// Weekly rotations for the homepage: the Perfect Saturday area and last week's newsletter headlines.
// Both change every Monday (Houston time). They run at build time for the first paint and again in
// the browser, so a Monday visit shows the new pick even if the site has not been rebuilt yet.
import { addDays } from './weekend';

export function mondayOf(today: string): string {
  const dow = new Date(today + 'T12:00:00Z').getUTCDay();
  return addDays(today, -((dow + 6) % 7));
}

// Whole weeks since Monday, January 5, 1970, so every Monday starts a new number.
export function weekNumber(monday: string): number {
  return Math.floor((new Date(monday + 'T12:00:00Z').getTime() / 86400000 - 4) / 7);
}

// Steps through the pool one entry per week, so every entry gets its turn before any repeats.
export function pickForWeek<T>(pool: T[], today: string): T | null {
  return pool.length ? pool[weekNumber(mondayOf(today)) % pool.length] : null;
}

export interface NlItem { tone: string; label: string; title: string; text: string }
export interface NlSummary { slug: string; weekStart: string; weekLabel: string; title: string; lead: string; href: string; items: NlItem[] }

// Which newsletter sections show on the homepage card, and in what color.
const ITEMS: [string, string, string][] = [
  ['things to do', 'Things to do', 'blue'],
  ['restaurant of the week', 'Restaurant of the week', 'gold'],
  ['openings & closings', 'Openings and closings', 'green'],
];

export function summarizeEdition(e: any, href: string): NlSummary {
  const secs: any[] = e.sections || [];
  const items: NlItem[] = [];
  ITEMS.forEach(([nav, label, tone]) => {
    const s = secs.find((x) => String(x.nav || '').trim().toLowerCase() === nav);
    if (!s) return;
    const h = String(s.heading || '');
    items.push({ tone, label, title: h.indexOf(':') > -1 ? h.split(':').slice(1).join(':').trim() : '', text: s.brief || '' });
  });
  return { slug: e.slug, weekStart: e.weekStart, weekLabel: e.weekLabel, title: e.title, lead: (secs[0] && secs[0].brief) || e.summary || '', href, items };
}

// The edition for the Monday to Sunday week that just ended. If that one is not published yet,
// the newest edition before this week stands in, and the card moves on as soon as it appears.
export function lastWeekEdition(list: NlSummary[], today: string): NlSummary | null {
  const thisMonday = mondayOf(today);
  const lastMonday = addDays(thisMonday, -7);
  const sorted = list.slice().sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  return sorted.find((e) => e.weekStart === lastMonday) || sorted.find((e) => e.weekStart < thisMonday) || sorted[0] || null;
}

function esc(s: string): string { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export function renderHeadlines(e: NlSummary | null): string {
  if (!e) return '<p class="muted">The next newsletter is on its way.</p>';
  const items = e.items.map((i) => '<div class="hl-item ' + i.tone + '"><p class="hl-label">' + esc(i.label) + '</p>' + (i.title ? '<strong>' + esc(i.title) + '</strong>' : '') + '<span class="muted small">' + esc(i.text) + '</span></div>').join('');
  return '<div class="hl-head"><span class="muted small">From: Tradition Local</span><span class="muted small">' + esc(e.weekLabel) + '</span></div>'
    + '<h3><a href="' + esc(e.href) + '">' + esc(e.title) + '</a></h3>'
    + (e.lead ? '<p class="hl-lead">' + esc(e.lead) + '</p>' : '')
    + '<div class="hl-items">' + items + '</div>'
    + '<div class="hl-foot"><a href="' + esc(e.href) + '">Read the full newsletter &rarr;</a></div>';
}
