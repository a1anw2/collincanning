/** Admin API client with HTTP Basic Auth (fetch does not trigger browser auth dialogs). */

const STORAGE_KEY = 'cannery-admin-auth';

export function getAdminAuthHeader(): string | null {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored;
}

export function setAdminCredentials(username: string, password: string): void {
  const encoded = btoa(`${username}:${password}`);
  sessionStorage.setItem(STORAGE_KEY, `Basic ${encoded}`);
}

export function clearAdminCredentials(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function adminFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const auth = getAdminAuthHeader();
  const headers = new Headers(init.headers);
  if (auth) {
    headers.set('Authorization', auth);
  }
  return fetch(input, { ...init, headers });
}

export async function checkAdminAuth(): Promise<boolean> {
  const res = await adminFetch('/api/admin/sim/status');
  return res.ok;
}
