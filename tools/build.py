#!/usr/bin/env python3
"""Build tools/index.html from tools.json + brief-mentions.json + stars.json.

Python 3 standard library only. Edit the inputs, never index.html, then commit the rebuilt page.
  tools.json            the listings (see README for the shape)
  brief-mentions.json   "Seen in the brief" index, made by library/tools_mentions.py in the Hark project
  stars.json            GitHub stars, made by tools/update_stars.py
  directory.template.html  layout, styles and behaviour
All asset paths are relative (img/...), so the page works at /tools/ and at a domain root.
"""
from pathlib import Path
from urllib.parse import urlparse
from html import escape
from datetime import date
import json, re

root = Path(__file__).resolve().parent
tools = json.loads((root / "tools.json").read_text())
mentions = json.loads((root / "brief-mentions.json").read_text())
stars = json.loads((root / "stars.json").read_text()) if (root / "stars.json").exists() else {"repos": {}}

JOBS = [("write", "Write & summarize", '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>'),
        ("research", "Research", '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>'),
        ("build", "Build an app or site", '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18M8 21h8"/>'),
        ("code", "Code", '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>'),
        ("automate", "Automate a chore", '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>'),
        ("create", "Create images & video", '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="9.5" r="1.5"/>'),
        ("business", "Run a small business", '<path d="M4 10v10h16V10M3 10l2-6h14l2 6M9 20v-5h6v5"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>'),
        ("learn", "Learn", '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>')]
JOB = {k: v for k, v, _ in JOBS}
PILLARS = ["AI", "Robotics", "Advanced manufacturing", "Biotechnology", "Energy", "Semiconductors"]
LEVELS = {"beginner": (1, "Beginner"), "intermediate": (2, "Intermediate"), "advanced": (3, "Advanced")}
TIERS = {"Free": "free", "Free + usage": "free-usage", "Included": "included", "Free + paid": "free-paid",
         "Usage-based": "usage-based", "Paid": "paid"}

def e(s): return escape(str(s or ""), quote=True)
def fmt_date(d, short=False):
    y, m, dd = map(int, d[:10].split("-"))
    s = date(y, m, dd).strftime("%b %-d" if short else "%b %-d, %Y")
    return s
def https(u, where):
    p = urlparse(u); assert p.scheme == "https" and p.netloc, (where, u); return u
def link(src, text=None):
    return f'<a href="{e(https(src["url"], text))}" rel="noopener">{e(text or src["label"])}</a>'
def k_num(n):
    return f"{n/1000:.1f}k".replace(".0k", "k") if n >= 1000 else str(n)
def initials(name):
    w = re.findall(r"[A-Za-z0-9]+", name.split("(")[0])
    return (w[0][0] + (w[1][0] if len(w) > 1 else w[0][1:2])).upper() if w else "?"

REQ = ["slug", "name", "maker", "url", "jobs", "pillars", "level", "levelNote", "what", "anchor", "firstTask", "skip", "price", "match", "status"]
slugs = set()
for t in tools:
    for k in REQ: assert t.get(k), (t.get("slug"), k)
    assert re.fullmatch(r"[a-z0-9-]+", t["slug"]) and t["slug"] not in slugs, t["slug"]; slugs.add(t["slug"])
    assert all(j in JOB for j in t["jobs"]), t["slug"]
    assert all(p in PILLARS for p in t["pillars"]), t["slug"]
    assert t["level"] in LEVELS and t["price"]["tier"] in TIERS, t["slug"]
    assert t["anchor"].startswith("Like "), (t["slug"], "anchor must start with 'Like '")
    for k in ("line", "detail", "checked"): assert t["price"].get(k), (t["slug"], "price." + k)
    https(t["url"], t["slug"]); https(t["price"]["source"]["url"], t["slug"])
    if t.get("image"): assert (root / t["image"]["file"]).exists(), (t["slug"], "missing image"); https(t["image"]["source"], t["slug"])
    for c in t.get("claims", []): https(c["source"]["url"], t["slug"])

M = mentions.get("mentions", {})
def seen(t): return M.get(t["slug"], [])

