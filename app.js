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

// Built-in recipe packs. Each recipe has a stable `pack` key and is added once per device,
// so a recipe the user deleted or edited is never re-added or overwritten.
const PB = 'מותאם לפיט בוס אנכי: מגש המים מלא, הנתח במדף האמצעי, ולא פותחים את הדלת בלי צורך. הזמנים הם הערכה; קובעים לפי טמפרטורה ומרקם.';
const PACK_RECIPES = [
  {
    pack: 'pb-asado-argentino', name: 'אסאדו בסגנון ארגנטינאי עם צ\'ימיצ\'ורי', cut: 'אסאדו עם עצם', weight: 2.5, smokerTemp: 135, targetTemp: 93, hours: 5, rest: 20, wood: 'אלון',
    ingredients: 'רצועות אסאדו עם עצם, בעובי 4-5 ס"מ\nמלח גס\nלתמלחת (סלמוארה): כוס מים חמים, כף מלח גס, 2 שיני שום כתושות, ענף רוזמרין\nלצ\'ימיצ\'ורי: צרור פטרוזיליה קצוצה, 4 שיני שום, כף אורגנו יבש, חצי כפית צ\'ילי גרוס, 3 כפות חומץ יין אדום, חצי כוס שמן זית, מלח',
    steps: ['להוציא את הבשר מהמקרר שעה לפני, ולהמליח במלח גס מכל הצדדים', 'להכין את התמלחת ולהניח לה להצטנן', 'לכוון את הפיט בוס ל-135°C ולחכות שיתייצב', 'להניח את הרצועות כשהעצם כלפי מטה', 'אחרי שעתיים למרוח תמלחת פעם ב-45 דקות', 'להכין את הצ\'ימיצ\'ורי ולהשאיר אותו בחוץ שעה לפחות', 'להוציא ב-93°C, כשהבשר נסוג מהעצם ועדיין מחזיק צורה', 'מנוחה של 20 דקות, לפרוס בין העצמות ולהגיש עם הצ\'ימיצ\'ורי'],
    notes: 'הבשר יוצא רך אבל נגיס, לא מתפרק. ' + PB,
  },
  {
    pack: 'pb-asado-pulled', name: 'אסאדו מפורק לסנדוויצ\'ים', cut: 'אסאדו בלי עצם / שפונדרה', weight: 3, smokerTemp: 120, targetTemp: 97, hours: 8, rest: 45, wood: 'היקורי',
    ingredients: 'מלח גס ופלפל שחור גרוס, ביחס שווה\nכף פפריקה מעושנת, כף שום גבישי\nלשלב העטיפה: כוס ציר בקר או בירה כהה, בצל פרוס, 2 כפות סילאן או דבש',
    steps: ['לתבל את הנתח ערב קודם ולהשאיר במקרר בלי כיסוי', 'לכוון את הפיט בוס ל-120°C', 'לעשן על המדף, צד השומן כלפי מעלה, עד שנוצר קרום כהה (סביב 75°C, כ-4 שעות)', 'להעביר לתבנית עם הבצל, הציר והסילאן ולכסות היטב בנייר כסף', 'להחזיר למעשנה עד 97°C, כשמזלג מסתובב בבשר בלי מאמץ', 'מנוחה מכוסה של 45 דקות', 'לפרק בשני מזלגות ולערבב עם הנוזלים שבתבנית'],
    notes: 'מתאים לחלות, לפיתות ולטורטיות. נשמר היטב ומתחמם יפה למחרת. ' + PB,
  },
  {
    pack: 'pb-brisket-hot-fast', name: 'בריסקט מהיר (חם ומהיר)', cut: 'בריסקט בקר', weight: 5, smokerTemp: 150, targetTemp: 96, hours: 7, rest: 120, wood: 'אלון',
    ingredients: 'מלח גס ופלפל שחור גרוס, ביחס שווה\nכפית שום גבישי\nלעטיפה: 3 כפות שומן בקר מומס או חמאה',
    steps: ['לנקות שומן קשה ולהשאיר שכבה של כחצי סנטימטר', 'לתבל ולהשאיר בחוץ בזמן שהמעשנה מתחממת', 'לכוון את הפיט בוס ל-150°C', 'להכניס כשצד השומן כלפי מטה, כדי שיגן על הבשר מהחום שעולה מלמטה', 'לעטוף בנייר קצבים עם השומן כשהקרום כהה ויציב (סביב 77°C, אחרי כ-3 שעות)', 'להמשיך עד 96°C, כשהמדחום נכנס בלי התנגדות בחלק העבה', 'מנוחה עטופה בצידנית, שעתיים לפחות'],
    notes: 'מתאים כשאין לילה שלם. המנוחה הארוכה חשובה כאן יותר מבשיטה האיטית. ' + PB,
  },
  {
    pack: 'pb-burnt-ends', name: 'קצוות שרופים מחזה בקר', cut: 'בריסקט בקר (החלק השמן)', weight: 2.5, smokerTemp: 120, targetTemp: 96, hours: 8, rest: 15, wood: 'היקורי',
    ingredients: 'מלח גס ופלפל שחור גרוס\nכף פפריקה, כף סוכר חום\nלזיגוג: חצי כוס רוטב ברביקיו, 2 כפות דבש או סילאן, 2 כפות ציר בקר',
    steps: ['לתבל את החלק השמן של החזה מכל הצדדים', 'לכוון את הפיט בוס ל-120°C ולעשן עד 88°C בערך, כ-6 שעות', 'לחתוך לקוביות של 3-4 ס"מ ולהעביר לתבנית', 'לערבב עם הזיגוג ועוד מעט תיבול', 'להעלות ל-135°C ולהחזיר את התבנית בלי כיסוי לשעה וחצי, עם ערבוב באמצע', 'מוכן כשהקוביות רכות והזיגוג סמיך ודביק', 'מנוחה של רבע שעה לפני ההגשה'],
    notes: 'אפשר להכין גם מצלי כתף אם אין חזה שמן. ' + PB,
  },
  {
    pack: 'pb-pastrami', name: 'פסטרמה מחזה בקר', cut: 'בריסקט בקר (החלק הרזה)', weight: 2.5, smokerTemp: 120, targetTemp: 93, hours: 7, rest: 60, wood: 'אלון',
    ingredients: 'לכבישה (5-6 ימים): 4 ליטר מים, 350 גרם מלח גס, 100 גרם סוכר, 20 גרם מלח משמר ורוד מס\' 1, 5 שיני שום, 2 כפות תבלין כבישה\nלציפוי: 3 כפות פלפל שחור גרוס גס, 3 כפות זרעי כוסברה גרוסים, כף פפריקה, כפית שום גבישי',
    steps: ['להמיס את חומרי הכבישה במים, לקרר לגמרי ולהשרות את הנתח במקרר 5-6 ימים, עם היפוך פעם ביום', 'לשטוף, להשרות במים נקיים שעתיים ולייבש היטב', 'לצפות בתערובת הפלפל והכוסברה וללחוץ שתידבק', 'לכוון את הפיט בוס ל-120°C', 'לעשן עד 70°C בערך, כ-4 שעות', 'לעטוף היטב בנייר כסף עם רבע כוס מים ולהמשיך עד 93°C', 'מנוחה עטופה של שעה, ולפרוס דק נגד כיוון הסיבים'],
    notes: 'את המלח המשמר שוקלים במדויק ולא מעגלים כלפי מעלה. בלי מלח משמר מתקבל חזה מעושן בצבע אפור, טעים אבל לא פסטרמה. ' + PB,
  },
  {
    pack: 'pb-chuck-roast', name: 'צלי כתף מעושן', cut: 'צלי כתף (מספר 5)', weight: 2, smokerTemp: 120, targetTemp: 95, hours: 7, rest: 45, wood: 'היקורי',
    ingredients: 'מלח גס ופלפל שחור גרוס, ביחס שווה\nכפית שום גבישי, כפית אבקת בצל\nלעטיפה: חצי כוס ציר בקר',
    steps: ['לתבל את הנתח ולהשאיר במקרר 4 שעות לפחות', 'לכוון את הפיט בוס ל-120°C', 'לעשן עד שנוצר קרום כהה, סביב 74°C (כ-4 שעות)', 'לעטוף בנייר קצבים או בנייר כסף עם הציר', 'להמשיך עד 95°C, כשהמדחום נכנס בלי התנגדות', 'מנוחה עטופה של 45 דקות', 'לפרוס נגד כיוון הסיבים, או לפרק'],
    notes: 'נתח זול וסלחני, טוב לתרגול לפני בריסקט שלם. ' + PB,
  },
  {
    pack: 'pb-picanha', name: 'פיקניה מעושנת בצריבה הפוכה', cut: 'פיקניה (שפיץ צ\'ך)', weight: 1.3, smokerTemp: 110, targetTemp: 54, hours: 1.5, rest: 10, wood: 'אלון',
    ingredients: 'מלח גס\nפלפל שחור גרוס',
    steps: ['לחרוץ את שכבת השומן בשתי וערב, בלי להגיע לבשר', 'להמליח מכל הצדדים ולהשאיר שעה בחוץ', 'לכוון את הפיט בוס ל-110°C', 'לעשן כשהשומן כלפי מעלה עד 48°C במרכז הנתח', 'להוציא את הנתח ולכסות ברפיון בנייר כסף', 'להעלות ל-250°C ולחכות שהמעשנה תתייצב, כ-15 דקות', 'להחזיר למדף האמצעי כשהשומן כלפי מעלה ל-6-8 דקות, עד 54°C וקרום זהוב', 'מנוחה של 10 דקות, ולפרוס נגד כיוון הסיבים'],
    notes: 'מוציאים מהעישון מוקדם, ב-48°C, כי הנתח ממשיך להתחמם בזמן ההמתנה ובצריבה. 54°C בסוף נותן מדיום-רייר; למדיום ממשיכים עד 58°C. הצריבה נעשית במעשנה עצמה ב-250°C. הקרום יוצא עדין יותר מאשר במחבת ברזל; מי שרוצה קרום חזק צורב במחבת דקה מכל צד. לפני שמעלים את החום מוודאים שמגש השומן נקי ושיש מים במגש. ' + PB,
  },
  {
    pack: 'pb-prime-rib', name: 'אנטריקוט שלם מעושן', cut: 'אנטריקוט', weight: 2.5, smokerTemp: 110, targetTemp: 52, hours: 3.5, rest: 20, wood: 'אלון',
    ingredients: 'מלח גס ופלפל שחור גרוס\n4 שיני שום כתושות\nכף רוזמרין וכף טימין קצוצים\n3 כפות שמן זית',
    steps: ['להמליח את הנתח ערב קודם ולהשאיר במקרר בלי כיסוי', 'לערבב שום, עשבי תיבול, פלפל ושמן ולמרוח על הנתח', 'לכוון את הפיט בוס ל-110°C', 'לעשן עד 52°C במרכז הנתח', 'להוציא את הנתח ולכסות ברפיון בנייר כסף', 'להעלות ל-250°C ולחכות שהמעשנה תתייצב, כ-15 דקות', 'להחזיר את הנתח למדף האמצעי ל-8-10 דקות, עד שנוצר קרום', 'מנוחה של 20 דקות לפני הפריסה'],
    notes: 'מחשבים בערך שעה ורבע לכל קילו, אבל קובעים לפי המדחום. למדיום מוציאים ב-57°C. הצריבה נעשית במעשנה עצמה, בחום המרבי שלה. לפני שמעלים את החום מוודאים שמגש השומן נקי ושיש מים במגש, כי שומן ישן עלול להידלק בחום גבוה. ' + PB,
  },
  {
    pack: 'pb-chicken-wings', name: 'כנפיים מעושנות פריכות', cut: 'כנפי עוף', weight: 1.5, smokerTemp: 120, targetTemp: 80, hours: 1.5, rest: 5, wood: 'עץ תפוח',
    ingredients: 'כף מלח, כף פפריקה מתוקה, כפית שום גבישי, כפית פלפל שחור\nכף אבקת אפייה (לא סודה לשתייה)\nלזיגוג, לא חובה: 3 כפות רוטב חריף, 2 כפות דבש, כף חמאה',
    steps: ['לייבש את הכנפיים היטב בנייר סופג', 'לערבב את התבלינים עם אבקת האפייה ולצפות את הכנפיים', 'להשאיר במקרר בלי כיסוי שעתיים לפחות, עדיף לילה', 'לכוון את הפיט בוס ל-120°C ולעשן שעה', 'להעלות ל-190°C ולהמשיך 30-40 דקות, עד שהעור פריך והטמפרטורה 80°C', 'לערבב עם הזיגוג החם ולהגיש מיד'],
    notes: 'אבקת האפייה והייבוש במקרר הם מה שנותן עור פריך בלי טיגון. בכנפיים 80°C עדיף על 74°C, כי הבשר נעשה רך יותר. ' + PB,
  },
  {
    pack: 'pb-pargiyot', name: 'פרגיות מעושנות בסילאן וחרדל', cut: 'פרגיות', weight: 1.2, smokerTemp: 135, targetTemp: 80, hours: 1.5, rest: 10, wood: 'דובדבן',
    ingredients: 'כפית מלח, כפית פפריקה מעושנת, חצי כפית כמון, חצי כפית פלפל שחור\n2 כפות שמן זית\nלזיגוג: 3 כפות סילאן, כף חרדל דיז\'ון, כף רוטב סויה, שן שום כתושה',
    steps: ['לערבב את הפרגיות עם השמן והתבלינים ולהשאיר במקרר שעה עד ארבע שעות', 'לכוון את הפיט בוס ל-135°C', 'לסדר על המדף בשכבה אחת, בלי חפיפה', 'לעשן כשעה, עד 70°C בערך', 'למרוח זיגוג משני הצדדים ולהמשיך 15-20 דקות, עד 80°C', 'מנוחה של 10 דקות'],
    notes: 'פרגיות סלחניות ונשארות עסיסיות גם מעל 74°C. את הזיגוג מורחים רק בסוף כדי שהסוכר לא יישרף. ' + PB,
  },
  {
    pack: 'pb-spatchcock', name: 'עוף פרוס (פרפר) מעושן', cut: 'עוף שלם', weight: 1.8, smokerTemp: 150, targetTemp: 74, hours: 1.75, rest: 15, wood: 'עץ תפוח',
    ingredients: 'כף מלח גס, כף פפריקה, כפית שום גבישי, כפית אבקת בצל, חצי כפית פלפל שחור, חצי כפית כורכום\n2 כפות שמן זית\nחצי לימון',
    steps: ['לחתוך את עצם הגב במספריים, לפתוח את העוף וללחוץ על החזה עד שהוא משתטח', 'לייבש את העור, למרוח שמן ולתבל גם מתחת לעור של החזה', 'להשאיר במקרר בלי כיסוי שעתיים עד לילה', 'לכוון את הפיט בוס ל-150°C', 'להניח כשהעור כלפי מעלה והרגליים לכיוון הדלת', 'להוציא כשהחזה ב-74°C והירך ב-80°C לפחות', 'מנוחה של רבע שעה, ולסחוט מעל חצי לימון'],
    notes: 'עוף פרוס מתבשל מהר ואחיד יותר מעוף שלם. למדוד בחלק העבה של החזה, בלי לגעת בעצם. ' + PB,
  },
  {
    pack: 'pb-lamb-shoulder', name: 'כתף טלה מפורקת', cut: 'כתף טלה עם עצם', weight: 2.5, smokerTemp: 120, targetTemp: 96, hours: 8, rest: 45, wood: 'דובדבן',
    ingredients: 'כף מלח גס, כף פלפל שחור גרוס, כף כמון, כף פפריקה, כפית כוסברה טחונה\n6 שיני שום פרוסות\n3 ענפי רוזמרין\nלעטיפה: חצי כוס ציר או יין אדום',
    steps: ['לנעוץ בבשר חריצים קטנים ולדחוף לתוכם פרוסות שום', 'לתבל מכל הצדדים ולהשאיר במקרר לילה', 'לכוון את הפיט בוס ל-120°C', 'לעשן כשצד השומן כלפי מעלה עד שנוצר קרום כהה, סביב 74°C (כ-4 שעות)', 'להעביר לתבנית עם הרוזמרין והציר ולכסות היטב בנייר כסף', 'להמשיך עד 96°C, כשהעצם יוצאת בקלות', 'מנוחה מכוסה של 45 דקות, ולפרק עם הנוזלים שבתבנית'],
    notes: 'מתאים לפיתות עם טחינה, עמבה ובצל סגול. ' + PB,
  },
  {
    pack: 'pb-lamb-rack', name: 'צלעות טלה בצריבה הפוכה', cut: 'סינטה טלה עם עצם (ראק)', weight: 1, smokerTemp: 110, targetTemp: 54, hours: 1, rest: 10, wood: 'אלון',
    ingredients: 'מלח גס ופלפל שחור גרוס\n2 שיני שום כתושות\nכף רוזמרין קצוץ, כף טימין\n2 כפות שמן זית, כפית חרדל',
    steps: ['לערבב שום, עשבי תיבול, שמן וחרדל ולמרוח על הבשר', 'להמליח ולהשאיר חצי שעה בחוץ', 'לכוון את הפיט בוס ל-110°C', 'לעשן כשהעצמות כלפי מטה עד 46°C במרכז הבשר', 'להוציא את הנתח ולכסות ברפיון בנייר כסף', 'להעלות ל-250°C ולחכות שהמעשנה תתייצב, כ-15 דקות', 'להחזיר למדף האמצעי ל-5-6 דקות, עד 54°C', 'מנוחה של 10 דקות, ולפרוס בין העצמות'],
    notes: 'נתח קטן שמתבשל מהר; כדאי להשאיר מדחום בפנים כל הזמן, גם בצריבה. 54°C נותן מדיום-רייר, למדיום ממשיכים עד 60°C. הצריבה נעשית במעשנה עצמה ב-250°C. הקרום יוצא עדין יותר מאשר במחבת ברזל; מי שרוצה קרום חזק צורב במחבת דקה מכל צד. לפני שמעלים את החום מוודאים שמגש השומן נקי ושיש מים במגש. ' + PB,
  },
  {
    pack: 'pb-lamb-leg', name: 'שוק טלה מעושן בשום ורוזמרין', cut: 'שוק טלה עם עצם', weight: 2.5, smokerTemp: 135, targetTemp: 60, hours: 3.5, rest: 20, wood: 'אלון',
    ingredients: 'כף וחצי מלח גס, כף פלפל שחור גרוס\n8 שיני שום כתושות\n2 כפות רוזמרין קצוץ\nקליפה מגוררת ומיץ מלימון אחד\n3 כפות שמן זית',
    steps: ['לערבב את כל החומרים לממרח', 'לחרוץ את השוק חריצים רדודים ולמרוח את הממרח מכל הצדדים', 'להשאיר במקרר 4 שעות עד לילה', 'לכוון את הפיט בוס ל-135°C', 'לעשן עד 60°C בחלק העבה, בלי לגעת בעצם', 'מנוחה של 20 דקות מתחת לנייר כסף רופף', 'לפרוס דק נגד כיוון הסיבים'],
    notes: '60°C נותן מדיום ורוד. מי שרוצה שוק מתפרק ממשיך בעטיפה עד 93°C, וזה מוסיף כשלוש שעות. ' + PB,
  },
  {
    pack: 'pb-salmon', name: 'סלמון מעושן בזיגוג סילאן', cut: 'פילה סלמון עם עור', weight: 1, smokerTemp: 110, targetTemp: 60, hours: 1.25, rest: 5, wood: 'עץ תפוח',
    ingredients: 'להמלחה יבשה: 2 כפות מלח גס, 2 כפות סוכר חום, כפית פלפל שחור\nלזיגוג: 2 כפות סילאן או מייפל, כף רוטב סויה, כפית חרדל\nלימון להגשה',
    steps: ['לפזר את תערובת המלח והסוכר על צד הבשר ולהשאיר במקרר שעה', 'לשטוף בעדינות, לייבש היטב ולהשאיר במקרר בלי כיסוי חצי שעה, עד שהמשטח מעט דביק', 'לכוון את הפיט בוס ל-110°C', 'להניח על נייר אפייה או על המדף, כשהעור כלפי מטה', 'אחרי 40 דקות למרוח זיגוג', 'להוציא ב-60°C בחלק העבה, כשהדג נפרד לפתיתים', 'מנוחה של 5 דקות, ולהגיש עם לימון'],
    notes: 'למרקם רך ועסיסי יותר אפשר להוציא ב-52°C. הייבוש במקרר עוזר לעשן להיתפס. ' + PB,
  },
  {
    pack: 'pb-whole-fish', name: 'דניס שלם מעושן', cut: 'דניס או לברק שלם', weight: 1, smokerTemp: 135, targetTemp: 63, hours: 1, rest: 5, wood: 'זית',
    ingredients: '2 דגים שלמים ומנוקים, כ-500 גרם כל אחד\nמלח גס ופלפל שחור\nפרוסות לימון, שיני שום פרוסות, ענפי טימין ופטרוזיליה\nשמן זית',
    steps: ['לחרוץ בכל צד של הדג שלושה חריצים אלכסוניים', 'למרוח שמן זית ולהמליח מבפנים ומבחוץ', 'למלא את הבטן בלימון, שום ועשבי תיבול', 'לכוון את הפיט בוס ל-135°C ולשמן את המדף', 'לעשן 45-60 דקות, עד 63°C ליד עצם השדרה', 'להעביר בזהירות עם מרית רחבה, ולהגיש עם שמן זית ולימון'],
    notes: 'הדג מוכן כשהבשר לבן ונפרד בקלות מהעצם. לא הופכים אותו במהלך העישון. ' + PB,
  },
  {
    pack: 'pb-trout', name: 'פורל מעושן בכבישה', cut: 'פילה פורל או מקרל', weight: 0.8, smokerTemp: 95, targetTemp: 63, hours: 2, rest: 10, wood: 'עץ תפוח',
    ingredients: 'לתמלחת: ליטר מים, 60 גרם מלח גס, 40 גרם סוכר חום, 2 עלי דפנה, כפית גרגירי פלפל\nפלפל שחור גרוס לציפוי',
    steps: ['להמיס את המלח והסוכר במים, לקרר ולהשרות את הפילה במקרר 3-4 שעות', 'לשטוף, לייבש ולהניח על רשת במקרר בלי כיסוי שעתיים, עד שהמשטח דביק ומבריק', 'לפזר פלפל גרוס', 'לכוון את הפיט בוס ל-95°C', 'לעשן כשהעור כלפי מטה עד 63°C, כשעתיים', 'לקרר, ולשמור במקרר עד ארבעה ימים'],
    notes: 'טוב קר, על לחם עם גבינת שמנת, או בסלט תפוחי אדמה. אם המעשנה לא מתייצבת ב-95°C, מכוונים לנמוך ביותר שהיא מחזיקה. ' + PB,
  },
  {
    pack: 'pb-eggplant', name: 'חצילים מעושנים', cut: 'חצילים', weight: 1.2, smokerTemp: 150, targetTemp: null, hours: 1.5, rest: 10, wood: 'אלון',
    ingredients: '3 חצילים בינוניים\nלהגשה: טחינה גולמית, לימון, שום כתוש, מלח, שמן זית, פטרוזיליה',
    steps: ['לדקור כל חציל במזלג בכמה מקומות', 'לכוון את הפיט בוס ל-150°C', 'להניח את החצילים שלמים על המדף', 'לעשן שעה עד שעה וחצי, עד שהם רכים לגמרי וקורסים בלחיצה', 'לחצות, לגרד את הבשר החוצה ולהניח במסננת 10 דקות', 'לתבל במלח, לימון ושום, ולהגיש עם טחינה ושמן זית'],
    notes: 'אין כאן טמפרטורת יעד; המדד הוא רכות מלאה. מתקבל טעם עשן עדין יותר מקלייה על אש גלויה. ' + PB,
  },
  {
    pack: 'pb-cauliflower', name: 'כרובית שלמה מעושנת', cut: 'כרובית', weight: 1, smokerTemp: 135, targetTemp: null, hours: 2, rest: 5, wood: 'היקורי',
    ingredients: 'כרובית שלמה בינונית\n3 כפות שמן זית, כפית מלח, כפית פפריקה מעושנת, חצי כפית כורכום, חצי כפית כמון\nלהגשה: טחינה, לימון, עשבי תיבול',
    steps: ['להסיר את העלים ולחתוך את הגבעול כך שהכרובית תעמוד ישר', 'לחלוט במים רותחים ומומלחים 6 דקות, ולייבש', 'לערבב שמן ותבלינים ולמרוח על כל הכרובית', 'לכוון את הפיט בוס ל-135°C', 'לעשן כשעתיים, עד שסכין נכנסת למרכז בלי התנגדות', 'להגיש עם טחינה, לימון ועשבי תיבול'],
    notes: 'החליטה מקצרת את הזמן ושומרת על מרכז רך. בלי חליטה מוסיפים כשעה. ' + PB,
  },
  {
    pack: 'pb-corn', name: 'תירס מעושן בחמאת שום', cut: 'קלחי תירס', weight: 1, smokerTemp: 120, targetTemp: null, hours: 1.25, rest: 0, wood: 'עץ תפוח',
    ingredients: '4-6 קלחי תירס טריים, מקולפים\n50 גרם חמאה רכה או 3 כפות שמן זית\n2 שיני שום כתושות\nמלח, פפריקה, פטרוזיליה קצוצה',
    steps: ['לערבב את החמאה עם השום, המלח והפפריקה', 'למרוח על הקלחים', 'לכוון את הפיט בוס ל-120°C', 'להניח ישירות על המדף ולעשן שעה עד שעה ורבע, עם סיבוב אחד באמצע', 'מוכן כשהגרגירים רכים ומעט מקומטים', 'למרוח עוד חמאה ולפזר פטרוזיליה'],
    notes: 'מתאים להכניס לצד נתח שכבר מתעשן באותה טמפרטורה. ' + PB,
  },
  {
    pack: 'pb-rice', name: 'אורז מעושן בתבנית', cut: 'אורז', weight: null, smokerTemp: 150, targetTemp: null, hours: 1, rest: 10, wood: 'אלון',
    ingredients: '2 כוסות אורז בסמטי או יסמין, שטוף היטב\n3 וחצי כוסות ציר או מים רותחים\n2 כפות שמן או חמאה\nכפית מלח, חצי כפית כורכום\nבצל קטן קצוץ דק, לא חובה',
    steps: ['לכוון את הפיט בוס ל-150°C', 'לערבב בתבנית חד-פעמית עמוקה את האורז, השמן, הבצל והתבלינים', 'לשפוך את הציר הרותח ולערבב פעם אחת', 'להכניס בלי כיסוי ל-20 דקות, כדי שהאורז יספוג עשן', 'לכסות היטב בנייר כסף ולהמשיך 30-40 דקות, עד שהנוזלים נספגו', 'מנוחה מכוסה של 10 דקות, ולהפריד במזלג'],
    notes: 'כמות הנוזלים תלויה בסוג האורז; בפעם הראשונה כדאי לבדוק אחרי 30 דקות בכיסוי ולהוסיף מעט מים רותחים אם צריך. אפשר להניח את התבנית במדף שמתחת לבשר, כדי שהנוזלים שלו יטפטפו לאורז. ' + PB,
  },
  {
    pack: 'pb-potatoes', name: 'תפוחי אדמה מעושנים שלמים', cut: 'תפוחי אדמה', weight: 1.5, smokerTemp: 135, targetTemp: 96, hours: 2.5, rest: 5, wood: 'היקורי',
    ingredients: '6 תפוחי אדמה בינוניים לאפייה\nשמן זית\nמלח גס\nלהגשה: חמאה או טחינה, בצל ירוק, מלח ופלפל',
    steps: ['לשטוף, לייבש ולדקור כל תפוח אדמה במזלג', 'למרוח שמן ולגלגל במלח גס', 'לכוון את הפיט בוס ל-135°C', 'להניח ישירות על המדף, בלי נייר כסף', 'לעשן שעתיים עד שעתיים וחצי, עד 96°C במרכז או עד שסכין נכנסת בלי התנגדות', 'לחרוץ, ללחוץ מהצדדים ולפתוח, ולהגיש עם התוספות'],
    notes: 'בלי נייר כסף הקליפה יוצאת פריכה וסופגת עשן. הזמן תלוי מאוד בגודל. ' + PB,
  },
  {
    pack: 'pb-smashed-potatoes', name: 'תפוחי אדמה מעוכים ופריכים', cut: 'תפוחי אדמה קטנים', weight: 1, smokerTemp: 190, targetTemp: null, hours: 1, rest: 0, wood: 'אלון',
    ingredients: 'קילו תפוחי אדמה קטנים\n4 כפות שמן זית\n3 שיני שום כתושות\nמלח גס, פלפל שחור, כפית פפריקה מעושנת\nרוזמרין או טימין',
    steps: ['לבשל את תפוחי האדמה במים מומלחים עד שהם רכים, כ-20 דקות, ולסנן', 'לכוון את הפיט בוס ל-190°C', 'לסדר בתבנית משומנת ולמעוך כל אחד בתחתית של כוס, לעובי של כסנטימטר', 'לערבב שמן, שום ותבלינים ולמרוח מלמעלה', 'לעשן 40-50 דקות, עד שהשוליים זהובים ופריכים', 'לפזר מלח גס ועשבי תיבול ולהגיש מיד'],
    notes: 'את הבישול במים אפשר לעשות מראש. ' + PB,
  },
  {
    pack: 'pb-side-beans', name: 'שעועית מעושנת ברוטב ברביקיו', cut: 'תוספת', weight: null, smokerTemp: 120, targetTemp: null, hours: 2.5, rest: 10, wood: 'היקורי',
    ingredients: '2 קופסאות שעועית לבנה מבושלת, מסוננת (או 500 גרם שעועית שבושלה מראש)\nבצל גדול קצוץ, 3 שיני שום\nכוס רוטב ברביקיו, 2 כפות סילאן, כף חרדל, כף חומץ תפוחים\nכפית פפריקה מעושנת, מלח ופלפל\nכוס מים או ציר\nשאריות בשר מעושן קצוץ, לא חובה',
    steps: ['לטגן את הבצל והשום במחבת עד שהם זהובים', 'לערבב בתבנית עמוקה את כל החומרים', 'לכוון את הפיט בוס ל-120°C', 'להכניס את התבנית בלי כיסוי, אם אפשר במדף שמתחת לבשר', 'לעשן שעתיים עד שעתיים וחצי, עם ערבוב פעם בשעה, עד שהרוטב סמיך', 'אם הרוטב מצטמצם מהר מדי, מוסיפים מעט מים חמים', 'מנוחה של 10 דקות לפני ההגשה'],
    notes: 'מתחת לבשר התבנית סופגת את הנוזלים שמטפטפים ממנו. אפשר להכין יום קודם ולחמם. ' + PB,
  },
  {
    pack: 'pb-side-sweet-potato', name: 'בטטות מעושנות', cut: 'תוספת', weight: 1.5, smokerTemp: 135, targetTemp: 96, hours: 2, rest: 5, wood: 'עץ תפוח',
    ingredients: '4 בטטות בינוניות\nשמן זית, מלח גס\nלהגשה: טחינה גולמית וסילאן, או חמאה וקינמון',
    steps: ['לשטוף, לייבש ולדקור כל בטטה במזלג', 'למרוח שמן ולפזר מלח גס', 'לכוון את הפיט בוס ל-135°C', 'להניח ישירות על המדף, ומתחתיהן מגש או נייר כסף לטפטופים', 'לעשן כשעתיים, עד 96°C במרכז או עד שסכין נכנסת בלי התנגדות', 'לחרוץ לאורך, לפתוח ולהגיש עם התוספות'],
    notes: 'בטטות מפרישות סירופ דביק, ולכן כדאי להגן על המדף שמתחת. ' + PB,
  },
  {
    pack: 'pb-side-onions', name: 'בצלים שלמים מעושנים', cut: 'תוספת', weight: 1, smokerTemp: 135, targetTemp: null, hours: 2.5, rest: 5, wood: 'אלון',
    ingredients: '6 בצלים בינוניים, לבנים או סגולים\n3 כפות שמן זית\nמלח גס, פלפל שחור, טימין\nכף חומץ בלסמי או סילאן לסיום',
    steps: ['לקלף את הבצלים ולהשאיר את הבסיס שלם', 'לחרוץ מלמעלה בצורת צלב עד חצי הגובה', 'לטפטף שמן לתוך החריץ ולתבל במלח, פלפל וטימין', 'לכוון את הפיט בוס ל-135°C', 'להניח בתבנית ולעשן שעתיים עד שעתיים וחצי, עד שהבצלים רכים לגמרי ונפתחים', 'לטפטף בלסמי או סילאן ולהגיש'],
    notes: 'מתאים לצד כל נתח, ונכנס למעשנה יחד עם בשר שמתבשל באותה טמפרטורה. ' + PB,
  },
  {
    pack: 'pb-side-mushrooms', name: 'פטריות פורטובלו מעושנות', cut: 'תוספת', weight: 0.6, smokerTemp: 120, targetTemp: null, hours: 1, rest: 0, wood: 'אלון',
    ingredients: '6 פטריות פורטובלו גדולות\n3 כפות שמן זית, 2 כפות רוטב סויה, כף חומץ בלסמי\n2 שיני שום כתושות\nפלפל שחור, טימין',
    steps: ['לנקות את הפטריות במטלית לחה ולהסיר את הרגל', 'לערבב שמן, סויה, בלסמי ושום ולמרוח על שני הצדדים', 'להשאיר 20 דקות בחוץ', 'לכוון את הפיט בוס ל-120°C', 'להניח על המדף כשהצד הפתוח כלפי מעלה, כדי שהנוזלים יישארו בפנים', 'לעשן 45-60 דקות, עד שהפטריות רכות וכהות', 'להגיש שלמות, או פרוסות מעל הבשר'],
    notes: 'פטריות סופגות עשן מהר, ולכן לא משאירים אותן הרבה מעבר לשעה. ' + PB,
  },
  {
    pack: 'pb-side-matbucha', name: 'סלט עגבניות ופלפלים מעושנים', cut: 'תוספת', weight: 1.5, smokerTemp: 150, targetTemp: null, hours: 1.5, rest: 15, wood: 'אלון',
    ingredients: 'קילו עגבניות בשלות, חצויות\n3 פלפלים אדומים, חצויים ומנוקים\nפלפל חריף אחד, לא חובה\nראש שום שלם, חתוך לרוחב\n4 כפות שמן זית, מלח גס\nלסיום: מיץ מחצי לימון, כפית פפריקה מתוקה, כוסברה או פטרוזיליה',
    steps: ['לסדר את הירקות בתבנית כשהצד החתוך כלפי מעלה, לטפטף שמן ולהמליח', 'לכוון את הפיט בוס ל-150°C', 'לעשן שעה עד שעה וחצי, עד שהירקות רכים והקליפה מתקמטת', 'לצנן רבע שעה, ולהסיר את הקליפות שיורדות בקלות', 'לסחוט את שיני השום מהקליפה, ולקצוץ הכול גס בסכין', 'לתבל בלימון, פפריקה, מלח ועשבי תיבול'],
    notes: 'נשמר במקרר עד חמישה ימים, ומשתבח אחרי לילה. ' + PB,
  },
  {
    pack: 'pb-dessert-apples', name: 'תפוחים ממולאים מעושנים', cut: 'קינוח', weight: null, smokerTemp: 150, targetTemp: null, hours: 1.25, rest: 10, wood: 'עץ תפוח',
    ingredients: '6 תפוחים חמצמצים (גרני סמית או פינק ליידי)\nלמילוי: חצי כוס אגוזי מלך או פקאן קצוצים, 3 כפות סוכר חום, 2 כפות צימוקים, כפית קינמון, 3 כפות חמאה רכה או שמן קוקוס\nסילאן או מייפל לזילוף',
    steps: ['להוציא את הליבה מכל תפוח בלי לחתוך את התחתית, כך שנוצר כיס', 'לערבב את חומרי המילוי ולדחוס לתוך התפוחים', 'לכוון את הפיט בוס ל-150°C', 'להעמיד את התפוחים בתבנית ולהכניס למעשנה', 'לעשן שעה עד שעה ורבע, עד שהתפוחים רכים אבל עדיין מחזיקים צורה', 'מנוחה של 10 דקות, ולזלף סילאן או מייפל'],
    notes: 'עם שמן קוקוס הקינוח פרווה. טוב חם, ליד גלידה. ' + PB,
  },
  {
    pack: 'pb-dessert-pineapple', name: 'אננס מעושן בקינמון', cut: 'קינוח', weight: 1.5, smokerTemp: 135, targetTemp: null, hours: 1.5, rest: 5, wood: 'דובדבן',
    ingredients: 'אננס בשל, מקולף\n3 כפות סוכר חום\nכפית קינמון, קמצוץ מלח\n2 כפות סילאן או דבש',
    steps: ['לחתוך את האננס לארבעה רבעים לאורך ולהסיר את הליבה הקשה, או להשאיר שלם', 'לערבב סוכר, קינמון ומלח ולשפשף על האננס', 'לכוון את הפיט בוס ל-135°C', 'להניח ישירות על המדף, ומתחתיו מגש לטפטופים', 'לעשן שעה עד שעה וחצי, ולמרוח סילאן ב-20 הדקות האחרונות', 'מוכן כשהאננס רך, מבריק ושוליו כהים', 'לפרוס ולהגיש חם'],
    notes: 'אננס שלם צריך כשעתיים. מתאים גם כתוספת מתוקה ליד בשר שמן. ' + PB,
  },
  {
    pack: 'pb-dessert-cookie', name: 'עוגיית ענק במחבת', cut: 'קינוח', weight: null, smokerTemp: 175, targetTemp: null, hours: 0.6, rest: 15, wood: 'פקאן',
    ingredients: '120 גרם חמאה מומסת או חצי כוס שמן\nחצי כוס סוכר חום, רבע כוס סוכר לבן\nביצה, כפית תמצית וניל\nכוס ורבע קמח, חצי כפית סודה לשתייה, חצי כפית מלח\n150 גרם שוקולד צ\'יפס או שוקולד קצוץ',
    steps: ['לערבב חמאה וסוכרים, ולהוסיף ביצה ווניל', 'להוסיף קמח, סודה ומלח ולערבב רק עד שהבצק אחיד', 'לקפל פנימה את השוקולד ולשטח במחבת ברזל משומנת בקוטר 24-26 ס"מ', 'לכוון את הפיט בוס ל-175°C', 'להכניס את המחבת למדף האמצעי ל-30-35 דקות', 'מוכן כשהשוליים זהובים והמרכז עדיין רך מעט', 'מנוחה של רבע שעה, ולהגיש מהמחבת'],
    notes: 'העוגייה ממשיכה להתייצב במחבת החמה, ולכן מוציאים כשהמרכז עוד רך. עם שמן ושוקולד מריר היא פרווה. ' + PB,
  },
  {
    pack: 'pb-dessert-bananas', name: 'בננות מעושנות עם שוקולד', cut: 'קינוח', weight: null, smokerTemp: 120, targetTemp: null, hours: 0.5, rest: 0, wood: 'עץ תפוח',
    ingredients: '6 בננות בשלות, בקליפה\n100 גרם שוקולד מריר, שבור לקוביות\n3 כפות אגוזים קצוצים או חלבה מפוררת\nקמצוץ מלח גס',
    steps: ['לחרוץ כל בננה לאורך דרך הקליפה, בלי לחתוך את הצד התחתון', 'לפתוח מעט ולדחוס פנימה קוביות שוקולד', 'לכוון את הפיט בוס ל-120°C', 'להעמיד את הבננות על המדף כשהחריץ כלפי מעלה, אפשר על נייר כסף מקופל שמייצב אותן', 'לעשן 25-30 דקות, עד שהקליפה שחורה והשוקולד נמס', 'לפזר אגוזים ומלח גס, ולאכול בכפית מתוך הקליפה'],
    notes: 'קינוח שנכנס למעשנה כשהבשר נח. פרווה עם שוקולד מריר. ' + PB,
  },
];

