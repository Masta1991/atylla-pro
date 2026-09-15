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
let sessionGeneration = 0;
let cacheRevision = 0;
const pendingReads = new Map();
export const SESSION_STORAGE_KEY = 'atylla_session_v2';
let idleToken = null;
let idleExpiresAt = null;
let sessionId = null;
let sessionEmail = null;
let sessionRevision = 0;
let storageQueue = Promise.resolve();
let activityPromise = null;

function withSessionLock(work) {
  // Browser tabs share one refresh token. Serialize rotations and logout across
  // tabs where Web Locks is available; the local queue also covers native apps.
  const run = () => typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('atylla-session-v2', work) : work();
  const pending = storageQueue.then(run, run);
  storageQueue = pending.catch(() => {});
  return pending;
}

function sessionRecord() {
  return { access_token: authToken, refresh_token: refreshToken, idle_token: idleToken,
    idle_expires_at: idleExpiresAt, session_id: sessionId, email: sessionEmail,
    revision: sessionRevision };
}

async function persistSessionUnlocked(generation) {
  if (generation !== sessionGeneration) throw new Error('Sesja została zmieniona.');
  const record = sessionRecord();
  // One durable record: never save an access token with the previous refresh token.
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(record));
  if (generation !== sessionGeneration) throw new Error('Sesja została zmieniona.');
}

export async function saveAuthSession(data, email) {
  if (!data.access_token || !data.refresh_token || !data.idle_token || !data.session_id) {
    throw new Error('Serwer zwrócił niepełną sesję. Spróbuj zalogować się ponownie.');
  }
  setAuthToken(data.access_token, data.refresh_token, { ...data, email });
  const generation = sessionGeneration;
  try {
    await withSessionLock(() => persistSessionUnlocked(generation));
  } catch (error) {
    if (generation === sessionGeneration) clearAuthToken();
    throw error;
  }
}

export async function restoreAuthSession() {
  const generation = sessionGeneration;
  const text = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  if (generation !== sessionGeneration) return null;
  let saved = null;
  try { saved = text ? JSON.parse(text) : null; } catch {}
  if (!saved?.access_token || !saved?.refresh_token || !saved?.idle_token || !saved?.session_id) {
    // Old sessions lack the server-signed inactivity lease. Require one login on
    // upgrade instead of silently minting an unlimited bypass for old refresh tokens.
    clearAuthToken();
    return null;
  }
  if (saved.access_token !== authToken || saved.idle_token !== idleToken || saved.session_id !== sessionId) {
    setAuthToken(saved.access_token, saved.refresh_token, saved);
  }
  return saved;
}

export async function clearStoredSession() {
  clearAuthToken();
  await withSessionLock(async () => {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    for (const key of ['auth_token', 'refresh_token', 'auth_email']) await AsyncStorage.removeItem(key);
  });
}

async function expireSession() {
  // Clear visible identity immediately; a late callback must not log out a new login.
  const callback = onSessionExpired;
  const cleared = clearStoredSession();
  if (callback) callback();
  await cleared;
}

export function setSessionExpiredCallback(cb) {
  onSessionExpired = cb;
}

export function setAuthToken(token, rToken, lease = {}) {
  sessionGeneration += 1;
  authToken = token;
  refreshToken = rToken || null;
  idleToken = lease.idle_token || null;
  idleExpiresAt = lease.idle_expires_at || null;
  sessionId = lease.session_id || null;
  sessionEmail = lease.email || null;
  sessionRevision = lease.revision || 0;
  activityPromise = null;
  isRefreshing = false;
  refreshPromise = null;
  invalidateCache();
}

export function clearAuthToken() {
  sessionGeneration += 1;
  authToken = null;
  refreshToken = null;
  idleToken = null;
  idleExpiresAt = null;
  sessionId = null;
  sessionEmail = null;
  activityPromise = null;
  isRefreshing = false;
  refreshPromise = null;
  invalidateCache();
}

const headers = (token) => ({
  'Content-Type': 'application/json',
  ...(token && { Authorization: `Bearer ${token}` }),
  ...(token && idleToken && { 'X-Atylla-Session': idleToken }),
});

function request(path, options = {}) {
  const method = options.method || 'GET';
  if (path.startsWith('/auth/')) return performRequest(path, options);
  if (method !== 'GET') {
    invalidateCache();
    return performRequest(path, options).finally(() => invalidateCache());
  }
  const revision = cacheRevision;
  const key = `${sessionGeneration}|${revision}|${options.token || ''}|${path}`;
  if (!pendingReads.has(key)) {
    const pending = performRequest(path, options).then(data => {
      if (revision !== cacheRevision) throw new Error('Dane zostały zmienione. Odśwież widok.');
      return data;
    }).finally(() => pendingReads.delete(key));
    pendingReads.set(key, pending);
  }
  return pendingReads.get(key);
}