def media(t):
    tier = t["price"]["tier"]
    n = len(seen(t))
    badge = f'<span class="tag tag--seen"><i aria-hidden="true"></i>Seen in {n} issue{"s" if n != 1 else ""}</span>' if n else ""
    if t.get("image"):
        dom = urlparse(t["image"]["source"]).netloc.replace("www.", "")
        art = f'<img src="{e(t["image"]["file"])}" alt="Preview image from {e(dom)}" width="640" height="336" loading="lazy" decoding="async">'
    else:
        sub = t.get("github") or urlparse(t["url"]).netloc.replace("www.", "")
        art = f'<div class="mono" aria-hidden="true"><b>{e(initials(t["name"]))}</b><small>{e(sub)}</small></div>'
    return f'<div class="tool__media">{art}<span class="tag tag--tier">{e(tier)}</span>{badge}</div>'

def stars_line(t, long=False):
    r = stars.get("repos", {}).get(t.get("github") or "")
    if not r: return ""
    star = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 .8l1.6 3.4 3.6.4-2.7 2.5.8 3.6L6 8.9 2.7 10.7l.8-3.6L.8 4.6l3.6-.4z" fill="currentColor"/></svg>'
    when = fmt_date(r["fetched"], short=not long)
    if long:
        return f'<p>{star} {r["stars"]:,} stars on {link({"url": "https://github.com/" + t["github"], "label": "GitHub"})} as of {e(when)}.</p>'
    return f'<span class="stars" title="GitHub stars, {e(when)}">{star}{k_num(r["stars"])} on GitHub · {e(when)}</span>'

def detail(t):
    lv, lvname = LEVELS[t["level"]]
    pills = "".join(f'<span class="pill pill--pillar">{e(p)}</span>' for p in t["pillars"])
    pills += "".join(f'<span class="pill">{e(JOB[j])}</span>' for j in t["jobs"])
    out = [f'<div class="pills">{pills}</div>']
    if t.get("disclosure"):
        out.append(f'<div class="callout"><h3>Disclosure</h3><p>{e(t["disclosure"])}</p></div>')
    out.append(f'<div><h3>What it is</h3><p>{e(t["what"])}</p></div>')
    out.append(f'<div><h3>Try first</h3><p>{e(t["firstTask"])}</p></div>')
    out.append(f'<div><h3>Skip it if</h3><p>{e(t["skip"])}</p></div>')
    out.append(f'<div><h3>Skill level · {e(lvname)}</h3><p>{e(t["levelNote"])}</p></div>')
    p = t["price"]
    out.append(f'<div><h3>Price · {e(p["tier"])}</h3><p>{e(p["detail"])}</p><p class="src">Source: {link(p["source"])} · checked {e(fmt_date(p["checked"]))}</p></div>')
    if t.get("github"):
        out.append(f'<div><h3>On GitHub</h3>{stars_line(t, True) or "<p>" + link({"url": "https://github.com/" + t["github"], "label": t["github"]}) + "</p>"}</div>')
    for c in t.get("claims", []):
        out.append(f'<div><h3>They say</h3><p>{e(c["text"])}</p><p class="src">Source: {link(c["source"])}</p></div>')
    if t.get("example"):
        x = t["example"]
        out.append(f'<div><h3>Example · {e(x["type"])}</h3><p>{e(x["text"])}</p><p class="src">Source: {link(x["source"])}</p></div>')
    s = seen(t)
    if s:
        lis = "".join(f'<li><a href="{e(m["url"])}"><time datetime="{e(m["date"])}">{e(fmt_date(m["date"], True))}</time><span>{e(m["section"])}</span><strong>{e(m["title"])}</strong></a></li>' for m in s)
        out.append(f'<div><h3>Seen in the brief · {len(s)}</h3><ul class="seenlist">{lis}</ul></div>')
    else:
        out.append('<div><h3>Seen in the brief</h3><p>Not covered in an issue yet; listed from the directory\'s first edition.</p></div>')
    sid, nm = e(t["slug"]), e(t["name"])
    out.append(f'<div class="actions"><a class="btn btn--primary" href="{e(t["url"])}" rel="noopener">Visit {nm} ↗</a>'
               f'<button type="button" class="btn" data-act="copy" data-id="{sid}" data-name="{nm}">Copy link</button>'
               f'<button type="button" class="btn" data-act="share" data-id="{sid}" data-name="{nm}">Share…</button></div>')
    img = ""
    if t.get("image"):
        img = f' · Image: {link({"url": t["image"]["source"], "label": urlparse(t["image"]["source"]).netloc.replace("www.", "")})}'
    out.append(f'<p class="status">{e(t["status"])}{img}</p>')
    return '<div class="detail">' + "".join(out) + "</div>"

