import { describe, it, expect } from 'vitest';
import { FACTORIES, SKILLS, validateRegistry, MAX_INITIAL_ACTIVE, type Factory } from './registry';

describe('factory/skill registry', () => {
  it('shipped registry is consistent: 8 factories, all asleep', () => {
    expect(validateRegistry()).toEqual([]);
    expect(FACTORIES).toHaveLength(8);
    expect(FACTORIES.every((f) => f.state === 'SLEEP')).toBe(true);
  });
  it('detects unknown skills, duplicates, cycles, write skills on read factories', () => {
    const f: Factory[] = [...FACTORIES, { ...FACTORIES[0]!, skills: ['nope', 'patch.bounded'] }];
    const errs = validateRegistry(f, [...SKILLS, { id: 'a', description: '', requires: ['b'], writes: false }, { id: 'b', description: '', requires: ['a'], writes: false }]);
    expect(errs.some((e) => e.startsWith('duplicate factory'))).toBe(true);
    expect(errs.some((e) => e.includes('unknown skill nope'))).toBe(true);
    expect(errs.some((e) => e.includes('read-only factory rastik has write skill'))).toBe(true);
    expect(errs.some((e) => e.startsWith('skill cycle'))).toBe(true);
  });
  it('caps concurrent active factories', () => {
    const many = Array.from({ length: MAX_INITIAL_ACTIVE + 1 }, (_, i) => ({ ...FACTORIES[1]!, id: `f${i}`, state: 'ACTIVE_READ' as const }));
    expect(validateRegistry(many)).toContain(`active factories ${MAX_INITIAL_ACTIVE + 1} exceed ${MAX_INITIAL_ACTIVE}`);
  });
});
