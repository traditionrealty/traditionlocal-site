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
    posts.append({
        "slug": p["path"].split("/post/", 1)[1], "path": p["path"], "title": title,
        "description": ld.get("description") or p["description"],
        "date": ld.get("datePublished"), "updated": ld.get("dateModified"),
        "author": (ld.get("author") or {}).get("name", "Sara Loren"),
        "image": hero, "html": body,
        "categories": [c for c, pre in CATS.items() if any(slug_of(p).startswith(x) for x in pre)],
        "readMin": max(1, round(len(text.split()) / 230)),
        "closed": bool(re.search(r"closed", title, re.I)),
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
    slug = slugify(fm.get("slug") or fm["title"])
    body = fm.get("body") or m.group(2)
    body_html = markdown.markdown(body or "", extensions=["extra", "sane_lists"])
    body_html = re.sub(r"<img (?![^>]*loading=)", '<img loading="lazy" ', body_html)
    text = re.sub(r"<[^>]+>", " ", body_html)
    cats = fm.get("categories") or []
    cats = [cats] if isinstance(cats, str) else cats
    cms_posts.append({
        "slug": slug, "path": f"/post/{slug}", "title": fm["title"],
        "description": fm.get("description") or " ".join(text.split())[:155],
        "date": iso(fm.get("date")), "updated": iso(fm.get("updated") or fm.get("date")),
        "author": fm.get("author") or "Sara Loren",
        "image": fm.get("image") or None, "imageAlt": fm.get("imageAlt") or fm["title"],
        "html": body_html, "categories": [str(c).lower() for c in cats],
        "readMin": max(1, round(len(text.split()) / 230)),
        "closed": bool(fm.get("closed")) or bool(re.search(r"closed", fm["title"], re.I)),
        "source": "cms",
    })
cms_slugs = {p["slug"] for p in cms_posts}
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
print("businesses", len(biz), "linked to an area guide:", sum(1 for x in biz if x["area"]))

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

for name, obj in [("posts", posts), ("categories", categories), ("events", events), ("neighborhoods", hoods),
                  ("areas", areas), ("businesses", biz), ("pages", generic), ("site", site), ("images", images)]:
    json.dump(obj, open(OUT / f"{name}.json", "w"), ensure_ascii=False)
if not (OUT / "image-map.json").exists():
    json.dump({}, open(OUT / "image-map.json", "w"))
print("images", len(images))
