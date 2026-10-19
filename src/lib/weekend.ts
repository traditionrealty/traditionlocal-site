// "This weekend in Houston": picks real dated events for the Friday, Saturday and Sunday of the
// coming weekend, then fills any empty slot with a Sara's Pick, a Local Favorite, or an idea. It runs
// at build time for the first paint and again in the browser, so the section stays current between
// rebuilds. The homepage "This week" list uses the same logic for Monday to Thursday.

export interface WkEvent { id: string; cat: string; date: string; end?: string; title: string; venue?: string; href?: string; tl?: boolean; feat?: boolean }
export interface WkBiz { slug: string; name: string; area: string; cats: string[]; href: string; pick?: boolean; fav?: boolean }
export interface WkIdea { t: string; area: string; int: string; kind?: string; href: string }
export interface WkData { events: WkEvent[]; biz: WkBiz[]; ideas: WkIdea[] }
export interface Weekend { fri: string; sat: string; sun: string }
export interface WkCard { day: string; date: string; title: string; sub: string; tag: string; href: string; ext: boolean; fb?: boolean }
export interface WkRow { abbr: string; date: string; card: WkCard | null; passed: boolean }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Exhibits and long runs live under "Happening now", so they stay out of the weekend picks.
const SKIP = ['Exhibits', 'Tours'];
const MAX_SPAN_DAYS = 4;

// Which kinds of events suit each day. Higher numbers are picked first.
const WEIGHTS: Record<string, Record<string, number>> = {
  fri: { 'Live music': 20, Nightlife: 18, Theater: 16, Film: 14, 'Food & drink': 12, Festivals: 10, Community: 8, Family: 6, Free: 6, Sports: 6, Holiday: 6, Talks: 4 },
  sat: { Festivals: 20, Community: 18, Family: 16, 'Food & drink': 14, 'Live music': 12, Sports: 10, Holiday: 10, Free: 8, Theater: 6, Film: 6, Nightlife: 4, Talks: 4 },
  sun: { Family: 20, Community: 18, Free: 16, Festivals: 14, 'Food & drink': 12, Sports: 12, Holiday: 10, 'Live music': 8, Theater: 8, Film: 6, Talks: 6, Nightlife: 0 },
  // Monday to Thursday: evening plans that fit a work night.
  wk: { 'Live music': 20, Theater: 18, Film: 16, 'Food & drink': 14, Talks: 14, Community: 12, Sports: 10, Free: 8, Family: 6, Festivals: 6, Nightlife: 6, Holiday: 6 },
};

// Fallbacks when a day has no event: the kinds of places that suit each day. Sara's Picks and Local
// Favorites are chosen first, then any local business, then an editorial idea.
export const BIZ_CATS: Record<string, string[]> = {
  fri: ['Desserts', 'Ice Cream & Frozen Yogurt', 'Gelato', 'Bubble Tea', 'Bakeries'],
  sat: ['Coffee & Tea', 'Bakeries', 'Breakfast & Brunch', 'Cafes', 'Donuts'],
  sun: ['Breakfast & Brunch', 'Cafes', 'Bakeries', 'Coffee & Tea'],
  mon: ['Coffee & Tea', 'Cafes', 'Bakeries'],
  tue: ['Tacos', 'Mexican', 'Tex-Mex'],
  wed: ['Sandwiches', 'Noodles', 'Pizza', 'Vietnamese'],
  thu: ['Desserts', 'Ice Cream & Frozen Yogurt', 'Bubble Tea', 'Donuts'],
};
export const BIZ_CATS_ALL: string[] = Array.from(new Set(Object.keys(BIZ_CATS).reduce((all: string[], k) => all.concat(BIZ_CATS[k]), [])));
const IDEA_INTS: Record<string, string[]> = {
  fri: ['Live music', 'Arts & culture'], sat: ['Markets & shopping', 'Family'], sun: ['Outdoors', 'Family'],
  mon: ['Food & coffee', 'Arts & culture'], tue: ['Food & coffee', 'Live music'], wed: ['Arts & culture', 'Food & coffee'], thu: ['Live music', 'Arts & culture'],
};
const WEEKEND_KEYS = ['fri', 'sat', 'sun'];

