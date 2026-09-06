import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://atylla-pro-production.up.railway.app';
// const API_BASE = 'http://127.0.0.1:8000';

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

// ── In-Memory Mock Database for Offline Demo Mode ───────────────────────────


// ── Auth ────────────────────────────────────────────────────────────────────
let clientsCache = null;
let workoutTypesCache = null;
let muscleGroupsCache = null;
let exercisesGroupedCache = null;

export function invalidateCache(type) {
  if (!type || type === 'clients') {
    clientsCache = null;
    if (typeof global !== 'undefined') global.cachedClients = null;
  }
  if (!type || type === 'workoutTypes') workoutTypesCache = null;
  if (!type || type === 'muscleGroups') muscleGroupsCache = null;
  if (!type || type === 'exercisesGrouped') exercisesGroupedCache = null;
  historyCache = {};
}

export function login(email, password) {
  
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

// ── Clients ─────────────────────────────────────────────────────────────────

export async function getClients() {
  
  if (clientsCache) return clientsCache;
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

export function getCalendarEvent(date, hour) {
  
  return request(`/calendar/${date}/${hour}`);
}

export function createCalendarEvent(data) {
  
  return request('/calendar/', { method: 'POST', body: data });
}

export function replaceWeekEvents(data) {
  return request('/calendar/replace-week', { method: 'POST', body: data });
}

export function clearWeekEvents(mondayDate) {
  return request(`/calendar/clear-week/${mondayDate}`, { method: 'DELETE' });
}

export function swapEvents(data) {
  
  return request('/calendar/swap', { method: 'POST', body: data });
}

export function updateCalendarEvent(date, hour, data) {
  
  return request(`/calendar/${date}/${hour}`, { method: 'PUT', body: data });
}

export function deleteCalendarEvent(date, hour) {
  
  return request(`/calendar/${date}/${hour}`, { method: 'DELETE' });
}

export function getCalendarStats(months) {
  return request(`/calendar/stats?months=${months}`);
}

export function getCalendarEvents(dateFrom, dateTo, clientId) {
  let query = '?';
  if (dateFrom) query += `date_from=${dateFrom}&`;
  if (dateTo) query += `date_to=${dateTo}&`;
  if (clientId) query += `client_id=${clientId}`;
  return request(`/calendar/${query}`);
}

export function settleWorkout(date, hour) {
  invalidateCache('clients');
  return request(`/calendar/${date}/${hour}/settle`, { method: 'POST' });
}

export function getDaySummary(day) {
  return request(`/day/summary/${day}`);
}

export function approveDay(day, decisions) {
  invalidateCache('clients');
  return request('/day/approve', { method: 'POST', body: { day, decisions } });
}



// ── Workouts ────────────────────────────────────────────────────────────────

export function getClientWorkouts(clientId, date) {
  
  const params = date ? `?session_date=${date}` : '';
  return request(`/workouts/client/${clientId}${params}`);
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

export function getPlans() {
  
  return request('/config/plans');
}

export function createPlan(data) {
  
  return request('/config/plans', { method: 'POST', body: data });
}

export function deletePlan(id) {
  
  return request(`/config/plans/${id}`, { method: 'DELETE' });
}

export function getPlanExercises(planId) {
  
  return request(`/config/plans/${planId}/exercises`);
}

export function addExerciseToPlan(planId, data) {
  return request(`/config/plans/${planId}/exercises`, { method: 'POST', body: data });
}

export function updatePlanExercise(planExerciseId, data) {
  return request(`/config/plan-exercises/${planExerciseId}`, { method: 'PUT', body: data });
}

export function removeExerciseFromPlan(planExerciseId) {
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
