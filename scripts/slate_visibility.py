#!/usr/bin/env python3
"""
Hide or show Slate titles without deleting anything.

    python3 scripts/slate_visibility.py list
    python3 scripts/slate_visibility.py hide "Past Due" "The Feed"
    python3 scripts/slate_visibility.py show "Past Due"

Titles match loosely (case and punctuation don't matter; "Black Girls Guide"
finds "Black Girl's Guide to Vengeance (and Vodka)").

Hiding a title:
  - wraps its Slate card in a  <!-- HIDDEN date (hidden for now): Title ... END HIDDEN -->  comment
  - makes its Passport redirect to the Slate and tells search engines to skip it
  - removes it from sitemap.xml
Showing reverses all three. Either way the site is rebuilt afterwards
(scripts/build_site.py), so counts, menus, the contact dropdown and
Previous/Next links stay in step.
"""
import datetime
import difflib
import html
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLATE = os.path.join(ROOT, "slate.html")
SITEMAP = os.path.join(ROOT, "sitemap.xml")

CARD_RE = re.compile(r'(?P<indent>[ \t]*)<article class="project-card"[^>]*data-title="(?P<title>[^"]+)".*?</article>', re.S)
HIDDEN_RE = re.compile(r'(?P<indent>[ \t]*)<!-- HIDDEN [^\n:]*?(?:\(hidden for now\))?: (?P<label>[^\n]*)\n(?P<card>.*?)\n[ \t]*END HIDDEN -->', re.S)

REDIRECT_BLOCK = """<!-- HIDDEN-TITLE REDIRECT: this title is off the public slate for now. Delete this block (and the noindex tag) to republish the page. -->
<meta name="robots" content="noindex" />
<meta http-equiv="refresh" content="0; url=../slate.html" />
<script>window.location.replace('../slate.html');</script>
<!-- /HIDDEN-TITLE REDIRECT -->
"""
REDIRECT_RE = re.compile(r"<!-- HIDDEN-TITLE REDIRECT:.*?<!-- /HIDDEN-TITLE REDIRECT -->\n?", re.S)


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)


def norm(t):
    t = html.unescape(t).lower().replace("’", "'")
    return re.sub(r"[^a-z0-9]+", " ", t.replace("'", "")).strip()


def comment_spans(s):
    return [(m.start(), m.end()) for m in re.finditer(r"<!--.*?-->", s, re.S)]


def live_cards(s):
    spans = comment_spans(s)
    inside = lambda i: any(a <= i < b for a, b in spans)
    return [m for m in CARD_RE.finditer(s) if not inside(m.start())]


def hidden_cards(s):
    out = []
    for m in HIDDEN_RE.finditer(s):
        t = CARD_RE.search(m.group("card"))
        if t:
            out.append((m, html.unescape(t.group("title"))))
    return out


def pick(wanted, titles):
    w = norm(wanted)
    exact = [t for t in titles if norm(t) == w]
    if exact:
        return exact[0]
    partial = [t for t in titles if w in norm(t) or norm(t).startswith(w)]
    if len(partial) == 1:
        return partial[0]
    if not partial:  # tolerate typos: "Vengence", "Sneakerhead"
        by_norm = {norm(t): t for t in titles}
        prefixes = {n[:len(w)]: n for n in by_norm}
        close = difflib.get_close_matches(w, list(by_norm) + list(prefixes), n=3, cutoff=0.78)
        found = sorted({by_norm.get(c) or by_norm[prefixes[c]] for c in close})
        if len(found) == 1:
            return found[0]
        raise SystemExit('No clear match for "%s"%s.' % (wanted, (": " + "; ".join(found)) if found else ""))
    raise SystemExit('"%s" matches several titles: %s' % (wanted, "; ".join(partial)))


def slug_of(card_html):
    m = re.search(r'href="projects/([^"#?]+)\.html"', card_html)
    return m.group(1) if m else None


