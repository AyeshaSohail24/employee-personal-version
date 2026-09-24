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

// MICROAPP_PERFORMANCE.md §2/§8, applied in the browser: every tab mounts fresh and refetches
// everything it needs, so moving Personnel -> Dashboard -> Onboarding and back re-paid the same
// roster fetch (including a ~0.5-1s live Interns DB call behind it) every single time, and
// several components on one page fired the same GET at once. A GET is now shared while in flight
// and reused for a short window. Kept deliberately safe:
//  - lives in this tab's memory only, so a full browser refresh always starts from nothing;
//  - any write (POST/PATCH/PUT/DELETE) clears it, so your own changes always show immediately;
//  - `{ fresh: true }` bypasses it (Sync Personnel uses this, then clears everything);
//  - never used for the session check or live candidate message threads;
//  - each caller gets its own copy, so one page mutating a response can't corrupt another's.
const GET_CACHE_TTL_MS = 30_000;
const NEVER_CACHE = [/^\/session(\/|$)/, /^\/candidates\/[^/]+\/messages/];
const getCache = new Map(); // path -> { at, promise }

function cachedGet(path, { fresh = false } = {}) {
  if (NEVER_CACHE.some((pattern) => pattern.test(path))) return request(path, { method: 'GET' });

  const hit = getCache.get(path);
  if (!fresh && hit && Date.now() - hit.at < GET_CACHE_TTL_MS) return hit.promise.then(structuredClone);

  const promise = request(path, { method: 'GET' });
  getCache.set(path, { at: Date.now(), promise });
  // A failed request must not be served back to the next caller.
  promise.catch(() => {
    if (getCache.get(path)?.promise === promise) getCache.delete(path);
  });
  return promise.then(structuredClone);
}

async function write(path, options) {
  try {
    return await request(path, options);
  } finally {
    // Cleared whether the write succeeded or not — a failed response can still mean the server
    // applied part of it, so nothing read before it can be trusted afterwards.
    getCache.clear();
  }
}

export const apiClient = {
  get: (path, options) => cachedGet(path, options),
  post: (path, data) => write(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  patch: (path, data) => write(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  put: (path, data) => write(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  delete: (path) => write(path, { method: 'DELETE' }),
  invalidate: () => getCache.clear(),
};
