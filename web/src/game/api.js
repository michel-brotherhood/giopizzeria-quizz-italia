// Cliente HTTP mínimo. Nunca envia score/elegibilidade; o servidor é a autoridade.

export class ApiError extends Error {
  constructor({ status = 0, code = 'NETWORK', message = 'Sem conexão com o servidor.', details } = {}) {
    super(message);
    this.status = status; this.code = code; this.details = details;
    this.network = code === 'NETWORK' || code === 'TIMEOUT';
  }
}

export async function api(path, { method = 'GET', body, headers = {}, timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch (e) {
    throw new ApiError({ code: e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' });
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch { /* corpo vazio */ }
  if (!res.ok) {
    if (res.status >= 502 && res.status <= 504 && !data?.error) throw new ApiError({ status: res.status, code: 'NETWORK' });
    throw new ApiError({ status: res.status, ...(data?.error ?? { code: 'HTTP_' + res.status, message: 'Algo não saiu como esperado.' }) });
  }
  return data;
}

export function newKey() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
