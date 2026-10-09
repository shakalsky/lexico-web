import { config } from '../config';

export class ApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const UNREACHABLE = "Couldn't reach the Léxico API. Is lexico-api running on localhost:3000?";

/** A JSON `POST`. */
export function postJson(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/** A JSON `PATCH`. */
export function patchJson(body: unknown): RequestInit {
  return { ...postJson(body), method: 'PATCH' };
}

/** Sends the request and reads its JSON body, if any. Failed requests become an `ApiError`. */
async function send(path: string, init: RequestInit): Promise<{ response: Response; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
  } catch {
    throw new ApiError(UNREACHABLE);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    // lexico-api always explains errors in JSON. Anything else came from the
    // proxy in front of it, which is what a stopped API looks like in dev.
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : UNREACHABLE;
    throw new ApiError(message, response.status);
  }
  return { response, body };
}

/**
 * Calls the API and returns the value inside its response envelope, e.g. the
 * array in `{ "words": [ … ] }`. Failures become an `ApiError` worth showing.
 */
export async function request(path: string, envelope: string, init: RequestInit = {}): Promise<unknown> {
  const { response, body } = await send(path, init);
  if (!body || typeof body !== 'object' || !(envelope in body)) {
    throw new ApiError('The API sent a response this app does not understand.', response.status);
  }
  return (body as Record<string, unknown>)[envelope];
}

/**
 * A `DELETE`, answered with `204` and no body. It sends no body or
 * `Content-Type`, which the API rejects on a `DELETE`.
 */
export async function requestDelete(path: string): Promise<void> {
  await send(path, { method: 'DELETE' });
}
