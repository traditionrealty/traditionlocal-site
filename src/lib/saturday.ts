// "The Perfect Saturday" on each area page, built from real data: the area's reviewed businesses,
// editorial ideas for the area, and dated events that happen there. Every slot falls back through a
// list of sources, and anything that is not local to the area says so ("Around Houston"), so the page
// never invents a place or presents a far away event as a local one. Businesses that have closed, are
// temporarily closed, or are being renovated are never picked.
import { addDays } from './weekend';

export interface SatBiz { slug: string; name: string; area?: string; categories: string[]; saraPick?: boolean; rating?: string | null; closed?: boolean; temporarilyClosed?: boolean; renovating?: boolean }
export interface SatIdea { area: string; int: string; kind?: string; t: string; b: string }
export interface SatEvent { id: string; cat: string; date: string; end?: string; title: string; venue?: string; where?: string; href: string; ext: boolean; tl?: boolean; feat?: boolean }
export interface SatSlot { time: string; label: string; title: string; sub: string; tag: string; href: string; ext: boolean; local: boolean }
export interface SatUpcoming { day: string; num: string; title: string; href: string; ext: boolean; local: boolean }
export interface SatPlan { saturday: string; slots: SatSlot[]; upcoming: SatUpcoming | null; localCount: number }
export interface SatHrefs { biz: (b: SatBiz) => string; idea: (i: SatIdea) => string; ideasPage: (areaName: string) => string; fallbackEvent: string }

const COFFEE = ['Coffee & Tea', 'Coffee Roasteries'];
const BREAKFAST = ['Cafes', 'Breakfast & Brunch'];
const BAKERY = ['Bakeries', 'Donuts'];
export const LUNCH_CATS = ['Sandwiches', 'Mexican', 'Tex-Mex', 'American', 'Mediterranean', 'Vietnamese', 'Indian', 'Chinese', 'Halal', 'Middle Eastern', 'Cajun/Creole', 'Breakfast & Brunch', 'Burgers', 'Tacos', 'Pizza', 'Noodles', 'Pakistani', 'Persian/Iranian', 'Korean', 'Japanese', 'Thai', 'Italian', 'Greek', 'Afghan', 'Soup', 'Salad', 'Diners', 'Seafood', 'Southern', 'Kebab', 'Ramen', 'Sushi Bars', 'Asian Fusion', 'New American', 'Latin American', 'Taiwanese', 'French', 'Vegan'];
const OUTDOOR_BIZ = ['Parks', 'Playgrounds', 'Trails', 'Gardens', 'Golf'];
const GAME_BIZ = ['Tabletop Games', 'Bowling', 'Arcades', 'Escape Games', 'Movie Theaters', 'Comedy Clubs', 'Music Venues'];
const OUTDOOR_EVENTS = ['Family', 'Free', 'Community', 'Festivals', 'Sports', 'Holiday'];
const SHOW_EVENTS = ['Theater', 'Live music', 'Sports', 'Film', 'Nightlife', 'Festivals', 'Talks'];
const SKIP_EVENTS = ['Exhibits', 'Tours'];
const MAX_SPAN_DAYS = 4;
const CHAINS = ['Starbucks', 'Dunkin', 'Tim Hortons', 'Krispy Kreme', 'Baskin', 'Dairy Queen', 'Cold Stone', 'Marble Slab', 'Crumbl', 'Insomnia', 'Smoothie King', 'Jamba', 'Panera', 'Einstein', 'IHOP', 'Denny', 'Black Bear Diner', 'Nothing Bundt', 'McDonald', 'Subway', 'Chick-fil-A', 'Whataburger', 'In-N-Out'];
const TIER: Record<string, number> = { favorite: 60, recommend: 50, visit: 40, return: 30, 'try-once': 20 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function utc(d: string) { return new Date(d + 'T12:00:00Z'); }
function dayDiff(a: string, b: string) { return Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000); }
function hash(s: string) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003; return h; }
function prettyDate(d: string) { return DAYS[utc(d).getUTCDay()] + ', ' + MONTHS[Number(d.slice(5, 7)) - 1] + ' ' + Number(d.slice(8, 10)); }
// True when the word appears in the text as a whole word, ignoring case.
function hasWord(text: string, word: string): boolean {
  const t = text.toLowerCase(), w = word.toLowerCase();
  const alnum = (c?: string) => !!c && /[a-z0-9]/.test(c);
  for (let i = t.indexOf(w); i > -1; i = t.indexOf(w, i + 1)) {
    if (!alnum(t[i - 1]) && !alnum(t[i + w.length])) return true;
  }
  return false;
}
function shortVenue(v?: string) { return (v || '').split(',')[0].trim(); }

