"""Build clean JSON for the Astro site from the Wix export and the CMS spreadsheets.
Run from the repo root:  python3 scripts/prepare_data.py
"""
import json, re, html, math
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "src" / "data"
OUT.mkdir(parents=True, exist_ok=True)

exp = json.load(open(RAW / "traditionlocal-export.json"))
pages = exp["pages"]
ORIGIN = re.compile(r"https?://(www\.)?traditionlocal\.com", re.I)
# A business is marked closed in the title/description itself, e.g. "Name [CLOSED]" or
# "Name [Permanently Closed]". We detect that from the raw text, then strip the bracket
# off so it never shows in a heading; closed status instead renders as a styled badge.
CLOSED_TAG = re.compile(r"[\xa0\s]*[\[\(]\s*(?:permanently\s+)?closed\s*[\]\)]\s*$", re.I)


def strip_closed_tag(s):
    return CLOSED_TAG.sub("", s).strip() if s else s


def clean_img(u):
    return u.split("/v1/")[0] if u else None


def local(href):
    return ORIGIN.sub("", href or "") or "/"


def nan(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else v


# ---------- posts ----------
posts = []
cat_pages = {p["path"]: p for p in pages if p["type"] == "blog-categories"}
cat_titles = {}
for path, cp in cat_pages.items():
    if "/categories/" in path:
        cat_titles[path.rsplit("/", 1)[1]] = [b["v"] for b in cp["blocks"] if b["t"] == "h2"]

# Full category membership, collected from every page of each Wix category listing
CATS = json.load(open(RAW / "post-categories.json"))
slug_of = lambda p: p["path"].split("/post/", 1)[1]
SLOT = r"<wow-image>.*?</wow-image>|<figure>.*?</figure>"
matched = total = 0
for p in (x for x in pages if x["type"] == "blog-posts"):
    ld = next((l for l in p["ld"] if l.get("@type") == "BlogPosting"), {})
    title = ld.get("headline") or p["h1"] or p["title"].split(" | ")[0]
    imgs = []
    for b in p["blocks"]:
        if b["t"] == "img" and b["src"] not in imgs and "static.wixstatic.com/media" in b["src"]:
            imgs.append(b["src"])
    hero = clean_img((ld.get("image") or {}).get("url")) or (imgs[0] if imgs else None)
    body = p.get("articleHtml")
    if body:
        body = re.sub(r"<header>.*?</header>", "", body, flags=re.S)
        body = re.sub(r"<(nav|footer)>.*?</\1>", "", body, flags=re.S)
        slots = re.findall(SLOT, body, flags=re.S)
        total += 1
        extra = []
        if slots and len(slots) == len(imgs):
            matched += 1
            it = iter(imgs)
            body = re.sub(SLOT, lambda m: f'<figure><img src="{next(it)}" alt="" loading="lazy"></figure>', body, flags=re.S)
        else:
            body = re.sub(SLOT, "", body, flags=re.S)
            extra = [i for i in imgs if i != hero]
        body = re.sub(r"</?section>", "", body)
        body = re.sub(r"(<br>\s*){2,}", "<br>", body)
        body = re.sub(r"<p>(\s|&nbsp;|\u200b)*</p>", "", body)
        body = ORIGIN.sub("", body)
        # Wix only features with no page on the new site
        body = re.sub(r'<a href="/(all-articles/hashtags|profile)/[^"]*">(.*?)</a>', r"\2", body)
        if extra:
            body += '<div class="gallery">' + "".join(
                f'<figure><img src="{i}" alt="" loading="lazy"></figure>' for i in extra) + "</div>"
    else:  # rebuild from blocks
        out, inlist = [], False
        for b in p["blocks"]:
            if b["t"] == "li":
                if not inlist:
                    out.append("<ul>"); inlist = True
                out.append(f"<li>{html.escape(b['v'])}</li>"); continue
            if inlist:
                out.append("</ul>"); inlist = False
            if b["t"] in ("p", "blockquote", "h2", "h3", "h4", "h5", "h6"):
                out.append(f"<{b['t']}>{html.escape(b['v'])}</{b['t']}>")
            elif b["t"] == "img" and b["src"] != hero:
                out.append(f'<figure><img src="{b["src"]}" alt="{html.escape(b.get("alt", ""))}" loading="lazy"></figure>')
        if inlist:
            out.append("</ul>")
        body = "".join(out)
    text = re.sub(r"<[^>]+>", " ", body)
    is_closed = bool(re.search(r"closed", title, re.I))
    description = ld.get("description") or p["description"]
    posts.append({
        "slug": p["path"].split("/post/", 1)[1], "path": p["path"],
        "title": strip_closed_tag(title) if is_closed else title,
        "description": strip_closed_tag(description) if is_closed else description,
        "date": ld.get("datePublished"), "updated": ld.get("dateModified"),
        "author": (ld.get("author") or {}).get("name", "Sara Loren"),
        "image": hero, "html": body,
        "categories": [c for c, pre in CATS.items() if any(slug_of(p).startswith(x) for x in pre)],
        "readMin": max(1, round(len(text.split()) / 230)),
        "closed": is_closed,
    })
print(f"posts from Wix {len(posts)}  (inline images placed exactly in {matched}/{total})")

# ---------- posts written in Pages CMS (content/posts/*.md) ----------
# A file here with the same slug as a Wix post replaces it, so old posts can be edited too.
import yaml, markdown
from datetime import date, datetime

def slugify(s):
    s = re.sub(r"[^\w\s-]", "", str(s).lower()).strip()
    return re.sub(r"[\s_-]+", "-", s)

def iso(v):
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    return str(v) if v else None

CMS_DIR = ROOT / "content" / "posts"
cms_posts, drafts = [], 0
for f in (sorted(x for x in CMS_DIR.glob("*.md") if x.name != "README.md") if CMS_DIR.exists() else []):
    raw = f.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", raw, flags=re.S)
    if not m:
        print("skipped (no front matter):", f.name); continue
    fm = yaml.safe_load(m.group(1)) or {}
    if fm.get("draft"):
        drafts += 1; continue
    if not fm.get("title"):
        print("skipped (no title):", f.name); continue
    slug = str(fm["slug"]).strip() if fm.get("slug") else slugify(fm["title"])
    body = fm.get("body") or m.group(2)
    body_html = markdown.markdown(body or "", extensions=["extra", "sane_lists"])
    body_html = re.sub(r"<img (?![^>]*loading=)", '<img loading="lazy" ', body_html)
    text = re.sub(r"<[^>]+>", " ", body_html)
    cats = fm.get("categories") or []
    cats = [cats] if isinstance(cats, str) else cats
    is_closed = bool(fm.get("closed")) or bool(re.search(r"closed", fm["title"], re.I))
    cms_title = strip_closed_tag(fm["title"]) if is_closed else fm["title"]
    cms_description = fm.get("description") or " ".join(text.split())[:155]
    if is_closed:
        cms_description = strip_closed_tag(cms_description)
    cms_posts.append({
        "slug": slug, "path": f"/post/{slug}", "title": cms_title,
        "description": cms_description,
        "date": iso(fm.get("date")), "updated": iso(fm.get("updated") or fm.get("date")),
        "author": fm.get("author") or "Sara Loren",
        "image": fm.get("image") or None,
        "imageAlt": strip_closed_tag(fm.get("imageAlt") or fm["title"]) if is_closed else (fm.get("imageAlt") or fm["title"]),
        "html": body_html, "categories": [str(c).lower() for c in cats],
        "readMin": max(1, round(len(text.split()) / 230)),
        "closed": is_closed,
        "source": "cms",
    })
cms_slugs = {p["slug"] for p in cms_posts}
if (CMS_DIR / ".migrated").exists():
    posts = []  # every Wix post now lives in content/posts
posts = [p for p in posts if p["slug"] not in cms_slugs] + cms_posts
print(f"posts from Pages CMS {len(cms_posts)} (drafts skipped {drafts})")

posts.sort(key=lambda x: x["date"] or "", reverse=True)
print(f"posts total {len(posts)}")

categories = [{"slug": path.rsplit("/", 1)[1], "name": path.rsplit("/", 1)[1].capitalize(),
               "description": cp["description"]}
              for path, cp in cat_pages.items() if "/categories/" in path]

# ---------- events ----------
FALLBACK_EVENTS = {
    "tenfold-coffee-company-for-coffee-conversations-march-part-1": {
        "title": "Tenfold Coffee Company for Coffee & Conversations [March, Part 1]", "date": "2026-03-01", "when": "March 2026"},
    "jos-coffee-for-coffee-conversations-july": {
        "title": "Jo's Coffee for Coffee & Conversations [July]", "date": "2026-07-01", "when": "July 2026"},
}
MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec"
events = []
for p in (x for x in pages if x["type"] == "event-pages"):
    B = p["blocks"]; ps = [b["v"] for b in B if b["t"] == "p"]
    title = p["h1"] or p["title"].split(" | ")[0]
    when = next((v for v in ps if re.search(rf"({MONTHS})\w* \d+, \d{{4}}", v)), None)
    iso = None
    if when:
        m = re.search(rf"(({MONTHS})\w* \d+, \d{{4}})", when)
        iso = pd.to_datetime(m.group(1)).date().isoformat()
    idx = ps.index(when) if when in ps else -1
    location = ps[idx + 1] if 0 <= idx < len(ps) - 1 else None
    about, grab = [], False
    for b in B:
        if b["t"] == "h2":
            grab = b["v"].lower().startswith("about")
        elif grab and b["t"] in ("p", "li"):
            about.append(b["v"])
    if not about:
        about = [v for v in ps[2:3] if v != when]
    img = next((b["src"] for b in B if b["t"] == "img"), None)
    slug = p["path"].split("/event-details/", 1)[1]
    if slug.endswith("/form"):  # Wix registration sub page; keep the event itself
        slug = slug[:-5]
    if not title or title == "Registration Form" or not when:
        # Wix returned an empty page; rebuild the basics from the URL
        title = FALLBACK_EVENTS.get(slug, {}).get("title", slug.replace("-", " ").title())
        iso = FALLBACK_EVENTS.get(slug, {}).get("date")
        when = FALLBACK_EVENTS.get(slug, {}).get("when")
    events.append({"slug": slug, "path": p["path"], "title": title, "date": iso, "when": when,
                   "venue": ps[1] if len(ps) > 1 else None, "location": location,
                   "about": about, "image": clean_img(img)})
events.sort(key=lambda e: e["date"] or "")
print("events", len(events))

# ---------- neighborhoods (Wix CMS) ----------
def listify(v):
    if not v:
        return []
    parts = re.findall(r"'([^']*)'?", str(v))
    return [x.strip().rstrip(".") for x in parts if x.strip()] or [str(v)]


def aslist(v):
    if not v:
        return []
    return [str(x) for x in v] if isinstance(v, list) else [x.strip() for x in str(v).split(",") if x.strip()]


hoods = []
for n in exp["cms"]["Neighborhoods"]:
    path = n.get("link-copy-of-neighborhoods-1-title")
    if not path:
        continue
    hoods.append({"slug": path.rsplit("/", 1)[1], "path": path, "name": n["title"],
                  "summary": n.get("summary"), "highlights": listify(n.get("topHighlights")),
                  "location": n.get("topHighlights2"), "amenities": n.get("topHighlights1"),
                  "priceRange": n.get("priceRange"), "pricePerSqft": n.get("avgSqFt"), "hoa": n.get("hoa"),
                  "yearBuilt": n.get("yearBuilt"), "zips": aslist(n.get("zipCodeTag")),
                  "schools": aslist(n.get("schoolDistrictTag")), "keyword": n.get("primaryKeyword")})
hoods.sort(key=lambda h: h["name"])
print("neighborhoods", len(hoods))

# ---------- areas (spreadsheet) ----------
a = pd.read_excel(RAW / "tradition-local-neighborhoods_CLAUDE.xlsx")
areas = [{"slug": r["Slug"], "name": r["Name"], "type": r["Type"], "region": r["Region"],
          "hero": nan(r["Hero Photo"]), "vibe": r["Vibe Line"], "bestFor": r["Best For"],
          "homes": r["Typical Homes"], "schools": nan(r["School District"]), "take": r["Dillon's Take"],
          "seoTitle": r["SEO Title"], "metaDescription": r["Meta Description"], "parent": nan(r["Parent Guide"])}
         for _, r in a.iterrows()]
areas.sort(key=lambda x: x["name"])
print("areas", len(areas))

# ---------- businesses (spreadsheet) ----------
b = pd.read_excel(RAW / "tradition_local_texas_businesses_CLAUDE.xlsx")
area_by_name = {x["name"].lower(): x["slug"] for x in areas}
biz = []
for _, r in b.iterrows():
    hood = nan(r["Neighborhood"])
    area = (area_by_name.get(str(hood).lower()) if hood else None) or area_by_name.get(str(r["City"]).lower())
    biz.append({"slug": r["Slug"], "name": r["Name"], "city": r["City"],
                "categories": [c.strip() for c in str(r["Category"]).split(",") if c.strip()],
                "description": r["Description"], "review": r["Review"], "reviewYear": int(r["Review Year"]),
                "saraPick": r["Sara Pick"] == "Yes", "region": r["Region"], "neighborhood": hood,
                "harMarket": nan(r["HAR Geo Market"]), "area": area})
biz.sort(key=lambda x: x["name"].lower())

# Rating tiers (Try at Least Once / Worth a Visit / Would Go Again / Highly Recommend / Local Favorite)
# now come from data/raw/business-rating-tiers.csv, which applies the rating rules to Sara's
# reviews. data/ratings.json still holds the hand-curated Sara's Pick list and any manual "rating"
# override, which always wins. The star lookup below is kept only as a fallback for a business
# the tiers file has no tier for.
#
# "saraPick" here means Sara's Pick, the small hand-curated list from ratings.json. It is NOT the
# spreadsheet's own "Sara Pick" column (that just means she's reviewed it at all, 265 businesses, far
# too broad to use as a badge) and that column is intentionally not read into saraPick below.
RATINGS_FILE = ROOT / "data" / "ratings.json"
STARS_FILE = ROOT / "data" / "yelp-stars.json"
overrides = json.load(open(RATINGS_FILE)) if RATINGS_FILE.exists() else {}
yelp_stars = json.load(open(STARS_FILE)) if STARS_FILE.exists() else {}
STAR_TIER = {5: "recommend", 4: "return", 3: "visit"}  # fallback only; the tiers file takes over below
TIER_TOKEN = {"Try at Least Once": "try-once", "Worth a Visit": "visit", "Would Go Again": "return",
              "Highly Recommend": "recommend", "Local Favorite": "favorite"}
for x in biz:
    o = overrides.get(x["slug"], {})
    stars = yelp_stars.get(x["slug"])  # internal only; never rendered on the site
    x["stars"] = stars
    x["rating"] = o.get("rating") or STAR_TIER.get(stars)
    x["saraPick"] = bool(o.get("picks"))
    x["reviewAuthor"] = o.get("reviewAuthor") or "Sara Loren"
print("businesses", len(biz), "linked to an area guide:", sum(1 for x in biz if x["area"]),
      "| Sara's Pick:", sum(1 for x in biz if x["saraPick"]),
      "| star fallback tiers:", sum(1 for x in biz if x["rating"]))

# Master CMS research pass (Oct 2026): verified closures, and real website/phone/address
# where the research turned them up. Only ever adds fields; never removes or overrides
# the spreadsheet's own content.
MASTER_CMS = RAW / "tradition-local-master-cms-2026-COMPLETE-v.10.3.26.xlsx"
if MASTER_CMS.exists():
    mb = pd.read_excel(MASTER_CMS, sheet_name="Local Businesses")
    cms_by_slug = {r["slug"]: r for _, r in mb.iterrows() if nan(r["slug"])}
    closed_n = contact_n = 0
    for x in biz:
        r = cms_by_slug.get(x["slug"])
        if r is None:
            continue
        if r.get("review_status") == "closed_verified":
            x["closed"] = True
            closed_n += 1
        for field, key in [("website", "website"), ("phone", "phone"), ("address", "address")]:
            v = nan(r.get(key))
            if v:
                x[field] = v
                contact_n += 1
    print("master CMS merge: verified closed", closed_n, ", contact fields added", contact_n)

# ---------- rating tiers and review links (data/raw CSVs) ----------
# business-rating-tiers.csv: one row per business with its tier and the reviews that back it.
# sara-reviews.csv: one row per review (text is not stored here, only ids, tier, date and place).
# A manual "rating" in data/ratings.json still wins; "Sara's Pick" in the CSV counts as a pick.
TIERS_CSV = RAW / "business-rating-tiers.csv"
if TIERS_CSV.exists():
    tr = pd.read_csv(TIERS_CSV, dtype=str)
    tier_by_slug = {r["slug"]: r for _, r in tr.iterrows() if nan(r["slug"])}
    tier_n = 0
    for x in biz:
        r = tier_by_slug.get(x["slug"])
        if r is None:
            continue
        t = nan(r.get("rating_tier"))
        if t == "Sara's Pick":
            x["saraPick"] = True
        elif t in TIER_TOKEN and not overrides.get(x["slug"], {}).get("rating"):
            x["rating"] = TIER_TOKEN[t]
            tier_n += 1
        ids = nan(r.get("sara_review_ids"))
        x["reviewIds"] = str(ids).split("|") if ids else []
        x["primaryReviewId"] = nan(r.get("primary_review_id"))
    print("rating tiers from business-rating-tiers.csv:", tier_n)

# ---------- business profile gap-fill (data/raw/reviews_business_profiles.csv) ----------
# Structural facts only (name, city, categories, neighborhood, closed/open status). Never
# overwrites a field that already has a real value from the master CMS merge above; this file's
# own address/phone/website/hours are blank for every row, so this only ever adds information,
# it never blanks out something better we already had.
PROFILES_CSV = RAW / "reviews_business_profiles.csv"
if PROFILES_CSV.exists():
    pr = pd.read_csv(PROFILES_CSV, dtype=str)
    profile_by_slug = {r["slug"]: r for _, r in pr.iterrows() if nan(r["slug"])}
    filled_n = status_n = 0
    for x in biz:
        r = profile_by_slug.get(x["slug"])
        if r is None:
            continue
        for field, key in [("neighborhood", "neighborhood"), ("address", "address"),
                            ("phone", "phone"), ("website", "website")]:
            if not x.get(field) and nan(r.get(key)):
                x[field] = r[key]
                filled_n += 1
        status = nan(r.get("current_status"))
        if status and status.lower() == "closed" and not x.get("closed"):
            x["closed"] = True
            status_n += 1
    print("business profile gaps filled from reviews_business_profiles.csv:", filled_n,
          "| newly marked closed:", status_n)

# ---------- review page content (data/raw/reviews_pages.csv) ----------
# The structured sections of the review page itself: what we tried, the experience, who might
# enjoy it, would we go again, what we ordered. Original write-ups grounded in the real visit,
# not the review source text (which only ever lands in data/raw for internal reference, never
# in src/data, never in the page output). A business with no row here still falls back to the
# page's own bracketed placeholders, same as before.
PAGES_CSV = RAW / "reviews_pages.csv"
if PAGES_CSV.exists():
    pg = pd.read_csv(PAGES_CSV, dtype=str)
    page_by_slug = {r["slug"]: r for _, r in pg.iterrows() if nan(r["slug"])}
    page_n = 0
    for x in biz:
        r = page_by_slug.get(x["slug"])
        if r is None:
            continue
        section = {}
        for field, key in [("whatWeTried", "what_we_tried"), ("theExperience", "the_experience"),
                            ("whoMightEnjoyIt", "who_might_enjoy_it"), ("wouldWeGoAgain", "would_we_go_again"),
                            ("whatWeOrdered", "what_we_ordered")]:
            v = nan(r.get(key))
            if v:
                section[field] = v
        if section:
            x["reviewPage"] = section
            page_n += 1
        if nan(r.get("visited_date")):
            x["reviewVisitedDate"] = r["visited_date"]
    print("review page content from reviews_pages.csv:", page_n)

# ---------- photo-backed business profiles missing from the original spreadsheet ----------
# Supplement only adds missing businesses; existing spreadsheet profiles always win.
PHOTO_SUPPLEMENT = RAW / "photo-business-supplement.json"
if PHOTO_SUPPLEMENT.exists():
    supplemental = json.loads(PHOTO_SUPPLEMENT.read_text(encoding="utf-8"))
    known_slugs = {x["slug"] for x in biz}
    area_lookup = {a["name"].strip().lower(): a["slug"] for a in areas}
    added = 0
    for entry in supplemental:
        slug = entry.get("slug")
        if not slug or slug in known_slugs:
            continue
        profile = dict(entry)
        area_name = profile.pop("areaName", None)
        profile["area"] = area_lookup.get(str(area_name).strip().lower()) if area_name else None
        profile.setdefault("rating", None)
        profile.setdefault("stars", None)
        known_slugs.add(slug)
        biz.append(profile)
        added += 1
    biz.sort(key=lambda x: x["name"].lower())
    print("photo-backed supplemental business profiles added:", added)

# ---------- updated business and review writing (user-supplied October 2026 CSVs) ----------
# Applied after the photo-profile supplement so both original and newly added businesses
# receive the same source copy. Existing contact details, photos, and manual rating rules remain.
COPY_FILE = RAW / "review-text-updates.json"
if COPY_FILE.exists():
    updated_copy = json.loads(COPY_FILE.read_text(encoding="utf-8"))
    copy_by_slug = {item["slug"]: item for item in updated_copy if item.get("slug")}
    updated_count = 0
    for business in biz:
        item = copy_by_slug.get(business["slug"])
        if item is None:
            continue
        if item.get("description"):
            business["description"] = item["description"]
        if item.get("review"):
            business["review"] = item["review"]
        if item.get("reviewer"):
            business["reviewAuthor"] = item["reviewer"]
        if item.get("visitedDate"):
            business["reviewVisitedDate"] = item["visitedDate"]
        sections = {key: value for key, value in item.get("sections", {}).items() if value}
        if sections:
            business["reviewPage"] = {**business.get("reviewPage", {}), **sections}
        updated_count += 1
    print("businesses updated with supplied profile and review writing:", updated_count)

# ---------- real visit photos (public/images/BATCH 1-8) ----------
# Build the complete slug-to-batch mapping from the uploaded image folders.
IMAGE_ROOT = ROOT / "public" / "images"
SLUG_TO_BATCH = {
    folder.name: int(batch.name.split(" ", 1)[1])
    for batch in sorted(IMAGE_ROOT.glob("BATCH [1-8]"))
    if batch.is_dir()
    for folder in batch.iterdir()
    if folder.is_dir()
}

def _image_norm(value):
    return re.sub(r"[^a-z0-9]", "", str(value).lower())

batch_by_norm = {_image_norm(slug): slug for slug in SLUG_TO_BATCH}
images_by_slug = {}
IMAGE_MANIFEST_CSV = RAW / "reviews_image_manifest.csv"
if IMAGE_MANIFEST_CSV.exists():
    im = pd.read_csv(IMAGE_MANIFEST_CSV, dtype=str).fillna("")
    for _, row in im.iterrows():
        if row.get("connection_status") != "matched":
            continue
        slug = batch_by_norm.get(_image_norm(row.get("matched_slug", "")))
        filename = row.get("target_filename", "").strip()
        if not slug or not filename or Path(filename).name != filename:
            continue
        local_file = IMAGE_ROOT / f"BATCH {SLUG_TO_BATCH[slug]}" / slug / filename
        if local_file.is_file():
            images_by_slug.setdefault(slug, []).append({
                "path": f"/images/BATCH {SLUG_TO_BATCH[slug]}/{slug}/{filename}",
                "alt": row.get("image_alt", "").strip()
            })

# Use photos already checked into the repository even without a manifest CSV.
for slug, batch_number in SLUG_TO_BATCH.items():
    if slug in images_by_slug:
        continue
    folder = IMAGE_ROOT / f"BATCH {batch_number}" / slug
    files = sorted(p for p in folder.iterdir()
                   if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".avif"})
    if files:
        images_by_slug[slug] = [
            {"path": f"/images/BATCH {batch_number}/{slug}/{p.name}",
             "alt": slug.replace("-", " ") + " photo"}
            for p in files
        ]

