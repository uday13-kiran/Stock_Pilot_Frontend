const API_ROOT = (import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
export const API_PREFIX = `${API_ROOT}/api/v1`;
export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.name='ApiError'; this.status=status; this.details=details; }
}
export async function api(path, options={}) {
  const token = sessionStorage.getItem('stockpiolet_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type','application/json');
  let response;
  try { response = await fetch(`${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`, {...options, cache:options.cache||'no-store', headers}); }
  catch (e) { throw new ApiError(import.meta.env.DEV?'Could not reach FastAPI through the Vite /api proxy. Check that the backend is running at the configured API target.':`Could not reach the API at ${API_ROOT}. Check that FastAPI is running and that its CORS origins include this frontend.`, 0); }
  if (response.status === 204) return null;
  const raw = await response.text();
  let payload = null;
  if (raw) { try { payload=JSON.parse(raw); } catch { payload=raw; } }
  if (!response.ok) {
    const detail = payload?.detail;
    const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(x=>`${x.loc?.join('.')||'Field'}: ${x.msg}`).join('; ') : payload?.message || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }
  return payload;
}
export const apiGet = path => api(path);
export const apiPost = (path, body) => api(path,{method:'POST',body:JSON.stringify(body)});
export const apiPut = (path, body) => api(path,{method:'PUT',body:JSON.stringify(body)});
export const apiPatch = (path, body) => api(path,{method:'PATCH',body:JSON.stringify(body)});
export const apiDelete = path => api(path,{method:'DELETE'});