const blank = () => ({
  v: 5,
  recipes: SEED_RECIPES.map((r) => ({ ...r, id: uid(), updated: Date.now() })),
  cook: null, journal: [], ideas: [], seasoning: {}, lastBackup: null, packs: [],
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
  const stated = lines.find((l) => /^\d+(?:\.\d+)? hours$/.test(l)); // cook time declared by the page itself
  if (stated) return Math.round(parseFloat(stated) * 10) / 10;
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
  const text = (jsonLdToText(raw) || raw).replace(/\r/g, '').replace(/[‎‏]/g, '')
    .replace(/℉/g, '°F').replace(/℃/g, '°C').replace(/\[([^\]\n]+)\]\(https?:[^)\s]+\)/g, '$1');
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
    steps: sec.steps.flatMap((l) => (/\s2[.)]\s/.test(l) ? l.split(/\s+(?=\d{1,2}[.)]\s)/) : [l])).map(stripLead).filter(Boolean),
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

// Readable text of a fetched page: structured recipe data if the page has it, otherwise headings, paragraphs and list items.
function htmlToText(html) {
  const ld = jsonLdToText(html);
  if (ld) return ld;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = (doc.querySelector('h1')?.textContent || doc.title || '').replace(/\s+/g, ' ').trim();
  doc.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,svg,iframe,button').forEach((n) => n.remove());
  const root = doc.querySelector('[itemtype*="Recipe"]') || doc.querySelector('article') || doc.querySelector('main') || doc.body;
  const out = [];
  root?.querySelectorAll('h1,h2,h3,h4,p,li').forEach((n) => {
    if (n.querySelector('p,li')) return;
    const t = n.textContent.replace(/\s+/g, ' ').trim();
    if (t && t !== title && t !== out[out.length - 1]) out.push(t);
  });
  return [title, ...out.slice(0, 400)].filter(Boolean).join('\n');
}
const FETCH_ERR = {
  'bad-url': 'הקישור לא תקין',
  site: 'האתר סירב להחזיר את הדף. אפשר להעתיק את הטקסט ולהדביק ידנית.',
  'not-html': 'הקישור לא מוביל לדף מתכון',
  timeout: 'האתר לא ענה בזמן. אפשר לנסות שוב או להדביק ידנית.',
};
async function importFetch(_, el) {
  const f = el.form;
  const link = (f.source.value.trim() || f.text.value.trim());
  if (!/^https?:\/\/\S+$/i.test(link)) { toast('מדביקים קודם קישור למתכון בשדה הקישור'); f.source.focus(); return; }
  if (!navigator.onLine) { toast('אין חיבור לרשת'); return; }
  const label = el.textContent;
  el.disabled = true; el.textContent = 'מושך את המתכון…';
  try {
    const res = await fetch('api/recipe?url=' + encodeURIComponent(link), { cache: 'no-store' });
    if (res.status === 404) { toast('משיכה מקישור פעילה רק בגרסה שמותקנת מ-Netlify. כאן אפשר להדביק את הטקסט.'); return; }
    const data = await res.json();
    if (!res.ok) { toast(FETCH_ERR[data.error] || 'המשיכה נכשלה. אפשר להדביק את הטקסט ידנית.'); return; }
    const parsed = parseRecipeText(htmlToText(data.html), data.url || link);
    if (!parsed || !parsed.recipe.name || (!parsed.recipe.steps.length && !parsed.recipe.ingredients)) {
      toast('הדף נמשך, אבל לא נמצא בו מתכון. אפשר להדביק את הטקסט ידנית.'); return;
    }
    recipeForm(parsed.recipe, '', parsed.hint);
  } catch { toast('המשיכה נכשלה. אפשר להדביק את הטקסט ידנית.'); }
  finally { if (el.isConnected) { el.disabled = false; el.textContent = label; } }
}