def sitemap_remove(slug):
    sm = read(SITEMAP)
    sm2 = re.sub(r"\s*<url>\s*<loc>[^<]*/projects/%s\.html</loc>.*?</url>" % re.escape(slug), "", sm, flags=re.S)
    if sm2 != sm:
        write(SITEMAP, sm2)


def sitemap_add(slug):
    sm = read(SITEMAP)
    if "/projects/%s.html" % slug in sm:
        return
    entry = ("  <url>\n    <loc>https://nccaentertainment.com/projects/%s.html</loc>\n"
             "    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n" % slug)
    write(SITEMAP, sm.replace("</urlset>", entry + "</urlset>"))


def passport_hide(slug):
    p = os.path.join(ROOT, "projects", slug + ".html")
    if not os.path.exists(p):
        return False
    s = read(p)
    if "HIDDEN-TITLE REDIRECT" not in s:
        block = REDIRECT_BLOCK
        if 'name="robots"' in s:  # page already carries its own noindex
            block = block.replace('<meta name="robots" content="noindex" />\n', "")
        s = re.sub(r"(<head[^>]*>\s*)", lambda m: m.group(1) + block, s, count=1)
    s = re.sub(r"\s*<!-- GEN:MORE:START -->.*?<!-- GEN:MORE:END -->", "", s, flags=re.S)
    write(p, s)
    return True


def passport_show(slug):
    p = os.path.join(ROOT, "projects", slug + ".html")
    if not os.path.exists(p):
        return False
    s = REDIRECT_RE.sub("", read(p))
    s = re.sub(r'[ \t]*<meta name="robots" content="noindex"\s*/?>\n?', "", s)
    write(p, s)
    return True


def cmd_list():
    s = read(SLATE)
    live = [html.unescape(m.group("title")) for m in live_cards(s)]
    hid = [t for _, t in hidden_cards(s)]
    print("Live (%d):" % len(live))
    for t in live:
        print("  " + t)
    print("Hidden (%d):" % len(hid))
    for t in sorted(hid, key=str.lower):
        print("  " + t)


def cmd_hide(names):
    s = read(SLATE)
    all_live = [html.unescape(m.group("title")) for m in live_cards(s)]
    names = [pick(n, all_live) for n in names]  # fail before touching any file
    today = datetime.date.today().isoformat()
    done = []
    for name in names:
        cards = live_cards(s)
        title = pick(name, [html.unescape(m.group("title")) for m in cards])
        m = next(c for c in cards if html.unescape(c.group("title")) == title)
        card, indent = m.group(0).lstrip(" \t"), m.group("indent")
        wrapped = "%s<!-- HIDDEN %s (hidden for now): %s\n%s%s\n%sEND HIDDEN -->" % (indent, today, title, indent, card, indent)
        s = s[:m.start()] + wrapped + s[m.end():]
        slug = slug_of(card)
        if slug:
            passport_hide(slug)
            sitemap_remove(slug)
        done.append(title)
    write(SLATE, s)
    return done


def cmd_show(names):
    s = read(SLATE)
    names = [pick(n, [t for _, t in hidden_cards(s)]) for n in names]  # fail before touching any file
    done = []
    for name in names:
        hid = hidden_cards(s)
        title = pick(name, [t for _, t in hid])
        m = next(h for h, t in hid if t == title)
        card = m.group("card")
        s = s[:m.start()] + card + s[m.end():]
        slug = slug_of(card)
        if slug:
            passport_show(slug)
            sitemap_add(slug)
        done.append(title)
    write(SLATE, s)
    return done


def rebuild():
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_site.py")], check=True)


def main(argv):
    if len(argv) < 2 or argv[1] not in ("list", "hide", "show"):
        print(__doc__.strip())
        return 1
    if argv[1] == "list":
        cmd_list()
        return 0
    if len(argv) < 3:
        raise SystemExit("Name at least one title.")
    changed = cmd_hide(argv[2:]) if argv[1] == "hide" else cmd_show(argv[2:])
    print("%s: %s" % ("Hidden" if argv[1] == "hide" else "Shown", "; ".join(changed)))
    rebuild()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
