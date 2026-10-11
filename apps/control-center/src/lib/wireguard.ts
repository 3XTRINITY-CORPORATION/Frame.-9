// WireGuard config validation, client-side only. Private keys are validated
// locally and are never part of any payload produced for the server.

export interface WgPeer { publicKey: string; presharedKey?: string; endpoint?: string; allowedIPs: string[]; persistentKeepalive?: number }
export interface WgConfig { privateKey: string; addresses: string[]; dns: string[]; listenPort?: number; mtu?: number; peers: WgPeer[] }
export interface WgResult { ok: boolean; errors: string[]; config?: WgConfig }

const B64_32 = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/; // exactly 32 bytes, canonical padding

function decode32(key: string): Uint8Array | null {
  if (!B64_32.test(key)) return null;
  const bin = atob(key);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Rejects malformed keys and obvious placeholders (all-zero / single repeated byte). */
export function isPlausibleKey(key: string): boolean {
  const bytes = decode32(key);
  if (!bytes) return false;
  return !bytes.every((b) => b === bytes[0]);
}

function isIPv4(s: string): boolean {
  const p = s.split('.');
  return p.length === 4 && p.every((x) => /^\d{1,3}$/.test(x) && Number(x) <= 255 && String(Number(x)) === x);
}
function isIPv6(s: string): boolean {
  if (!/^[0-9a-fA-F:]+$/.test(s) || s.includes(':::')) return false;
  const dbl = s.split('::').length - 1;
  if (dbl > 1) return false;
  const groups = s.split(':').filter((g) => g !== '');
  return groups.every((g) => g.length <= 4) && (dbl === 1 ? groups.length < 8 : groups.length === 8);
}
export function isCidr(s: string): boolean {
  const [ip, len, extra] = s.split('/');
  if (extra !== undefined || ip === undefined || len === undefined || !/^\d{1,3}$/.test(len)) return false;
  const n = Number(len);
  return (isIPv4(ip) && n <= 32) || (isIPv6(ip) && n <= 128);
}
function isEndpoint(s: string): boolean {
  const m = /^(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+):(\d{1,5})$/.exec(s);
  if (!m) return false;
  const port = Number(m[2]);
  const host = m[1]!;
  const hostOk = host.startsWith('[') ? isIPv6(host.slice(1, -1)) : isIPv4(host) || /^(?=.{1,253}$)([A-Za-z0-9-]{1,63}\.)*[A-Za-z0-9-]{1,63}$/.test(host);
  return hostOk && port >= 1 && port <= 65535;
}
const list = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);

