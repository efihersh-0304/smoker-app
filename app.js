'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDate = (ts) => { const d = new Date(ts); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; };
const isoDate = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtDur = (min) => {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} דק'`;
  return m ? `${h} שע' ${m} דק'` : `${h} שע'`;
};
const fmtClock = (ms) => {
  const neg = ms < 0; let s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
  return `${neg ? '-' : ''}${h ? h + ':' : ''}${pad(m)}:${pad(s)}`;
};
const stars = (n) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '');
const dayLabel = (ts) => {
  const a = new Date(ts), b = new Date();
  const diff = Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5);
  if (diff === 0) return 'היום';
  if (diff === -1) return 'אתמול';
  if (diff === 1) return 'מחר';
  return fmtDate(ts);
};

/* ---------- storage (IndexedDB, single document) ---------- */
const store = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('smoker', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async get(key) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const q = db.transaction('kv').objectStore('kv').get(key);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  },
  async set(key, val) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  },
};

const SEED_RECIPES = [
  {
    name: 'בריסקט קלאסי', cut: 'בריסקט בקר', weight: 5, smokerTemp: 120, targetTemp: 95, hours: 12, rest: 90, wood: 'אלון',
    ingredients: 'מלח גס ופלפל שחור גרוס, ביחס שווה\nחרדל למריחה (לא חובה)',
    steps: ['לנקות שומן עודף ולהשאיר שכבה של כחצי סנטימטר', 'לתבל ערב קודם ולהשאיר במקרר', 'לייצב את המעשנה על 120°C', 'להכניס את הנתח, צד השומן כלפי מעלה', 'לעטוף בנייר קצבים כשהקרום כהה ויציב (סביב 70°C)', 'להוציא ב-95°C, כשהמדחום נכנס בלי התנגדות', 'מנוחה עטופה בצידנית, שעה וחצי לפחות'],
    notes: 'מתכון לדוגמה. הזמנים משתנים מנתח לנתח; קובעים לפי טמפרטורה ומרקם, לא לפי שעון.',
  },
  {
    name: 'עוף שלם מעושן', cut: 'עוף שלם', weight: 1.8, smokerTemp: 150, targetTemp: 74, hours: 2, rest: 15, wood: 'עץ תפוח',
    ingredients: 'מלח, פפריקה, שום גבישי, פלפל שחור\nמעט שמן זית',
    steps: ['לייבש היטב את העור ולתבל', 'לייצב את המעשנה על 150°C', 'להכניס כשהחזה כלפי מעלה', 'למדוד בחלק העבה של החזה, בלי לגעת בעצם', 'להוציא ב-74°C בחזה', 'מנוחה של רבע שעה לפני פירוק'],
    notes: 'מתכון לדוגמה. טמפרטורה גבוהה יחסית כדי שהעור לא ייצא גומי.',
  },
  {
    name: 'שורט ריבס', cut: 'אסאדו עם עצם', weight: 2.5, smokerTemp: 120, targetTemp: 95, hours: 7, rest: 45, wood: 'אלון',
    ingredients: 'מלח גס ופלפל שחור גרוס',
    steps: ['להסיר את הקרום הכסוף מצד הבשר', 'לתבל שעה לפחות לפני העישון', 'לייצב את המעשנה על 120°C', 'להכניס כשהעצם כלפי מטה', 'לרסס מים או ציר פעם בשעה אחרי השעה השלישית', 'להוציא ב-95°C, כשהבשר רך כמו חמאה', 'מנוחה עטופה של 45 דקות'],
    notes: 'מתכון לדוגמה.',
  },
];

const blank = () => ({
  v: 1,
  recipes: SEED_RECIPES.map((r) => ({ ...r, id: uid(), updated: Date.now() })),
  cook: null, journal: [], ideas: [], seasoning: {}, lastBackup: null,
});

let S = blank();
let tab = 'recipes';
let wake = null, wakeWanted = false;
let audio = null;
let lastPlan = null;

async function save() {
  try { await store.set('state', S); }
  catch (err) { console.error(err); toast('השמירה נכשלה. כדאי לייצא גיבוי עכשיו.'); }
}

/* ---------- small UI utilities ---------- */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}
function openSheet(title, body) {
  const d = $('#sheet');
  d.innerHTML = `<div class="sheet-body"><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="sheet-close" aria-label="סגירה">✕</button></div>${body}</div>`;
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}
function closeSheet() { const d = $('#sheet'); if (d.open) d.close(); d.innerHTML = ''; }
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const field = (label, html) => `<label>${label}${html}</label>`;
const inp = (name, val, attrs = '') => `<input name="${name}" value="${esc(val ?? '')}" ${attrs}>`;
const numInp = (name, val, attrs = '') => inp(name, val, `type="text" inputmode="decimal" autocomplete="off" ${attrs}`);
const area = (name, val, attrs = '') => `<textarea name="${name}" ${attrs}>${esc(val ?? '')}</textarea>`;

