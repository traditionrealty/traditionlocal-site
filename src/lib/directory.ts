// Helpers for the Local Directory page: sorts every open business listing into a simple category group.
import businesses from '../data/businesses.json';

export type DirGroup = 'food' | 'shops' | 'home' | 'health' | 'parks';
export const GROUPS: { id: '' | DirGroup; label: string }[] = [
  { id: '', label: 'All businesses' },
  { id: 'food', label: 'Food & drink' },
  { id: 'shops', label: 'Shops & everyday services' },
  { id: 'home', label: 'Home services & maintenance' },
  { id: 'health', label: 'Health, beauty & fitness' },
  { id: 'parks', label: 'Parks, travel & outings' },
];
export const GROUP_LABEL: Record<string, string> = Object.fromEntries(GROUPS.map((g) => [g.id, g.label]));

// Categories that are not food or drink. A listing whose categories are all in this set is not a restaurant or cafe.
const NONFOOD = new Set([
  'Gyms', 'Trainers', 'Hair Salons', 'Nail Salons', 'Waxing', 'Skin Care', 'Cosmetics & Beauty Supply', 'Cosmetic Dentists',
  'General Dentistry', 'Pediatric Dentists', 'Periodontists', 'Medical Centers', 'Heating & Air Conditioning/HVAC', 'Car Dealers',
  'Auto Repair', 'Auto Parts & Supplies', 'Car Wash', 'Furniture Stores', 'Department Stores', 'Home Decor', 'Clothing', 'Shoe Stores',
  'Children’s Clothing', 'Accessories', 'Antiques', 'Vintage & Consignment', 'Art Supplies', 'Bookstores', 'Hardware Stores',
  'Gift Shops', 'Cards & Stationery', 'Gas Stations', 'Massage', 'Reflexology', 'Massage Therapy', 'Hair Removal', 'Eyelash Service',
  'Pet Groomers', 'Hotels', 'Airports', 'Parks', 'Playgrounds', 'Festivals', 'Rodeo', 'Nurseries & Gardening', 'Discount Store',
  'Drugstores', 'Pharmacy', 'Shopping Centers', 'Tabletop Games', 'Convenience Stores',
]);
// Home service names are listed so new providers land in the right group as soon as they are added.
const HOME = new Set(['Heating & Air Conditioning/HVAC', 'Plumbing', 'Roofing', 'Electricians', 'Contractors', 'Handyman', 'Landscaping', 'Pest Control', 'Home Cleaning', 'Painters', 'Pool Cleaners', 'Garage Door Services', 'Locksmiths', 'Movers', 'Home Inspectors', 'Windows Installation', 'Flooring', 'Appliance Repair']);
const HEALTH = new Set(['Gyms', 'Trainers', 'Hair Salons', 'Nail Salons', 'Waxing', 'Skin Care', 'Massage', 'Reflexology', 'Massage Therapy', 'Hair Removal', 'Eyelash Service', 'Cosmetic Dentists', 'General Dentistry', 'Pediatric Dentists', 'Periodontists', 'Medical Centers']);
const PARKS = new Set(['Parks', 'Playgrounds', 'Festivals', 'Rodeo', 'Hotels', 'Airports']);

function groupOf(cats: string[]): DirGroup {
  if (cats.some((c) => HOME.has(c))) return 'home';
  if (cats.some((c) => HEALTH.has(c))) return 'health';
  if (cats.some((c) => PARKS.has(c)) && cats.every((c) => NONFOOD.has(c))) return 'parks';
  if (cats.every((c) => NONFOOD.has(c))) return 'shops';
  return 'food';
}

export function trim(s: string | null | undefined, n: number) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n).replace(/\s+\S*$/, '').replace(/[,;:]+$/, '') + '…';
}

/** Open listings, Sara's picks first, then newest reviews, then A to Z. */
export function directoryListings() {
  return (businesses as any[])
    .filter((b) => !b.closed)
    .map((b) => ({
      slug: b.slug as string,
      name: b.name as string,
      where: (b.neighborhood || b.city) as string,
      cats: (b.categories as string[]).slice(0, 2),
      desc: trim(b.description, 120),
      rating: (b.rating || '') as string,
      pick: Boolean(b.saraPick),
      year: Number(b.reviewYear) || 0,
      group: groupOf(b.categories as string[]),
    }))
    .sort((a, b) => Number(b.pick) - Number(a.pick) || b.year - a.year || a.name.localeCompare(b.name));
}
