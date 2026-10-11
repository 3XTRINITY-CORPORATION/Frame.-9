// Lawful call-screening policy. Pure decision function: it does not store or
// transmit numbers. Restricted/withheld caller ID must never trigger a lookup.

export type Presentation = 'ALLOWED' | 'RESTRICTED' | 'UNAVAILABLE' | 'PAYPHONE';
export interface IncomingCall { presentation: Presentation; number?: string | null }
export interface CallPolicySettings {
  /** User opted in to reputation lookups for presented, unknown numbers. */
  lookupOptIn: boolean;
  /** What to do with withheld numbers (local decision only). */
  restrictedAction: 'ALLOW' | 'SILENCE' | 'VOICEMAIL';
  blockedNumbers: ReadonlySet<string>;
  contacts: ReadonlySet<string>;
}
export type CallAction = 'ALLOW' | 'SILENCE' | 'VOICEMAIL' | 'REJECT';
export interface CallDecision { action: CallAction; lookupPermitted: boolean; reason: string }

const E164 = /^\+[1-9]\d{6,14}$/;

export function evaluateCall(call: IncomingCall, s: CallPolicySettings): CallDecision {
  if (call.presentation !== 'ALLOWED') {
    // Withheld / unavailable: no lookup, no logging of any number-like data.
    return { action: s.restrictedAction, lookupPermitted: false, reason: `CLI_${call.presentation}` };
  }
  const n = call.number ?? '';
  if (!E164.test(n)) return { action: 'ALLOW', lookupPermitted: false, reason: 'CLI_NOT_E164' };
  if (s.blockedNumbers.has(n)) return { action: 'REJECT', lookupPermitted: false, reason: 'USER_BLOCKLIST' };
  if (s.contacts.has(n)) return { action: 'ALLOW', lookupPermitted: false, reason: 'KNOWN_CONTACT' };
  return { action: 'ALLOW', lookupPermitted: s.lookupOptIn, reason: s.lookupOptIn ? 'UNKNOWN_LOOKUP_OPT_IN' : 'UNKNOWN_NO_OPT_IN' };
}
