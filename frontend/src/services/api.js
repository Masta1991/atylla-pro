import AsyncStorage from '@react-native-async-storage/async-storage';

// API_BASE (T3): jawna konfiguracja środowiska.
// EXPO_PUBLIC_API_URL ma pierwszeństwo (wstrzyknięte w buildzie).
// Bez niego: dev -> lokalny backend 8000, prod build -> Railway.
// PWA MUSI być budowana ze jawnym EXPO_PUBLIC_API_URL, inaczej gotowy bundle
// wskazuje prod (to był błąd ENV-01/STATIC-ENV-01 w audycie 2.0).
const SANDBOX_API_URL = 'http://127.0.0.1:8000';
const PROD_API_URL = 'https://atylla-pro-production.up.railway.app';
function resolveApiBase() {
  try {
    const fromEnv = typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL;
    if (fromEnv) return fromEnv;
  } catch (e) {}
  if (typeof __DEV__ !== 'undefined' && __DEV__) return SANDBOX_API_URL;
  return PROD_API_URL;
}
const API_BASE = resolveApiBase();

export function getApiBase() {
  return API_BASE;
}

let authToken = null;
let refreshToken = null;
let isRefreshing = false;
let refreshPromise = null;
let onSessionExpired = null;

export function setSessionExpiredCallback(cb) {
  onSessionExpired = cb;
}

export function setAuthToken(token, rToken) {
  authToken = token;
  if (rToken) refreshToken = rToken;
}

export function clearAuthToken() {
  authToken = null;
  refreshToken = null;
}

const headers = (token) => ({
  'Content-Type': 'application/json',
  ...(token && { Authorization: `Bearer ${token}` }),
});

async function request(path, options = {}) {
  const { token, method = 'GET', body } = options;
  const effectiveToken = token || authToken;
  const config = {
    method,
    headers: headers(effectiveToken),
    cache: 'no-store',
  };
  if (body) config.body = JSON.stringify(body);

  let res = await fetch(`${API_BASE}${path}`, config);

  if (res.status === 401 && refreshToken && !path.startsWith('/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = fetch(`${API_BASE}/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(async (refreshRes) => {
        if (refreshRes.ok) {
          const newData = await refreshRes.json();
          authToken = newData.access_token;
          refreshToken = newData.refresh_token;
          await AsyncStorage.setItem('auth_token', authToken);
          await AsyncStorage.setItem('refresh_token', refreshToken);
          return authToken;
        } else {
          clearAuthToken();
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('refresh_token');
          if (onSessionExpired) onSessionExpired();
          throw new Error('Session expired');
        }
      }).finally(() => {
        isRefreshing = false;
      });
    }

    try {
      const newToken = await refreshPromise;
      config.headers = headers(newToken);
      res = await fetch(`${API_BASE}${path}`, config);
    } catch (err) {
      throw new Error("Session expired, please log in again.");
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    // Wygasla sesja bez mozliwosci odswiezenia (brak refresh tokenu albo
    // odswiezenie sie nie powiodlo): wymus wylogowanie na ekran Login
    // zamiast cichego pustego kalendarza.
    if ((res.status === 401 || res.status === 403) && !path.startsWith('/auth/') && (authToken || refreshToken)) {
      clearAuthToken();
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('refresh_token');
      if (onSessionExpired) onSessionExpired();
      throw new Error('Sesja wygasla, zaloguj sie ponownie.');
    }
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.status !== 204 ? res.json() : null;
}

export function getClientPackages(clientId) {
  return request(`/clients/${clientId}/packages`);
}

export function createClientPackage(clientId, payload) {
  invalidateCache('clients');
  return request(`/clients/${clientId}/packages`, { method: 'POST', body: payload });
}

export async function hardResetClient(clientId) {
  invalidateCache('clients');
  return await request(`/clients/${clientId}/hard-reset`, { method: 'POST' });
}