// The coming Saturday, or today if it is Saturday.
export function saturdayOf(today: string): string {
  const dow = utc(today).getUTCDay();
  return addDays(today, dow === 6 ? 0 : (6 - dow + 7) % 7);
}

// Normalizes Tradition Local events and the area calendar into one list.
export function toSatEvents(tl: any[], area: any[], url: (p: string) => string): SatEvent[] {
  return [
    ...tl.map((e) => ({ id: 'tl-' + e.slug, cat: 'Tradition Local', date: e.date, title: String(e.title).replace(/\s*\[.*?\]\s*/g, ' ').trim(), venue: e.venue, where: e.location || e.venue, href: url(e.path || '/event-details/' + e.slug), ext: false, tl: true })),
    ...area.map((e) => ({ id: e.id, cat: e.cat, date: e.date, end: e.end || '', title: e.title, venue: e.venue, where: e.venue, href: e.url || '', ext: !!e.url, feat: !!e.feat })),
  ].filter((e) => e.date);
}

function rank(b: SatBiz): number {
  return b.saraPick ? 100 : TIER[String(b.rating)] || 0;
}
function isChain(b: SatBiz) { return CHAINS.some((c) => b.name.indexOf(c) > -1); }
// A place that has closed, is temporarily closed, or is being renovated is never picked.
export function isOpen(b: { closed?: boolean; temporarilyClosed?: boolean; renovating?: boolean }) { return !b.closed && !b.temporarilyClosed && !b.renovating; }
// Chains never count as a local pick; the best reviewed independent place that is open wins.
function best(list: SatBiz[]): SatBiz | null {
  return list.filter((b) => isOpen(b) && !isChain(b)).sort((x, y) => rank(y) - rank(x) || x.name.localeCompare(y.name))[0] || null;
}
function tagFor(b: SatBiz): string { return b.saraPick ? "Sara's Pick" : b.rating === 'favorite' ? 'Local favorite' : b.rating === 'recommend' ? 'Highly recommend' : ''; }
function hasCat(b: SatBiz, cats: string[]) { return (b.categories || []).some((c) => cats.indexOf(c) > -1); }

