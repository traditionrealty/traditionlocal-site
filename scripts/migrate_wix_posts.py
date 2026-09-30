"""One time move of the Wix blog posts into content/posts as Markdown, so every
post can be edited in Pages CMS. Run from the repo root after prepare_data.py:
    python3 scripts/prepare_data.py && python3 scripts/migrate_wix_posts.py
Writes content/posts/<date>-<slug>.md for each Wix post plus content/posts/.migrated,
which tells prepare_data.py to stop reading posts from the Wix export.
"""
import json, re, unicodedata
from pathlib import Path
import yaml
from markdownify import markdownify

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "posts"
OUT.mkdir(parents=True, exist_ok=True)
posts = json.load(open(ROOT / "src" / "data" / "posts.json"))
imap = json.load(open(ROOT / "src" / "data" / "image-map.json"))

def local(src):
    return imap.get(src, src) if src else None

def ascii_name(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9-]", "-", s.lower())).strip("-")

class Str(str): pass
yaml.add_representer(Str, lambda d, s: d.represent_scalar("tag:yaml.org,2002:str", s, style='"'))

written = 0
for p in posts:
    if p.get("source") == "cms":
        continue
    html = p["html"]
    html = re.sub(r'src="([^"]+)"', lambda m: f'src="{local(m.group(1))}"', html)
    html = re.sub(r"<br\s*/?>", "", html)
    # Wix padded bold and italic runs with non-breaking spaces; move the spaces outside
    html = html.replace("&nbsp;", " ").replace("\u00a0", " ")
    for _ in range(3):
        html = re.sub(r"<(em|strong)>(\s+)", r"\2<\1>", html)
        html = re.sub(r"(\s+)</(em|strong)>", r"</\2>\1", html)
    html = re.sub(r"<(em|strong)>\s*</\1>", " ", html)
    # Wix photo sets are lists of <figure>s; make every photo its own paragraph
    html = re.sub(r"<li>\s*<figure>(.*?)</figure>\s*</li>", r"<p>\1</p>", html, flags=re.S)
    html = re.sub(r"<figure>(.*?)</figure>", r"<p>\1</p>", html, flags=re.S)
    html = re.sub(r"<ul>((?:\s*<p>\s*<img[^>]*>\s*</p>)+)\s*</ul>", r"\1", html)
    html = re.sub(r"</?u>", "", html)
    # list items wrap their text in <p>; unwrap so lists stay tight
    html = re.sub(r"<li>\s*<p>(.*?)</p>\s*</li>", r"<li>\1</li>", html, flags=re.S)
    md = markdownify(html, heading_style="ATX", bullets="-", strip=["figure"], escape_misc=False)
    # Wix sometimes ran text straight on after a photo; give each photo its own line
    md = re.sub(r"(!\[[^\]]*\]\([^)]*\))[ \t]*(?=\S)", r"\1\n\n", md)
    md = re.sub(r"(?<=\S)[ \t]*(!\[[^\]]*\]\([^)]*\))", r"\n\n\1", md)
    md = re.sub(r"(?m)^[ \t]*-[ \t]*$\n?", "", md)  # empty list items
    md = re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"
    date = (p["date"] or "")[:10]
    # Two Wix posts came through the export empty; keep them as drafts to rewrite
    empty = not p["title"] and not md.strip()
    title = p["title"] or p["slug"].replace("-", " ").capitalize()
    fm = {
        "title": Str(title),
        "draft": empty,
        "date": date,
        "author": p["author"],
        "categories": p["categories"],
        "description": Str(p["description"] or ""),
        "image": local(p["image"]),
        "imageAlt": Str(title),
        "slug": Str(p["slug"]),
    }
    if p.get("updated"):
        fm["updated"] = p["updated"][:10]
    front = yaml.dump(fm, allow_unicode=True, sort_keys=False, width=1000)
    name = f"{date}-{ascii_name(p['slug'])}.md" if date else f"{ascii_name(p['slug'])}.md"
    (OUT / name).write_text(f"---\n{front}---\n\n{md}", encoding="utf-8")
    written += 1

(OUT / ".migrated").write_text("Wix posts now live in this folder. prepare_data.py skips the Wix export for posts.\n")
print("wrote", written, "posts to", OUT.relative_to(ROOT))
