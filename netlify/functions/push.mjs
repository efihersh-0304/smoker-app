// Lock-screen notifications. The app registers its pending alarms (timers, water-pan checks) here,
// and push-tick.mjs sends each one when it is due.
//   GET  /api/push            -> { key }      public key the browser needs to subscribe
//   GET  /api/push?health=1   -> { lastTick } when the sender last ran
//   POST /api/push { sub, alarms: [{ id, at, title, body }] }   replace this device's pending alarms
//   POST /api/push { sub, test: true }                          send one notification now
import { getStore } from '@netlify/blobs';
import { vapidKey, vapidPublic, validSub, sendPush, subKey, CONTACT } from '../lib/webpush.mjs';

const MAX_ALARMS = 30, MAX_DEVICES = 200, HORIZON_MS = 36 * 3600 * 1000;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max);

export default async (req) => {
  // Only this app's own pages may call the function.
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return json(403, { error: 'forbidden' });
  const store = getStore({ name: 'push', consistency: 'strong' });

  if (req.method === 'GET') {
    if (new URL(req.url).searchParams.has('health')) return json(200, { lastTick: (await store.get('tick', { type: 'json' }))?.at ?? null });
    return json(200, { key: vapidPublic(await vapidKey(store)) });
  }
  if (req.method !== 'POST') return json(405, { error: 'method' });

  let d;
  try { d = JSON.parse((await req.text()).slice(0, 20000)); } catch { return json(400, { error: 'bad-json' }); }
  if (!d || !validSub(d.sub)) return json(400, { error: 'bad-sub' });
  const sub = { endpoint: d.sub.endpoint, keys: { p256dh: d.sub.keys.p256dh, auth: d.sub.keys.auth } };
  const key = subKey(sub.endpoint);

  if (d.test) {
    const status = await sendPush(sub, { title: 'המעשנה', body: 'התראת בדיקה: ההתראות פועלות גם כשהטלפון נעול.', tag: 'smoker-test' }, await vapidKey(store), CONTACT);
    return json(200, { status });
  }

  const now = Date.now();
  const alarms = (Array.isArray(d.alarms) ? d.alarms : []).slice(0, MAX_ALARMS)
    .map((a) => ({ id: text(a?.id, 40), at: Number(a?.at), title: text(a?.title, 80), body: text(a?.body, 240) }))
    .filter((a) => a.id && Number.isFinite(a.at) && a.at > now - 60000 && a.at < now + HORIZON_MS);
  if (!alarms.length) { await store.delete(key); return json(200, { stored: 0 }); }
  if (!(await store.get(key, { type: 'json' })) && (await store.list({ prefix: 'sub/' })).blobs.length >= MAX_DEVICES) return json(429, { error: 'full' });
  await store.setJSON(key, { sub, alarms, saved: now });
  return json(200, { stored: alarms.length });
};

export const config = { path: '/api/push' };
