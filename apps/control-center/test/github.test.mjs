import { describe, it, expect } from 'vitest';
import { createGitHubClient, classifyGitHubResponse, summarizeChecks, GitHubError } from '../server/github.mjs';

const SHA = 'b'.repeat(40);
function mockFetch(routes, calls = []) {
  return async (url, init) => {
    calls.push({ url, headers: init.headers });
    const path = new URL(url).pathname + new URL(url).search;
    const hit = routes.find(([re]) => re.test(path));
    if (!hit) throw new TypeError('fetch failed');
    const [, status, body, headers = {}] = hit;
    return new Response(JSON.stringify(body), { status, headers: { 'x-ratelimit-remaining': '59', 'x-ratelimit-reset': '1700000000', ...headers } });
  };
}
const OK_ROUTES = [
  [/\/repos\/o\/r$/, 200, { default_branch: 'main' }],
  [/\/branches/, 200, [{ name: 'main', commit: { sha: SHA }, protected: true }, { name: 'dev', commit: { sha: 'c'.repeat(40) } }]],
  [/\/commits\?sha=main/, 200, [{ sha: SHA, html_url: 'https://github.com/o/r/commit/x', commit: { message: 'first line\nbody', author: { name: 'A', date: '2026-10-11T00:00:00Z' } } }]],
  [/check-runs/, 200, { check_runs: [{ name: 'ci', status: 'completed', conclusion: 'success', html_url: 'u' }] }],
];

describe('GitHub adapter', () => {
  it('maps real repo state and sends token only as Authorization header', async () => {
    const calls = [];
    const gh = createGitHubClient({ token: 'test-token-not-a-real-secret', fetchImpl: mockFetch(OK_ROUTES, calls) });
    const s = await gh.fetchRepoState('o/r');
    expect(s).toMatchObject({ fetchStatus: 'OK', defaultBranch: 'main', headSha: SHA, ci: { state: 'SUCCESS' } });
    expect(s.branches).toHaveLength(2);
    expect(s.commits[0].message).toBe('first line');
    expect(calls.every((c) => c.headers.authorization === 'Bearer test-token-not-a-real-secret')).toBe(true);
    expect(JSON.stringify(s)).not.toContain('test-token-not-a-real-secret');
  });

  it('sends no Authorization header when no token is configured', async () => {
    const calls = [];
    await createGitHubClient({ fetchImpl: mockFetch(OK_ROUTES, calls) }).fetchRepoState('o/r');
    expect(calls.some((c) => 'authorization' in c.headers)).toBe(false);
  });

  it.each([
    [401, {}, 'GITHUB_UNAUTHORIZED'],
    [403, { 'x-ratelimit-remaining': '0' }, 'GITHUB_RATE_LIMITED'],
    [403, {}, 'GITHUB_FORBIDDEN'],
    [404, {}, 'GITHUB_NOT_FOUND'],
    [429, {}, 'GITHUB_RATE_LIMITED'],
    [502, {}, 'GITHUB_UPSTREAM_ERROR'],
  ])('HTTP %i surfaces as error, never example data', async (status, headers, code) => {
    const gh = createGitHubClient({ fetchImpl: mockFetch([[/./, status, { message: 'Bad credentials' }, headers]]) });
    const err = await gh.fetchRepoState('o/r').catch((e) => e);
    expect(err).toBeInstanceOf(GitHubError);
    expect(err.code).toBe(code);
    expect(err.status).toBe(status);
  });

  it('network failure is GITHUB_UNREACHABLE', async () => {
    const gh = createGitHubClient({ fetchImpl: async () => { throw new TypeError('fetch failed'); } });
    expect((await gh.fetchRepoState('o/r').catch((e) => e)).code).toBe('GITHUB_UNREACHABLE');
  });

  it('check-runs failure yields PARTIAL with the real error, not fake CI', async () => {
    const routes = [...OK_ROUTES.slice(0, 3), [/check-runs/, 403, { message: 'Resource not accessible' }]];
    const s = await createGitHubClient({ fetchImpl: mockFetch(routes) }).fetchRepoState('o/r');
    expect(s.fetchStatus).toBe('PARTIAL');
    expect(s.ci).toMatchObject({ state: 'UNKNOWN', checkRuns: [], error: { code: 'GITHUB_FORBIDDEN' } });
  });

  it('rejects malformed repo names before any request (no path injection)', async () => {
    const calls = [];
    const gh = createGitHubClient({ fetchImpl: mockFetch(OK_ROUTES, calls) });
    for (const bad of ['../x', 'o/r/../../users', 'o', 'o/r?x=1']) {
      expect((await gh.fetchRepoState(bad).catch((e) => e)).code).toBe('INVALID_REPO');
    }
    expect(calls).toHaveLength(0);
  });

  it('summarizes checks', () => {
    expect(summarizeChecks([])).toBe('NO_CHECKS');
    expect(summarizeChecks([{ status: 'in_progress' }])).toBe('PENDING');
    expect(summarizeChecks([{ status: 'completed', conclusion: 'failure' }])).toBe('FAILURE');
    expect(classifyGitHubResponse(403, { remaining: 5 }, '60')).toBe('GITHUB_RATE_LIMITED');
  });
});

describe.skipIf(process.env.LIVE_GITHUB !== '1')('GitHub adapter LIVE (public, unauthenticated)', () => {
  it('fetches real 3XTRINITY-CORPORATION/Frame.-9 state', async () => {
    const s = await createGitHubClient({ token: process.env.GITHUB_TOKEN || undefined }).fetchRepoState('3XTRINITY-CORPORATION/Frame.-9');
    console.log('LIVE_EVIDENCE', JSON.stringify({ fetchStatus: s.fetchStatus, defaultBranch: s.defaultBranch, headSha: s.headSha,
      branches: s.branches.map((b) => b.name), ci: s.ci.state, rateLimitRemaining: s.rateLimit?.remaining }));
    expect(s.defaultBranch).toBe('main');
    expect(s.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(s.branches.some((b) => b.name === 'main')).toBe(true);
  }, 30_000);
});