function utc(d: string) { return new Date(d + 'T12:00:00Z'); }
function parts(d: string) { return { m: Number(d.slice(5, 7)), day: Number(d.slice(8, 10)) }; }
export function addDays(d: string, n: number): string { const t = utc(d); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function dayDiff(a: string, b: string): number { return Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000); }

// Today's date in Houston as YYYY-MM-DD.
export function houstonToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// Monday to Thursday points at the coming weekend. Friday to Sunday stays on the current one.
export function weekendFor(today: string): Weekend {
  const w = utc(today).getUTCDay();
  const fri = w === 5 ? today : w === 6 ? addDays(today, -1) : w === 0 ? addDays(today, -2) : addDays(today, 5 - w);
  return { fri, sat: addDays(fri, 1), sun: addDays(fri, 2) };
}

export function shortDate(d: string): string { const p = parts(d); return MONTHS[p.m - 1] + ' ' + p.day; }
// Monday to Thursday shows this week. Friday to Sunday looks ahead to next week.
export function weekFor(today: string): { mon: string; next: boolean } {
  const w = utc(today).getUTCDay();
  const next = w === 5 || w === 6 || w === 0;
  return { mon: addDays(today, next ? (w === 0 ? 1 : 8 - w) : 1 - w), next };
}

function dayLabel(d: string): string { const p = parts(d); return DAY_NAMES[utc(d).getUTCDay()] + ', ' + MONTHS[p.m - 1] + ' ' + p.day; }
function between(from: string, to: string): string {
  const a = parts(from), b = parts(to);
  return MONTHS[a.m - 1] + ' ' + a.day + ' to ' + (a.m === b.m ? '' : MONTHS[b.m - 1] + ' ') + b.day;
}
export function rangeLabel(w: Weekend): string { return between(w.fri, w.sun); }
export function weekRange(mon: string): string { return between(mon, addDays(mon, 3)); }
function hash(s: string): number { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003; return h; }
function shortVenue(v?: string): string { return (v || '').split(',')[0].trim(); }

function eventsOn(data: WkData, d: string, key: string, used: Set<string>): WkEvent[] {
  const w = WEIGHTS[key];
  return data.events
    .filter((e) => e.date <= d && (e.end || e.date) >= d && !used.has(e.id) && SKIP.indexOf(e.cat) < 0 && (!e.end || dayDiff(e.date, e.end) <= MAX_SPAN_DAYS))
    .map((e) => ({ e, s: (e.tl ? 100 : 0) + (e.feat ? 30 : 0) + (w[e.cat] || 0) + (e.end ? 0 : 5) }))
    .sort((a, b) => b.s - a.s || a.e.title.localeCompare(b.e.title))
    .map((x) => x.e);
}

function eventCard(e: WkEvent, d: string): WkCard {
  return { day: dayLabel(d), date: d, title: e.title, sub: shortVenue(e.venue), tag: e.tl ? 'Tradition Local' : e.cat, href: e.href || '', ext: !e.tl && !!e.href };
}

// A day with no event gets a Sara's Pick or Local Favorite from the right kind of place for that day.
// If none fits the day, any pick or favorite will do, and only then an ordinary local business.
function fallbackCard(data: WkData, key: string, d: string, seed: string, usedBiz: Set<string>): WkCard | null {
  const cats = BIZ_CATS[key];
  const open = data.biz.filter((b) => !usedBiz.has(b.slug));
  const themed = open.filter((b) => b.cats.some((c) => cats.indexOf(c) > -1));
  const best = themed.filter((b) => b.pick || b.fav);
  const anyBest = open.filter((b) => b.pick || b.fav);
  const pool = best.length ? best : anyBest.length ? anyBest : themed;
  if (pool.length) {
    const b = pool[hash(seed + key + d) % pool.length];
    usedBiz.add(b.slug);
    return { day: dayLabel(d), date: d, title: b.name, sub: b.area, tag: b.pick ? "Sara's Pick" : b.fav ? 'Local favorite' : 'Local pick', href: b.href, ext: false, fb: true };
  }
  const kind = WEEKEND_KEYS.indexOf(key) > -1 ? 'weekend' : 'anytime';
  const ideas = data.ideas.filter((i) => IDEA_INTS[key].indexOf(i.int) > -1 && (i.kind || 'weekend') === kind);
  if (ideas.length) {
    const i = ideas[hash(seed + key + d) % ideas.length];
    return { day: dayLabel(d), date: d, title: i.t, sub: i.area, tag: 'Idea', href: i.href, ext: false, fb: true };
  }
  return null;
}