def card(t, i):
    lv, lvname = LEVELS[t["level"]]
    s = seen(t)
    q = " ".join([t["name"], t["maker"], t["what"], " ".join(JOB[j] for j in t["jobs"]), " ".join(t["pillars"]),
                  " ".join(t.get("tags", [])), t.get("github", "")]).lower()
    jobs_txt = " · ".join(JOB[j] for j in t["jobs"])
    disc = '<span class="disc">Used to build this directory</span>' if t.get("disclosure") else ""
    return f'''<article class="tool" id="{e(t["slug"])}" data-jobs="{e(" ".join(t["jobs"]))}" data-pillars="{e(" ".join(p.replace(" ", "-") for p in t["pillars"]))}" data-level="{e(t["level"])}" data-tier="{TIERS[t["price"]["tier"]]}" data-name="{e(t["name"].lower())}" data-latest="{e(s[0]["date"] if s else "")}" data-seen="{len(s)}" data-q="{e(q)}">
<a class="tool__hit" href="#{e(t["slug"])}" aria-label="{e(t["name"])}: details"></a>
{media(t)}
<div class="tool__body"><p class="eyebrow">{e(t["maker"])} · {e(jobs_txt)}</p><h2 class="tool__name">{e(t["name"])}</h2>{disc}
<p class="tool__what">{e(t["what"])}</p><p class="anchor">{e(t["anchor"])}</p>
<div class="meta"><span class="lvl"><span class="meter" data-l="{lv}" aria-hidden="true"><i></i><i></i><i></i></span>{e(lvname)}</span><span class="price">{e(t["price"]["line"])}</span>{stars_line(t)}</div></div>
<details class="tool__more"><summary>Details, sources and coverage</summary>{detail(t)}</details>
</article>'''

counts = {k: sum(k in t["jobs"] for t in tools) for k, _, _ in JOBS}
pcount = {p: sum(p in t["pillars"] for t in tools) for p in PILLARS}
tiles = "\n".join(f'<button type="button" class="job" data-job="{k}" aria-pressed="false" data-in style="--d:{3 + i}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{svg}</svg><b>{e(lbl)}</b><small>{counts[k]}</small></button>'
                  for i, (k, lbl, svg) in enumerate(JOBS))
jchips = "\n".join(f'<button type="button" class="chip-btn" data-job="{k}" aria-pressed="false">{e(lbl)} <small>{counts[k]}</small></button>' for k, lbl, _ in JOBS)
pchips = "\n".join(f'<button type="button" class="chip-btn chip-btn--pillar" data-pillar="{p.replace(" ", "-")}" aria-pressed="false">{e(p)} <small>{pcount[p]}</small></button>' for p in PILLARS if pcount[p])

def sort_key(t):
    s = seen(t); return ("" if not s else s[0]["date"], len(s))
ordered = sorted(tools, key=lambda t: t["name"].lower())
ordered = sorted(ordered, key=sort_key, reverse=True)
checked = max(t["price"]["checked"] for t in tools)
latest = mentions.get("latest") or {"date": checked, "headline": "Today's issue", "url": "https://tech.onetobetter.com/"}
tok = {
    "COUNT": str(len(tools)),
    "SEEN_TOOLS": str(sum(1 for t in tools if seen(t))),
    "MENTIONS": str(sum(len(seen(t)) for t in tools)),
    "ISSUES": str(mentions.get("issues_scanned", 0)),
    "CHECKED_SHORT": fmt_date(checked, True),
    "CHECKED_LONG": fmt_date(checked),
    "LATEST_URL": e(latest["url"]), "LATEST_DATE": e(fmt_date(latest["date"])), "LATEST_HEADLINE": e(latest["headline"]),
    "JOB_TILES": tiles, "JOB_CHIPS": jchips, "PILLAR_CHIPS": pchips,
    "CARDS": "\n".join(card(t, i) for i, t in enumerate(ordered)),
}
html = (root / "directory.template.html").read_text()
for k, v in tok.items():
    assert f"@@{k}@@" in html, k
    html = html.replace(f"@@{k}@@", v)
assert "@@" not in html, re.findall(r"@@\w+@@", html)
(root / "index.html").write_text(html, encoding="utf-8")
print(f"Built tools/index.html: {len(tools)} tools, {tok['SEEN_TOOLS']} seen in the brief, {tok['MENTIONS']} mentions.")