/* ---------- recipes ---------- */
function recipeChips(r) {
  const c = [];
  if (r.weight) c.push(`${r.weight} ק"ג`);
  if (r.smokerTemp) c.push(`מעשנה ${r.smokerTemp}°C`);
  if (r.targetTemp) c.push(`יעד ${r.targetTemp}°C`);
  if (r.hours) c.push(`כ-${r.hours} שע'`);
  if (r.wood) c.push(esc(r.wood));
  return c.map((x) => `<span class="chip">${x}</span>`).join('');
}
function viewRecipes() {
  const list = [...S.recipes].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  return `
    <button class="btn primary block" data-act="recipe-new">＋ מתכון חדש</button>
    <button class="btn block" data-act="recipe-import">🔎 ייבוא מתכון ממקור</button>
    ${list.length ? list.map((r) => `
      <button class="card" data-act="recipe-open" data-arg="${r.id}">
        <div class="row between"><h3>${esc(r.name)}</h3><span class="muted">${esc(r.cut || '')}</span></div>
        <div class="chips">${recipeChips(r)}</div>
      </button>`).join('') : '<p class="empty">עדיין אין מתכונים. מתחילים מהכפתור למעלה, או הופכים רעיון למתכון.</p>'}`;
}
function lastLesson(recipeId) {
  return S.journal.filter((j) => j.recipeId === recipeId && j.next).sort((a, b) => b.date - a.date)[0];
}
function openRecipe(id) {
  const r = S.recipes.find((x) => x.id === id); if (!r) return;
  const lesson = lastLesson(id);
  const times = S.journal.filter((j) => j.recipeId === id).length;
  openSheet(r.name, `
    <div class="chips">${recipeChips(r)}${r.rest ? `<span class="chip">מנוחה ${fmtDur(r.rest)}</span>` : ''}${times ? `<span class="chip">בושל ${times === 1 ? 'פעם אחת' : times + ' פעמים'}</span>` : ''}</div>
    ${lesson ? `<div class="note warn"><strong>מהפעם הקודמת (${fmtDate(lesson.date)}):</strong><p class="pre">${esc(lesson.next)}</p></div>` : ''}
    ${r.ingredients ? `<div><h3>מרכיבים ותיבול</h3><p class="pre">${esc(r.ingredients)}</p></div>` : ''}
    ${r.steps?.length ? `<div><h3>שלבי הכנה</h3><ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
    ${r.notes ? `<div><h3>הערות</h3><p class="pre">${esc(r.notes)}</p></div>` : ''}
    ${/^https?:\/\//i.test(r.source || '') ? `<p class="muted small">מקור: <a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(r.source))}</a></p>` : ''}
    <button class="btn primary block" data-act="cook-start" data-arg="${r.id}">🔥 התחל בישול</button>
    <div class="row">
      <button class="btn grow" data-act="recipe-edit" data-arg="${r.id}">עריכה</button>
      <button class="btn grow" data-act="recipe-share" data-arg="${r.id}">שיתוף</button>
      <button class="btn danger" data-act="recipe-del" data-arg="${r.id}">מחיקה</button>
    </div>`);
}
function recipeForm(r = {}, ideaId = '', hint = '') {
  openSheet(r.id ? 'עריכת מתכון' : 'מתכון חדש', `
    <form data-form="recipe">
      <input type="hidden" name="id" value="${esc(r.id || '')}">
      <input type="hidden" name="ideaId" value="${esc(ideaId)}">
      ${hint ? `<p class="note warn">${esc(hint)}</p>` : ''}
      ${field('שם המתכון', inp('name', r.name, 'required'))}
      <div class="grid2">
        ${field('נתח', inp('cut', r.cut))}
        ${field('משקל (ק"ג)', numInp('weight', r.weight))}
      </div>
      <div class="grid2">
        ${field('טמפרטורת מעשנה (\u200E°C)', numInp('smokerTemp', r.smokerTemp))}
        ${field('טמפרטורת יעד בבשר (\u200E°C)', numInp('targetTemp', r.targetTemp))}
      </div>
      <div class="grid2">
        ${field('זמן בישול משוער (שעות)', numInp('hours', r.hours))}
        ${field('מנוחה (דקות)', numInp('rest', r.rest))}
      </div>
      ${field('סוג עץ', inp('wood', r.wood, 'list="woods"'))}
      <datalist id="woods"><option value="אלון"><option value="עץ תפוח"><option value="דובדבן"><option value="היקורי"><option value="מסקיט"><option value="הדרים"><option value="זית"><option value="פקאן"></datalist>
      ${field('מרכיבים ותיבול', area('ingredients', r.ingredients))}
      ${field('שלבי הכנה (שלב בכל שורה)', area('steps', (r.steps || []).join('\n'), 'rows="7"'))}
      ${field('הערות', area('notes', r.notes))}
      ${field('מקור (קישור)', inp('source', r.source, 'type="url" inputmode="url" placeholder="https://..."'))}
      <button class="btn primary block">שמירה</button>
    </form>`);
}
function saveRecipe(f) {
  const d = Object.fromEntries(new FormData(f));
  const rec = {
    id: d.id || uid(), name: d.name.trim(), cut: d.cut.trim(),
    weight: num(d.weight), smokerTemp: num(d.smokerTemp), targetTemp: num(d.targetTemp), hours: num(d.hours), rest: num(d.rest),
    wood: d.wood.trim(), ingredients: d.ingredients.trim(),
    steps: d.steps.split('\n').map((s) => s.trim()).filter(Boolean),
    notes: d.notes.trim(), source: d.source.trim(), updated: Date.now(),
  };
  const i = S.recipes.findIndex((x) => x.id === rec.id);
  if (i >= 0) S.recipes[i] = rec; else S.recipes.push(rec);
  if (d.ideaId) S.ideas = S.ideas.filter((x) => x.id !== d.ideaId);
  save(); closeSheet(); tab = 'recipes'; render(); toast('המתכון נשמר');
}
function recipeText(r) {
  const L = [r.name];
  const meta = [r.cut, r.weight && `${r.weight} ק"ג`, r.smokerTemp && `מעשנה ${r.smokerTemp}°C`, r.targetTemp && `יעד ${r.targetTemp}°C`, r.hours && `כ-${r.hours} שעות`, r.wood && `עץ: ${r.wood}`].filter(Boolean);
  if (meta.length) L.push(meta.join(' · '));
  if (r.ingredients) L.push('', 'מרכיבים:', r.ingredients);
  if (r.steps?.length) L.push('', 'שלבים:', ...r.steps.map((s, i) => `${i + 1}. ${s}`));
  if (r.notes) L.push('', r.notes);
  if (r.source) L.push('', `מקור: ${r.source}`);
  return L.join('\n');
}
async function shareRecipe(id) {
  const r = S.recipes.find((x) => x.id === id); if (!r) return;
  const text = recipeText(r);
  try {
    if (navigator.share) await navigator.share({ title: r.name, text });
    else { await navigator.clipboard.writeText(text); toast('המתכון הועתק'); }
  } catch (err) { if (err.name !== 'AbortError') toast('השיתוף לא הצליח'); }
}

/* ---------- import a recipe from a source ---------- */
// The app has no server and never fetches other sites: the user finds a recipe, pastes its text,
// and this parser maps it onto the recipe structure. The result is always reviewed before saving.
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const WOOD_KINDS = 'wood|chips|chunks|pellets';
const WOODS = [
  [/\b(post\s+)?oak\b|אלון/i, 'אלון'], [/\bhickory\b|היקורי/i, 'היקורי'], [/\bmesquite\b|מסקיט/i, 'מסקיט'],
  [new RegExp(`\\bapple\\s*(${WOOD_KINDS})|(עץ|עצי|שבבי)\\s+תפוח`, 'i'), 'עץ תפוח'],
  [new RegExp(`\\bcherry\\s*(${WOOD_KINDS})|(עץ|עצי|שבבי)\\s+דובדבן`, 'i'), 'דובדבן'],
  [new RegExp(`\\bpecan\\s*(${WOOD_KINDS})|(עץ|עצי|שבבי)\\s+פקאן`, 'i'), 'פקאן'],
  [new RegExp(`\\bmaple\\s*(${WOOD_KINDS})|(עץ|עצי|שבבי)\\s+מייפל`, 'i'), 'מייפל'],
  [/\bolive\s*wood|(עץ|עצי|שבבי)\s+זית/i, 'זית'],
  [/\b(citrus|orange)\s*wood|(עץ|עצי|שבבי)\s+הדרים/i, 'הדרים'],
];
const CUTS = [
  [/brisket|בריסקט/i, 'בריסקט בקר'], [/short\s*ribs?|שורט\s*ריבס|אסאדו/i, 'שורט ריבס / אסאדו'],
  [/pulled|shoulder|כתף/i, 'כתף'], [/wings|כנפיים/i, 'כנפי עוף'], [/thighs?|פרגיות|שוקיים|ירכיים/i, 'פרגיות / שוקיים'],
  [/chicken|עוף/i, 'עוף'], [/turkey|הודו/i, 'הודו'], [/salmon|סלמון/i, 'סלמון'], [/lamb|טלה|כבש/i, 'טלה'],
  [/picanha|פיקניה/i, 'פיקניה'], [/entrecote|rib\s*eye|אנטריקוט/i, 'אנטריקוט'], [/ribs|צלעות/i, 'צלעות'],
];
const HDR = {
  ingredients: /^(?:מרכיבים|מצרכים|חומרים|רכיבים|תיבול|לתיבול|לראב|ingredients?|for the rub|rub|you(?:'|’)ll need)(?=[^:：]{0,20}[:：]|\s*$)/i,
  steps: /^(?:אופן ההכנה|אופן הכנה|הוראות הכנה|שלבי הכנה|הכנה|שלבים|הוראות|instructions?|directions?|method|steps|preparation)(?=[^:：]{0,20}[:：]|\s*$)/i,
  notes: /^(?:הערות|טיפים|notes?|tips?)(?=[^:：]{0,20}[:：]|\s*$)/i,
};
const headerOf = (l) => (l.length > 40 ? null : Object.keys(HDR).find((k) => HDR[k].test(l)) || null);
const stripLead = (l) => l.replace(/^(?:\d+\s*[.)]\s*|[-•*·▪◦]\s*|(?:שלב|step)\s*\d+\s*[:.)-]?\s*)/i, '').trim();
const HOURS_RE = /(\d+(?:[.,]\d+)?)(?:\s*(?:[-–]|עד|to)\s*(\d+(?:[.,]\d+)?))?\s*(?:שעות|שעה|hours?\b|hrs?\b)/gi;
const REST_RE = /מנוחה|לנוח|\brest/i;

function findTemps(text) {
  const hasF = /[°º]\s*F\b|fahrenheit|פרנהייט|\d\s*F\b/i.test(text);
  const hasC = /[°º]\s*C\b|celsius|צלזיוס/i.test(text);
  const re = /(\d{2,3})\s*(?:[°º]\s*([CF]\b)?|מעלות\s*(צלזיוס|פרנהייט)?|degrees?\s*(fahrenheit|celsius|[CF]\b)?|([CF])\b)/gi;
  const found = [];
  for (const m of text.matchAll(re)) {
    const tag = (m[2] || m[3] || m[4] || m[5] || '').toLowerCase();
    let unit = /^f|פרנהייט/.test(tag) ? 'F' : /^c|צלזיוס/.test(tag) ? 'C' : (hasF && !hasC ? 'F' : 'C');
    const v = +m[1], c = unit === 'F' ? Math.round(((v - 32) * 5) / 9) : v;
    if (c < 40 || c > 200) continue;
    const a = text.lastIndexOf('\n', m.index) + 1, b = text.indexOf('\n', m.index);
    found.push({ c, converted: unit === 'F', line: text.slice(a, b < 0 ? undefined : b) });
  }
  const SM = /מעשנה|smoker|grill|preheat|לחמם|לייצב|חום עקיף|indirect|\bpit\b/i;
  const IN = /פנימית|internal|ליבה|probe|מדחום|מגיע|until|reaches|להוציא|\bpull\b/i;
  const hot = found.filter((t) => t.c >= 95);
  const smoker = hot.find((t) => SM.test(t.line) && !IN.test(t.line)) || hot.find((t) => t.c >= 100) || null;
  const cool = found.filter((t) => t !== smoker && t.c >= 45 && t.c <= 99);
  const marked = cool.filter((t) => IN.test(t.line));
  const pool = marked.length ? marked : cool;
  const target = pool.length ? pool.reduce((x, y) => (y.c > x.c ? y : x)) : null;
  return { smoker: smoker?.c ?? null, target: target?.c ?? null, converted: found.some((t) => t.converted) };
}
function findHours(lines) {
  let best = null;
  const up = (v) => { if (v > 0 && v <= 30) best = Math.max(best ?? 0, v); };
  for (const l of lines) {
    if (REST_RE.test(l)) continue;
    if (/שעתיים/.test(l)) up(2);
    if (/שעה וחצי/.test(l)) up(1.5);
    for (const m of l.matchAll(HOURS_RE)) { const a = num(m[1]), b = m[2] ? num(m[2]) : a; up((a + b) / 2); }
  }
  return best != null ? Math.round(best * 10) / 10 : null;
}
function findRest(lines) {
  for (const l of lines) {
    if (!REST_RE.test(l)) continue;
    let m = l.match(/(\d+)\s*(?:דקות|דק'|minutes?\b|mins?\b)/i); if (m) return +m[1];
    m = l.match(/(\d+(?:[.,]\d+)?)\s*(?:שעות|שעה|hours?\b|hrs?\b)/i); if (m) return Math.round(num(m[1]) * 60);
    if (/שעה וחצי/.test(l)) return 90;
    if (/שעתיים/.test(l)) return 120;
    if (/חצי שעה|half an hour/i.test(l)) return 30;
    if (/שעה|an hour/i.test(l)) return 60;
  }
  return null;
}
function findWeight(t) {
  let m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:ק["״']ג|קג|קילו(?:גרם)?|kg\b|kilos?\b)/i);
  if (m) return num(m[1]);
  m = t.match(/(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:lbs?\b|pounds?\b|ליברות|פאונד)/i);
  return m ? Math.round(num(m[1]) * 4.536) / 10 : null;
}

// schema.org Recipe (JSON-LD), for when the pasted text is a page's source.
function recipeNode(n) {
  if (!n || typeof n !== 'object') return null;
  if (Array.isArray(n)) { for (const x of n) { const h = recipeNode(x); if (h) return h; } return null; }
  return n.recipeIngredient ? n : recipeNode(n['@graph']);
}
function jsonLdToText(text) {
  const blocks = [...text.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  if (!blocks.length && /"recipeIngredient"/.test(text)) blocks.push(text);
  for (const b of blocks) {
    let node = null;
    try { node = recipeNode(JSON.parse(b)); } catch { continue; }
    if (!node) continue;
    const plain = (x) => String(x ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const flat = (x) => (!x ? [] : typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(flat) : x.itemListElement ? flat(x.itemListElement) : [x.text || x.name || '']);
    const iso = String(node.cookTime || node.totalTime || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
    const hrs = iso && (iso[1] || iso[2]) ? (+(iso[1] || 0) + +(iso[2] || 0) / 60).toFixed(1) : '';
    return [plain(node.name), plain(node.description), hrs && `${hrs} hours`, 'Ingredients', ...flat(node.recipeIngredient).map(plain),
      'Instructions', ...flat(node.recipeInstructions).map(plain)].filter(Boolean).join('\n');
  }
  return null;
}

function parseRecipeText(raw, source = '') {
  const text = (jsonLdToText(raw) || raw).replace(/\r/g, '').replace(/[‎‏]/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const name = stripLead(lines[0]).replace(/^מתכון ל/, '').slice(0, 80);
  const sec = { ingredients: [], steps: [], notes: [], other: [] };
  let cur = null;
  for (const l of lines.slice(1)) {
    const h = headerOf(l);
    if (h) { cur = h; const tail = /[:：]/.test(l) ? l.replace(/^[^:：]*[:：]\s*/, '') : ''; if (tail) sec[h].push(tail); continue; }
    sec[cur || 'other'].push(l);
  }
  if (!sec.steps.length) {
    const numbered = sec.other.filter((l) => /^(?:\d+\s*[.)]|(?:שלב|step)\s*\d+)/i.test(l));
    sec.steps = numbered.length ? numbered : sec.other.filter((l) => l.length > 45);
    sec.other = sec.other.filter((l) => !sec.steps.includes(l));
  }
  if (!sec.ingredients.length) {
    sec.ingredients = sec.other.filter((l) => l.length < 70 && /^(?:[-•*·▪◦]|\d|½|¼|¾|כף|כפית|כוס)/.test(l));
    sec.other = sec.other.filter((l) => !sec.ingredients.includes(l));
  }
  const t = findTemps(text);
  const cut = (CUTS.find(([re]) => re.test(name)) || CUTS.find(([re]) => re.test(text)) || [])[1] || '';
  const wood = (WOODS.find(([re]) => re.test(text)) || [])[1] || '';
  const notes = [...sec.notes, ...sec.other.filter((l) => l.length > 25)];
  const recipe = {
    name, cut, wood, weight: findWeight(text), smokerTemp: t.smoker, targetTemp: t.target,
    hours: findHours(lines), rest: findRest(lines),
    ingredients: sec.ingredients.map(stripLead).join('\n'),
    steps: sec.steps.map(stripLead).filter(Boolean),
    notes: notes.join('\n'), source: source.trim(),
  };
  const missing = [
    !recipe.smokerTemp && 'טמפרטורת מעשנה', !recipe.targetTemp && 'טמפרטורת יעד', !recipe.hours && 'זמן בישול',
    !recipe.weight && 'משקל', !recipe.wood && 'סוג עץ', !recipe.steps.length && 'שלבים', !recipe.ingredients && 'מרכיבים',
  ].filter(Boolean);
  let hint = 'השדות מולאו אוטומטית מהטקסט. כדאי לעבור עליהם לפני השמירה.';
  if (t.converted) hint += ' הטמפרטורות הומרו מפרנהייט לצלזיוס.';
  if (missing.length) hint += ` לא נמצאו בטקסט: ${missing.join(', ')}.`;
  return { recipe, hint };
}

function importSheet() {
  openSheet('ייבוא מתכון ממקור', `
    <p class="muted">מחפשים מתכון ברשת, מעתיקים את הטקסט שלו ומדביקים כאן. האפליקציה מפרקת אותו לשדות של מתכון, ואתה מאשר לפני השמירה.</p>
    <form data-form="import">
      ${field('מה מחפשים?', inp('q', '', 'placeholder="למשל: צלעות טלה מעושנות" enterkeyhint="search"'))}
      <div class="row">
        <button type="button" class="btn grow" data-act="import-search" data-arg="google">חיפוש ב-Google</button>
        <button type="button" class="btn grow" data-act="import-search" data-arg="ddg">חיפוש ב-DuckDuckGo</button>
      </div>
      ${field('קישור למקור (לא חובה)', inp('source', '', 'type="url" inputmode="url" placeholder="https://..."'))}
      ${field('טקסט המתכון', area('text', '', 'rows="9" required placeholder="מדביקים כאן את המתכון: שם, מרכיבים, אופן ההכנה..."'))}
      <button type="button" class="btn block" data-act="import-paste">הדבקה מהלוח</button>
      <button class="btn primary block">פענוח ומילוי המתכון</button>
    </form>
    <p class="muted small">האפליקציה עצמה לא שולחת כלום לרשת. החיפוש נפתח בדפדפן, והפענוח נעשה במכשיר.</p>`);
}
function importSearch(engine, el) {
  const q = el.form.q.value.trim();
  if (!q) { toast('כותבים קודם מה מחפשים'); el.form.q.focus(); return; }
  const query = encodeURIComponent(`${q} מתכון מעשנה`);
  window.open((engine === 'ddg' ? 'https://duckduckgo.com/?q=' : 'https://www.google.com/search?q=') + query, '_blank', 'noopener,noreferrer');
}
async function importPaste(_, el) {
  try {
    const t = await navigator.clipboard.readText();
    if (!t.trim()) { toast('הלוח ריק'); return; }
    el.form.text.value = t;
    if (/^https?:\/\/\S+$/i.test(t.trim())) toast('בלוח יש רק קישור. צריך להעתיק את טקסט המתכון עצמו.');
  } catch { toast('אין גישה ללוח. אפשר להדביק ידנית בתיבת הטקסט.'); }
}
function runImport(f) {
  const d = Object.fromEntries(new FormData(f));
  if (/^https?:\/\/\S+$/i.test(d.text.trim())) { toast('הודבק רק קישור. האפליקציה לא קוראת אתרים; צריך להדביק את טקסט המתכון.'); return; }
  const res = parseRecipeText(d.text, d.source);
  if (!res || !res.recipe.name) { toast('לא הצלחתי לפענח את הטקסט'); return; }
  recipeForm(res.recipe, '', res.hint);
}

/* ---------- cook mode ---------- */
function startCook(id) {
  if (S.cook && !confirm('יש בישול פעיל. להחליף אותו בבישול חדש? המדידות של הבישול הנוכחי יימחקו.')) return;
  const r = S.recipes.find((x) => x.id === id);
  S.cook = {
    id: uid(), recipeId: r?.id || null, name: r?.name || 'בישול חופשי',
    weight: r?.weight ?? null, wood: r?.wood || '', smokerTemp: r?.smokerTemp ?? null, targetTemp: r?.targetTemp ?? null,
    start: Date.now(), steps: (r?.steps || []).map((t) => ({ t, at: null })), log: [], timers: [],
  };
  save(); closeSheet(); tab = 'cook'; render();
}
function analyze(c) {
  const m = c.log.filter((r) => r.meat != null).sort((a, b) => a.at - b.at);
  if (!c.targetTemp) return { cls: '', msg: 'לא הוגדרה טמפרטורת יעד, ולכן אין הערכת סיום.' };
  if (m.length < 2) return { cls: '', msg: 'אחרי שתי מדידות של טמפרטורת הבשר תופיע כאן הערכת זמן סיום.' };
  const last = m[m.length - 1];
  if (last.meat >= c.targetTemp) return { cls: 'good', msg: `הבשר הגיע ליעד (${last.meat}°C). אפשר להוציא ולהתחיל מנוחה.` };
  const win = m.filter((r) => r.at >= last.at - 90 * 60000);
  const first = win.length >= 2 ? win[0] : m[m.length - 2];
  const hrs = (last.at - first.at) / 3600000;
  if (hrs < 0.15) return { cls: '', msg: 'המדידות האחרונות קרובות מדי בזמן. ההערכה תתעדכן במדידה הבאה.' };
  const slope = (last.meat - first.meat) / hrs;
  const stall = last.meat >= 60 && last.meat <= 80 && slope < 2 && hrs >= 0.5;
  if (stall) return { cls: 'warn', msg: `נראה שנכנסת ל-stall: הבשר עומד סביב ${last.meat}°C. זה שלב רגיל. אפשר לחכות בסבלנות, או לעטוף בנייר קצבים או בנייר כסף כדי לקצר אותו.` };
  if (slope <= 0.5) return { cls: 'warn', msg: 'הטמפרטורה כמעט לא עולה כרגע, ולכן אין הערכת סיום.' };
  const eta = last.at + ((c.targetTemp - last.meat) / slope) * 3600000;
  return { cls: '', msg: `בקצב הנוכחי (כ-${slope.toFixed(1)}°C לשעה) הבשר יגיע ליעד בסביבות ${fmtTime(eta)}${dayLabel(eta) !== 'היום' ? ' ' + dayLabel(eta) : ''}. זו הערכה גסה; stall עלול לדחות אותה.` };
}
function chart(log, start, target) {
  const pts = log.filter((r) => r.meat != null || r.smoker != null).sort((a, b) => a.at - b.at);
  if (pts.length < 2) return '<p class="muted">הגרף יופיע אחרי שתי מדידות.</p>';
  const W = 340, H = 190, L = 30, R = 10, T = 10, B = 22;
  const t0 = Math.min(start, pts[0].at), span = Math.max(pts[pts.length - 1].at - t0, 60000);
  const vals = pts.flatMap((p) => [p.meat, p.smoker]).filter((v) => v != null);
  if (target) vals.push(target);
  let lo = Math.floor(Math.min(...vals) / 20) * 20, hi = Math.ceil(Math.max(...vals) / 20) * 20;
  if (hi === lo) hi = lo + 20;
  const x = (t) => L + ((t - t0) / span) * (W - L - R);
  const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const path = (k) => pts.filter((p) => p[k] != null).map((p) => `${x(p.at).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const dots = (k) => pts.filter((p) => p[k] != null).map((p) => `<circle class="dot-${k}" r="2.6" cx="${x(p.at).toFixed(1)}" cy="${y(p[k]).toFixed(1)}"/>`).join('');
  let grid = '';
  const step = (hi - lo) / 4;
  for (let i = 0; i <= 4; i++) {
    const v = lo + step * i;
    grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${Math.round(v)}</text>`;
  }
  const hoursTotal = span / 3600000;
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="גרף טמפרטורות לאורך הבישול">
      ${grid}
      ${target ? `<line class="target" x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}"/>` : ''}
      <polyline class="smoker" points="${path('smoker')}"/>
      <polyline class="meat" points="${path('meat')}"/>
      ${dots('smoker')}${dots('meat')}
      <text x="${L}" y="${H - 6}">${fmtTime(t0)}</text>
      <text x="${W - R}" y="${H - 6}" text-anchor="end">${fmtTime(t0 + span)} (${hoursTotal.toFixed(1)}h)</text>
    </svg>
    <div class="legend"><span><i class="l-meat"></i>בשר</span><span><i class="l-smoker"></i>מעשנה</span>${target ? '<span><i class="l-target"></i>יעד</span>' : ''}</div>`;
}
function logTable(log, deletable) {
  if (!log.length) return '';
  const rows = [...log].sort((a, b) => b.at - a.at);
  return `<table>
    <thead><tr><th>שעה</th><th>מעשנה</th><th>בשר</th><th>הערה</th>${deletable ? '<th></th>' : ''}</tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td class="n">${fmtTime(r.at)}</td>
      <td class="n">${r.smoker != null ? r.smoker + '°' : '–'}</td>
      <td class="n">${r.meat != null ? r.meat + '°' : '–'}</td>
      <td>${esc(r.note || '')}</td>
      ${deletable ? `<td><button class="icon-btn" data-act="log-del" data-arg="${r.at}" aria-label="מחיקת מדידה">✕</button></td>` : ''}
    </tr>`).join('')}</tbody></table>`;
}
function viewCook() {
  const c = S.cook;
  if (!c) {
    return `
      <div class="card">
        <h2>אין בישול פעיל</h2>
        <p class="muted">בוחרים מתכון ומתחילים, או פותחים בישול חופשי בלי מתכון.</p>
        ${S.recipes.length ? `<form data-form="cook-pick">
          ${field('מתכון', `<select name="id">${S.recipes.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>`)}
          <button class="btn primary block">🔥 התחל בישול</button>
        </form>` : ''}
        <button class="btn block" data-act="cook-start" data-arg="">בישול חופשי</button>
      </div>`;
  }
  const a = analyze(c);
  const done = c.steps.filter((s) => s.at).length;
  const timers = [...c.timers].sort((x, y) => x.end - y.end);
  const notifState = !('Notification' in window) ? 'none' : Notification.permission;
  return `
    <div class="card">
      <div class="row between"><h2>${esc(c.name)}</h2><span class="muted">התחיל ב-${fmtTime(c.start)}${dayLabel(c.start) !== 'היום' ? ' ' + dayLabel(c.start) : ''}</span></div>
      <div class="big" data-elapsed="${c.start}">${fmtClock(Date.now() - c.start)}</div>
      <div class="chips">${c.weight ? `<span class="chip">${c.weight} ק"ג</span>` : ''}${c.smokerTemp ? `<span class="chip">מעשנה ${c.smokerTemp}°C</span>` : ''}${c.targetTemp ? `<span class="chip">יעד ${c.targetTemp}°C</span>` : ''}${c.wood ? `<span class="chip">${esc(c.wood)}</span>` : ''}</div>
      <p class="note ${a.cls}">${esc(a.msg)}</p>
      <label class="row"><input type="checkbox" data-act="wake-toggle" ${wakeWanted ? 'checked' : ''}> <span>להשאיר את המסך דולק</span></label>
    </div>

    ${c.steps.length ? `<div class="card">
      <div class="row between"><h3>שלבים</h3><span class="muted">${done} מתוך ${c.steps.length}</span></div>
      <ul class="steps">${c.steps.map((s, i) => `<li><label class="${s.at ? 'done' : ''}">
        <input type="checkbox" data-act="step-toggle" data-arg="${i}" ${s.at ? 'checked' : ''}>
        <span>${esc(s.t)}</span>${s.at ? `<time>${fmtTime(s.at)}</time>` : ''}</label></li>`).join('')}</ul>
    </div>` : ''}

    <div class="card">
      <h3>טיימרים</h3>
      <div class="row">${[15, 30, 45, 60].map((m) => `<button class="btn sm" data-act="timer-add" data-arg="${m}">${m} דק'</button>`).join('')}</div>
      <form data-form="timer" class="row">
        <div class="grow">${inp('label', '', 'placeholder="למשל: ריסוס" aria-label="שם הטיימר"')}</div>
        <div>${numInp('min', '', 'placeholder="דקות" aria-label="דקות" size="5" required')}</div>
        <button class="btn">הוספה</button>
      </form>
      ${timers.map((t) => `<div class="timer ${t.end <= Date.now() ? 'over' : ''}">
        <span class="clock" data-end="${t.end}">${fmtClock(t.end - Date.now())}</span>
        <span class="grow">${esc(t.label)} <span class="muted">· ${fmtTime(t.end)}</span></span>
        <button class="icon-btn" data-act="timer-del" data-arg="${t.id}" aria-label="מחיקת טיימר">✕</button>
      </div>`).join('')}
      ${notifState === 'default' ? '<button class="btn sm" data-act="notif-enable">הפעלת התראות מערכת</button>' : ''}
      <p class="muted small">הטיימר מצלצל כשהאפליקציה פתוחה. כשהטלפון נעול אין הבטחה שתישמע התראה, ולכן לבישול ארוך כדאי להשאיר את המסך דולק או לייצא את לוח הזמנים ליומן (בלשונית "כלים").</p>
    </div>

    <div class="card">
      <h3>מדידת טמפרטורה</h3>
      <form data-form="log">
        <div class="grid2">
          ${field('מעשנה (\u200E°C)', numInp('smoker', ''))}
          ${field('בשר (\u200E°C)', numInp('meat', ''))}
        </div>
        ${field('הערה', inp('note', '', 'placeholder="עטפתי, הוספתי עץ, ריססתי..."'))}
        <button class="btn primary block">רישום מדידה</button>
      </form>
      ${chart(c.log, c.start, c.targetTemp)}
      ${logTable(c.log, true)}
    </div>

    <button class="btn primary block" data-act="cook-finish">סיום ותיעוד ביומן</button>
    <button class="btn danger block" data-act="cook-cancel">ביטול הבישול בלי תיעוד</button>`;
}
function addTimer(min, label) {
  if (!S.cook || !(min > 0)) return;
  ensureAudio();
  S.cook.timers.push({ id: uid(), label: label || `טיימר ${min} דק'`, end: Date.now() + min * 60000, fired: false });
  save(); render();
}
function addLog(f) {
  const d = Object.fromEntries(new FormData(f));
  const smoker = num(d.smoker), meat = num(d.meat), note = d.note.trim();
  if (smoker == null && meat == null && !note) { toast('אין מה לרשום: צריך טמפרטורה אחת לפחות או הערה'); return; }
  S.cook.log.push({ at: Date.now(), smoker, meat, note });
  save(); render();
}
function finishCook() {
  const c = S.cook; if (!c) return;
  journalForm({
    date: Date.now(), name: c.name, recipeId: c.recipeId, weight: c.weight, wood: c.wood,
    durationMin: Math.round((Date.now() - c.start) / 60000),
  }, true);
}

/* ---------- alarm / wake lock / notifications ---------- */
function ensureAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* no audio available */ }
}
function beep() {
  if (!audio) return;
  const now = audio.currentTime;
  for (let i = 0; i < 6; i++) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = i % 2 ? 660 : 880;
    g.gain.setValueAtTime(0.0001, now + i * 0.35);
    g.gain.exponentialRampToValueAtTime(0.4, now + i * 0.35 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 0.3);
    o.connect(g).connect(audio.destination);
    o.start(now + i * 0.35); o.stop(now + i * 0.35 + 0.32);
  }
}
async function fireAlarm(label) {
  beep();
  if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
  $('#alarm-text').textContent = label;
  const d = $('#alarm'); if (!d.open) d.showModal();
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) reg.showNotification('הטיימר הסתיים', { body: label, tag: 'smoker-timer', icon: 'icon-192.png' });
      else new Notification('הטיימר הסתיים', { body: label });
    } catch { /* notifications unavailable */ }
  }
}
async function setWake(on) {
  wakeWanted = on;
  try {
    if (on && 'wakeLock' in navigator) { wake = await navigator.wakeLock.request('screen'); }
    else if (on) { wakeWanted = false; toast('הדפדפן הזה לא תומך בהשארת המסך דולק'); render(); }
    else if (wake) { await wake.release(); wake = null; }
  } catch { wakeWanted = false; toast('לא הצלחתי להשאיר את המסך דולק'); render(); }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (wakeWanted) setWake(true); tick(); }
});

