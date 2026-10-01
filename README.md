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

## Publishing posts with Pages CMS

Write and edit posts at https://app.pagescms.org (sign in with GitHub, open traditionrealty/traditionlocal-site).

1. Posts and reviews, then Add an entry.
2. Fill in the title, summary, main photo, photo description, categories, and the post itself.
3. Save while Draft is on to keep working. Turn Draft off and save to publish.
4. The site rebuilds automatically and the post is live in about two minutes.

Every post, including the 186 moved over from Wix, is a Markdown file in content/posts.
Photos live in public/media.
The editor setup lives in .pages.yml.

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

## Newsletter signup and event RSVPs

Both run through one Cloudflare Worker named tl-newsletter-signup. Its workers.dev address is set as newsletterAction in src/config.ts. It does not depend on the traditionlocal.com domain, so moving the domain does not break it. The Worker code lives in Cloudflare (Workers and Pages, tl-newsletter-signup, Edit code).

Newsletter signup: the footer form posts the email to the Worker. The Worker adds it to the Newsletter subscribers segment in Resend, then sends the visitor back to the same page with a thank you message.

Event RSVPs: the form on each upcoming event page posts to the Worker at /rsvp. The Worker saves the RSVP in the rsvps table in Supabase and sends a confirmation email through Resend. Anyone can add an RSVP, but nobody can read them from the website. View and export them in the Supabase dashboard (Table Editor, rsvps). Signed in members see a one tap RSVP button. Events are free with no guest limit for now. The table has a status column so ticketing can be added later.

Worker settings (Cloudflare, the Worker, Settings, Variables and Secrets): RESEND_API_KEY is a secret and is never stored in this repo. SEGMENT_ID is the Newsletter subscribers segment in Resend. ALLOWED_ORIGINS lists the sites allowed to post, so add the new domain here when it moves. SUPABASE_URL and SUPABASE_KEY hold the same public values as in src/config.ts.

Email sending: messages come from noreply@mail.traditionlocals.com, which is verified in Resend. When traditionlocal.com moves off Wix, verify mail.traditionlocal.com in Resend and change the from address in the Worker.

## Publishing and member accounts

Publishing posts uses Pages CMS, described above. Member sign in works through Supabase (see supabase/schema.sql for the members table and the rsvps table, which are run once in the Supabase SQL editor).

## Still to replace from Wix

Contact and info request forms: the pages exist. Add an endpoint to contactFormAction in src/config.ts.

Member groups: not built. The Facebook group is linked instead.