async function performRequest(path, options = {}) {
  const requestGeneration = sessionGeneration;
  const { token, method = 'GET', body } = options;
  const effectiveToken = token || authToken;
  const config = {
    method,
    headers: headers(effectiveToken),
    cache: 'no-store',
  };
  if (body) config.body = JSON.stringify(body);

  let res = await fetch(`${API_BASE}${path}`, config);
  if (requestGeneration !== sessionGeneration) throw new Error('Sesja została zmieniona.');

  let firstError = null;
  if (res.status === 401) firstError = await res.json().catch(() => ({}));
  if (firstError?.detail?.code === 'idle_session_expired') {
    await expireSession();
    throw new Error(firstError.detail.message);
  }

  if (res.status === 401 && refreshToken && path !== '/auth/login' && path !== '/auth/refresh') {
    const generation = sessionGeneration;
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = withSessionLock(async () => {
        if (generation !== sessionGeneration) throw new Error('Sesja została zmieniona.');
        const storedText = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        const stored = storedText ? JSON.parse(storedText) : null;
        if (sessionId && (!stored || stored.session_id !== sessionId)) throw new Error('Sesja została zmieniona.');
        if (stored && stored.session_id === sessionId && stored.revision > sessionRevision) {
          authToken = stored.access_token; refreshToken = stored.refresh_token;
          idleToken = stored.idle_token; idleExpiresAt = stored.idle_expires_at;
          sessionRevision = stored.revision;
          if (authToken !== effectiveToken) return authToken;
        }
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken, ...(idleToken && { idle_token: idleToken }) }),
        });
        if (generation !== sessionGeneration) throw new Error('Sesja została zmieniona.');
        if (refreshRes.ok) {
          const newData = await refreshRes.json();
          if (generation !== sessionGeneration) throw new Error('Sesja została zmieniona.');
          if (!newData.access_token || !newData.refresh_token) throw new Error('Odnowienie sesji chwilowo niedostępne. Spróbuj ponownie.');
          authToken = newData.access_token;
          refreshToken = newData.refresh_token;
          sessionRevision += 1;
          await persistSessionUnlocked(generation);
          return authToken;
        } else if (refreshRes.status === 401) {
          const error = new Error('Sesja wygasła. Zaloguj się ponownie.');
          error.sessionExpired = true;
          throw error;
        } else {
          throw new Error('Odnowienie sesji chwilowo niedostępne. Spróbuj ponownie.');
        }
      }).catch(async error => {
        // This runs after the cross-tab lock is released, so clearing cannot deadlock.
        if (error.sessionExpired && generation === sessionGeneration) await expireSession();
        throw error;
      }).finally(() => {
        if (generation === sessionGeneration) isRefreshing = false;
      });
    }

    try {
      const newToken = await refreshPromise;
      if (generation !== sessionGeneration) throw new Error('Sesja została zmieniona.');
      config.headers = headers(newToken);
      res = await fetch(`${API_BASE}${path}`, config);
      firstError = null;
    } catch (err) {
      throw err;
    }
  }

  if (requestGeneration !== sessionGeneration) throw new Error('Sesja została zmieniona.');
  if (!res.ok) {
    const err = firstError || await res.json().catch(() => ({ detail: res.statusText }));
    // Wygasla sesja bez mozliwosci odswiezenia (brak refresh tokenu albo
    // odswiezenie sie nie powiodlo): wymus wylogowanie na ekran Login
    // zamiast cichego pustego kalendarza.
    if (res.status === 401 && path !== '/auth/login' && (authToken || refreshToken)) {
      await expireSession();
      throw new Error(err.detail?.message || 'Sesja wygasła, zaloguj się ponownie.');
    }
    const error = new Error(err.detail?.message || err.detail || `HTTP ${res.status}`);
    error.status = res.status;
    error.code = err.detail?.code;
    throw error;
  }
  const data = res.status !== 204 ? await res.json() : null;
  if (requestGeneration !== sessionGeneration) throw new Error('Sesja została zmieniona.');
  return data;
}