img_n = 0
for business in biz:
    slug = batch_by_norm.get(_image_norm(business["slug"]))
    imgs = images_by_slug.get(slug) if slug else None
    if imgs:
        business["images"] = imgs
        business["heroImage"] = imgs[0]["path"]
        img_n += 1
print("businesses with local visit photos:", img_n,
      "| total photos:", sum(len(v) for v in images_by_slug.values()))

reviews = []
REVIEWS_CSV = RAW / "sara-reviews.csv"
if REVIEWS_CSV.exists():
    rs = pd.read_csv(REVIEWS_CSV, dtype=str)
    for _, r in rs.iterrows():
        if not nan(r.get("review_id")):
            continue
        reviews.append({
            "id": r["review_id"], "businessSlug": nan(r.get("business_slug")),
            "reviewer": nan(r.get("reviewer")), "date": nan(r.get("review_date")),
            "text": nan(r.get("review_text")), "tier": TIER_TOKEN.get(nan(r.get("rating_tier"))),
            "scope": nan(r.get("review_scope")), "primary": nan(r.get("is_primary_review")) == "yes",
            "status": nan(r.get("status")) or "draft", "category": nan(r.get("category")),
            "neighborhood": nan(r.get("neighborhood_area")), "city": nan(r.get("city")), "state": nan(r.get("state")),
        })
    reviews.sort(key=lambda x: (x["date"] or ""), reverse=True)
    print("reviews", len(reviews), "linked to a business:", sum(1 for x in reviews if x["businessSlug"]),
          "| travel:", sum(1 for x in reviews if x["scope"] == "travel"))

