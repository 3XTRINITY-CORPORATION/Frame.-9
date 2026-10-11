// Server-side, read-only GitHub adapter. The token (optional) comes only from
// server env and is never returned to callers or written to the database.
const API = 'https://api.github.com';
// owner: GitHub login rules; repo: no '.'/'..' segments (no path traversal).
const REPO_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;

export class GitHubError extends Error {
  constructor(code, status, message, rateLimit) {
    super(message);
    this.code = code;
    this.status = status;
    this.rateLimit = rateLimit;
  }
  toJSON() {
    return { code: this.code, status: this.status, message: this.message, rateLimit: this.rateLimit ?? null };
  }
}

function rateLimitOf(res) {
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  return {
    remaining: remaining === null ? null : Number(remaining),
    resetAt: reset === null ? null : new Date(Number(reset) * 1000).toISOString(),
  };
}

export function classifyGitHubResponse(status, rateLimit, retryAfter) {
  if (status === 401) return 'GITHUB_UNAUTHORIZED';
  if (status === 429 || (status === 403 && (rateLimit?.remaining === 0 || retryAfter))) return 'GITHUB_RATE_LIMITED';
  if (status === 403) return 'GITHUB_FORBIDDEN';
  if (status === 404) return 'GITHUB_NOT_FOUND';
  if (status >= 500) return 'GITHUB_UPSTREAM_ERROR';
  return `GITHUB_HTTP_${status}`;
}

export function createGitHubClient({ token, fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  let lastRateLimit = null;
  async function get(path) {
    const headers = {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'frame9-control-center/0.1 (+https://github.com/3XTRINITY-CORPORATION/Frame.-9)',
    };
    if (token) headers.authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetchImpl(`${API}${path}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw new GitHubError('GITHUB_UNREACHABLE', 0, `GitHub request failed: ${err?.name ?? 'Error'}`);
    }
    const rl = rateLimitOf(res);
    lastRateLimit = rl;
    if (!res.ok) {
      let msg = '';
      try { msg = String((await res.json())?.message ?? ''); } catch { /* non-JSON body */ }
      const code = classifyGitHubResponse(res.status, rl, res.headers.get('retry-after'));
      throw new GitHubError(code, res.status, msg.slice(0, 300) || `HTTP ${res.status}`, rl);
    }
    return res.json();
  }

  async function fetchRepoState(fullName) {
    if (!REPO_RE.test(fullName)) throw new GitHubError('INVALID_REPO', 400, 'Invalid repository name');
    const [owner, repo] = fullName.split('/');
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const meta = await get(base);
    const defaultBranch = meta.default_branch;
    const branches = (await get(`${base}/branches?per_page=50`)).map((b) => ({
      name: b.name, sha: b.commit?.sha, protected: Boolean(b.protected),
    }));
    const commits = (await get(`${base}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=10`)).map((c) => ({
      sha: c.sha,
      message: String(c.commit?.message ?? '').split('\n')[0].slice(0, 200),
      author: c.commit?.author?.name ?? null,
      date: c.commit?.author?.date ?? null,
      url: c.html_url,
    }));
    const headSha = commits[0]?.sha ?? branches.find((b) => b.name === defaultBranch)?.sha ?? null;
    // CI is best-effort: a failure here yields PARTIAL, never invented data.
    let ci = { state: 'UNKNOWN', checkRuns: [], error: null };
    let status = 'OK';
    if (headSha) {
      try {
        const runs = await get(`${base}/commits/${headSha}/check-runs?per_page=50`);
        const checkRuns = (runs.check_runs ?? []).map((r) => ({
          name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url,
        }));
        ci = { state: summarizeChecks(checkRuns), checkRuns, error: null };
      } catch (err) {
        if (!(err instanceof GitHubError)) throw err;
        ci = { state: 'UNKNOWN', checkRuns: [], error: err.toJSON() };
        status = 'PARTIAL';
      }
    }
    return {
      repo: fullName,
      fetchStatus: status,
      defaultBranch,
      headSha,
      branches,
      commits,
      ci,
      rateLimit: lastRateLimit,
    };
  }
  return { fetchRepoState };
}

export function summarizeChecks(checkRuns) {
  if (checkRuns.length === 0) return 'NO_CHECKS';
  if (checkRuns.some((r) => r.status !== 'completed')) return 'PENDING';
  const bad = ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure', 'stale'];
  if (checkRuns.some((r) => bad.includes(r.conclusion))) return 'FAILURE';
  return 'SUCCESS';
}
