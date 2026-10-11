// API base: same origin on web (Vite proxy / reverse proxy); on Android set
// VITE_API_BASE at build time. The session token is kept in memory only.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';
let token: string | null = null;

export class ApiError extends Error {
  constructor(public status: number, public code: string, public body: unknown) {
    super(`${status} ${code}`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers });
  } catch {
    throw new ApiError(0, 'API_UNREACHABLE', null);
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string } | null)?.error ?? `HTTP_${res.status}`, body);
  return body as T;
}

export type Role = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER';
export interface Org { id: string; name: string; role: Role }
export interface Me { user: { id: string; email: string }; orgs: Org[]; repo: string }
export interface Snapshot {
  id: string; repo: string; fetch_status: 'OK' | 'PARTIAL' | 'ERROR';
  default_branch: string | null; head_sha: string | null;
  branches: { name: string; sha: string; protected?: boolean }[];
  commits: { sha: string; message: string; author: string | null; date: string | null; url: string }[];
  ci: { state?: string; checkRuns?: { name: string; status: string; conclusion: string | null; url: string }[] };
  error: { code: string; status: number; message: string } | null;
  rate_limit_remaining: number | null; fetched_at: string;
}
export interface AuditEvent { id: number; action: string; target: string | null; outcome: string; detail: Record<string, unknown>; created_at: string }

export const api = {
  async login(email: string, password: string) {
    const r = await request<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    token = r.token;
  },
  async logout() { try { await request('/api/auth/logout', { method: 'POST' }); } finally { token = null; } },
  me: () => request<Me>('/api/me'),
  latest: (orgId: string) => request<{ snapshot: Snapshot | null }>(`/api/orgs/${orgId}/snapshots/latest`),
  // 502 carries a persisted ERROR snapshot; surface it rather than throwing it away.
  async refresh(orgId: string): Promise<Snapshot> {
    try {
      return (await request<{ snapshot: Snapshot }>(`/api/orgs/${orgId}/snapshots`, { method: 'POST' })).snapshot;
    } catch (e) {
      if (e instanceof ApiError && e.status === 502) return (e.body as { snapshot: Snapshot }).snapshot;
      throw e;
    }
  },
  audit: (orgId: string) => request<{ events: AuditEvent[] }>(`/api/orgs/${orgId}/audit`),
};