# ---------- subdivisions (master CMS, linked to an existing neighborhood guide) ----------
# Subdivisions sit a level under a neighborhood (e.g. Cinco Ranch is inside Katy). We only keep
# the ones whose parent neighborhood matches a real area guide on the site, so every subdivision
# page can link back to a real "Living in <Area>" page, and vice versa.
subdivisions = []
if MASTER_CMS.exists():
    nb_sheet = pd.read_excel(MASTER_CMS, sheet_name="Neighborhoods")
    subs_sheet = pd.read_excel(MASTER_CMS, sheet_name="Subdivisions")
    loc_to_name = dict(zip(nb_sheet["location_id"], nb_sheet["name"]))
    area_by_name = {a["name"].strip().lower(): a for a in areas}
    SUB_SYNONYMS = {"downtown": "downtown houston", "galleria/uptown": "galleria", "midtown": "midtown houston"}
    # The older subdivision-profile dataset (neighborhoods.json, 270 entries) has real price range,
    # price/sqft, year built, HOA, schools, and zips that the master CMS research doesn't carry.
    # Same real places in most cases (matched by name) -- merge that structured data in rather than
    # losing it, so this page ends up with everything both sources have.
    hood_by_name = {h["name"].strip().lower(): h for h in hoods}
    enriched = 0
    skipped = 0
    for _, s in subs_sheet.iterrows():
        loc_name = loc_to_name.get(s["parent_location_id"])
        key = SUB_SYNONYMS.get(str(loc_name).strip().lower(), str(loc_name).strip().lower()) if loc_name else None
        area = area_by_name.get(key) if key else None
        if not area:
            skipped += 1
            continue
        entry = {
            "slug": s["slug"], "name": s["subdivision_name"], "city": s["city"], "state": s["state"],
            "zipCodes": nan(s["zip_codes"]), "description": s["short_description"],
            "seoTitle": nan(s["seo_title"]), "metaDescription": nan(s["meta_description"]),
            "area": area["slug"],
        }
        h = hood_by_name.get(s["subdivision_name"].strip().lower())
        if h:
            for field in ["priceRange", "pricePerSqft", "yearBuilt", "hoa"]:
                if h.get(field):
                    # A few of these fields came through with stray HTML markup (e.g. a <p> tag
                    # wrapping the price/sqft). Strip tags so the site never renders raw HTML text.
                    entry[field] = re.sub(r"<[^>]+>", "", str(h[field])).strip()
            if h.get("schools"):
                entry["schools"] = h["schools"]
            if h.get("zips") and not entry["zipCodes"]:
                entry["zipCodes"] = ", ".join(h["zips"])
            enriched += 1
        subdivisions.append(entry)
    # A handful of subdivisions got classified under two overlapping neighborhood areas in the
    # research (e.g. Spring Branch / Memorial Villages boundaries aren't crisp). Same name + same
    # zip code is treated as the same real place; keep one, drop the rest. Same name but a
    # different zip (e.g. two different "Ashford Forest"s) are genuinely different places and both
    # stay.
    seen_key = set()
    deduped = []
    dupes_dropped = 0
    for x in subdivisions:
        key = (x["name"].strip().lower(), x["zipCodes"])
        if key in seen_key:
            dupes_dropped += 1
            continue
        seen_key.add(key)
        deduped.append(x)
    subdivisions = deduped
    subdivisions.sort(key=lambda x: x["name"].lower())
    print("subdivisions", len(subdivisions), "linked to a neighborhood guide, skipped (no matching area):", skipped,
          ", duplicate (same name + zip) dropped:", dupes_dropped, ", enriched with price/HOA/schools data:", enriched)