function tick() {
  const now = Date.now();
  const pill = $('#cook-pill');
  if (S.cook) { pill.hidden = false; pill.textContent = '🔥 ' + fmtClock(now - S.cook.start); } else pill.hidden = true;
  document.querySelectorAll('[data-elapsed]').forEach((el) => { el.textContent = fmtClock(now - +el.dataset.elapsed); });
  document.querySelectorAll('[data-end]').forEach((el) => {
    el.textContent = fmtClock(+el.dataset.end - now);
    el.parentElement.classList.toggle('over', +el.dataset.end <= now);
  });
  if (!S.cook) return;
  const due = S.cook.timers.filter((t) => !t.fired && t.end <= now);
  if (due.length) {
    due.forEach((t) => { t.fired = true; });
    save();
    fireAlarm(due.map((t) => t.label).join(' · '));
  }
}

/* ---------- journal ---------- */
function viewJournal() {
  const list = [...S.journal].sort((a, b) => b.date - a.date);
  return `
    <button class="btn primary block" data-act="journal-new">＋ רישום חדש</button>
    ${list.length ? list.map((j) => `
      <button class="card" data-act="journal-open" data-arg="${j.id}">
        <div class="row between"><h3>${esc(j.name)}</h3><span class="stars" aria-label="דירוג ${j.rating || 0} מתוך 5">${stars(j.rating)}</span></div>
        <div class="chips"><span class="chip">${fmtDate(j.date)}</span>${j.weight ? `<span class="chip">${j.weight} ק"ג</span>` : ''}${j.durationMin ? `<span class="chip">${fmtDur(j.durationMin)}</span>` : ''}${j.wood ? `<span class="chip">${esc(j.wood)}</span>` : ''}</div>
        ${j.result ? `<p class="muted">${esc(j.result.length > 110 ? j.result.slice(0, 110) + '…' : j.result)}</p>` : ''}
      </button>`).join('') : '<p class="empty">היומן ריק. כל בישול שמסתיים במצב בישול נרשם כאן, ואפשר גם להוסיף רישום ידנית.</p>'}`;
}
function openJournal(id) {
  const j = S.journal.find((x) => x.id === id); if (!j) return;
  const start = j.log?.length ? Math.min(...j.log.map((r) => r.at)) : j.date;
  openSheet(j.name, `
    <div class="row between"><span class="muted">${fmtDate(j.date)}</span><span class="stars">${stars(j.rating)}</span></div>
    <div class="chips">${j.weight ? `<span class="chip">${j.weight} ק"ג</span>` : ''}${j.durationMin ? `<span class="chip">${fmtDur(j.durationMin)}</span>` : ''}${j.wood ? `<span class="chip">${esc(j.wood)}</span>` : ''}${j.weather ? `<span class="chip">${esc(j.weather)}</span>` : ''}</div>
    ${j.photo ? `<img class="photo" src="${esc(j.photo)}" alt="תמונה מהבישול">` : ''}
    ${j.result ? `<div><h3>איך יצא</h3><p class="pre">${esc(j.result)}</p></div>` : ''}
    ${j.next ? `<div class="note warn"><strong>מה לשנות בפעם הבאה</strong><p class="pre">${esc(j.next)}</p></div>` : ''}
    ${j.log?.length ? `<div><h3>מדידות</h3>${chart(j.log, start, j.targetTemp)}${logTable(j.log, false)}</div>` : ''}
    <div class="row">
      <button class="btn grow" data-act="journal-edit" data-arg="${j.id}">עריכה</button>
      <button class="btn danger" data-act="journal-del" data-arg="${j.id}">מחיקה</button>
    </div>`);
}
function journalForm(j = {}, fromCook = false) {
  openSheet(fromCook ? 'סיום ותיעוד' : j.id ? 'עריכת רישום' : 'רישום חדש', `
    <form data-form="journal">
      <input type="hidden" name="id" value="${esc(j.id || '')}">
      <input type="hidden" name="recipeId" value="${esc(j.recipeId || '')}">
      <input type="hidden" name="fromCook" value="${fromCook ? '1' : ''}">
      ${field('מה בישלת', inp('name', j.name, 'required'))}
      <div class="grid2">
        ${field('תאריך', inp('date', isoDate(j.date || Date.now()), 'type="date" required'))}
        ${field('משקל (ק"ג)', numInp('weight', j.weight))}
      </div>
      <div class="grid2">
        ${field('משך בפועל (שעות)', numInp('hours', j.durationMin ? Math.round(j.durationMin / 6) / 10 : ''))}
        ${field('סוג עץ', inp('wood', j.wood))}
      </div>
      ${field('מזג אוויר', inp('weather', j.weather, 'placeholder="קר, רוח חזקה, 28°C..."'))}
      ${field('דירוג', `<select name="rating"><option value="">בלי דירוג</option>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${j.rating === n ? 'selected' : ''}>${stars(n)}</option>`).join('')}</select>`)}
      ${field('איך יצא', area('result', j.result, 'placeholder="קרום, עסיסיות, עשן, מליחות..."'))}
      ${field('מה לשנות בפעם הבאה', area('next', j.next))}
      ${field(j.photo ? 'החלפת תמונה' : 'תמונה', '<input type="file" name="photo" accept="image/*">')}
      <button class="btn primary block">שמירה ביומן</button>
    </form>`);
}
function shrinkImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1000 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      res(cv.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
    img.src = url;
  });
}
async function saveJournal(f) {
  const fd = new FormData(f), d = Object.fromEntries(fd);
  const old = S.journal.find((x) => x.id === d.id) || {};
  const hours = num(d.hours);
  const [y, m, day] = d.date.split('-').map(Number);
  const entry = {
    ...old, id: d.id || uid(), recipeId: d.recipeId || old.recipeId || null,
    name: d.name.trim(), date: new Date(y, m - 1, day, 12).getTime(),
    weight: num(d.weight), durationMin: hours != null ? Math.round(hours * 60) : null,
    wood: d.wood.trim(), weather: d.weather.trim(), rating: num(d.rating),
    result: d.result.trim(), next: d.next.trim(),
  };
  const file = fd.get('photo');
  if (file && file.size) {
    try { entry.photo = await shrinkImage(file); } catch { toast('לא הצלחתי לקרוא את התמונה; הרישום נשמר בלעדיה'); }
  }
  if (d.fromCook && S.cook) {
    entry.log = S.cook.log; entry.targetTemp = S.cook.targetTemp;
    entry.steps = S.cook.steps;
    S.cook = null; setWake(false);
  }
  const i = S.journal.findIndex((x) => x.id === entry.id);
  if (i >= 0) S.journal[i] = entry; else S.journal.push(entry);
  await save(); closeSheet(); tab = 'journal'; render(); toast('נשמר ביומן');
}