function importSheet() {
  openSheet('ייבוא מתכון ממקור', `
    <p class="muted">מחפשים מתכון ברשת ומדביקים כאן את הקישור אליו. האפליקציה מושכת את הדף, מפרקת אותו לשדות של מתכון, ואתה מאשר לפני השמירה. אם אתר חוסם משיכה, מדביקים את הטקסט עצמו.</p>
    <form data-form="import">
      ${field('מה מחפשים?', inp('q', '', 'placeholder="למשל: צלעות טלה מעושנות" enterkeyhint="search"'))}
      <div class="row">
        <button type="button" class="btn grow" data-act="import-search" data-arg="google">חיפוש ב-Google</button>
        <button type="button" class="btn grow" data-act="import-search" data-arg="ddg">חיפוש ב-DuckDuckGo</button>
      </div>
      ${field('קישור למתכון', inp('source', '', 'type="url" inputmode="url" placeholder="https://..."'))}
      <button type="button" class="btn primary block" data-act="import-fetch">משיכת המתכון מהקישור</button>
      ${field('או טקסט המתכון', area('text', '', 'rows="7" placeholder="מדביקים כאן את המתכון: שם, מרכיבים, אופן ההכנה..."'))}
      <button type="button" class="btn block" data-act="import-paste">הדבקה מהלוח</button>
      <button class="btn block">פענוח הטקסט ומילוי המתכון</button>
    </form>
    <p class="muted small">במשיכה מקישור נשלחת כתובת הדף בלבד לשרת של האפליקציה, והוא מחזיר את תוכן הדף. הפענוח נעשה במכשיר, ושום מידע אחר לא יוצא ממנו.</p>`);
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
    if (/^https?:\/\/\S+$/i.test(t.trim())) { el.form.text.value = ''; el.form.source.value = t.trim(); toast('בלוח יש קישור. לוחצים על "משיכת המתכון מהקישור".'); }
  } catch { toast('אין גישה ללוח. אפשר להדביק ידנית בתיבת הטקסט.'); }
}
function runImport(f) {
  const d = Object.fromEntries(new FormData(f));
  if (!d.text.trim() || /^https?:\/\/\S+$/i.test(d.text.trim())) { importFetch('', f.querySelector('[data-act="import-fetch"]')); return; }
  const res = parseRecipeText(d.text, d.source);
  if (!res || !res.recipe.name) { toast('לא הצלחתי לפענח את הטקסט'); return; }
  recipeForm(res.recipe, '', res.hint);
}

