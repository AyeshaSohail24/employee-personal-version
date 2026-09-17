// Thin fetch wrapper for src/services/* — relative paths only (this app and
// its API share one origin/deployment, see vercel.json), the session cookie
// goes along automatically via `credentials: 'include'`. A 401 means the
// gateway session ended (or was never started) — the app has no sign-out/
// sign-in UI of its own (MICROAPP_AUTH.md), so the only correct response is
// to send the browser to the gateway, exactly like the backend's own
// unauthenticated-page redirect would if Vercel's routing didn't bypass it
// for a real page load.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed with status ${status}`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    window.location.href = '/auth/login';
    throw new ApiError(401, null);
  }

  if (response.status === 204) return null;

  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, body);
  return body;
}

export const apiClient = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
