// API configuration — change this to your FastAPI backend URL
const API_BASE = 'https://atylla-pro-production.up.railway.app';

const headers = (token) => ({
  'Content-Type': 'application/json',
  ...(token && { Authorization: `Bearer ${token}` }),
});

async function request(path, options = {}) {
  const { token, method = 'GET', body } = options;
  const config = {
    method,
    headers: headers(token),
  };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.status !== 204 ? res.json() : null;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

// ── Clients ─────────────────────────────────────────────────────────────────

export async function getClients() {
  return request('/clients/');
}

export function getClient(id) {
  return request(`/clients/${id}`);
}

export function createClient(data) {
  return request('/clients/', { method: 'POST', body: data });
}

export function updateClient(id, data) {
  return request(`/clients/${id}`, { method: 'PUT', body: data });
}

export function deleteClient(id) {
  return request(`/clients/${id}`, { method: 'DELETE' });
}

// ── Calendar ────────────────────────────────────────────────────────────────

export function getWeekEvents(mondayDate) {
  return request(`/calendar/week/${mondayDate}`);
}

export function getCalendarEvent(date, hour) {
  return request(`/calendar/${date}/${hour}`);
}

export function createCalendarEvent(data) {
  return request('/calendar/', { method: 'POST', body: data });
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

// ── Workouts ────────────────────────────────────────────────────────────────

export function getClientWorkouts(clientId, date) {
  const params = date ? `?session_date=${date}` : '';
  return request(`/workouts/client/${clientId}${params}`);
}

export function getClientHistory(clientId) {
  return request(`/workouts/client/${clientId}/history`);
}

export function saveWorkoutBatch(data) {
  return request('/workouts/batch', { method: 'POST', body: data });
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

export function getWorkoutTypes() {
  return request('/config/workout-types');
}

export function getMuscleGroups() {
  return request('/config/muscle-groups');
}

export function getExercises(muscleGroupId) {
  const params = muscleGroupId ? `?muscle_group_id=${muscleGroupId}` : '';
  return request(`/config/exercises${params}`);
}

export function getExercisesGrouped() {
  return request('/config/exercises/by-group');
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

export function sendReportEmail(data) {
  return request('/email/send-report', { method: 'POST', body: data });
}

export function sendPlanEmail(data) {
  return request('/email/send-plan', { method: 'POST', body: data });
}

export function createWorkoutType(name) {
  return request('/config/workout-types', { method: 'POST', body: { name } });
}

export function deleteWorkoutType(id) {
  return request(`/config/workout-types/${id}`, { method: 'DELETE' });
}

export function createMuscleGroup(name) {
  return request('/config/muscle-groups', { method: 'POST', body: { name } });
}

export function deleteMuscleGroup(id) {
  return request(`/config/muscle-groups/${id}`, { method: 'DELETE' });
}

export function createExercise(data) {
  return request('/config/exercises', { method: 'POST', body: data });
}

export function deleteExercise(id) {
  return request(`/config/exercises/${id}`, { method: 'DELETE' });
}