export function endClientPackage(packageId, payload) {
  invalidateCache('clients');
  return request(`/clients/packages/${packageId}`, { method: 'PUT', body: payload });
}

export function deleteClientPackage(packageId) {
  invalidateCache('clients');
  return request(`/clients/packages/${packageId}`, { method: 'DELETE' });
}

export function closeClientCycle(clientId, payload) {
  // T9: domknięcie cyklu miesięcznego — liczy backend (start..koniec),
  // frontend nie kopiuje bieżącego licznika.
  invalidateCache('clients');
  invalidateCache('calendar');
  return request(`/clients/${clientId}/close-cycle`, { method: 'POST', body: payload });
}

// 2.0: start/koniec pakietu z szuflady kalendarza (solo; wspoldzielone w Rozliczeniach).
export function startPackageAt(clientId, payload) {
  invalidateCache('clients');
  return request(`/clients/${clientId}/packages/start-at`, { method: 'POST', body: payload });
}

export function endPackageAt(clientId, payload) {
  invalidateCache('clients');
  return request(`/clients/${clientId}/packages/end-at`, { method: 'POST', body: payload });
}

// ── Cache słowników + danych treningu (stale-while-revalidate) ───────────────


// ── Auth ────────────────────────────────────────────────────────────────────
let clientsCache = null;
let workoutTypesCache = null;
let muscleGroupsCache = null;
let exercisesGroupedCache = null;
// Cache danych treningu: słowniki dynamiczne + eventy + logi (krótki TTL, SWR).
let plansCache = null;
let planExercisesCache = {};
let calendarEventCache = {};
let clientWorkoutsCache = {};
const TRAINING_CACHE_TTL_MS = 30000;

function isFresh(entry) {
  return entry && (Date.now() - entry.ts) < TRAINING_CACHE_TTL_MS;
}

export function invalidateCache(type) {
  if (!type || type === 'clients') {
    clientsCache = null;
    if (typeof global !== 'undefined') global.cachedClients = null;
  }
  if (!type || type === 'workoutTypes') workoutTypesCache = null;
  if (!type || type === 'muscleGroups') muscleGroupsCache = null;
  if (!type || type === 'exercisesGrouped') exercisesGroupedCache = null;
  if (!type || type === 'plans') {
    plansCache = null;
    planExercisesCache = {};
  }
  if (!type || type === 'calendar') calendarEventCache = {};
  if (!type || type === 'workouts') clientWorkoutsCache = {};
  try { historyCache = {}; } catch {}
}

// Prefetch słowników w tle (nie blokuje UI, błędy ignorowane).
export function prefetchTrainingDicts() {
  getClients().catch(() => {});
  getWorkoutTypes().catch(() => {});
  getMuscleGroups().catch(() => {});
  getExercisesGrouped().catch(() => {});
  getPlans().catch(() => {});
}

// Prefetch konkretnego slotu kalendarza (wywoływane przy otwarciu szuflady).
export function prefetchCalendarEvent(date, hour) {
  if (!date || hour == null) return;
  getCalendarEvent(date, hour).catch(() => {});
}