/* ---------- cook guidance: what now, what next, what to prepare ---------- */
const STEP_KIND = [
  ['heat', /לכוון את|לייצב את המעשנה|לחמם את המעשנה|preheat/i],
  ['dial', /להעלות ל-|להוריד ל-/],
  ['wrap', /לעטוף|לכסות היטב|\bwrap/i],
  ['sear', /לצרוב|צריבה|מחבת ברזל|\bsear/i],
  ['glaze', /זיגוג|\bglaze/i],
  ['spritz', /לרסס|תמלחת פעם|spritz/i],
  ['rest', /^מנוחה|^rest\b/i],
  ['out', /להוציא|מוכן כש|remove from/i],
  ['in', /להכניס|להניח|לסדר על|לעשן|place (?:the|it) /i],
];
const KIND_LABEL = { prep: 'הכנה', heat: 'חימום', in: 'למעשנה', dial: 'שינוי טמפרטורה', wrap: 'עטיפה', sear: 'צריבה', glaze: 'זיגוג', spritz: 'הרטבה', out: 'הוצאה', rest: 'מנוחה', step: 'שלב' };
const PREPARE = {
  heat: 'פלטים במכל, מגש מים מלא ומגש שומן נקי',
  in: 'מדחום לנעיצה בחלק העבה של הנתח',
  wrap: 'נייר קצבים או נייר כסף, והנוזלים לעטיפה אם המתכון דורש',
  sear: 'מחבת ברזל או גריל; לחמם כמה דקות מראש',
  glaze: 'את הזיגוג, ומברשת',
  spritz: 'בקבוק ריסוס, או קערית ומברשת',
  out: 'מגש, כפפות חום ומדחום לבדיקה אחרונה',
  rest: 'צידנית ומגבות למנוחה ארוכה, או קרש חיתוך ונייר כסף',
};
function stepMinutes(t) {
  if (/שעה וחצי/.test(t)) return 90;
  const m = t.match(/(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(שעות|דקות)/);
  if (m) { const a = num(m[1]), b = m[2] ? num(m[2]) : a; return Math.round(((a + b) / 2) * (m[3] === 'שעות' ? 60 : 1)); }
  if (/שעתיים/.test(t)) return 120;
  if (/חצי שעה/.test(t)) return 30;
  if (/רבע שעה/.test(t)) return 15;
  if (/(?:^|\s)כ?שעה(?!\s*לפני)/.test(t)) return 60;
  return null;
}
// Reads each step's text: what kind of action it is, the dial setting or meat temperature it names, and its duration.
function planSteps(steps) {
  const heatAt = steps.findIndex((x) => STEP_KIND[0][1].test(x.t));
  let seenIn = false;
  return steps.map((x, i) => {
    let kind = i < heatAt ? 'prep' : (STEP_KIND.find(([, re]) => re.test(x.t)) || ['step'])[0];
    if (kind === 'in') { if (seenIn) kind = 'step'; seenIn = true; }
    const temps = [...x.t.matchAll(/(\d{2,3})\s*°C/g)].map((m) => +m[1]);
    const dial = kind === 'heat' ? temps[0] ?? null : kind === 'dial' ? temps.find((v) => v >= 100) ?? null : null;
    const meats = temps.filter((v) => v !== dial && v >= 40 && v <= 99);
    const meat = (kind === 'out' ? meats[0] : meats[meats.length - 1]) ?? null;
    return { kind, dial, meat, min: kind === 'prep' ? null : stepMinutes(x.t) };
  });
}
function meatTrend(c) {
  const m = c.log.filter((r) => r.meat != null).sort((a, b) => a.at - b.at);
  const last = m[m.length - 1] || null;
  if (m.length < 2) return { last, slope: null };
  const win = m.filter((r) => r.at >= last.at - 90 * 60000);
  const first = win.length >= 2 ? win[0] : m[m.length - 2];
  const hrs = (last.at - first.at) / 3600000;
  return { last, slope: hrs >= 0.15 ? (last.meat - first.meat) / hrs : null };
}
function markStep(i) {
  const c = S.cook, x = c.steps[i]; if (!x) return;
  x.at = x.at ? null : Date.now();
  if (x.at && c.water && !c.water.next && planSteps(c.steps)[i].kind === 'in') c.water.next = Date.now() + c.water.every * 60000;
  save(); render();
}
function guide(c) {
  if (!c.steps.length) return '';
  const info = planSteps(c.steps);
  const i = c.steps.findIndex((x) => !x.at);
  const { last, slope } = meatTrend(c);
  const lastSmoker = [...c.log].reverse().find((r) => r.smoker != null);
  const dials = info.map((p, n) => ({ ...p, n })).filter((p) => p.dial);
  const wraps = info.map((p, n) => ({ ...p, n })).filter((p) => p.kind === 'wrap');
  const lines = [];
  if (dials.length === 1) lines.push(`טמפרטורה: ${dials[0].dial}°C לאורך כל הבישול, בלי שינוי.`);
  else if (dials.length > 1) lines.push(`שינויי טמפרטורה: ${dials.map((d, k) => (k ? `${d.dial}°C בשלב ${d.n + 1}` : `מתחילים ב-${d.dial}°C`)).join(', ואז ')}.`);
  lines.push(wraps.length ? `עטיפה: ${wraps.map((w) => `בשלב ${w.n + 1}${w.meat ? `, סביב ${w.meat}°C בבשר` : ''}`).join('; ')}.` : 'עטיפה: אין במתכון הזה.');
  let water = '';
  if (c.water) {
    water = c.water.next
      ? `<div class="row between"><span>מגש המים: בדיקה הבאה ב-<strong>${fmtTime(c.water.next)}</strong></span><button class="btn sm" data-act="water-done">בדקתי ומילאתי</button></div>`
      : '<p class="muted">מגש המים: למלא לפני ההדלקה. התזכורות לבדיקה יתחילו כשהנתח ייכנס למעשנה.</p>';
  }
  let now = '<p class="note good">כל השלבים בוצעו. אפשר לסיים את הבישול ולרשום אותו ביומן.</p>';
  if (i >= 0) {
    const p = info[i], cues = [];
    if (p.kind === 'heat' && p.dial) {
      const ready = lastSmoker && Math.abs(lastSmoker.smoker - p.dial) <= 8;
      cues.push(ready ? `המעשנה התייצבה סביב ${lastSmoker.smoker}°C. אפשר להכניס.` : `מדליקים במצב SMOKE בדלת פתוחה (כ-5 דקות), סוגרים, ומחממים 15 עד 20 דקות. מכניסים רק אחרי שהמעשנה התייצבה על ${p.dial}°C; רושמים מדידת מעשנה כדי לוודא.`);
    }
    if (p.meat) {
      if (!last) cues.push(`נקודת הציון של השלב: ${p.meat}°C בבשר. כדאי לרשום מדידה.`);
      else if (last.meat >= p.meat) cues.push(`הבשר ב-${last.meat}°C, ונקודת הציון של השלב (${p.meat}°C) הושגה.`);
      else {
        const eta = slope > 0.5 ? last.at + ((p.meat - last.meat) / slope) * 3600000 : null;
        cues.push(`נקודת הציון של השלב: ${p.meat}°C בבשר. מדידה אחרונה: ${last.meat}°C, חסרות ${p.meat - last.meat} מעלות${eta ? `; בקצב הנוכחי בסביבות ${fmtTime(eta)}` : ''}.`);
      }
    }
    const nx = info[i + 1];
    now = `
      <p class="now-step"><span class="chip">${KIND_LABEL[p.kind]}</span> ${esc(c.steps[i].t)}</p>
      ${cues.map((t) => `<p class="note">${t}</p>`).join('')}
      <div class="row">
        <button class="btn primary grow" data-act="step-done" data-arg="${i}">בוצע, לשלב הבא</button>
        ${p.min ? `<button class="btn" data-act="step-timer" data-arg="${i}">טיימר ${fmtDur(p.min)}</button>` : ''}
      </div>
      ${nx ? `<div class="next-step"><div class="muted small">הבא בתור · ${KIND_LABEL[nx.kind]}</div><div>${esc(c.steps[i + 1].t)}</div>
        ${PREPARE[nx.kind] ? `<div class="muted small">להכין מראש: ${PREPARE[nx.kind]}.</div>` : ''}
        ${nx.kind === 'dial' && nx.dial ? `<div class="muted small">בשלב הזה מכוונים את המעשנה ל-${nx.dial}°C.</div>` : ''}</div>` : ''}`;
  }
  return `<div class="card now">
    <div class="row between"><h3>מה עכשיו</h3><span class="muted">${i >= 0 ? `שלב ${i + 1} מתוך ${c.steps.length}` : ''}</span></div>
    ${now}
    <div class="milestones">${lines.map((t) => `<p class="muted">${t}</p>`).join('')}${water}</div>
  </div>`;
}

/* ---------- where we are: stage picture and time strip ---------- */
// Steps whose action waits for a sign ("wrap when the bark is dark", "take out at 95°C"): until then nothing has changed yet.
const WAITS = /כש|סביב|(?:^|\s)ב-\d{2}°C/;
const QUICK_MIN = { prep: 10, heat: 20, in: 5, dial: 15, wrap: 10, sear: 10, glaze: 10, spritz: 5, out: 5, rest: 30, step: 10 };
// Estimated clock times per step: finished steps use the time they were marked, the rest are projected forward.
// A step's time runs until its action is done, so open-ended steps ("until 93°C") share whatever is left of the recipe's cooking time.
function stageTimes(c) {
  const info = planSteps(c.steps), r = S.recipes.find((x) => x.id === c.recipeId);
  const total = (c.hours ?? r?.hours ?? 0) * 60000 * 60, rest = c.rest ?? r?.rest ?? null;
  const cooking = (p) => p.kind !== 'prep' && p.kind !== 'heat' && p.kind !== 'rest';
  const open = info.map((p, i) => cooking(p) && p.min == null && (p.meat != null || (p.kind === 'out' && WAITS.test(c.steps[i].t))));
  if (!open.some(Boolean)) { const k = info.findLastIndex(cooking); if (k >= 0 && info[k].min == null) open[k] = true; }
  const fixed = (p) => (p.min ?? (p.kind === 'rest' && rest ? rest : QUICK_MIN[p.kind])) * 60000;
  const now = Date.now(), cur = c.steps.findIndex((x) => !x.at);
  let t = c.start, cookEnd = null;
  return info.map((p, i) => {
    const from = t, at = c.steps[i].at;
    // A step that both lights the smoker and smokes ("set to 120°C and smoke an hour") starts the cooking clock after the preheat.
    if (cookEnd == null && (cooking(p) || p.kind === 'heat')) cookEnd = from + (p.kind === 'heat' ? QUICK_MIN.heat * 60000 : 0) + (total || 3600000);
    let len = fixed(p);
    if (open[i] && !at) {
      const later = info.slice(i + 1).map((q, k) => ({ q, k: k + i + 1 })).filter(({ q }) => cooking(q));
      const fixedLeft = later.filter(({ k }) => !open[k]).reduce((a, { q }) => a + fixed(q), 0);
      len = Math.max(15 * 60000, (cookEnd - Math.max(from, i === cur ? now : from) - fixedLeft) / (1 + later.filter(({ k }) => open[k]).length) + (i === cur ? Math.max(0, now - from) : 0));
    }
    const plan = from + len;
    const to = at ? Math.max(from, at) : i === cur ? Math.max(plan, now) : plan;
    t = to;
    return { ...p, from, to, plan, done: !!at, late: !at && i === cur && plan < now };
  });
}
function sceneState(c, info, i) {
  const st = { inside: false, wrapped: false, dial: null, lit: false, wasLit: false, kind: i >= 0 ? info[i].kind : 'end' };
  const upto = i >= 0 ? i : info.length - 1;
  for (let k = 0; k <= upto; k++) {
    const p = info[k], t = c.steps[k].t, pending = k === i && WAITS.test(t);
    if (p.dial) st.dial = p.dial;
    if (p.kind === 'heat') { st.lit = st.wasLit = true; if (/לעשן|להכניס|להניח/.test(t)) st.inside = true; }
    if (/להוציא/.test(t) && !pending) st.inside = false;
    if (p.kind === 'in' || /להחזיר/.test(t)) st.inside = true;
    if (p.kind === 'wrap' && !pending) st.wrapped = true;
    if (/לפתוח את (?:הנייר|העטיפה)|להסיר את (?:הנייר|העטיפה)/.test(t)) st.wrapped = false;
    if (p.kind === 'rest') { st.inside = false; st.lit = false; }
  }
  if (i < 0) { st.inside = false; st.lit = false; }
  if (st.lit && !st.dial) st.dial = c.smokerTemp || null;
  const at = st.dial ? ` ב-${st.dial}°C` : '';
  st.hot = st.lit && (st.kind === 'sear' || st.dial >= 230);
  st.label = i < 0 ? 'כל השלבים בוצעו' : st.kind === 'rest' ? 'מנוחה' : !st.lit ? (st.wasLit ? 'אחרי הבישול: פריסה והגשה' : 'הכנות, המעשנה עוד כבויה')
    : st.inside ? (st.hot ? `צריבה${at}` : st.wrapped ? `עטוף או מכוסה, ממשיך${at}` : `עישון${at}`)
    : st.kind === 'heat' ? `חימום המעשנה${st.dial ? ` ל-${st.dial}°C` : ''}` : `המעשנה דולקת${at}, האוכל בחוץ`;
  return st;
}
function sceneSvg(st) {
  const meat = (x, y) => `<ellipse class="${st.wrapped ? 'sc-foil' : 'sc-meat'}" cx="${x}" cy="${y}" rx="22" ry="9"/>`;
  const smoke = st.lit ? [[128, 16, 7], [138, 6, 9], [124, 0, 6]].map(([x, y, r], k) => `<circle class="sc-smoke s${k}" cx="${x}" cy="${y}" r="${r}"/>`).join('') : '';
  const flame = st.lit ? `<path class="sc-flame" d="${st.hot ? 'M170 134c-14-10-4-20-8-30 12 6 10 14 14 18 2-8 0-14 4-20 10 12 12 24-2 32z' : 'M170 134c-8-6-2-12-4-18 7 4 6 8 8 11 1-5 0-8 3-12 6 8 6 14-3 19z'}"/>` : '';
  const steam = st.kind === 'rest' ? '<path class="sc-steam" d="M262 92c-4-6 4-8 0-14M276 92c-4-6 4-8 0-14M290 92c-4-6 4-8 0-14"/>' : '';
  return `<svg class="scene" viewBox="0 0 340 150" role="img" aria-label="${esc(st.label)}">
    ${smoke}
    <rect class="sc-pipe" x="120" y="18" width="14" height="14" rx="2"/>
    <rect class="sc-body" x="110" y="30" width="120" height="108" rx="8"/>
    <rect class="sc-win ${st.hot ? 'hot' : st.lit ? 'on' : ''}" x="122" y="42" width="96" height="62" rx="5"/>
    <line class="sc-rack" x1="124" x2="216" y1="60" y2="60"/><line class="sc-rack" x1="124" x2="216" y1="80" y2="80"/><line class="sc-rack" x1="124" x2="216" y1="98" y2="98"/>
    ${st.inside ? meat(170, 72) : ''}
    <rect class="sc-pan" x="140" y="108" width="60" height="6" rx="2"/>
    ${flame}
    <line class="sc-leg" x1="120" x2="116" y1="138" y2="148"/><line class="sc-leg" x1="220" x2="224" y1="138" y2="148"/>
    ${st.dial && st.lit ? `<text class="sc-dial" x="70" y="62" text-anchor="middle">${st.dial}°C</text><text class="sc-sub" x="70" y="78" text-anchor="middle">כיוון החוגה</text>` : ''}
    <rect class="sc-board" x="246" y="100" width="62" height="6" rx="3"/>
    ${!st.inside ? meat(277, 92) : ''}
    ${steam}
  </svg>`;
}
function stageStrip(st) {
  const W = 340, L = 6, R = 6, MINW = 18, span = st.reduce((a, x) => a + (x.to - x.from), 0) || 1;
  const free = Math.max(0, W - L - R - MINW * st.length), now = Date.now();
  let x = W - R, mark = '';
  const segs = st.map((p, i) => {
    const w = MINW + free * ((p.to - p.from) / span), x0 = x - w; x = x0;
    const cur = !p.done && (i === 0 || st[i - 1].done) && st.slice(0, i).every((q) => q.done);
    if (cur) { const f = Math.min(1, Math.max(0, (now - p.from) / Math.max(1, p.to - p.from))); const mx = x0 + w - f * w; mark = `<path class="st-now" d="M${(mx - 5).toFixed(1)} 2h10l-5 8z"/><line class="st-now" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="8" y2="36"/>`; }
    return `<rect class="st-seg ${p.done ? 'done' : cur ? 'cur' : ''}" x="${(x0 + 1).toFixed(1)}" y="12" width="${(w - 2).toFixed(1)}" height="22" rx="4"/><text class="${p.done ? 'done' : cur ? 'cur' : ''}" x="${(x0 + w / 2).toFixed(1)}" y="27" text-anchor="middle">${i + 1}</text>`;
  }).join('');
  const end = st[st.length - 1].to;
  return `<svg class="strip" viewBox="0 0 ${W} 50" role="img" aria-label="ציר השלבים לפי זמן">
    ${segs}${mark}
    <text x="${W - R}" y="47" text-anchor="end">${fmtTime(st[0].from)}</text>
    <text x="${L}" y="47" text-anchor="start">${fmtTime(end)}${dayLabel(end) !== dayLabel(st[0].from) ? ' ' + dayLabel(end) : ''}</text>
  </svg>`;
}
function stageCard(c) {
  if (!c.steps.length) return '';
  const st = stageTimes(c), i = c.steps.findIndex((x) => !x.at), sc = sceneState(c, st, i);
  const end = st[st.length - 1].to, p = st[i];
  let line = '';
  if (p) {
    line = p.late
      ? `<p class="note warn">לפי השעון, שלב ${i + 1} היה אמור להסתיים בסביבות ${fmtTime(p.plan)}. אם הוא בוצע, מסמנים "בוצע"; אם לא, ממשיכים לפי הטמפרטורה והמרקם.</p>`
      : `<p class="muted">שלב ${i + 1} התחיל ב-${fmtTime(p.from)}, ולפי ההערכה יסתיים בסביבות ${fmtTime(p.to)}.</p>`;
  }
  return `<div class="card" id="stage">
    <div class="row between"><h3>איפה אנחנו</h3><span class="chip">${esc(sc.label)}</span></div>
    ${sceneSvg(sc)}
    ${stageStrip(st)}
    ${line}
    ${p ? `<p class="muted">סיום משוער של כל השלבים, כולל מנוחה: <strong>${fmtTime(end)}</strong>${dayLabel(end) !== 'היום' ? ' ' + dayLabel(end) : ''}. זו הערכה לפי זמני המתכון; בפועל קובעת הטמפרטורה.</p>` : ''}
  </div>`;
}

/* ---------- cook mode ---------- */
function startCook(id) {
  if (S.cook && !confirm('יש בישול פעיל. להחליף אותו בבישול חדש? המדידות של הבישול הנוכחי יימחקו.')) return;
  const r = S.recipes.find((x) => x.id === id);
  S.cook = {
    id: uid(), recipeId: r?.id || null, name: r?.name || 'בישול חופשי',
    weight: r?.weight ?? null, wood: r?.wood || '', smokerTemp: r?.smokerTemp ?? null, targetTemp: r?.targetTemp ?? null,
    hours: r?.hours ?? null, rest: r?.rest ?? null, wake: true,
    start: Date.now(), steps: (r?.steps || []).map((t) => ({ t, at: null })), log: [], timers: [],
  };
  // Water-pan reminders for longer cooks; the clock starts when the meat goes in.
  if ((r?.hours ?? 0) >= 2) {
    const hasIn = planSteps(S.cook.steps).some((p) => p.kind === 'in');
    S.cook.water = { every: 120, next: hasIn ? null : Date.now() + 120 * 60000, fired: false };
  }
  setWake(true, true);
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
  const a = analyze(c), plan = stageTimes(c);
  const done = c.steps.filter((s) => s.at).length;
  const timers = [...c.timers].sort((x, y) => x.end - y.end);
  const notifState = !('Notification' in window) ? 'none' : Notification.permission;
  return `
    <div class="card">
      <div class="row between"><h2>${esc(c.name)}</h2><span class="muted">התחיל ב-${fmtTime(c.start)}${dayLabel(c.start) !== 'היום' ? ' ' + dayLabel(c.start) : ''}</span></div>
      <div class="big" data-elapsed="${c.start}">${fmtClock(Date.now() - c.start)}</div>
      <div class="chips">${c.weight ? `<span class="chip">${c.weight} ק"ג</span>` : ''}${c.smokerTemp ? `<span class="chip">מעשנה ${c.smokerTemp}°C</span>` : ''}${c.targetTemp ? `<span class="chip">יעד ${c.targetTemp}°C</span>` : ''}${c.wood ? `<span class="chip">${esc(c.wood)}</span>` : ''}</div>
      <p class="note ${a.cls}">${esc(a.msg)}</p>
      ${'wakeLock' in navigator
        ? `<label class="row"><input type="checkbox" data-act="wake-toggle" ${wakeWanted ? 'checked' : ''}> <span>המסך נשאר דולק כל זמן שהבישול פעיל</span></label>`
        : '<p class="muted small">הדפדפן הזה לא מאפשר להשאיר את המסך דולק. אפשר לבטל זמנית את הנעילה האוטומטית בהגדרות הטלפון.</p>'}
      <p class="muted small">הבישול נשמר במכשיר ונשאר פתוח גם אם סוגרים את האפליקציה. הוא מסתיים רק בלחיצה על "סיום ותיעוד ביומן" או על "ביטול".</p>
    </div>

    ${stageCard(c)}

    ${guide(c)}

    ${c.steps.length ? `<div class="card">
      <div class="row between"><h3>שלבים</h3><span class="muted">${done} מתוך ${c.steps.length}</span></div>
      <ul class="steps">${c.steps.map((s, i) => `<li><label class="${s.at ? 'done' : ''}">
        <input type="checkbox" data-act="step-toggle" data-arg="${i}" ${s.at ? 'checked' : ''}>
        <span>${esc(s.t)}</span><time>${s.at ? fmtTime(s.at) : 'בערך ' + fmtTime(plan[i].to)}</time></label></li>`).join('')}</ul>
      <p class="muted small">השעות שליד שלבים שעוד לא בוצעו הן הערכה, והן מתעדכנות בכל שלב שמסמנים.</p>
    </div>` : ''}

    <div class="card">
      <h3>טיימרים</h3>
      <div class="row">${[15, 30, 45, 60].map((m) => `<button class="btn sm" data-act="timer-add" data-arg="${m}">${m} דק'</button>`).join('')}</div>
      <select data-act="timer-hours" aria-label="טיימר בשעות">
        <option value="">טיימר בשעות…</option>
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => `<option value="${h}">${hoursLabel(h)}</option>`).join('')}
      </select>
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
const hoursLabel = (h) => (h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`);
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
  const c = S.cook;
  c.log.push({ at: Date.now(), smoker, meat, note });
  const i = c.steps.findIndex((x) => !x.at), cue = i >= 0 ? planSteps(c.steps)[i].meat : null;
  const hit = meat != null && cue && meat >= cue && c.cued !== i;
  if (hit) c.cued = i;
  save(); render();
  if (hit) fireAlarm(`הבשר ב-${meat}°C. ${c.steps[i].t}`, 'נקודת ציון בבישול');
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
async function fireAlarm(label, title = 'הטיימר הסתיים') {
  beep();
  if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
  $('#alarm-text').textContent = label;
  const d = $('#alarm'); if (!d.open) d.showModal();
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) reg.showNotification(title, { body: label, tag: 'smoker-timer', icon: 'icon-192.png' });
      else new Notification(title, { body: label });
    } catch { /* notifications unavailable */ }
  }
}
// While a cook is active the screen stays on. "quiet" requests (on open, on start) never nag;
// if the browser refuses without a tap, the next tap or return to the app tries again.
async function setWake(on, quiet = false) {
  wakeWanted = on && 'wakeLock' in navigator;
  try {
    if (wakeWanted) { if (!wake || wake.released) wake = await navigator.wakeLock.request('screen'); }
    else if (on) { if (!quiet) toast('הדפדפן הזה לא תומך בהשארת המסך דולק'); }
    else if (wake) { await wake.release(); wake = null; }
  } catch { if (!quiet) { wakeWanted = false; toast('לא הצלחתי להשאיר את המסך דולק'); render(); } }
}
let stageDrawn = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (wakeWanted) setWake(true, true); stageDrawn = 0; tick(); }
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
  if (tab === 'cook' && now - stageDrawn > 30000) {
    stageDrawn = now;
    const el = $('#stage'); if (el) el.outerHTML = stageCard(S.cook);
  }
  const due = S.cook.timers.filter((t) => !t.fired && t.end <= now);
  if (due.length) {
    due.forEach((t) => { t.fired = true; });
    save();
    fireAlarm(due.map((t) => t.label).join(' · '));
  }
  const w = S.cook.water;
  if (w?.next && !w.fired && w.next <= now) {
    w.fired = true; save();
    fireAlarm('בדיקת מגש המים: להוסיף מים חמים אם המפלס ירד.', 'תזכורת');
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
const PRACTICES = [
  ['הדלקה וחימום', [
    'מדליקים במצב SMOKE כשדלת התא פתוחה, עד שמחזור ההצתה מסתיים (כ-5 דקות).',
    'סוגרים את הדלת ומחממים 15 עד 20 דקות לפני שמכניסים אוכל. ביום קר מוסיפים 20 דקות לפחות.',
    'כשמורידים מטמפרטורה גבוהה לנמוכה, פותחים את הדלת עד שהחום יורד קרוב ליעד. כך האש לא נכבית.',
    'אחרי שמכל הפלטים התרוקן לגמרי, לוחצים על PRIME עד שפלטים נופלים שוב לתא הבעירה.',
  ]],
  ['מגש המים', [
    'ממלאים עד כשלושה רבעים, ולא נותנים לו להתייבש בזמן בישול. המגש גם אוסף שומן.',
    'קצב ההתאדות משתנה מאוד ממעשנה למעשנה ומיום ליום (בין שעה וחצי לשש שעות), ולכן האפליקציה מזכירה לבדוק כל שעתיים.',
    'ממלאים במים חמים כדי שהטמפרטורה בתא לא תצנח. בבישול ארוך אפשר להעלות את המגש קומה כדי שהמים יחזיקו יותר.',
    'ריפוד בנייר כסף מקל על הניקוי.',
  ]],
  ['הדלת', [
    'כל פתיחה של הדלת מאריכה את הבישול ב-10 עד 15 דקות. מרכזים פעולות: מדידה, ריסוס ובדיקת מים באותה פתיחה.',
    'משאירים רווח בין הנתחים לדפנות. תא עמוס מדי מאריך את הבישול.',
    'אין נתון רשמי על הפרשי חום בין המדפים, ובעלי מעשנות מדווחים על כיוונים הפוכים. מדחום בגובה המדף ייתן תשובה למעשנה שלך.',
  ]],
  ['עטיפה ועצירת הטמפרטורה (stall)', [
    'העצירה מתחילה סביב 66 עד 68°C ויכולה להימשך שעות. הסיבה היא קירור מהתאדות, לא תקלה.',
    'שלוש אפשרויות: לחכות, לעטוף, או לבשל חם יותר (סביב 150°C כמעט אין עצירה).',
    'עוטפים כשהקרום כהה ויציב, בדרך כלל בין 66 ל-74°C.',
    'נייר קצבים שומר על קרום יציב יותר. נייר כסף מהיר יותר ושומר יותר נוזלים, אבל מרכך את הקרום.',
  ]],
  ['ריסוס', [
    'מתחילים אחרי שעתיים עד ארבע, כשהקרום התייצב, ואז כל חצי שעה עד שעה. מים, חומץ תפוחים או מיץ תפוחים.',
    'המומחים חלוקים על המחיר: יש שמדדו השפעה זניחה, ויש שמדברים על 10 עד 20 אחוז יותר זמן.',
  ]],
  ['מנוחה והחזקה', [
    'בריסקט ונתחים גדולים: מנוחה של שעתיים עד ארבע נותנת את התוצאה הטובה ביותר.',
    'צידנית עם מגבות מחזיקה חום שלוש עד ארבע שעות.',
    'מחזיקים אוכל חם ב-60°C ומעלה. בתנור: סביב 60°C, ולא מעל 71°C.',
    'בנתחים ארוכים המספר הוא רק כיוון. מוכן כשהמדחום נכנס כמו לחמאה, בדרך כלל בין 93 ל-99°C.',
  ]],
  ['בטיחות מזון', [
    'מינימום לפי ה-USDA: נתחים שלמים של בקר וטלה 63°C ועוד שלוש דקות מנוחה; בשר טחון 71°C; עוף והודו 74°C; דגים 63°C.',
    'טמפרטורות נמוכות מ-63°C בנתחי בקר וטלה (מדיום-רייר) הן בחירה של טעם, מתחת להמלצה הרשמית.',
    'אזור הסכנה הוא בין 4 ל-60°C. אוכל לא נשאר בו יותר משעתיים, ושעה אחת ביום חם מאוד.',
    'מפשירים לגמרי לפני העישון, במקרר.',
    'שאריות: למקרר בתוך שעתיים, בכלים רדודים. אוכלים בתוך שלושה עד ארבעה ימים ומחממים ל-74°C.',
    'מלח משמר שוקלים במדויק. לא מוסיפים "ליתר ביטחון".',
  ]],
  ['מדחום', [
    'נועצים בחלק העבה ביותר, רחוק מעצם, משומן ומגיד. בנתח דק נועצים מהצד.',
    'התצוגה של הבקר לא תמיד תואמת את החום ליד האוכל. מדחום בגובה המדף מדויק יותר.',
    'בדיקת כיול: כוס מלאה קרח עם מים, לערבב, ולמדוד בלי לגעת בדפנות. צריך להראות 0°C.',
  ]],
  ['ניקוי ותחזוקה', [
    'אחרי כל בישול: תא הבעירה, הרשתות, מגש המים ומגש השומן.',
    'כל שניים-שלושה בישולים: הזכוכית (סודה לשתייה וחומץ) וחיישן הטמפרטורה.',
    'כל חמישה-שישה בישולים: תחתית התא, צינור ניקוז השומן ופתח האוויר.',
    'כיבוי: מריצים על 177°C בדלת סגורה 5 עד 10 דקות (יותר אחרי בישול שומני), ואז נותנים למאוורר לסיים את מחזור הקירור.',
    'שריפת שומן: משאירים את הדלת סגורה ומכבים. לא שופכים מים ולא מנתקים מהחשמל.',
    'פלטים שומרים בכלי אטום ויבש. פלטים רטובים מתנפחים וחוסמים את הבורג.',
  ]],
  ['תקלות', [
    'תצוגה מהבהבת: החום ירד מתחת ל-65°C והאש עלולה להיכבות. בודקים פלטים, בורג, אפר בתא הבעירה ומאוורר.',
    'ErH: התחממות יתר. מכבים, נותנים להתקרר, מנקים ומדליקים מחדש.',
    'Er1: חיבור חיישן התא. noP: חיבור מדחום הבשר.',
  ]],
];
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
      <summary>כמה מנות לשעת הגשה אחת</summary>
      <form data-calc="multi">
        <p class="muted">מסמנים את המנות וקובעים שעת הגשה. האפליקציה מחשבת מתי להכניס כל מנה כדי שהכול יהיה מוכן יחד.</p>
        ${field('שעת הגשה', inp('serve', defaultServe(), 'type="datetime-local"'))}
        <div class="picklist">${[...S.recipes].sort((a, b) => a.name.localeCompare(b.name, 'he')).map((r) => `<label><input type="checkbox" name="r" value="${r.id}"> <span class="grow">${esc(r.name)}</span> <span class="muted small">${r.hours ? fmtDur(r.hours * 60) : 'בלי זמן'}</span></label>`).join('')}</div>
        <div class="grid2">
          ${field('מרווח ביטחון (דקות)', numInp('buffer', '30'))}
          ${field('חימום המעשנה (דקות)', numInp('preheat', '30'))}
        </div>
        <div class="result" data-out="multi"><span class="muted">מסמנים שתי מנות או יותר ושעת הגשה, ולוח הזמנים המשותף מופיע כאן.</span></div>
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
      <summary>כללי עבודה לפיט בוס אנכי</summary>
      ${PRACTICES.map(([h, items]) => `<h3>${h}</h3><ul class="plain">${items.map((t) => `<li>${t}</li>`).join('')}</ul>`).join('')}
      <p class="muted small">מקורות: חוברת ההפעלה של Pit Boss Pro Series 4 Vertical, ה-USDA, ThermoWorks, AmazingRibs ו-Texas A&amp;M. אם החוברת של הדגם שלך אומרת אחרת, היא הקובעת.</p>
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
      <button class="btn block" data-act="packs-restore">הוספת המתכונים המובנים שחסרים</button>
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
  multi(f, out) {
    const serve = new Date(f.serve.value).getTime(), buffer = num(f.buffer.value) || 0, preheat = num(f.preheat.value) || 0;
    const picked = [...f.querySelectorAll('input[name="r"]:checked')].map((el) => S.recipes.find((r) => r.id === el.value)).filter(Boolean);
    const ok = picked.filter((r) => r.hours > 0), skipped = picked.filter((r) => !(r.hours > 0));
    if (!serve || !ok.length) { out.innerHTML = '<span class="muted">מסמנים שתי מנות או יותר ושעת הגשה, ולוח הזמנים המשותף מופיע כאן.</span>'; return; }
    const items = [];
    for (const r of ok) {
      const outAt = serve - (buffer + (r.rest || 0)) * 60000, inAt = outAt - r.hours * 3600000;
      items.push([`להכניס: ${r.name}`, inAt, r.smokerTemp], [`להוציא למנוחה: ${r.name}`, outAt]);
    }
    items.push(['הדלקת המעשנה', Math.min(...items.map((x) => x[1])) - preheat * 60000], ['הגשה', serve]);
    items.sort((a, b) => a[1] - b[1]);
    lastPlan = { name: 'ארוחה במעשנה', items };
    const temps = [...new Set(ok.map((r) => r.smokerTemp).filter(Boolean))].sort((a, b) => a - b);
    const notes = [];
    if (items[0][1] < Date.now()) notes.push('שעת ההדלקה כבר עברה. צריך לדחות את ההגשה או לוותר על מנה ארוכה.');
    if (temps.length > 1) notes.push(`המתכונים דורשים טמפרטורות שונות (${temps.map((t) => t + '°C').join(', ')}), ובמעשנה אחת יש טמפרטורה אחת. מכוונים לפי הנתח הגדול. מנה שהמתכון שלה חם יותר תצטרך יותר זמן, ולכן מקדימים אותה ועוקבים במדחום; מנה שהמתכון שלה קר יותר תהיה מוכנה מוקדם יותר.`);
    if (skipped.length) notes.push(`בלי זמן בישול במתכון, ולכן לא נכללו: ${skipped.map((r) => r.name).join(', ')}.`);
    out.innerHTML = `<table><tbody>${items.map(([t, at, temp]) => `<tr><td>${esc(t)}${temp ? ` <span class="muted small">(${temp}°C)</span>` : ''}</td><td class="n">${dayLabel(at)}</td><td class="n"><strong>${fmtTime(at)}</strong></td></tr>`).join('')}</tbody></table>${notes.map((n) => `<p class="note warn">${esc(n)}</p>`).join('')}`;
  },
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
  'import-fetch': importFetch,
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
  'step-toggle': (i) => markStep(+i),
  'step-done': (i) => markStep(+i),
  'step-timer': (i) => { const x = S.cook.steps[+i], m = planSteps(S.cook.steps)[+i].min; if (m) addTimer(m, x.t.length > 40 ? x.t.slice(0, 38) + '…' : x.t); },
  'water-done': () => { const w = S.cook.water; w.next = Date.now() + w.every * 60000; w.fired = false; save(); render(); toast('התזכורת הבאה בעוד שעתיים'); },
  'timer-add': (m) => addTimer(+m),
  'timer-hours': (_, el) => { const h = +el.value; if (h > 0) addTimer(h * 60, `טיימר ${hoursLabel(h)}`); },
  'timer-del': (id) => { S.cook.timers = S.cook.timers.filter((t) => t.id !== id); save(); render(); },
  'log-del': (at) => { S.cook.log = S.cook.log.filter((r) => r.at !== +at); save(); render(); },
  'wake-toggle': (_, el) => { if (S.cook) { S.cook.wake = el.checked; save(); } setWake(el.checked); },
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
  'packs-restore': () => {
    const have = new Set(S.recipes.map((r) => r.name));
    const add = [...SEED_RECIPES, ...PACK_RECIPES].filter((r) => !have.has(r.name));
    if (!add.length) { toast('כל המתכונים המובנים כבר ברשימה'); return; }
    S.recipes.push(...add.map(({ pack, ...r }) => ({ ...r, id: uid(), updated: Date.now() })));
    S.packs = [...new Set([...S.packs, ...PACK_RECIPES.map((r) => r.pack)])];
    save(); render(); toast(add.length === 1 ? 'נוסף מתכון אחד' : `נוספו ${add.length} מתכונים`);
  },
};
const ON_CHANGE = new Set(['wake-toggle', 'step-toggle', 'season-toggle', 'timer-hours']);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || ON_CHANGE.has(el.dataset.act) || el.matches('select, input[type="file"]')) return;
  ensureAudio();
  if (wakeWanted && (!wake || wake.released)) setWake(true, true);
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
  if (S.cook) { tab = 'cook'; if (S.cook.wake !== false) setWake(true, true); }
  // v2: pack recipes first shipped with Fahrenheit dial settings; the dial is in Celsius.
  if (S.v < 2) {
    const round = { 107: 110, 121: 120, 135: 135, 149: 150 };
    for (const r of S.recipes) {
      let hit = false;
      r.steps = (r.steps || []).map((t) => t.replace(/\d+°F \((\d+)°C\)/g, (_, c) => { hit = true; return `${round[c] || c}°C`; }));
      if (hit && round[r.smokerTemp]) r.smokerTemp = round[r.smokerTemp];
    }
    S.v = 2; save();
  }
  if (S.v < 4) {
    // Entrecote: the sear now happens in the smoker itself (dial reaches 250°C).
    const a = 'להוציא, ולהעלות את המעשנה לחום המרבי או לחמם תנור ל-250°C', b = 'לצרוב 8-10 דקות עד שנוצר קרום';
    for (const r of S.recipes) {
      const i = (r.steps || []).indexOf(a);
      if (i < 0 || r.steps[i + 1] !== b) continue;
      r.steps.splice(i, 2, 'להוציא את הנתח ולכסות ברפיון בנייר כסף', 'להעלות ל-250°C ולחכות שהמעשנה תתייצב, כ-15 דקות', 'להחזיר את הנתח למדף האמצעי ל-8-10 דקות, עד שנוצר קרום');
      r.notes = (r.notes || '').replace('למדיום מוציאים ב-57°C. ', 'למדיום מוציאים ב-57°C. הצריבה נעשית במעשנה עצמה, בחום המרבי שלה. לפני שמעלים את החום מוודאים שמגש השומן נקי ושיש מים במגש, כי שומן ישן עלול להידלק בחום גבוה. ');
    }
  }
  if (S.v < 3) {
    for (const r of S.recipes) if (typeof r.ingredients === 'string') r.ingredients = r.ingredients.replace('25 גרם מלח משמר ורוד', '20 גרם מלח משמר ורוד');
    S.v = 3;
  }
  if (S.v < 5) {
    // Picanha and lamb rack: sear in the smoker at 250°C instead of a pan.
    const out = ['להוציא את הנתח ולכסות ברפיון בנייר כסף', 'להעלות ל-250°C ולחכות שהמעשנה תתייצב, כ-15 דקות'];
    const sear = 'הצריבה נעשית במעשנה עצמה ב-250°C. הקרום יוצא עדין יותר מאשר במחבת ברזל; מי שרוצה קרום חזק צורב במחבת דקה מכל צד. לפני שמעלים את החום מוודאים שמגש השומן נקי ושיש מים במגש. ';
    const swaps = [
      [['לעשן כשהשומן כלפי מעלה עד 52°C במרכז הנתח', 'לחמם מחבת ברזל או גריל לחום גבוה מאוד', 'לצרוב דקה עד שתיים מכל צד, ולהתחיל בצד השומן'],
        ['לעשן כשהשומן כלפי מעלה עד 48°C במרכז הנתח', ...out, 'להחזיר למדף האמצעי כשהשומן כלפי מעלה ל-6-8 דקות, עד 54°C וקרום זהוב'],
        (r) => { if (r.targetTemp === 52) r.targetTemp = 54; r.ingredients = (r.ingredients || '').replace('\nמעט שמן לצריבה', '');
          r.notes = (r.notes || '').replace('הטמפרטורה נותנת מידת עשייה מדיום-רייר. למדיום מוציאים ב-57°C. המעשנה האנכית לא צורבת, ולכן הצריבה נעשית במחבת או על גריל. ', 'מוציאים מהעישון מוקדם, ב-48°C, כי הנתח ממשיך להתחמם בזמן ההמתנה ובצריבה. 54°C בסוף נותן מדיום-רייר; למדיום ממשיכים עד 58°C. ' + sear); }],
      [['לעשן כשהעצמות כלפי מטה עד 49°C במרכז הבשר', 'לחמם מחבת ברזל או גריל לחום גבוה מאוד', 'לצרוב דקה מכל צד, עד 54°C'],
        ['לעשן כשהעצמות כלפי מטה עד 46°C במרכז הבשר', ...out, 'להחזיר למדף האמצעי ל-5-6 דקות, עד 54°C'],
        (r) => { r.notes = (r.notes || '').replace('כל הזמן. 54°C נותן מדיום-רייר, למדיום מוציאים ב-60°C. ', 'כל הזמן, גם בצריבה. 54°C נותן מדיום-רייר, למדיום ממשיכים עד 60°C. ' + sear); }],
    ];
    for (const r of S.recipes) for (const [from, to, fix] of swaps) {
      const i = (r.steps || []).indexOf(from[0]);
      if (i < 0 || from.some((t, k) => r.steps[i + k] !== t)) continue;
      r.steps.splice(i, from.length, ...to); fix(r);
    }
  }
  if (S.v < 4) { S.v = 4; save(); }
  if (S.v < 5) { S.v = 5; save(); }
  const fresh = PACK_RECIPES.filter((r) => !S.packs.includes(r.pack));
  if (fresh.length) {
    S.recipes.push(...fresh.map(({ pack, ...r }) => ({ ...r, id: uid(), updated: Date.now() })));
    S.packs.push(...fresh.map((r) => r.pack));
    save();
  }
  render();
  if (fresh.length) toast(`נוספו ${fresh.length} מתכונים חדשים`);
  setInterval(tick, 1000);
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('sw', err));
  }
})();
