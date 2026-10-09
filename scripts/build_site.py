#!/usr/bin/env python3
"""
NCCA site builder.

slate.html is the master list of titles. Run this after any change to the Slate
(adding, hiding, renaming, or re-tagging a title):

    python3 scripts/build_site.py

It regenerates everything that is derived from the Slate, so nothing is typed twice:
  - data/projects.json            (machine-readable slate)
  - the main nav + mobile menu    (index, slate, studio, contact), with live counts
  - the homepage Shop by Buyer tiles
  - the nav on Music and every Passport page
  - the contact form's Project dropdown (contact.html)
  - Previous / Next / More Like This on every live Passport page
  - the "Slate updated" date (changes only when titles or their details change)
  - the analytics script tag on every public page
  - "57 original projects"-style counts on the homepage and Slate

Generated regions sit between <!-- GEN:NAME:START --> and <!-- GEN:NAME:END -->
markers. Edit the script, not the generated HTML.
"""
import html
import json
import os
import re
import sys
from urllib.parse import quote
import datetime
import hashlib
try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PLATFORM_LABELS = {
    "bet-plus": "BET+", "netflix": "Netflix", "tubi": "Tubi", "lifetime": "Lifetime",
    "tv-one": "TV One", "own": "OWN", "hallmark": "Hallmark", "hbo": "HBO / Max",
    "broadcast": "Broadcast TV", "allblk": "ALLBLK", "theatrical": "Theatrical",
    "peacock": "Peacock", "paramount": "Paramount+", "apple": "Apple TV+",
}
FORMAT_LABELS = [
    ("feature", "Feature Films"), ("mow", "TV Movies (MOW)"),
    ("limited-series", "Limited Series"), ("network-series", "Network Series"),
    ("docuseries", "Docuseries"),
]
MIN_BUYER_TITLES = 2  # a buyer needs at least this many titles to appear in the nav

esc = lambda s: html.escape(s, quote=True)


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return f.read()


def write(path, text):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(text)


def strip_comments(s):
    return re.sub(r"<!--.*?-->", "", s, flags=re.S)


def text_of(fragment):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", fragment))).strip()


# ---------------------------------------------------------------- data
def load_slate():
    s = strip_comments(read("slate.html"))
    collections, projects = [], []
    for sec in re.finditer(r'<section class="slate-collection" id="([^"]+)"[^>]*>(.*?)</section>', s, re.S):
        cid, body = sec.group(1), sec.group(2)
        title_m = re.search(r'id="%s-title"[^>]*>(.*?)</' % re.escape(cid), body, re.S)
        cname = text_of(title_m.group(1)) if title_m else cid
        count = 0
        for card in re.finditer(r'<article class="project-card"(.*?)</article>', body, re.S):
            b = card.group(1)
            attr = lambda n: (re.search(r'data-%s="([^"]*)"' % n, b) or [None, ""])[1]
            href = re.search(r'href="(projects/[^"#?]+\.html)"', b)
            img = re.search(r'<img src="([^"]+)"', b)
            syn = re.search(r'class="card__synopsis"[^>]*>(.*?)</p>', b, re.S)
            title = html.unescape(attr("title"))
            projects.append({
                "title": title,
                "slug": os.path.basename(href.group(1))[:-5] if href else "",
                "url": href.group(1) if href else "",
                "image": img.group(1) if img else "",
                "logline": text_of(syn.group(1)) if syn else "",
                "format": attr("format"),
                "genre": attr("genre"),
                "platforms": [p for p in attr("platform").split(",") if p],
                "status": attr("status"),
                "collection": cid,
                "collectionName": cname,
            })
            count += 1
        if count:
            collections.append({"id": cid, "name": cname, "count": count})
    return projects, collections


def counts(projects):
    buyers, formats = {}, {}
    for p in projects:
        for b in p["platforms"]:
            buyers[b] = buyers.get(b, 0) + 1
        formats[p["format"]] = formats.get(p["format"], 0) + 1
    pitch_ready = sum(1 for p in projects if p["status"] == "pitch-ready")
    buyer_list = sorted(
        [(b, n) for b, n in buyers.items() if n >= MIN_BUYER_TITLES and b in PLATFORM_LABELS],
        key=lambda x: (-x[1], PLATFORM_LABELS[x[0]]))
    format_list = [(f, label, formats[f]) for f, label in FORMAT_LABELS if formats.get(f)]
    return buyer_list, format_list, pitch_ready