export function login(email, password) {
  
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

// ── Clients ─────────────────────────────────────────────────────────────────

// FIX 2026-09-07 (Ania: baza ma date 02.09 od 09:15, apka o 11:56 "brak daty"):
// cache klientow nie mial TTL ani odswiezania w tle — zapis z innej sesji
// (drugie urzadzenie/web) byl niewidoczny az do restartu/reloginu, a nawet
// reczne przeciagniecie (RefreshControl) trafialo w ten sam cache.
// Ekrany z danymi rozliczeniowymi wymuszaja swieze pobranie (force=true).
export async function getClients(force = false) {
  if (clientsCache && !force) return clientsCache;
  const res = await request('/clients/');
  clientsCache = res;
  return res;
}

export function getClient(id) {
  
  return request(`/clients/${id}`);
}

export function createClient(data) {
  
  invalidateCache('clients');
  return request('/clients/', { method: 'POST', body: data });
}

export function updateClient(id, data) {
  
  invalidateCache('clients');
  return request(`/clients/${id}`, { method: 'PUT', body: data });
}

export function deleteClient(id) {
  invalidateCache('clients');
  return request(`/clients/${id}`, { method: 'DELETE' });
}


// ── Calendar ────────────────────────────────────────────────────────────────

export function getAbsences(dateFrom) {
  const query = dateFrom ? `?date_from=${dateFrom}` : '';
  return request(`/calendar/absences${query}`);
}

export function createAbsence(data) {
  return request('/calendar/absences', { method: 'POST', body: data });
}

export function deleteAbsence(id) {
  return request(`/calendar/absences/${id}`, { method: 'DELETE' });
}

export function getWeekEvents(mondayDate) {
  
  return request(`/calendar/week/${mondayDate}`);
}

export async function getCalendarEvent(date, hour) {
  const key = `${date}|${hour}`;
  const cached = calendarEventCache[key];
  if (isFresh(cached)) return cached.data;
  const res = await request(`/calendar/${date}/${hour}`);
  calendarEventCache[key] = { data: res, ts: Date.now() };
  return res;
}

export async function createCalendarEvent(data) {
  invalidateCache('calendar');
  if (data?.client_id) invalidateCache('workouts');
  return request('/calendar/', { method: 'POST', body: data });
}

export function replaceWeekEvents(data) {
  return request('/calendar/replace-week', { method: 'POST', body: data });
}

export function clearWeekEvents(mondayDate) {
  return request(`/calendar/clear-week/${mondayDate}`, { method: 'DELETE' });
}

export function swapEvents(data) {
  invalidateCache('calendar');
  invalidateCache('workouts');
  invalidateCache('clients');
  return request('/calendar/swap', { method: 'POST', body: data });
}

export function updateCalendarEvent(date, hour, data) {
  invalidateCache('calendar');
  if (data?.client_id) invalidateCache('workouts');
  return request(`/calendar/${date}/${hour}`, { method: 'PUT', body: data });
}

export function deleteCalendarEvent(date, hour) {
  // Usuń = TWARDE usunięcie wiersza (przypadek/test). Licznik pakietu
  // przelicza się sam; kotwica aktywnego pakietu → 400 (przepływ delete-start).
  invalidateCache('calendar');
  invalidateCache('workouts');
  invalidateCache('clients');
  return request(`/calendar/${date}/${hour}`, { method: 'DELETE' });
}

export function deletePackageStart(date, hour, body) {
  // Usunięcie początku pakietu: probe (sonda) / cancel (anuluj pakiet)
  // / repoint (nowy początek). Backend liczy przyszłe treningi pakietu.
  invalidateCache('calendar');
  invalidateCache('workouts');
  invalidateCache('clients');
  return request(`/calendar/${date}/${hour}/delete-start`, { method: 'POST', body });
}

export function getCalendarStats(months) {
  return request(`/calendar/stats?months=${months}`);
}

export function getCalendarEvents(dateFrom, dateTo, clientId) {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  if (clientId) params.append('client_id', clientId);
  const qs = params.toString();
  return request(`/calendar/${qs ? `?${qs}` : ''}`);
}

export function settleWorkout(date, hour) {
  // 2.0: prymityw "oplacone" — tylko sciezka platnego odwolania (usuniecie /
  // nieobecnosc z platnoscia). Brak UI do rozliczania odbytych treningow.
  invalidateCache('clients');
  invalidateCache('calendar');
  return request(`/calendar/${date}/${hour}/settle`, { method: 'POST' });
}

// DayClose usuniety w 2.0 (decyzja 2026-09-07) — brak getDaySummary/approveDay.



// ── Workouts ────────────────────────────────────────────────────────────────

export async function getClientWorkouts(clientId, date) {
  const key = `${clientId}|${date || ''}`;
  const cached = clientWorkoutsCache[key];
  if (isFresh(cached)) return cached.data;
  const params = date ? `?session_date=${date}` : '';
  const res = await request(`/workouts/client/${clientId}${params}`);
  clientWorkoutsCache[key] = { data: res, ts: Date.now() };
  return res;
}

let historyCache = {};

export function invalidateHistoryCache(clientId) {
  if (clientId) {
    delete historyCache[clientId];
  } else {
    historyCache = {};
  }
}

export async function getClientHistory(clientId) {
  
  if (historyCache[clientId]) return historyCache[clientId];
  const res = await request(`/workouts/client/${clientId}/history`);
  historyCache[clientId] = res;
  return res;
}

export async function saveWorkoutBatch(data) {
  invalidateHistoryCache(data.client_id);
  invalidateCache('workouts');
  return request('/workouts/batch', { method: 'POST', body: data });
}

export async function saveCalendarWorkout(data) {
  const calendarPayload = {
    event_date: data.event_date,
    event_hour: data.event_hour,
    client_id: data.client_id,
    partner_client_id: data.partner_client_id || null,
    workout_type_id: data.workout_type_id || null,
    plan_id: data.plan_id || null,
    status: 'active',
    is_settled: !!data.is_settled,
    note: data.note,
    main_group: data.main_group,
    added_groups: data.added_groups,
    is_replacement: !!data.is_replacement,
    replaced_client_id: data.replaced_client_id || null,
  };
  await createCalendarEvent(calendarPayload);

  // Zapis bez ćwiczeń: sam wpis w kalendarzu, logów nie ruszamy
  // (ani nie dopisujemy, ani nie czyścimy — czyszczenie robi Usuń).
  if (!data.exercises || data.exercises.length === 0) return [];

  const batchPayload = {
    client_id: data.client_id,
    session_date: data.event_date,
    week_number: 1,
    logs: data.exercises.map(ex => ({
      client_id: data.client_id,
      exercise_id: ex.exercise_id,
      weight_kg: ex.weight_kg,
      reps: ex.reps,
      week_number: 1,
      session_date: data.event_date,
    })),
  };
  return saveWorkoutBatch(batchPayload);
}

// ── Measurements ────────────────────────────────────────────────────────────

export function getMeasurements(clientId) {
  
  return request(`/measurements/?client_id=${clientId}`);
}

export function createMeasurement(data) {
  
  return request('/measurements/', { method: 'POST', body: data });
}

export function updateMeasurement(id, data) {
  
  return request(`/measurements/${id}`, { method: 'PUT', body: data });
}

export function deleteMeasurement(id) {
  
  return request(`/measurements/${id}`, { method: 'DELETE' });
}

// ── Config ──────────────────────────────────────────────────────────────────

export async function getWorkoutTypes() {
  
  if (workoutTypesCache) return workoutTypesCache;
  const res = await request('/config/workout-types');
  workoutTypesCache = res;
  return res;
}

export async function getMuscleGroups() {
  
  if (muscleGroupsCache) return muscleGroupsCache;
  const res = await request('/config/muscle-groups');
  muscleGroupsCache = res;
  return res;
}

export function getExercises(muscleGroupId) {
  
  const params = muscleGroupId ? `?muscle_group_id=${muscleGroupId}` : '';
  return request(`/config/exercises${params}`);
}

export async function getExercisesGrouped() {
  
  if (exercisesGroupedCache) return exercisesGroupedCache;
  const res = await request('/config/exercises/by-group');
  exercisesGroupedCache = res;
  return res;
}

export async function getPlans() {
  if (isFresh(plansCache)) return plansCache.data;
  const res = await request('/config/plans');
  plansCache = { data: res, ts: Date.now() };
  return res;
}

export function createPlan(data) {
  invalidateCache('plans');
  return request('/config/plans', { method: 'POST', body: data });
}

export function deletePlan(id) {
  invalidateCache('plans');
  return request(`/config/plans/${id}`, { method: 'DELETE' });
}

export async function getPlanExercises(planId) {
  const cached = planExercisesCache[planId];
  if (isFresh(cached)) return cached.data;
  const res = await request(`/config/plans/${planId}/exercises`);
  planExercisesCache[planId] = { data: res, ts: Date.now() };
  return res;
}

export function addExerciseToPlan(planId, data) {
  delete planExercisesCache[planId];
  return request(`/config/plans/${planId}/exercises`, { method: 'POST', body: data });
}

export function updatePlanExercise(planExerciseId, data) {
  planExercisesCache = {};
  return request(`/config/plan-exercises/${planExerciseId}`, { method: 'PUT', body: data });
}

export function removeExerciseFromPlan(planExerciseId) {
  planExercisesCache = {};
  return request(`/config/plan-exercises/${planExerciseId}`, { method: 'DELETE' });
}

export function sendReportEmail(data) {
  
  return request('/email/send-report', { method: 'POST', body: data });
}

export function sendPlanEmail(data) {
  
  return request('/email/send-plan', { method: 'POST', body: data });
}

export function createWorkoutType(name) {
  
  invalidateCache('workoutTypes');
  return request('/config/workout-types', { method: 'POST', body: { name } });
}

export function deleteWorkoutType(id) {
  
  invalidateCache('workoutTypes');
  return request(`/config/workout-types/${id}`, { method: 'DELETE' });
}

export function createMuscleGroup(name) {
  
  invalidateCache('muscleGroups');
  invalidateCache('exercisesGrouped');
  return request('/config/muscle-groups', { method: 'POST', body: { name } });
}

export function deleteMuscleGroup(id) {
  
  invalidateCache('muscleGroups');
  invalidateCache('exercisesGrouped');
  return request(`/config/muscle-groups/${id}`, { method: 'DELETE' });
}

export function createExercise(data) {
  
  invalidateCache('exercisesGrouped');
  return request('/config/exercises', { method: 'POST', body: data });
}

export function deleteExercise(id) {
  
  invalidateCache('exercisesGrouped');
  return request(`/config/exercises/${id}`, { method: 'DELETE' });
}

export function updateExercise(id, data) {
  invalidateCache('exercisesGrouped');
  return request(`/config/exercises/${id}`, { method: 'PUT', body: data });
}

// ── Panel klienta 1.7 (lokalnie, bez migracji) ─────────────────────────────
// Prywatny trening = workout_logs bez eventu kalendarza tego dnia.
// Trening z trenerem = dzien z eventem kalendarza (client_id) — eventy sa SSOT.

export async function getClientSourceMap(clientId, dateFrom, dateTo) {
  // Zwraca { trainerDates: Set<string>, privateDates: string[], sessionsByDate: {} }
  const [history, events] = await Promise.all([
    getClientHistory(clientId).catch(() => []),
    getCalendarEvents(dateFrom, dateTo, clientId).catch(() => []),
  ]);
  const trainerDates = new Set(
    (events || [])
      .filter(e => e.status !== 'deleted')
      .map(e => e.event_date)
  );
  const sessionsByDate = {};
  (history || []).forEach(w => {
    const d = w.session_date;
    if (!sessionsByDate[d]) sessionsByDate[d] = [];
    sessionsByDate[d].push(w);
  });
  const privateDates = Object.keys(sessionsByDate).filter(d => !trainerDates.has(d));
  return { trainerDates, privateDates, sessionsByDate, history: history || [], events: events || [] };
}

export function classifySessionDate(sessionDate, trainerDates) {
  return trainerDates.has(sessionDate) ? 'trainer' : 'private';
}

// 2.0: podsumowanie tygodnia (Strefa Trenera) — wszystkie statusy + absencje.
export function getWeekSummary(mondayDate) {
  return request(`/calendar/week-summary/${mondayDate}`);
}
