import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type AuditEvent, type Me, type Snapshot } from './api';

const WRITE = ['OWNER', 'ADMIN', 'OPERATOR'];
const AUDIT = ['OWNER', 'ADMIN', 'AUDITOR'];

function describe(e: unknown): string {
  if (e instanceof ApiError) return e.status === 0 ? 'API unreachable' : `${e.code} (HTTP ${e.status})`;
  return 'Unexpected error';
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true); setError(null);
    try { await api.login(email, password); onDone(); } catch (e) { setError(describe(e)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} aria-label="login">
      <h1>FRAME.9 Control Center</h1>
      <label>E-post <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Parool <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p className="err" role="alert">{error}</p>}
      <button disabled={busy}>Logi sisse</button>
    </form>
  );
}

function SnapshotView({ s }: { s: Snapshot }) {
  const cls = s.fetch_status === 'OK' ? 'ok' : s.fetch_status === 'PARTIAL' ? 'warn' : 'bad';
  return (
    <section>
      <h2>{s.repo} <span className={cls}>{s.fetch_status}</span></h2>
      <p>Fetched {new Date(s.fetched_at).toLocaleString()} · rate limit remaining: {s.rate_limit_remaining ?? 'unknown'}</p>
      {s.error && <p className="err" role="alert">GitHub: {s.error.code} (HTTP {s.error.status}) — {s.error.message}</p>}
      {s.fetch_status !== 'ERROR' && (
        <>
          <p>Default branch <b>{s.default_branch}</b> @ <code>{s.head_sha?.slice(0, 12)}</code> · CI: <b>{s.ci.state ?? 'UNKNOWN'}</b></p>
          <h3>Branches ({s.branches.length})</h3>
          <table><tbody>{s.branches.map((b) => <tr key={b.name}><td>{b.name}</td><td><code>{b.sha.slice(0, 12)}</code></td><td>{b.protected ? 'protected' : ''}</td></tr>)}</tbody></table>
          <h3>Recent commits</h3>
          <table><tbody>{s.commits.map((c) => <tr key={c.sha}><td><code>{c.sha.slice(0, 7)}</code></td><td>{c.message}</td><td>{c.author}</td></tr>)}</tbody></table>
          <h3>Checks on HEAD</h3>
          <table><tbody>{(s.ci.checkRuns ?? []).map((r, i) => <tr key={i}><td>{r.name}</td><td>{r.status}</td><td>{r.conclusion ?? '—'}</td></tr>)}</tbody></table>
        </>
      )}
    </section>
  );
}

function Dashboard({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [orgId, setOrgId] = useState(me.orgs[0]?.id ?? '');
  const org = me.orgs.find((o) => o.id === orgId);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!org) return;
    setError(null);
    try {
      setSnap((await api.latest(org.id)).snapshot);
      setAudit(AUDIT.includes(org.role) ? (await api.audit(org.id)).events : null);
    } catch (e) { setError(describe(e)); }
  }, [org]);
  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    if (!org) return;
    setBusy(true); setError(null);
    try { setSnap(await api.refresh(org.id)); await load(); } catch (e) { setError(describe(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <section>
        <p>{me.user.email} · <button onClick={onLogout}>Logi välja</button></p>
        {me.orgs.length === 0 ? <p className="err">Sul pole ühtegi organisatsiooni liikmesust.</p> : (
          <p>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {me.orgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.role})</option>)}
            </select>{' '}
            <button onClick={refresh} disabled={busy || !org || !WRITE.includes(org.role)}>Värskenda GitHubist</button>
          </p>
        )}
        {error && <p className="err" role="alert">{error}</p>}
      </section>
      {snap ? <SnapshotView s={snap} /> : org && <section><p>Snapshot puudub. {WRITE.includes(org.role) ? 'Vajuta "Värskenda".' : 'Operaator peab selle looma.'}</p></section>}
      {audit && (
        <section>
          <h2>Audit</h2>
          <table><tbody>{audit.map((a) => <tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.action}</td><td className={a.outcome === 'SUCCESS' ? 'ok' : 'bad'}>{a.outcome}</td></tr>)}</tbody></table>
        </section>
      )}
    </>
  );
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function afterLogin() {
    try { setMe(await api.me()); } catch (e) { setError(describe(e)); }
  }
  async function logout() { await api.logout().catch(() => {}); setMe(null); }
  return (
    <main>
      {error && <p className="err" role="alert">{error}</p>}
      {me ? <Dashboard me={me} onLogout={logout} /> : <Login onDone={afterLogin} />}
    </main>
  );
}