/* ---------- ideas ---------- */
function viewIdeas() {
  const list = [...S.ideas].sort((a, b) => b.created - a.created);
  return `
    <form data-form="idea" class="card">
      ${field('רעיון חדש', area('text', '', 'required placeholder="צלעות טלה עם סילאן וצ\'ילי, עישון על עץ זית..."'))}
      <button class="btn primary block">שמירת הרעיון</button>
    </form>
    ${list.length ? list.map((x) => `
      <div class="card">
        <p class="pre">${esc(x.text)}</p>
        <div class="row between">
          <span class="muted small">${fmtDate(x.created)}</span>
          <span class="row">
            <button class="btn sm" data-act="idea-to-recipe" data-arg="${x.id}">הפוך למתכון</button>
            <button class="icon-btn" data-act="idea-del" data-arg="${x.id}" aria-label="מחיקת רעיון">✕</button>
          </span>
        </div>
      </div>`).join('') : '<p class="empty">כאן שומרים רעיונות שעולים בראש, ואחר כך הופכים אותם למתכון בלחיצה.</p>'}`;
}

/* ---------- tools ---------- */
const TEMPS = [
  ['בריסקט', '110–125', '93–96', 'מוכן כשהמדחום נכנס בלי התנגדות'],
  ['שורט ריבס / אסאדו', '110–125', '93–96', ''],
  ['כתף טלה למשיכה', '110–125', '90–95', ''],
  ['צלעות טלה', '110–120', '57–63', 'מדיום'],
  ['אנטריקוט / סינטה (נתח שלם)', '105–120', '52–57', 'מדיום-רייר עד מדיום, ואחר כך צריבה'],
  ['עוף שלם / חזה', '135–160', '74', 'מודדים בחלק העבה, בלי לגעת בעצם'],
  ['שוקיים וירכיים', '135–160', '80–85', 'בטוח מ-74, רך יותר בטמפרטורה גבוהה ממנה'],
  ['הודו', '135–160', '74', ''],
  ['קבב / בשר טחון', '110–135', '71', ''],
  ['סלמון', '95–110', '60–63', ''],
];
const SEASONING = [
  'לקרוא את הוראות היצרן; אם הן שונות מהרשימה הזו, הן הקובעות',
  'לשטוף רשתות ומגשים במים וסבון ולייבש היטב',
  'למרוח שכבה דקה של שמן צמחי על הדפנות הפנימיות והרשתות',
  'להדליק ולהעלות בהדרגה ל-120–135°C',
  'להחזיק את הטמפרטורה שעתיים עד שלוש, ולהוסיף עץ בשעה האחרונה',
  'לבדוק בזמן הזה מאיפה דולף עשן ואם הדלת אטומה',
  'לבדוק את דיוק המדחום במים רותחים (אמור להראות קרוב ל-100°C)',
  'לתת למעשנה להתקרר לאט, בלי לשטוף',
];
function defaultServe() {
  const d = new Date(); d.setHours(19, 0, 0, 0);
  if (d < Date.now()) d.setDate(d.getDate() + 1);
  return `${isoDate(d)}T19:00`;
}
function viewTools() {
  const daysSince = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 864e5) : null;
  return `
    <details class="card" open>
      <summary>תכנון לאחור: מתי מדליקים?</summary>
      <form data-calc="plan">
        ${S.recipes.length ? field('מילוי ממתכון', `<select name="recipe" data-act="plan-fill"><option value="">בחירה...</option>${S.recipes.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>`) : ''}
        ${field('מה מבשלים', inp('name', ''))}
        ${field('שעת הגשה', inp('serve', defaultServe(), 'type="datetime-local"'))}
        <div class="grid2">
          ${field('זמן בישול (שעות)', numInp('hours', ''))}
          ${field('מנוחה (דקות)', numInp('rest', '60'))}
        </div>
        <div class="grid2">
          ${field('מרווח ביטחון (דקות)', numInp('buffer', '60'))}
          ${field('חימום המעשנה (דקות)', numInp('preheat', '30'))}
        </div>
        <div class="result" data-out="plan"><span class="muted">ממלאים זמן בישול ושעת הגשה, ולוח הזמנים מופיע כאן.</span></div>
        <button type="button" class="btn block" data-act="plan-ics">ייצוא ליומן הטלפון (עם התראות)</button>
      </form>
    </details>

    <details class="card">
      <summary>מחשבון מלח</summary>
      <form data-calc="salt">
        <div class="grid2">
          ${field('משקל הנתח (ק"ג)', numInp('kg', ''))}
          ${field('אחוז מלח', numInp('pct', '1'))}
        </div>
        <div class="result" data-out="salt"><span class="muted">המלחה יבשה: בדרך כלל בין 0.8% ל-1.5% ממשקל הנתח.</span></div>
      </form>
    </details>

    <details class="card">
      <summary>מחשבון מנות: כמה בשר לקנות?</summary>
      <form data-calc="portions">
        <div class="grid3">
          ${field('סועדים', numInp('guests', ''))}
          ${field('גרם מוכן לסועד', numInp('grams', '150'))}
          ${field('תפוקה (%)', numInp('yield', '55'))}
        </div>
        <div class="result" data-out="portions"><span class="muted">תפוקה היא מה שנשאר אחרי ניקוי ובישול. בבריסקט ובכתף: בערך 50% עד 60%; בעוף עם עצם: בערך 65%.</span></div>
      </form>
    </details>

    <details class="card">
      <summary>טמפרטורות יעד</summary>
      <table>
        <thead><tr><th>נתח</th><th>מעשנה \u200E°C</th><th>בשר \u200E°C</th></tr></thead>
        <tbody>${TEMPS.map((t) => `<tr><td>${t[0]}${t[3] ? `<div class="muted small">${t[3]}</div>` : ''}</td><td class="n">${t[1]}</td><td class="n">${t[2]}</td></tr>`).join('')}</tbody>
      </table>
      <p class="muted small">ערכים מקובלים להכוונה. בעוף ובבשר טחון הטמפרטורה היא עניין של בטיחות, ולא רק של טעם.</p>
    </details>

    <details class="card">
      <summary>מעשנה חדשה: שריפה ראשונה</summary>
      <ul class="steps">${SEASONING.map((t, i) => `<li><label class="${S.seasoning[i] ? 'done' : ''}"><input type="checkbox" data-act="season-toggle" data-arg="${i}" ${S.seasoning[i] ? 'checked' : ''}><span>${t}</span></label></li>`).join('')}</ul>
    </details>

    <details class="card" open>
      <summary>גיבוי ושחזור</summary>
      <p class="muted">כל הנתונים נשמרים רק במכשיר הזה. ${daysSince == null ? 'עדיין לא יוצא גיבוי.' : daysSince === 0 ? 'גיבוי אחרון: היום.' : `גיבוי אחרון: לפני ${daysSince === 1 ? 'יום' : daysSince === 2 ? 'יומיים' : daysSince + ' ימים'}.`}</p>
      <p class="muted small">${S.recipes.length} מתכונים · ${S.journal.length} רישומי יומן · ${S.ideas.length} רעיונות</p>
      <button class="btn primary block" data-act="backup-export">ייצוא לקובץ</button>
      <label>שחזור מקובץ גיבוי<input type="file" accept="application/json,.json" data-act="backup-import"></label>
      <p class="muted small">שחזור מחליף את כל הנתונים שבמכשיר בנתונים שבקובץ.</p>
    </details>`;
}
function computePlan(f) {
  const d = Object.fromEntries(new FormData(f));
  const hours = num(d.hours), serve = d.serve ? new Date(d.serve).getTime() : NaN;
  if (!(hours > 0) || !Number.isFinite(serve)) return null;
  const rest = num(d.rest) || 0, buffer = num(d.buffer) || 0, preheat = num(d.preheat) || 0;
  const off = serve - (rest + buffer) * 60000;
  const on = off - hours * 3600000;
  const light = on - preheat * 60000;
  return {
    name: d.name.trim() || 'עישון',
    items: [
      ['הדלקת המעשנה', light], ['הבשר נכנס', on], ['יעד לסיום הבישול', off],
      ...(rest ? [['סוף המנוחה', off + rest * 60000]] : []), ['הגשה', serve],
    ],
  };
}
const CALC = {
  plan(f, out) {
    lastPlan = computePlan(f);
    if (!lastPlan) { out.innerHTML = '<span class="muted">ממלאים זמן בישול ושעת הגשה, ולוח הזמנים מופיע כאן.</span>'; return; }
    const late = lastPlan.items[0][1] < Date.now();
    out.innerHTML = `<table><tbody>${lastPlan.items.map(([t, at], i) => `<tr><td>${i === 0 ? `<strong>${t}</strong>` : t}</td><td class="n">${dayLabel(at)}</td><td class="n"><strong>${fmtTime(at)}</strong></td></tr>`).join('')}</tbody></table>${late ? '<p class="note warn">שעת ההדלקה כבר עברה. צריך לדחות את ההגשה או לקצר את הבישול.</p>' : ''}`;
  },
  salt(f, out) {
    const d = Object.fromEntries(new FormData(f)), kg = num(d.kg), pct = num(d.pct);
    if (!(kg > 0) || !(pct > 0)) { out.innerHTML = '<span class="muted">המלחה יבשה: בדרך כלל בין 0.8% ל-1.5% ממשקל הנתח.</span>'; return; }
    out.innerHTML = `<strong>${Math.round(kg * 10 * pct)} גרם מלח</strong><div class="muted small">לנתח של ${kg} ק"ג, לפי ${pct}%.</div>`;
  },
  portions(f, out) {
    const d = Object.fromEntries(new FormData(f)), g = num(d.guests), gr = num(d.grams), y = num(d.yield);
    if (!(g > 0) || !(gr > 0) || !(y > 0)) { out.innerHTML = '<span class="muted">תפוקה היא מה שנשאר אחרי ניקוי ובישול. בבריסקט ובכתף: בערך 50% עד 60%; בעוף עם עצם: בערך 65%.</span>'; return; }
    const cooked = (g * gr) / 1000, raw = cooked / (y / 100);
    out.innerHTML = `<strong>לקנות כ-${raw.toFixed(1)} ק"ג בשר נא</strong><div class="muted small">כדי לקבל ${cooked.toFixed(1)} ק"ג בשר מוכן.</div>`;
  },
};
function planIcs() {
  if (!lastPlan) { toast('קודם ממלאים זמן בישול ושעת הגשה'); return; }
  const z = (ts) => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const clean = (s) => String(s).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, ' ');
  const ev = lastPlan.items.map(([t, at], i) => [
    'BEGIN:VEVENT', `UID:${at}-${i}-${uid()}@smoker.local`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(at)}`, `DTEND:${z(at + 15 * 60000)}`,
    `SUMMARY:${clean(`${t}: ${lastPlan.name}`)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${clean(t)}`, 'TRIGGER:PT0M', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${clean(t)}`, 'TRIGGER:-PT10M', 'END:VALARM',
    'END:VEVENT',
  ].join('\r\n'));
  download('smoker-plan.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//smoker//he', ...ev, 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
}
function exportBackup() {
  S.lastBackup = Date.now();
  download(`smoker-backup-${isoDate(Date.now())}.json`, JSON.stringify({ app: 'smoker', exported: new Date().toISOString(), data: S }), 'application/json');
  save(); render();
}
async function importBackup(file) {
  try {
    const raw = JSON.parse(await file.text());
    const d = raw?.app === 'smoker' ? raw.data : null;
    if (!d || !Array.isArray(d.recipes) || !Array.isArray(d.journal) || !Array.isArray(d.ideas)) throw new Error('format');
    if (!confirm(`בקובץ: ${d.recipes.length} מתכונים, ${d.journal.length} רישומי יומן, ${d.ideas.length} רעיונות.\nהשחזור יחליף את כל הנתונים שבמכשיר. להמשיך?`)) return;
    S = { ...blank(), ...d, recipes: d.recipes, journal: d.journal, ideas: d.ideas };
    await save(); render(); toast('הנתונים שוחזרו');
  } catch { toast('הקובץ אינו קובץ גיבוי תקין של האפליקציה'); }
}

