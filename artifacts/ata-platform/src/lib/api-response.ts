/** Fetch helpers that never hand a proxy/Cloudflare HTML page to res.json(). */

export async function readJsonOrThrow<T>(res: Response): Promise<T> {
  const type = res.headers.get('content-type') ?? '';
  if (!type.toLowerCase().includes('application/json')) {
    throw new Error('The server returned an unexpected response. Please try again shortly.');
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('The server returned an unexpected response. Please try again shortly.');
  }
}

export async function apiErrorMessage(res: Response): Promise<string> {
  if ((res.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    try {
      const body = await res.json();
      return body.error || body.message || 'Request failed. Please try again.';
    } catch { /* fall through */ }
  }
  return 'The server returned an unexpected response. Please try again shortly.';
}
