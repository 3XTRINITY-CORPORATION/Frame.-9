// Typed factory + skill registry (data only; no agents are started from here).
export type FactoryState = 'SLEEP' | 'READY' | 'ACTIVE_READ' | 'ACTIVE_WRITE' | 'VERIFY' | 'CI_WAIT' | 'BLOCKED';
export type WorkerRole = 'ARCHITECT' | 'BUILDER' | 'DEBUGGER' | 'FIXER' | 'TESTER' | 'SECURITY' | 'INTEGRATOR' | 'RELEASE' | 'EVIDENCE';
export interface Factory { id: string; name: string; purpose: string; mode: 'READ' | 'WRITE'; state: FactoryState; skills: string[] }
export interface Skill { id: string; description: string; requires: string[]; writes: boolean }

export const MAX_SLOTS = 149;
export const MAX_INITIAL_ACTIVE = 8;

export const SKILLS: Skill[] = [
  { id: 'repo.inspect', description: 'Read-only repository inspection cached by commit SHA', requires: [], writes: false },
  { id: 'test.run', description: 'Run repository test suites under Node 22', requires: ['repo.inspect'], writes: false },
  { id: 'security.review', description: 'Adversarial review of auth, RLS and secrets handling', requires: ['repo.inspect'], writes: false },
  { id: 'evidence.verify', description: 'Independently re-run checks and compare digests', requires: ['test.run'], writes: false },
  { id: 'patch.bounded', description: 'Minimal scoped patch on a feature branch with tests', requires: ['test.run'], writes: true },
  { id: 'android.build', description: 'Capacitor sync + Gradle assembleDebug in CI', requires: ['test.run'], writes: false },
  { id: 'pr.prepare', description: 'Open a reviewable PR (never merge)', requires: ['evidence.verify'], writes: true },
];

export const FACTORIES: Factory[] = [
  { id: 'rastik', name: 'RÄSTIK', purpose: 'Adversarial attack preparation', mode: 'READ', state: 'SLEEP', skills: ['security.review'] },
  { id: 'toepara', name: 'TÖEPÄRA', purpose: 'Independent evidence verification', mode: 'READ', state: 'SLEEP', skills: ['evidence.verify'] },
  { id: 'cerberus', name: 'CERBERUS', purpose: 'Trust gate, fail-closed recovery', mode: 'WRITE', state: 'SLEEP', skills: ['patch.bounded', 'security.review'] },
  { id: 'kratt', name: 'KRATT', purpose: 'Bounded execution handlers', mode: 'WRITE', state: 'SLEEP', skills: ['patch.bounded'] },
  { id: 'goliath', name: 'GOLIATH', purpose: 'Control plane adaptation', mode: 'WRITE', state: 'SLEEP', skills: ['patch.bounded'] },
  { id: 'matrix', name: 'MATRIX', purpose: 'Test matrix specification', mode: 'READ', state: 'SLEEP', skills: ['repo.inspect', 'test.run'] },
  { id: 'node22', name: 'NODE22', purpose: 'Runtime standardization', mode: 'WRITE', state: 'SLEEP', skills: ['patch.bounded', 'test.run'] },
  { id: 'release', name: 'RELEASE', purpose: 'Android debug build + PR preparation', mode: 'WRITE', state: 'SLEEP', skills: ['android.build', 'pr.prepare'] },
];

/** Returns a list of integrity problems; empty means the registry is consistent. */
export function validateRegistry(factories: Factory[] = FACTORIES, skills: Skill[] = SKILLS): string[] {
  const errs: string[] = [];
  const skillIds = new Set<string>();
  for (const s of skills) {
    if (skillIds.has(s.id)) errs.push(`duplicate skill ${s.id}`);
    skillIds.add(s.id);
  }
  for (const s of skills) for (const r of s.requires) if (!skillIds.has(r)) errs.push(`skill ${s.id} requires unknown ${r}`);
  // cycle detection
  const byId = new Map(skills.map((s) => [s.id, s]));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) { errs.push(`skill cycle ${[...path, id].join(' -> ')}`); return; }
    state.set(id, 1);
    for (const r of byId.get(id)?.requires ?? []) visit(r, [...path, id]);
    state.set(id, 2);
  };
  for (const s of skills) visit(s.id, []);
  const fIds = new Set<string>();
  for (const f of factories) {
    if (fIds.has(f.id)) errs.push(`duplicate factory ${f.id}`);
    fIds.add(f.id);
    for (const sk of f.skills) {
      if (!skillIds.has(sk)) errs.push(`factory ${f.id} uses unknown skill ${sk}`);
      else if (f.mode === 'READ' && byId.get(sk)!.writes) errs.push(`read-only factory ${f.id} has write skill ${sk}`);
    }
  }
  const active = factories.filter((f) => f.state.startsWith('ACTIVE')).length;
  if (active > MAX_INITIAL_ACTIVE) errs.push(`active factories ${active} exceed ${MAX_INITIAL_ACTIVE}`);
  if (factories.length > MAX_SLOTS) errs.push(`factories exceed ${MAX_SLOTS} slots`);
  return errs;
}
