// Helpers for the Food page: which directory entries are food and drink, and which collection each belongs to.
import businesses from '../data/businesses.json';

// Directory entries whose categories are all in this set are not food (gyms, salons, dentists, and so on).
const NONFOOD = new Set([
  'Gyms', 'Trainers', 'Hair Salons', 'Nail Salons', 'Waxing', 'Skin Care', 'Cosmetics & Beauty Supply', 'Cosmetic Dentists',
  'General Dentistry', 'Pediatric Dentists', 'Periodontists', 'Medical Centers', 'Heating & Air Conditioning/HVAC', 'Car Dealers',
  'Auto Repair', 'Auto Parts & Supplies', 'Car Wash', 'Furniture Stores', 'Department Stores', 'Home Decor', 'Clothing', 'Shoe Stores',
  'Children’s Clothing', 'Accessories', 'Antiques', 'Vintage & Consignment', 'Art Supplies', 'Bookstores', 'Hardware Stores',
  'Gift Shops', 'Cards & Stationery', 'Gas Stations', 'Massage', 'Reflexology', 'Massage Therapy', 'Hair Removal', 'Eyelash Service',
  'Pet Groomers', 'Hotels', 'Airports', 'Parks', 'Playgrounds', 'Festivals', 'Rodeo', 'Nurseries & Gardening', 'Discount Store',
  'Drugstores', 'Pharmacy', 'Shopping Centers', 'Tabletop Games', 'Convenience Stores',
]);
const COFFEE = new Set(['Coffee & Tea', 'Cafes', 'Cafés', 'Coffee', 'Coffee Roasteries', 'Tea Rooms', 'Bubble Tea', 'Juice Bars & Smoothies', 'Internet Cafes']);
const SWEETS = new Set(['Bakeries', 'Desserts', 'Ice Cream & Frozen Yogurt', 'Donuts', 'Gelato', 'Custom Cakes', 'Cupcakes', 'Macarons', 'Creperies', 'Patisserie', 'Cake Shops', 'Patisserie/Cake Shop', 'Ice Cream', 'Shaved Snow', 'Shaved Ice', 'Waffles', 'Acai Bowls']);
const MARKETS = new Set(['Grocery', 'International Grocery', 'Farmers Market', 'Imported Food', 'Specialty Food', 'Health Markets', 'Meat Shops', 'Butcher', 'Fruits & Veggies', 'Organic Stores', 'Do-It-Yourself Food']);

export type Group = 'coffee' | 'restaurants' | 'sweets' | 'markets';

export function trim(s: string | null | undefined, n: number) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n).replace(/\s+\S*$/, '').replace(/[,;:]+$/, '') + '…';
}

function groupsOf(cats: string[]): Group[] {
  const g: Group[] = [];
  if (cats.some((c) => COFFEE.has(c))) g.push('coffee');
  if (cats.some((c) => SWEETS.has(c))) g.push('sweets');
  if (cats.some((c) => MARKETS.has(c))) g.push('markets');
  if (cats.some((c) => !COFFEE.has(c) && !SWEETS.has(c) && !MARKETS.has(c) && !NONFOOD.has(c))) g.push('restaurants');
  return g;
}

/** Open food and drink places, Sara's picks first, then newest reviews, then A to Z. */
export function foodPlaces() {
  return (businesses as any[])
    .filter((b) => !b.closed && !b.categories.every((c: string) => NONFOOD.has(c)))
    .map((b) => {
      const groups = groupsOf(b.categories);
      return {
        slug: b.slug as string,
        name: b.name as string,
        city: b.city as string,
        where: (b.neighborhood || b.city) as string,
        cats: (b.categories as string[]).slice(0, 3),
        desc: trim(b.description, 150),
        rating: (b.rating || '') as string,
        pick: Boolean(b.saraPick),
        year: Number(b.reviewYear) || 0,
        review: b.rating ? trim(b.review, 210) : '',
        author: (b.reviewAuthor || 'Sara Loren') as string,
        groups,
        prim: (groups.includes('restaurants') ? 'restaurants' : groups[0] || 'restaurants') as Group,
      };
    })
    .sort((a, b) => Number(b.pick) - Number(a.pick) || b.year - a.year || a.name.localeCompare(b.name));
}