// By default one Friday card, two Saturday cards, one Sunday card. Days already past drop off, and
// the days still to come share the slots, so a Sunday visit shows several things happening that day.
export function buildWeekend(data: WkData, w: Weekend, today: string, counts: number[] = [1, 2, 1]): WkCard[] {
  const used = new Set<string>();
  const usedBiz = new Set<string>();
  const cards: WkCard[] = [];
  const slots: [string, string, number][] = ([['fri', w.fri, counts[0]], ['sat', w.sat, counts[1]], ['sun', w.sun, counts[2]]] as [string, string, number][]).filter((s) => s[1] >= today);
  const total = counts[0] + counts[1] + counts[2];
  if (slots.length) slots[slots.length - 1][2] += Math.max(0, total - slots.reduce((n, s) => n + s[2], 0));
  slots.forEach(([key, d, n]) => {
    const list = eventsOn(data, d, key, used);
    const chosen: WkEvent[] = [];
    list.forEach((e) => {
      if (chosen.length >= n) return;
      // For a second pick, prefer a different kind of event when one exists.
      if (chosen.length && e.cat === chosen[0].cat && list.some((o) => o.cat !== chosen[0].cat && chosen.indexOf(o) < 0)) return;
      chosen.push(e);
    });
    chosen.forEach((e) => { used.add(e.id); cards.push(eventCard(e, d)); });
    for (let i = chosen.length; i < n; i++) {
      const f = fallbackCard(data, key, d, w.fri, usedBiz);
      if (f) cards.push(f);
    }
  });
  return cards;
}

function esc(s: string): string { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export function renderCards(cards: WkCard[]): string {
  if (!cards.length) return '<p class="muted">See the calendar below for what is happening this weekend.</p>';
  return cards.map((c) => {
    const t = c.href ? '<a href="' + esc(c.href) + '"' + (c.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(c.title) + '</a>' : esc(c.title);
    return '<div class="weekend-card"><p class="day">' + esc(c.day) + '</p><strong>' + t + '</strong>' + (c.sub ? '<span class="muted small">' + esc(c.sub) + '</span>' : '') + '<span class="wk-tag">' + esc(c.tag) + '</span></div>';
  }).join('');
}

// Monday to Thursday, one pick per day: an event on that date, or else a Sara's Pick or Local Favorite.
export function buildWeek(data: WkData, mon: string, today: string): WkRow[] {
  const used = new Set<string>();
  const usedBiz = new Set<string>();
  return ['mon', 'tue', 'wed', 'thu'].map((key, i) => {
    const d = addDays(mon, i);
    const passed = d < today;
    const list = eventsOn(data, d, 'wk', used);
    let card: WkCard | null = null;
    if (list.length) { used.add(list[0].id); card = eventCard(list[0], d); }
    else card = fallbackCard(data, key, d, mon, usedBiz);
    return { abbr: DAY_ABBR[utc(d).getUTCDay()], date: d, card, passed };
  });
}

export function rowsFromCards(cards: WkCard[]): WkRow[] {
  return cards.map((c) => ({ abbr: DAY_ABBR[utc(c.date).getUTCDay()], date: c.date, card: c, passed: false }));
}

export function renderRows(rows: WkRow[]): string {
  if (!rows.length) return '<p class="muted">See the calendar for what is happening.</p>';
  return rows.map((r) => {
    const head = '<p class="hw-day">' + r.abbr + '<span>' + shortDate(r.date) + '</span></p>';
    const c = r.card;
    if (!c) return '<div class="hw-row">' + head + '<span class="hw-done">See the calendar</span></div>';
    const t = c.href ? '<a href="' + esc(c.href) + '"' + (c.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(c.title) + '</a>' : esc(c.title);
    return '<div class="hw-row">' + head + '<div class="hw-body"><strong>' + t + '</strong>' + (c.sub ? '<span class="muted small">' + esc(c.sub) + '</span>' : '') + (c.fb ? '<span class="hw-tag">' + esc(c.tag) + '</span>' : '') + '</div></div>';
  }).join('');
}
