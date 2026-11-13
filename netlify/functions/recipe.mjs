// Fetches one public recipe page so the app can read it (browsers block cross-site reads).
// GET /api/recipe?url=https://...  ->  { html, url }
const ALLOWED_ORIGINS = ['https://efihersh-0304.github.io'];
const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 12_000;
const PRIVATE_HOST = /^(?:localhost|.*\.local|.*\.internal|.*\.lan|\[.*\]|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\d+)$|^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i;

const json = (status, body, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    },
  });

function publicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) return null;
  if (!u.hostname.includes('.') || PRIVATE_HOST.test(u.hostname)) return null;
  return u;
}

export default async (req) => {
  const origin = req.headers.get('origin');
  const cors = ALLOWED_ORIGINS.includes(origin) ? origin : null;
  // Only this app may use the function: same-site page, or the listed origins.
  if (!cors && req.headers.get('sec-fetch-site') !== 'same-origin') return json(403, { error: 'forbidden' });
  if (req.method !== 'GET') return json(405, { error: 'method' }, cors);

  const target = publicUrl(new URL(req.url).searchParams.get('url') || '');
  if (!target) return json(400, { error: 'bad-url' }, cors);

  try {
    const res = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'he,en;q=0.8',
      },
    });
    if (!publicUrl(res.url)) return json(400, { error: 'bad-url' }, cors);
    if (!res.ok) return json(502, { error: 'site', status: res.status }, cors);
    const type = res.headers.get('content-type') || '';
    if (!/html|text\/plain/i.test(type)) return json(415, { error: 'not-html' }, cors);

    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > MAX_BYTES) break;
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const head = bytes.subarray(0, 2048).toString('latin1');
    const charset = (type.match(/charset=["']?([\w-]+)/i) || head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html;
    try { html = new TextDecoder(charset).decode(bytes); } catch { html = new TextDecoder().decode(bytes); }
    return json(200, { html, url: res.url }, cors);
  } catch (e) {
    return json(504, { error: e.name === 'TimeoutError' ? 'timeout' : 'fetch' }, cors);
  }
};

export const config = { path: '/api/recipe' };