# ---------------------------------------------------------------- helpers
def slate_updated(projects):
    """Keep the last 'updated' date unless the slate's content actually changed."""
    digest = hashlib.sha256(json.dumps(projects, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:16]
    try:
        prev = json.loads(read("data/projects.json"))
    except (OSError, ValueError):
        prev = {}
    if prev.get("hash") == digest and prev.get("updated"):
        return prev["updated"], digest
    now = datetime.datetime.now(ZoneInfo("America/New_York")) if ZoneInfo else datetime.datetime.now()
    return now.date().isoformat(), digest


def pretty_date(iso):
    d = datetime.date.fromisoformat(iso)
    return "%s %d, %d" % (d.strftime("%B"), d.day, d.year)


def updated_line(iso, cls):
    return '<p class="%s">Slate updated <time datetime="%s">%s</time></p>' % (cls, iso, pretty_date(iso))


UPDATED_CSS = ".slate-updated{margin:18px 0 0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim,#b0aaa0);opacity:.8}"


def ensure_analytics(s, prefix=""):
    tag = '<script src="%sjs/ncca-analytics.js" defer></script>' % prefix
    if "ncca-analytics.js" in s:
        return s
    i = s.rfind("</body>")
    return s[:i] + tag + "\n" + s[i:] if i != -1 else s


def gen_block(name, content):
    return "<!-- GEN:%s:START -->\n%s\n<!-- GEN:%s:END -->" % (name, content.rstrip(), name)


def put_block(s, name, content, first_time_pattern=None, path=""):
    """Replace a generated region. On first run, wrap the region matched by first_time_pattern."""
    marker = re.compile(r"<!-- GEN:%s:START -->.*?<!-- GEN:%s:END -->" % (name, name), re.S)
    new = gen_block(name, content)
    if marker.search(s):
        return marker.sub(lambda m: new, s, count=1)
    if first_time_pattern is None:
        raise SystemExit("%s: no GEN:%s markers and no pattern to place them" % (path, name))
    m = re.search(first_time_pattern, s, re.S)
    if not m:
        raise SystemExit("%s: could not find the original %s block" % (path, name))
    return s[:m.start()] + new + s[m.end():]


# ---------------------------------------------------------------- nav (home + slate)
def main_nav(on_slate, buyer_list, format_list, collections, total, pitch_ready):
    slate = "slate.html"
    lane_href = (lambda cid: "#" + cid) if on_slate else (lambda cid: slate + "#" + cid)
    buyers = "\n".join('          <a href="%s?platform=%s">%s <span class="mega-count">%d</span></a>'
                       % (slate, b, PLATFORM_LABELS[b], n) for b, n in buyer_list)
    formats = "\n".join('          <a href="%s?format=%s">%s <span class="mega-count">%d</span></a>'
                        % (slate, f, label, n) for f, label, n in format_list)
    lanes = ['          <a href="%s">Buyer Shortlist</a>' % lane_href("buyer-shortlist")]
    lanes += ['          <a href="%s">%s <span class="mega-count">%d</span></a>' % (lane_href(c["id"]), esc(c["name"]), c["count"])
              for c in collections if c["id"] not in ("limited-series", "network-series", "feature-films", "docuseries")]
    if pitch_ready:
        lanes.append('          <a href="%s?status=pitch-ready">Pitch-Ready <span class="mega-count">%d</span></a>' % (slate, pitch_ready))
    desktop = """<ul class="nav__links" role="list">
    <li><a href="{slate}">Slate</a></li>
    <li>
      <button aria-haspopup="true" aria-expanded="false">Buyer Lanes &#9660;</button>
      <div class="mega-menu" role="region" aria-label="Buyer lanes">
        <div class="mega-col">
          <div class="mega-col__label">By Buyer</div>
{buyers}
        </div>
        <div class="mega-col">
          <div class="mega-col__label">By Format</div>
{formats}
        </div>
        <div class="mega-col">
          <div class="mega-col__label">Collections</div>
{lanes}
        </div>
        <div class="mega-view-all"><a href="{slate}">Browse the full slate ({total}) &rarr;</a></div>
      </div>
    </li>
    <li><a href="studio.html">Studio</a></li>
    <li><a href="music.html">Music</a></li>
    <li><a href="contact.html">Contact</a></li>
    <li><a href="contact.html?type=materials" class="nav__cta">Request Materials</a></li>
  </ul>""".format(slate=slate, buyers=buyers, formats=formats, lanes="\n".join(lanes), total=total)
    drawer = """<ul class="drawer-nav">
    <li><a href="index.html">Home</a></li>
    <li><a href="{slate}">Slate ({total})</a></li>
    <li>
      <button id="drawer-projects-btn" aria-expanded="false">Buyer Lanes &#9660;</button>
      <div class="drawer-accordion__content" id="drawer-projects-content">
        <div class="drawer-accordion__section">
          <div class="drawer-accordion__section-label">By Buyer</div>
{buyers}
        </div>
        <div class="drawer-accordion__section">
          <div class="drawer-accordion__section-label">By Format</div>
{formats}
        </div>
        <div class="drawer-accordion__section">
          <div class="drawer-accordion__section-label">Collections</div>
{lanes}
        </div>
      </div>
    </li>
    <li><a href="studio.html">Studio</a></li>
    <li><a href="music.html">Music</a></li>
    <li><a href="contact.html">Contact</a></li>
  </ul>
  <a href="contact.html?type=materials" class="drawer-cta">Request Materials</a>""".format(
        slate=slate, total=total, buyers=buyers, formats=formats, lanes="\n".join(lanes))
    return desktop, drawer


MEGA_COUNT_CSS = ".mega-count{opacity:.55;font-size:.85em;margin-left:4px}"


def build_main_pages(projects, collections, updated_iso):
    buyer_list, format_list, pitch_ready = counts(projects)
    total = len(projects)
    for path in ("index.html", "slate.html", "studio.html", "contact.html"):
        s = read(path)
        desktop, drawer = main_nav(path == "slate.html", buyer_list, format_list, collections, total, pitch_ready)
        s = put_block(s, "NAV", desktop, r'<ul class="nav__links" role="list">.*?</ul>(?=\s*<div class="nav__right">)', path)
        s = put_block(s, "DRAWER", drawer, r'<ul class="drawer-nav">.*?</ul>\s*<a [^>]*class="drawer-cta"[^>]*>.*?</a>', path)
        # Utility bar: phone and email only.
        s = re.sub(r'\s*<div class="utility-pulse">.*?</div>', "", s, count=1, flags=re.S)
        s = re.sub(r'\s*<div class="utility-bar__right">\s*<a [^>]*util-pitch-badge[^>]*>.*?</a>\s*</div>', "", s, count=1, flags=re.S)
        if MEGA_COUNT_CSS not in s:
            s = s.replace("</style>", MEGA_COUNT_CSS + "\n</style>", 1)
        # Keep every "NN original projects" style count in step with the slate.
        s = re.sub(r"\b([4-7]\d)(\s+(?:original scripted projects|Original Projects|original projects|Projects|projects|titles))\b",
                   lambda m: "%d%s" % (total, m.group(2)), s)
        s = re.sub(r'(<div class="hero__stat-num">)[4-7]\d(</div><div class="hero__stat-label">Original Projects)',
                   lambda m: "%s%d%s" % (m.group(1), total, m.group(2)), s)
        s = re.sub(r"\b(All|Explore all|Explore All)\s+[4-7]\d\b", lambda m: "%s %d" % (m.group(1), total), s)
        s = re.sub(r"(Projects \()[4-7]\d(\))", lambda m: "%s%d%s" % (m.group(1), total, m.group(2)), s)
        if path == "slate.html":
            s = s.replace('<nav class="collection-nav" aria-label', '<nav class="collection-nav" id="lanes" aria-label', 1)
        if path == "contact.html":
            s = put_block(s, "PROJECT-OPTIONS", project_options(projects), None, path)
        if path == "index.html":
            s = put_block(s, "SHOP-BY-BUYER", shop_by_buyer(buyer_list, format_list, total, pitch_ready), None, path)
        if path in ("index.html", "slate.html"):
            s = put_block(s, "UPDATED", updated_line(updated_iso, "slate-updated"), None, path)
            if UPDATED_CSS not in s:
                s = s.replace("</style>", UPDATED_CSS + "\n</style>", 1)
        s = ensure_analytics(s)
        write(path, s)


def shop_by_buyer(buyer_list, format_list, total, pitch_ready=0):
    tiles = "\n".join(
        '        <a class="buyer-tile" href="slate.html?platform=%s"><span class="buyer-tile__name">%s</span>'
        '<span class="buyer-tile__count">%d title%s</span></a>' % (b, esc(PLATFORM_LABELS[b]), n, "" if n == 1 else "s")
        for b, n in buyer_list if n >= 3)
    formats = "\n".join('        <a href="slate.html?format=%s">%s (%d)</a>' % (f, esc(label), n) for f, label, n in format_list)
    if pitch_ready:
        formats = ('        <a class="pitch-ready-chip" href="slate.html?status=pitch-ready">&#9733; %d Pitch-Ready Titles &rarr;</a>\n'
                   % pitch_ready) + formats
    return """  <section class="shop-buyer" id="shop-by-buyer" aria-labelledby="shop-buyer-title">
    <div class="shop-buyer__inner">
      <div class="shop-buyer__head">
        <div>
          <p class="section-eyebrow">Shop by Buyer</p>
          <h2 class="section-title" id="shop-buyer-title">Start with your mandate.</h2>
        </div>
        <p class="shop-buyer__copy">Every title is developed with a buyer in mind. Pick your network or streamer to see the titles built for it, or browse all %d.</p>
      </div>
      <div class="shop-buyer__grid">
%s
      </div>
      <div class="shop-buyer__formats" aria-label="Browse by format">
%s
        <a href="slate.html">Full slate (%d) &rarr;</a>
      </div>
    </div>
  </section>""" % (total, tiles, formats, total)


def project_options(projects):
    key = lambda t: re.sub(r"^(the|a)\s+", "", t.lower())
    out = ['              <option value="">General / not title-specific</option>']
    for f, label in FORMAT_LABELS:
        titles = sorted({p["title"] for p in projects if p["format"] == f}, key=key)
        if not titles:
            continue
        out.append('              <optgroup label="%s">' % esc(label))
        out += ['                <option value="%s">%s</option>' % (esc(t), esc(t)) for t in titles]
        out.append("              </optgroup>")
    return "\n".join(out)


# ---------------------------------------------------------------- secondary pages
def simple_nav_items(prefix, request_href, item_cls="", cta_cls="", link_cta_cls=""):
    li = '<li%s>' % (' class="%s"' % item_cls if item_cls else "")
    cta_li = '<li%s>' % (' class="%s"' % cta_cls if cta_cls else "")
    a_cta = ' class="%s"' % link_cta_cls if link_cta_cls else ""
    items = [("Slate", prefix + "slate.html"), ("Buyer Lanes", prefix + "slate.html#lanes"),
             ("Studio", prefix + "studio.html"), ("Music", prefix + "music.html"),
             ("Contact", prefix + "contact.html")]
    rows = ['%s<a href="%s">%s</a></li>' % (li, h, t) for t, h in items]
    rows.append('%s<a%s href="%s">Request Materials</a></li>' % (cta_li, a_cta, esc(request_href)))
    return rows


def build_music():
    s = read("music.html")
    rows = simple_nav_items("", "contact.html?type=materials", "nav-item", "nav-item cta")
    content = '<ul class="nav-list">\n' + "\n".join("          " + r for r in rows) + "\n        </ul>"
    s = put_block(s, "NAV", content, r'<ul class="nav-list">.*?</ul>', "music.html")
    write("music.html", ensure_analytics(s))


PASSPORT_CSS = """<style>
.ncca-more{max-width:1100px;margin:64px auto 0;padding:40px 24px 8px;border-top:1px solid rgba(255,255,255,.12);color:inherit;font-family:inherit}
.ncca-more__label{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.65;margin:0 0 6px}
.ncca-more h2{font-size:clamp(22px,3vw,30px);margin:0 0 20px}
.ncca-more__pn{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:36px}
.ncca-more__pn a{display:block;padding:14px 16px;border:1px solid rgba(255,255,255,.14);border-radius:8px;text-decoration:none;color:inherit}
.ncca-more__pn a:hover,.ncca-more__card:hover{border-color:var(--accent,var(--brand,#d9ae67))}
.ncca-more__pn small{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin-bottom:4px}
.ncca-more__pn .is-next{text-align:right}
.ncca-more__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.ncca-more__card{display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.12);border-radius:8px;overflow:hidden;text-decoration:none;color:inherit}
.ncca-more__card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#111}
.ncca-more__card div{padding:12px 14px 14px}
.ncca-more__card strong{display:block;font-size:16px;margin-bottom:4px}
.ncca-more__card span{font-size:13px;opacity:.7;line-height:1.45}
.ncca-more__all{display:inline-block;margin-top:24px;color:var(--accent,var(--brand,#d9ae67))}
/* Phones: keep the site menu reachable as a swipeable row under the logo. */
@media (max-width:900px){.site-header .nav-wrap{flex-wrap:wrap;row-gap:10px}.site-header nav[aria-label^="Main"]{display:block!important;width:100%;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.site-header nav[aria-label^="Main"]::-webkit-scrollbar{display:none}.site-header .nav-list{display:flex!important;flex-wrap:nowrap;gap:8px;white-space:nowrap;margin:0;padding:0 0 2px}.site-header .nav-list li{display:list-item!important;list-style:none;flex:0 0 auto}}
@media (max-width:700px){.ncca-more__pn{grid-template-columns:1fr}.ncca-more__pn .is-next{text-align:left}.ncca-more__grid{grid-template-columns:1fr 1fr}.ncca-more__grid a:nth-child(3){display:none}}
</style>"""

FORMAT_SHORT = {"feature": "Feature", "mow": "TV Movie", "limited-series": "Limited Series",
                "network-series": "Network Series", "docuseries": "Docuseries"}


def more_block(p, projects):
    lane = [x for x in projects if x["collection"] == p["collection"]]
    i = next(k for k, x in enumerate(lane) if x["slug"] == p["slug"])
    prev_p, next_p = lane[i - 1], lane[(i + 1) % len(lane)]
    picks = [x for x in lane[i + 2:] + lane[:max(i - 1, 0)] if x["slug"] not in (p["slug"], prev_p["slug"], next_p["slug"])]
    picks += [x for x in projects if x["format"] == p["format"] and x not in picks and x["slug"] not in (p["slug"], prev_p["slug"], next_p["slug"])]
    picks += [x for x in projects if x not in picks and x["slug"] != p["slug"]]
    cards = "\n".join(
        '    <a class="ncca-more__card" href="%s.html"><img src="../%s" alt="%s key art" loading="lazy" />'
        '<div><strong>%s</strong><span>%s</span></div></a>'
        % (x["slug"], esc(x["image"]), esc(x["title"]), esc(x["title"]), esc(FORMAT_SHORT.get(x["format"], "")))
        for x in picks[:3])
    pn = ""
    if len(lane) > 1:
        pn = ('  <div class="ncca-more__pn">\n'
              '    <a href="%s.html"><small>&larr; Previous in %s</small>%s</a>\n'
              '    <a class="is-next" href="%s.html"><small>Next in %s &rarr;</small>%s</a>\n'
              '  </div>\n') % (prev_p["slug"], esc(p["collectionName"]), esc(prev_p["title"]),
                               next_p["slug"], esc(p["collectionName"]), esc(next_p["title"]))
    return PASSPORT_CSS + ('\n<section class="ncca-more" aria-labelledby="ncca-more-title">\n'
            '  <p class="ncca-more__label">Keep exploring</p>\n'
            '  <h2 id="ncca-more-title">More from %s</h2>\n%s'
            '  <div class="ncca-more__grid">\n%s\n  </div>\n'
            '  <a class="ncca-more__all" href="../slate.html#%s">See the full %s lane &rarr;</a>\n'
            '</section>') % (esc(p["collectionName"]), pn, cards, esc(p["collection"]), esc(p["collectionName"]))


def build_passports(projects):
    done = 0
    for p in projects:
        path = "projects/%s.html" % p["slug"]
        if not os.path.exists(os.path.join(ROOT, path)):
            print("warning: %s missing" % path, file=sys.stderr)
            continue
        s = read(path)
        request = "../contact.html?project=%s&type=materials" % quote(p["title"], safe="")
        if "project-passport.css" in s:  # newer template
            rows = simple_nav_items("../", request, link_cta_cls="nav-portal")
            content = '<ul class="nav-list">\n' + "\n".join("          " + r for r in rows) + "\n        </ul>"
        else:  # original template
            rows = simple_nav_items("../", request, "nav-item", "nav-item cta")
            content = '<ul class="nav-list">\n' + "\n".join("        " + r for r in rows) + "\n      </ul>"
        s = put_block(s, "NAV", content, r'<ul class="nav-list">.*?</ul>', path)
        s = s.replace('href="../projects.html"', 'href="../slate.html"')
        s = put_block(s, "MORE", more_block(p, projects), r'(?=<footer)', path)
        s = ensure_analytics(s, "../")
        write(path, s)
        done += 1
    return done


def main():
    projects, collections = load_slate()
    if not projects:
        raise SystemExit("No titles found in slate.html; nothing written.")
    updated_iso, digest = slate_updated(projects)
    write("data/projects.json", json.dumps({"count": len(projects), "updated": updated_iso, "hash": digest,
                                            "collections": collections, "projects": projects},
                                           ensure_ascii=False, indent=2) + "\n")
    build_main_pages(projects, collections, updated_iso)
    build_music()
    n = build_passports(projects)
    print("Slate: %d titles in %d collections (updated %s). Rebuilt home, Slate, Studio, Contact, Music, %d Passports."
          % (len(projects), len(collections), pretty_date(updated_iso), n))


if __name__ == "__main__":
    main()
