# TraditionLocal.com

Houston food, neighborhoods, and local living. This is the new home of TraditionLocal.com, rebuilt from the Wix site with [Astro](https://astro.build) and hosted free on GitHub Pages.

## What's in here

| Content | Pages | Where it comes from |
|---|---|---|
| Blog posts | 186 at `/post/...` | `data/raw/traditionlocal-export.json` |
| Area guides | 154 at `/cities/...` | `data/raw/tradition-local-neighborhoods_CLAUDE.xlsx` |
| Businesses | 335 at `/eat/...` | `data/raw/tradition_local_texas_businesses_CLAUDE.xlsx` |
| Subdivision profiles | 270 at `/copy-of-neighborhoods-1/...` | Wix CMS, in the export |
| Events | 15 at `/event-details/...` | export |
| Other pages (About, area hubs, listings, forms) | 82 at their old URLs | export |

Every URL from the old Wix sitemap exists here, so search rankings and shared links carry over.

## Turning the site on (one time)

1. Upload these files to the `traditionlocal-site` repo (main branch).
2. In the repo, open **Settings, Pages**, and set **Source** to **GitHub Actions**.
3. Open the **Actions** tab. The "Deploy to GitHub Pages" run starts on every push; the site appears at `https://traditionrealty.github.io/traditionlocal-site/`.
4. In **Actions**, run **Mirror images from Wix** once. It copies all images into `public/media` so nothing depends on Wix.

## Moving traditionlocal.com over (when you're ready)

1. In **Settings, Pages, Custom domain**, enter `www.traditionlocal.com` and save.
2. At your domain registrar, point DNS at GitHub: a `CNAME` record for `www` to `traditionrealty.github.io`, and `A` records for the bare domain to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. Once the check passes, tick **Enforce HTTPS**. The next deploy builds for the custom domain automatically.

## Updating content

- **Businesses or area guides:** edit the spreadsheet in `data/raw/`, upload it with the same file name, and the site rebuilds itself.
- **Settings** (contact email, newsletter form, contact form): `src/config.ts`.
- **Look and feel:** colors and fonts live at the top of `src/layouts/Base.astro`.

## Working on it locally (optional)

```
npm install
npm run data     # rebuild src/data from data/raw (needs python3 with pandas + openpyxl)
npm run dev      # http://localhost:4321
```

## Wix features that need a replacement

- **Newsletter signup:** paste a Beehiiv, Mailchimp, or Formspree form URL into `newsletterAction` in `src/config.ts`.
- **Contact and info request forms:** the pages exist; add a Formspree endpoint to `contactFormAction`.
- **Event RSVPs:** currently RSVP by email; can point to Luma or Eventbrite per event.
- **Member logins and groups:** not available on a static site; the Facebook group is linked instead.