# ---------- generic pages ----------
CUSTOM = {"/", "/food", "/living", "/cities", "/all-articles"}
generic = []
for p in pages:
    if p["type"] not in ("pages", "listings", "group-lists") or p["path"] in CUSTOM:
        continue
    blocks = []
    for bl in p["blocks"]:
        bl = dict(bl)
        if bl["t"] == "img":
            if "data:image" in bl["src"]:
                continue
            bl["src"] = clean_img(bl["src"])
        if bl.get("href"):
            bl["href"] = local(bl["href"])
        if bl.get("links"):
            bl["links"] = [{**l, "href": local(l["href"])} for l in bl["links"]]
        if (bl.get("v") or "x").strip("\u200b ") in ("", "|", "< Back"):
            continue
        blocks.append(bl)
    generic.append({"path": p["path"], "type": p["type"], "title": (p["title"] or "").split(" | ")[0],
                    "h1": p["h1"], "description": p["description"], "blocks": blocks})
print("generic pages", len(generic))

# ---------- site ----------
home = next(p for p in pages if p["path"] == "/")
site = exp["site"]
site["videos"] = [re.search(r"/vi/([^/]+)/", b["src"]).group(1)
                  for b in home["blocks"] if b["t"] == "img" and "ytimg" in b["src"]]
site["sponsors"] = [b["src"] for b in home["blocks"] if b["t"] == "img"][-3:]
site["description"] = home["description"]

images = set(exp["images"])
for x in posts:
    images.add(x["image"]); images.update(re.findall(r'src="(https://static\.wixstatic[^"]+)"', x["html"]))
for x in events:
    images.add(x["image"])
images = sorted(i for i in images if i and "wixstatic" in i)

# The Food Feature section's "Opened this month" list, hand-edited at data/new-and-notable.json.
nn_file = ROOT / "data" / "new-and-notable.json"
new_and_notable = (json.load(open(nn_file)).get("items", []) if nn_file.exists() else [])

for name, obj in [("posts", posts), ("categories", categories), ("events", events), ("neighborhoods", hoods),
                  ("areas", areas), ("businesses", biz), ("pages", generic), ("site", site), ("images", images),
                  ("new-and-notable", new_and_notable), ("subdivisions", subdivisions), ("reviews", reviews)]:
    json.dump(obj, open(OUT / f"{name}.json", "w"), ensure_ascii=False)
if not (OUT / "image-map.json").exists():
    json.dump({}, open(OUT / "image-map.json", "w"))
print("images", len(images))
