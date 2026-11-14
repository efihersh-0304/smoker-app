// Web Push without third-party code: payload encryption (RFC 8291, aes128gcm) and VAPID (RFC 8292) on node:crypto.
import crypto from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// Only real browser push services; the function must never POST to an arbitrary address.
const PUSH_HOST = /^(?:[a-z0-9-]+\.)*push\.apple\.com$|^fcm\.googleapis\.com$|^updates\.push\.services\.mozilla\.com$|^[a-z0-9-]+\.notify\.windows\.com$/;

export function validSub(sub) {
  try {
    const u = new URL(sub.endpoint);
    if (u.protocol !== 'https:' || u.port || u.username || !PUSH_HOST.test(u.hostname) || sub.endpoint.length > 1000) return false;
    return Buffer.from(sub.keys.p256dh, 'base64url').length === 65 && Buffer.from(sub.keys.auth, 'base64url').length === 16;
  } catch { return false; }
}

export const newVapid = () => crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' });
export const vapidPublic = (jwk) => b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]));

export function encrypt(text, p256dh, auth, test = {}) {
  const ua = Buffer.from(p256dh, 'base64url'), secret = Buffer.from(auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1');
  if (test.priv) ecdh.setPrivateKey(test.priv); else ecdh.generateKeys();
  const as = ecdh.getPublicKey(), salt = test.salt || crypto.randomBytes(16);
  const ikm = hmac(hmac(secret, ecdh.computeSecret(ua)), Buffer.concat([Buffer.from('WebPush: info\0'), ua, as, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head); head.writeUInt32BE(4096, 16); head[20] = as.length;
  return Buffer.concat([head, as, body]);
}

function vapidHeader(endpoint, jwk, contact) {
  const part = (o) => b64u(JSON.stringify(o));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contact })}`;
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key: crypto.createPrivateKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${unsigned}.${b64u(sig)}, k=${vapidPublic(jwk)}`;
}

// Returns the push service's HTTP status (201 = accepted; 404/410 = the subscription is gone).
export async function sendPush(sub, message, jwk, contact) {
  if (!validSub(sub)) return 400;
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { authorization: vapidHeader(sub.endpoint, jwk, contact), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '3600', urgency: 'high' },
      body: encrypt(JSON.stringify(message), sub.keys.p256dh, sub.keys.auth),
      signal: AbortSignal.timeout(8000),
    });
    return res.status;
  } catch { return 0; }
}

// The signing key is created on first use and kept in the site's private storage; nobody has to handle it.
export async function vapidKey(store) {
  let jwk = await store.get('vapid', { type: 'json' });
  if (!jwk) { jwk = newVapid(); await store.setJSON('vapid', jwk); }
  return jwk;
}

export const subKey = (endpoint) => 'sub/' + crypto.createHash('sha256').update(endpoint).digest('hex');
export const CONTACT = process.env.URL || 'https://hamaashena.netlify.app';
