import { describe, it, expect } from 'vitest';
import { evaluateCall, type CallPolicySettings, type Presentation } from './callSecurity';

const s: CallPolicySettings = {
  lookupOptIn: true, restrictedAction: 'SILENCE',
  blockedNumbers: new Set(['+3725550001']), contacts: new Set(['+3725550002']),
};

describe('call security policy', () => {
  it.each<Presentation>(['RESTRICTED', 'UNAVAILABLE', 'PAYPHONE'])('%s CLI never permits lookup, even with a number attached', (p) => {
    const d = evaluateCall({ presentation: p, number: '+3725559999' }, s);
    expect(d.lookupPermitted).toBe(false);
    expect(d.action).toBe('SILENCE');
    expect(JSON.stringify(d)).not.toContain('5559999');
  });
  it('blocklist rejects without lookup', () => expect(evaluateCall({ presentation: 'ALLOWED', number: '+3725550001' }, s)).toMatchObject({ action: 'REJECT', lookupPermitted: false }));
  it('contacts are never looked up', () => expect(evaluateCall({ presentation: 'ALLOWED', number: '+3725550002' }, s).lookupPermitted).toBe(false));
  it('unknown number: lookup only with opt-in', () => {
    expect(evaluateCall({ presentation: 'ALLOWED', number: '+3725550003' }, s).lookupPermitted).toBe(true);
    expect(evaluateCall({ presentation: 'ALLOWED', number: '+3725550003' }, { ...s, lookupOptIn: false }).lookupPermitted).toBe(false);
  });
  it('non-E.164 input never triggers lookup', () => {
    for (const n of ['', '12345', 'anonymous', '+0123456789', null]) {
      expect(evaluateCall({ presentation: 'ALLOWED', number: n }, s).lookupPermitted).toBe(false);
    }
  });
  it('decisions contain no telephone number data', () => {
    expect(JSON.stringify(evaluateCall({ presentation: 'ALLOWED', number: '+3725550003' }, s))).not.toMatch(/\+?\d{7,}/);
  });
});
