// In dev the Vite proxy forwards /api to the backend. Override with VITE_API_URL if needed.
const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    throw new Error('Cannot reach the API. Is the backend running on port 4000?');
  }

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    // non-JSON response
  }

  if (!res.ok) {
    const error = new Error(data?.message || `Request failed (${res.status})`);
    error.details = data?.details;
    throw error;
  }
  return data;
}

export const scheduleEmail = (payload) => request('/emails', { method: 'POST', body: JSON.stringify(payload) });
export const listEmails = () => request('/emails');
export const getEmail = (id) => request(`/emails/${id}`);
export const cancelEmail = (id) => request(`/emails/${id}`, { method: 'DELETE' });

// Health returns 503 JSON when Redis is down; we still want that body.
export async function getHealth() {
  try {
    const res = await fetch(`${BASE}/health`);
    return await res.json();
  } catch (err) {
    return { status: 'unreachable', redis: 'unknown', worker: 'unknown' };
  }
}