export function parseAndValidate(text: string): WgResult {
  const errors: string[] = [];
  let section: 'Interface' | 'Peer' | null = null;
  let iface: Partial<WgConfig> & { addresses: string[]; dns: string[] } = { addresses: [], dns: [] };
  let seenInterface = 0;
  const peers: Partial<WgPeer>[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    const where = `line ${i + 1}`;
    if (!line) return;
    const sec = /^\[(\w+)\]$/.exec(line);
    if (sec) {
      if (sec[1] === 'Interface') { section = 'Interface'; seenInterface++; }
      else if (sec[1] === 'Peer') { section = 'Peer'; peers.push({ allowedIPs: [] }); }
      else errors.push(`${where}: unknown section [${sec[1]}]`);
      return;
    }
    const kv = /^(\w+)\s*=\s*(.+)$/.exec(line);
    if (!kv || !section) { errors.push(`${where}: expected "Key = Value" inside a section`); return; }
    const [, key, value] = kv as unknown as [string, string, string];
    if (section === 'Interface') {
      switch (key) {
        case 'PrivateKey': if (!isPlausibleKey(value)) errors.push(`${where}: Interface PrivateKey is not a valid 32-byte base64 key`); iface.privateKey = value; break;
        case 'Address': for (const a of list(value)) { if (!isCidr(a)) errors.push(`${where}: invalid Address ${a}`); iface.addresses.push(a); } break;
        case 'DNS': for (const d of list(value)) { if (!isIPv4(d) && !isIPv6(d)) errors.push(`${where}: invalid DNS ${d}`); iface.dns.push(d); } break;
        case 'ListenPort': { const n = Number(value); if (!Number.isInteger(n) || n < 1 || n > 65535) errors.push(`${where}: invalid ListenPort`); iface.listenPort = n; break; }
        case 'MTU': { const n = Number(value); if (!Number.isInteger(n) || n < 1280 || n > 9000) errors.push(`${where}: invalid MTU`); iface.mtu = n; break; }
        default: errors.push(`${where}: unsupported Interface key ${key}`);
      }
    } else {
      const peer = peers[peers.length - 1]!;
      switch (key) {
        case 'PublicKey': if (!isPlausibleKey(value)) errors.push(`${where}: Peer PublicKey is not a valid 32-byte base64 key`); peer.publicKey = value; break;
        case 'PresharedKey': if (!isPlausibleKey(value)) errors.push(`${where}: invalid PresharedKey`); peer.presharedKey = value; break;
        case 'Endpoint': if (!isEndpoint(value)) errors.push(`${where}: invalid Endpoint ${value}`); peer.endpoint = value; break;
        case 'AllowedIPs': for (const a of list(value)) { if (!isCidr(a)) errors.push(`${where}: invalid AllowedIPs ${a}`); peer.allowedIPs!.push(a); } break;
        case 'PersistentKeepalive': { const n = Number(value); if (!Number.isInteger(n) || n < 0 || n > 65535) errors.push(`${where}: invalid PersistentKeepalive`); peer.persistentKeepalive = n; break; }
        default: errors.push(`${where}: unsupported Peer key ${key}`);
      }
    }
  });
  if (seenInterface !== 1) errors.push('exactly one [Interface] section is required');
  if (!iface.privateKey) errors.push('Interface PrivateKey is required');
  if (iface.addresses.length === 0) errors.push('Interface Address is required');
  if (peers.length === 0) errors.push('at least one [Peer] is required');
  const pubs = new Set<string>();
  peers.forEach((p, i) => {
    if (!p.publicKey) errors.push(`peer ${i + 1}: PublicKey is required`);
    else if (pubs.has(p.publicKey)) errors.push(`peer ${i + 1}: duplicate PublicKey`);
    else pubs.add(p.publicKey);
    if (p.publicKey && p.publicKey === iface.privateKey) errors.push(`peer ${i + 1}: PublicKey equals the Interface PrivateKey`);
    if (!p.allowedIPs?.length) errors.push(`peer ${i + 1}: AllowedIPs is required`);
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors, config: { ...(iface as WgConfig), peers: peers as WgPeer[] } };
}

/** The only shape that may leave the device: no PrivateKey, no PresharedKey. */
export interface WgServerPayload { addresses: string[]; dns: string[]; peers: { publicKey: string; endpoint?: string; allowedIPs: string[] }[] }
export function toServerPayload(cfg: WgConfig): WgServerPayload {
  return {
    addresses: [...cfg.addresses],
    dns: [...cfg.dns],
    peers: cfg.peers.map((p) => ({ publicKey: p.publicKey, endpoint: p.endpoint, allowedIPs: [...p.allowedIPs] })),
  };
}

export type TunnelStatus = 'CONNECTED' | 'STALE_HANDSHAKE' | 'NO_HANDSHAKE' | 'UNKNOWN';
/**
 * Status is derived only from a real handshake timestamp reported by the
 * WireGuard backend. Without such a measurement the answer is UNKNOWN, never CONNECTED.
 */
export function tunnelStatus(latestHandshakeSec: number | null | undefined, nowSec: number, maxAgeSec = 180): TunnelStatus {
  if (latestHandshakeSec === null || latestHandshakeSec === undefined || !Number.isFinite(latestHandshakeSec)) return 'UNKNOWN';
  if (latestHandshakeSec <= 0) return 'NO_HANDSHAKE';
  if (latestHandshakeSec > nowSec + 5) return 'UNKNOWN'; // future timestamp: untrusted
  return nowSec - latestHandshakeSec <= maxAgeSec ? 'CONNECTED' : 'STALE_HANDSHAKE';
}
