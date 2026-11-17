/** Cliente HTTP del frontend. El token de acceso vive solo en memoria; el refresh token en cookie httpOnly. */
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => (accessToken = t);
export const getAccessToken = () => accessToken;
export const setSessionLostHandler = (fn: () => void) => (onSessionLost = fn);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function refreshSession(): Promise<any | null> {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) return null;
  const data = await res.json();
  accessToken = data.accessToken;
  return data;
}

async function tryRefresh() {
  refreshing ??= refreshSession()
    .then((d) => Boolean(d))
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`/api${path}`, { ...init, headers, body, credentials: 'same-origin' });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return api<T>(path, init, false);
    onSessionLost?.();
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const data = await res.json();
      msg = Array.isArray(data.message) ? data.message.join('. ') : data.message ?? msg;
    } catch {
      /* respuesta sin JSON */
    }
    if (res.status === 429) msg = 'Demasiadas solicitudes. Espere un momento e intente de nuevo.';
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