export function noteUserActivity() {
  if (!authToken || !idleToken || (typeof document !== 'undefined' && document.hidden)) return Promise.resolve(false);
  if (activityPromise) return activityPromise;
  const generation = sessionGeneration;
  const pending = request('/auth/activity', { method: 'POST', body: {} }).then(async data => {
    if (generation !== sessionGeneration) throw new Error('Sesja została zmieniona.');
    if (!data.idle_token || data.session_id !== sessionId || !Number.isFinite(data.idle_expires_at)) {
      throw new Error('Nie udało się potwierdzić aktywności sesji.');
    }
    await withSessionLock(async () => {
      if (generation !== sessionGeneration) throw new Error('Sesja została zmieniona.');
      const storedText = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      const stored = storedText ? JSON.parse(storedText) : null;
      if (!stored || stored.session_id !== sessionId) throw new Error('Sesja została zmieniona.');
      if (generation !== sessionGeneration) throw new Error('Sesja została zmieniona.');
      if (stored.revision > sessionRevision) {
        authToken = stored.access_token; refreshToken = stored.refresh_token;
        idleToken = stored.idle_token; idleExpiresAt = stored.idle_expires_at;
        sessionRevision = stored.revision;
      }
      if (data.idle_expires_at >= idleExpiresAt) {
        idleToken = data.idle_token; idleExpiresAt = data.idle_expires_at;
      }
      sessionRevision += 1;
      await persistSessionUnlocked(generation);
    });
    return true;
  }).finally(() => { if (activityPromise === pending) activityPromise = null; });
  activityPromise = pending;
  return pending;
}

export function getClientPackages(clientId) {
  return request(`/clients/${clientId}/packages`);
}

export function createClientPackage(clientId, payload) {
  invalidateCache('clients');
  return request(`/clients/${clientId}/packages`, { method: 'POST', body: payload });
}

export async function hardResetClient(clientId, expectedUpdatedAt) {
  invalidateCache('clients');
  invalidateCache('calendar');
  return await request(`/clients/${clientId}/hard-reset`, { method: 'POST', body: { expected_updated_at: expectedUpdatedAt } });
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
let clientsCacheAt = 0;
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
  cacheRevision += 1;
  if (!type && typeof global !== 'undefined') {
    global.cachedWorkoutTypes = null;
    global.cachedWorkoutTypesMap = null;
    global.cachedExercisesByGroup = null;
  }
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
  if (clientsCache && !force && Date.now() - clientsCacheAt < TRAINING_CACHE_TTL_MS) return clientsCache;
  const res = await request('/clients/');
  clientsCache = res;
  clientsCacheAt = Date.now();
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

export function getAbsences(dateFrom, dateTo) {
  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  return request(`/calendar/absences?${params}`);
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

export async function getCalendarEvent(date, hour, includeDeleted = false, force = false) {
  const key = `${date}|${hour}|${includeDeleted}`;
  const cached = calendarEventCache[key];
  if (!force && isFresh(cached)) return cached.data;
  const res = await request(`/calendar/${date}/${hour}${includeDeleted ? '?include_deleted=true' : ''}`);
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

export function getCalendarEvents(dateFrom, dateTo, clientId, billing = true, includeDeleted = false) {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  if (clientId) params.append('client_id', clientId);
  if (!billing) params.append('billing', 'false');
  if (includeDeleted) params.append('include_deleted', 'true');
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

export async function getClientWorkouts(clientId, date, calendarEventId) {
  const key = `${clientId}|${date || ''}|${calendarEventId || ''}`;
  const cached = clientWorkoutsCache[key];
  if (isFresh(cached)) return cached.data;
  const params = new URLSearchParams();
  if (date) params.set('session_date', date);
  if (calendarEventId) params.set('calendar_event_id', calendarEventId);
  const res = await request(`/workouts/client/${clientId}?${params}`);
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
  if (isFresh(historyCache[clientId])) return historyCache[clientId].data;
  const res = await request(`/workouts/client/${clientId}/history`);
  historyCache[clientId] = {data: res, ts: Date.now()};
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
    expected_event_id: data.expected_event_id || null,
    expected_updated_at: data.expected_updated_at || null,
    reactivate: !!data.reactivate,
    confirm_duplicate: !!data.confirm_duplicate,
    exercises: data.exercises || [],
  };
  return request('/calendar/save-workout', {method: 'POST', body: calendarPayload});
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

export function getTrainerOverview(year, month, clientId = '') {
  return request(`/trainer/overview?year=${year}&month=${month}${clientId ? `&client_id=${encodeURIComponent(clientId)}` : ''}`);
}
export function getManagerData(source) {
  return request(`/trainer/manager?source=${source}`);
}
export function previewWeekCopy(data) {
  return request('/trainer/copy-preview', {method:'POST',body:data});
}
export async function commitWeekCopy(data) {
  try { return await request('/trainer/copy', {method:'POST',body:data}); }
  finally { invalidateCache('calendar'); invalidateCache('clients'); invalidateCache('workouts'); }
}