/* ---------- render + events ---------- */
const VIEWS = { recipes: viewRecipes, cook: viewCook, journal: viewJournal, ideas: viewIdeas, tools: viewTools };
const TITLES = { recipes: 'מתכונים', cook: 'מצב בישול', journal: 'יומן עישון', ideas: 'מאגר רעיונות', tools: 'כלים' };
function render() {
  $('#main').innerHTML = VIEWS[tab]();
  $('#title').textContent = TITLES[tab];
  document.querySelectorAll('.tabs button').forEach((b) => {
    if (b.dataset.arg === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  tick();
}

const ACT = {
  tab: (a) => { tab = a; render(); window.scrollTo(0, 0); },
  'sheet-close': closeSheet,
  'alarm-dismiss': () => $('#alarm').close(),
  'recipe-new': () => recipeForm(),
  'recipe-import': () => importSheet(),
  'import-search': importSearch,
  'import-paste': importPaste,
  'recipe-open': openRecipe,
  'recipe-edit': (id) => recipeForm(S.recipes.find((x) => x.id === id)),
  'recipe-share': shareRecipe,
  'recipe-del': (id) => {
    if (!confirm('למחוק את המתכון? רישומי היומן שלו יישארו.')) return;
    S.recipes = S.recipes.filter((x) => x.id !== id); save(); closeSheet(); render();
  },
  'cook-start': startCook,
  'cook-finish': finishCook,
  'cook-cancel': () => {
    if (!confirm('לבטל את הבישול? השלבים והמדידות יימחקו בלי תיעוד ביומן.')) return;
    S.cook = null; setWake(false); save(); render();
  },
  'step-toggle': (i) => { const s = S.cook.steps[+i]; s.at = s.at ? null : Date.now(); save(); render(); },
  'timer-add': (m) => addTimer(+m),
  'timer-del': (id) => { S.cook.timers = S.cook.timers.filter((t) => t.id !== id); save(); render(); },
  'log-del': (at) => { S.cook.log = S.cook.log.filter((r) => r.at !== +at); save(); render(); },
  'wake-toggle': (_, el) => setWake(el.checked),
  'notif-enable': async () => { try { await Notification.requestPermission(); } catch { /* ignore */ } render(); },
  'journal-new': () => journalForm(),
  'journal-open': openJournal,
  'journal-edit': (id) => journalForm(S.journal.find((x) => x.id === id)),
  'journal-del': (id) => {
    if (!confirm('למחוק את הרישום מהיומן?')) return;
    S.journal = S.journal.filter((x) => x.id !== id); save(); closeSheet(); render();
  },
  'idea-del': (id) => { if (!confirm('למחוק את הרעיון?')) return; S.ideas = S.ideas.filter((x) => x.id !== id); save(); render(); },
  'idea-to-recipe': (id) => {
    const x = S.ideas.find((i) => i.id === id); if (!x) return;
    const [first, ...rest] = x.text.split('\n');
    recipeForm({ name: first.slice(0, 60), notes: rest.join('\n').trim() || (first.length > 60 ? x.text : '') }, id);
  },
  'season-toggle': (i, el) => { S.seasoning[i] = el.checked; save(); render(); },
  'plan-ics': planIcs,
  'backup-export': exportBackup,
};
const ON_CHANGE = new Set(['wake-toggle', 'step-toggle', 'season-toggle']);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || ON_CHANGE.has(el.dataset.act) || el.matches('select, input[type="file"]')) return;
  ensureAudio();
  ACT[el.dataset.act]?.(el.dataset.arg, el);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (ON_CHANGE.has(act)) ACT[act](el.dataset.arg, el);
  else if (act === 'backup-import' && el.files[0]) { importBackup(el.files[0]); el.value = ''; }
  else if (act === 'plan-fill') {
    const r = S.recipes.find((x) => x.id === el.value), f = el.form;
    if (r) { f.name.value = r.name; f.hours.value = r.hours ?? ''; if (r.rest != null) f.rest.value = r.rest; CALC.plan(f, $('[data-out="plan"]', f)); }
  }
});
document.addEventListener('input', (e) => {
  const f = e.target.closest('form[data-calc]');
  if (f) CALC[f.dataset.calc](f, $(`[data-out="${f.dataset.calc}"]`, f));
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form'); if (!f) return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f));
  switch (f.dataset.form) {
    case 'recipe': saveRecipe(f); break;
    case 'import': runImport(f); break;
    case 'cook-pick': startCook(d.id); break;
    case 'log': addLog(f); break;
    case 'timer': { const m = num(d.min); if (m > 0) addTimer(m, d.label.trim()); else toast('צריך מספר דקות'); break; }
    case 'journal': saveJournal(f); break;
    case 'idea': S.ideas.push({ id: uid(), text: d.text.trim(), created: Date.now() }); save(); render(); toast('הרעיון נשמר'); break;
  }
});
$('#sheet').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSheet(); });
$('#sheet').addEventListener('close', () => { $('#sheet').innerHTML = ''; });

/* ---------- boot ---------- */
(async function boot() {
  try {
    const saved = await store.get('state');
    if (saved && Array.isArray(saved.recipes)) S = { ...blank(), ...saved };
    else await store.set('state', S);
  } catch (err) {
    console.error(err);
    toast('אין גישה לאחסון במכשיר. הנתונים לא יישמרו (ייתכן שזה מצב גלישה פרטית).');
  }
  if (S.cook) tab = 'cook';
  render();
  setInterval(tick, 1000);
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('sw', err));
  }
})();
