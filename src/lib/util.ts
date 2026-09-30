import imageMap from '../data/image-map.json';

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

/** Prefix an internal path with the site base (needed while hosted at /traditionlocal-site). */
export function url(path = '/') {
  if (!path || /^(https?:|mailto:|tel:|#)/.test(path)) return path;
  return BASE + (path.startsWith('/') ? path : '/' + path);
}

/** Swap a Wix CDN image for the mirrored copy in /public/media once mirror-images has run. */
export function img(src?: string | null, width?: number) {
  if (!src) return undefined;
  const local = (imageMap as Record<string, string>)[src];
  if (local) return url(local);
  // Images uploaded through Pages CMS are site paths like /media/uploads/photo.jpg
  if (src.startsWith('/') && !src.startsWith('//')) return url(src);
  if (width && src.includes('static.wixstatic.com/media/')) {
    const file = src.split('/').pop();
    return `${src}/v1/fill/w_${width},h_${Math.round(width * 0.66)},al_c,q_80,enc_auto/${file}`;
  }
  return src;
}

/** Fix links and images inside HTML that came from Wix. */
export function fixHtml(html = '') {
  return html
    .replace(/href="\/(?!\/)/g, `href="${BASE}/`)
    .replace(/src="\/(?!\/)/g, `src="${BASE}/`)
    .replace(/src="(https:\/\/static\.wixstatic\.com\/media\/[^"]+)"/g, (_, s) => `src="${img(s)}"`);
}

export function fmtDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-US', { ...opts, timeZone: 'America/Chicago' });
}

export function tidy(s?: string | null) {
  return (s || '').replace(/\s*\.\.\.$/, '…');
}
