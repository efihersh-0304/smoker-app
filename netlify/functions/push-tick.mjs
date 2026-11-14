// Runs every minute: sends the notifications that have come due and forgets them.
import { getStore } from '@netlify/blobs';
import { vapidKey, sendPush, CONTACT } from '../lib/webpush.mjs';

export default async () => {
  const store = getStore({ name: 'push', consistency: 'strong' });
  const now = Date.now();
  const tick = await store.get('tick', { type: 'json' });
  if (!tick || now - tick.at > 10 * 60000) await store.setJSON('tick', { at: now });

  const { blobs } = await store.list({ prefix: 'sub/' });
  if (!blobs.length) return;
  const jwk = await vapidKey(store);
  await Promise.all(blobs.map(async ({ key }) => {
    const rec = await store.get(key, { type: 'json' });
    if (!rec?.alarms?.length) { await store.delete(key); return; }
    const due = rec.alarms.filter((a) => a.at <= now + 20000);
    if (!due.length) return;
    let gone = false;
    for (const a of due) {
      if (a.at < now - 2 * 3600000) continue;               // too late to be useful
      const status = await sendPush(rec.sub, { title: a.title, body: a.body, tag: a.id }, jwk, CONTACT);
      if (status === 404 || status === 410) { gone = true; break; }
    }
    const rest = rec.alarms.filter((a) => !due.includes(a));
    if (gone || !rest.length) await store.delete(key); else await store.setJSON(key, { ...rec, alarms: rest });
  }));
};

export const config = { schedule: '* * * * *' };