export function perfectSaturday(area: { slug: string; name: string }, all: SatBiz[], ideas: SatIdea[], events: SatEvent[], today: string, h: SatHrefs): SatPlan {
  const sat = saturdayOf(today);
  const eats = all.filter((b) => b.area === area.slug);
  const local = (e: SatEvent) => hasWord(e.where || '', area.name);
  const live = events.filter((e) => SKIP_EVENTS.indexOf(e.cat) < 0 && (e.end || e.date) >= today && (!e.end || dayDiff(e.date, e.end) <= MAX_SPAN_DAYS));
  const onSat = (e: SatEvent) => e.date <= sat && (e.end || e.date) >= sat;
  const byDate = (a: SatEvent, b: SatEvent) => (b.tl ? 1 : 0) - (a.tl ? 1 : 0) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
  const areaIdeas = ideas.filter((i) => i.area === area.name).sort((x, y) => (y.kind === 'weekend' ? 1 : 0) - (x.kind === 'weekend' ? 1 : 0));
  const idea = (ints: string[]) => { const l = areaIdeas.filter((i) => ints.indexOf(i.int) > -1); return l.length ? l[hash(area.slug + sat) % l.length] : null; };

  const bizSlot = (time: string, label: string, b: SatBiz | null): SatSlot | null => b ? { time, label, title: b.name, sub: '', tag: tagFor(b), href: h.biz(b), ext: false, local: true } : null;
  const eventSlot = (time: string, label: string, e: SatEvent, isLocal: boolean): SatSlot => ({ time, label, title: e.title, sub: (onSat(e) ? 'Sat, ' + prettyDate(sat).slice(5) : prettyDate(e.date)) + (shortVenue(e.venue) ? ' \u00b7 ' + shortVenue(e.venue) : ''), tag: isLocal ? '' : 'Around Houston', href: e.href, ext: e.ext, local: isLocal });
  const ideaSlot = (time: string, label: string, i: SatIdea | null): SatSlot | null => i ? { time, label, title: i.t, sub: i.b, tag: 'Idea', href: h.idea(i), ext: false, local: true } : null;
  const empty = (time: string, label: string): SatSlot => ({ time, label, title: 'Browse ideas for ' + area.name, sub: '', tag: '', href: h.ideasPage(area.name), ext: false, local: false });

  // 9 AM: coffee, or a cafe or bakery if there is no coffee shop.
  const coffeeBiz = best(eats.filter((b) => hasCat(b, COFFEE)));
  const breakfastBiz = best(eats.filter((b) => hasCat(b, BREAKFAST))) || best(eats.filter((b) => hasCat(b, BAKERY)));
  const s1 = bizSlot('9 AM', 'Coffee', coffeeBiz) || bizSlot('9 AM', 'Breakfast', breakfastBiz) || empty('9 AM', 'Coffee');

  // 10:30 AM: something outdoors or a Saturday morning market.
  const outdoorEvent = live.filter((e) => local(e) && onSat(e) && OUTDOOR_EVENTS.indexOf(e.cat) > -1).sort(byDate)[0];
  const houstonOutdoor = live.filter((e) => onSat(e) && OUTDOOR_EVENTS.indexOf(e.cat) > -1).sort((a, b) => byDate(a, b))[0];
  const s2 = ideaSlot('10:30 AM', 'Outdoors', idea(['Outdoors']))
    || bizSlot('10:30 AM', 'Outdoors', best(eats.filter((b) => hasCat(b, OUTDOOR_BIZ))))
    || ideaSlot('10:30 AM', 'Out and about', idea(['Markets & shopping', 'Family']))
    || (outdoorEvent ? eventSlot('10:30 AM', 'Out and about', outdoorEvent, true) : null)
    || (houstonOutdoor ? eventSlot('10:30 AM', 'Out and about', houstonOutdoor, false) : null)
    || empty('10:30 AM', 'Outdoors');

  // 1 PM: lunch, not the same place as coffee.
  const lunchBiz = best(eats.filter((b) => b.slug !== (coffeeBiz || breakfastBiz)?.slug && hasCat(b, LUNCH_CATS) && !hasCat(b, ['Fast Food'])))
    || best(eats.filter((b) => b.slug !== (coffeeBiz || breakfastBiz)?.slug && hasCat(b, LUNCH_CATS)));
  const s3 = bizSlot('1 PM', 'Lunch', lunchBiz) || empty('1 PM', 'Lunch');

  // 6 PM: a game or a show.
  const showSat = live.filter((e) => local(e) && onSat(e) && SHOW_EVENTS.indexOf(e.cat) > -1).sort(byDate)[0];
  const houstonShow = live.filter((e) => onSat(e) && SHOW_EVENTS.indexOf(e.cat) > -1).sort((a, b) => (b.feat ? 1 : 0) - (a.feat ? 1 : 0) || byDate(a, b))[0];
  const showLabel = (e: SatEvent) => (e.cat === 'Sports' ? 'Game' : e.cat === 'Film' ? 'Movie' : 'Show');
  const gameBiz = best(eats.filter((b) => hasCat(b, GAME_BIZ)));
  const s4 = (showSat ? eventSlot('6 PM', showLabel(showSat), showSat, true) : null)
    || ideaSlot('6 PM', 'Live music', idea(['Live music']))
    || bizSlot('6 PM', gameBiz && hasCat(gameBiz, ['Tabletop Games']) ? 'Game night' : 'Evening out', gameBiz)
    || (houstonShow ? eventSlot('6 PM', showLabel(houstonShow), houstonShow, false) : null)
    || empty('6 PM', 'Evening out');

  // Upcoming bar: the next event in the area, else the next Tradition Local event, else the weekend page.
  const next = live.filter(local).sort((a, b) => a.date.localeCompare(b.date) || byDate(a, b))[0];
  const nextTl = live.filter((e) => e.tl).sort((a, b) => a.date.localeCompare(b.date))[0];
  const pickUp = (e: SatEvent, isLocal: boolean): SatUpcoming => { const d = e.date < today ? today : e.date; const near = dayDiff(today, d) < 7; return { day: (near ? DAYS[utc(d).getUTCDay()] : MONTHS[Number(d.slice(5, 7)) - 1]).toUpperCase(), num: String(Number(d.slice(8, 10))), title: e.title, href: e.href || h.fallbackEvent, ext: e.ext, local: isLocal }; };
  const upcoming = next ? pickUp(next, true) : nextTl ? pickUp(nextTl, false) : null;

  const slots = [s1, s2, s3, s4];
  return { saturday: sat, slots, upcoming, localCount: slots.filter((s) => s.local).length };
}

// Areas whose Perfect Saturday page is mostly real: coffee (or breakfast) and lunch from reviewed
// businesses, plus at least one more local slot. The homepage card steps through these, one per week.
export function readyAreas(areas: any[], all: SatBiz[], ideas: SatIdea[], events: SatEvent[], today: string, h: SatHrefs): { slug: string; name: string; n: number; localCount: number }[] {
  return areas.map((a) => {
    const plan = perfectSaturday(a, all, ideas, events, today, h);
    const ok = plan.slots[0].local && plan.slots[2].local;
    return { slug: a.slug, name: a.name, n: all.filter((b) => b.area === a.slug).length, localCount: ok ? plan.localCount : 0 };
  }).filter((x) => x.localCount >= 3).sort((x, y) => y.localCount - x.localCount || y.n - x.n || x.slug.localeCompare(y.slug));
}
