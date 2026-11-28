# The Tech Brief · AI Tools Directory

A standalone static page at `/tools/`. It lists AI tools The Tech Brief has covered, sorted by the job a reader needs done, with one checked price line, an "it's like … in ChatGPT/Claude/Gemini/Grok, but…" anchor, a first task, a skip-it-if line, and the issues that covered each tool.

This branch (`review/ai-tools-directory`) does not touch the home page, `main`, or the GitHub Pages settings.

## Files

| File | What it is | Edit it? |
| --- | --- | --- |
| `tools.json` | The listings. | Yes |
| `brief-mentions.json` | "Seen in the brief" index, generated from the brief's issue files (which live outside this repo). | No, regenerate |
| `stars.json` | GitHub star counts with the date they were read. | No, regenerate |
| `directory.template.html` | Layout, styles and behaviour (no libraries). | Yes |
| `build.py` | Builds `index.html` from the above. Python 3 standard library only. Validates every listing. | Rarely |
| `update_stars.py` | Refreshes `stars.json` from the GitHub API. | No |
| `img/` | Each tool's own preview image (its `og:image`), resized to 640px WebP, plus the One to Better logos. `img/SOURCES.json` records where every image came from. | Add files |
| `index.html` | The built page. | Never by hand |

All paths are relative (`img/…`, `./`), so the same build works at `/tools/` and at the root of its own domain. Only links back to the Library use the absolute `https://tech.onetobetter.com/`.

## Add a tool

1. Read the tool's own site: what it does, the pricing page, the `og:image`, and (if open source) its GitHub repo.
2. Add an object to `tools.json`:

```json
{
  "slug": "wispr-flow",
  "name": "Wispr Flow",
  "maker": "Wispr",
  "url": "https://wisprflow.ai/",
  "jobs": ["write"],
  "pillars": ["AI"],
  "tags": ["dictation", "voice"],
  "level": "beginner",
  "levelNote": "Install, hold a key, talk.",
  "what": "One or two plain sentences. Expand acronyms the first time.",
  "anchor": "Like voice mode in ChatGPT or Gemini, but it types into any app.",
  "firstTask": "One small, concrete first try.",
  "skip": "When the reader should not bother.",
  "github": "owner/repo",
  "price": {
    "tier": "Free + paid",
    "line": "Free · Pro US$15/user/mo",
    "detail": "Full plan detail, as the pricing page states it.",
    "source": {"label": "Wispr Flow pricing", "url": "https://wisprflow.ai/pricing"},
    "checked": "2026-11-28"
  },
  "claims": [{"text": "Company says … (self-reported).", "source": {"label": "…", "url": "https://…"}}],
  "example": {"type": "Vendor case study", "text": "…", "source": {"label": "…", "url": "https://…"}},
  "disclosure": "Only for tools that helped make this page.",
  "image": {"file": "img/wispr-flow.webp", "source": "https://wisprflow.ai/"},
  "match": {"names": ["Wispr Flow", "Canto-2"], "urls": ["wisprflow.ai"]},
  "status": "Researched · not hands-on tested",
  "added": "2026-11-28"
}
```

- `jobs`: any of `write`, `research`, `build`, `code`, `automate`, `create`, `business`, `learn`.
- `pillars`: `AI`, `Robotics`, `Advanced manufacturing`, `Biotechnology`, `Energy`, `Semiconductors` (only where the tool really reaches it).
- `level`: `beginner`, `intermediate` or `advanced` (an editorial judgement for the first task, explained in `levelNote`).
- `price.tier`: `Free`, `Free + usage`, `Included`, `Free + paid`, `Usage-based` or `Paid`.
- `anchor` must start with "Like ".
- Optional: `github`, `claims`, `example`, `disclosure`, `image`. No `image` gives a plain monogram tile. Never use an image URL you didn't read from the tool's own page.
- `match.names` are matched case-sensitively as whole words against brief item titles; `match.urls` are matched as substrings of item links. Keep them specific (e.g. "Claude Ship", not "Claude").

3. Image: save the `og:image` as `img/<slug>.webp` (640px wide, about 16:9, quality ~72) and add it to `img/SOURCES.json`.

## Rebuild

From the repository root:

```sh
# 1. "Seen in the brief" (run in the Hark project, which has the issues/ folder)
python3 library/tools_mentions.py --tools <repo>/tools/tools.json
# 2. GitHub stars (optional GITHUB_TOKEN)
python3 tools/update_stars.py
# 3. Build
python3 tools/build.py
python3 -m http.server 8765 --bind 127.0.0.1   # open http://127.0.0.1:8765/tools/
```

Commit `tools.json`, the regenerated JSON files, new images and `index.html` together.

## How the page behaves

- Works without JavaScript: every listing and its details (`<details>`) are in the HTML.
- With JavaScript: search (name, maker, job, pillar, tags), job and pillar chips, sort (Newest in brief, A–Z, Price), Gallery/List views (remembered), light/dark theme (shares the Library's `hark-theme` setting), a details sheet with Copy link and Share…
- Deep links: `/tools/#<slug>` opens that tool; `/tools/?job=code`, `?pillar=Robotics`, `?q=video` preset the filters.
- Motion: hero count-up, staggered reveal on scroll, card lift on hover, View Transitions when filtering, a bottom sheet with a gentle spring on phones. `prefers-reduced-motion` turns it all off.

## Merge plan

1. Review on this branch (checklist below), then merge `review/ai-tools-directory` into `main`. The page goes live at `https://tech.onetobetter.com/tools/`.
2. The daily publish (`library/publish_github.py` in the Hark project) leaves `/tools/` alone: it only replaces root files, `/s/`, root `img/<date>/` and `audio/`. Its checkout must pull `main` before the next run so the merge isn't overwritten.
3. Library entry point (one line, not done on this branch): in the Library's top nav (`<nav class="x-nav__top">`), add `<a class="x-nav__g" href="tools/">Tools</a>` after Saved, or in the Library sub-nav add `<a href="tools/">Tools directory</a>`. The Library's `index.html` is generated, so make the change at the source (the Hark Page, or a string replace in `publish_github.py` next to the existing "Follow → Saved" replacements).
4. Brief → directory links: `library/tools_link.py <date>` (Hark project) adds `tool_slug`/`tool_url` to matching release, AI & small business and repo items. Rendering an "In the Tools Directory" link on the Library, share cards and PDF is a separate, later change.
5. Offline: the Library's service worker serves `offline.html` for uncached pages, so `/tools/` needs a connection. Precaching it is optional.

### Its own domain later: tools.onetobetter.com

Because all paths are relative, either works:

- **Redirect (simplest):** add a Cloudflare redirect rule `tools.onetobetter.com/*` → `https://tech.onetobetter.com/tools/$1` (301). One repo, one publish. The address bar shows `tech.onetobetter.com/tools/`.
- **Separate site:** move `tools/` into its own repository (contents at the root), add a `CNAME` file containing `tools.onetobetter.com`, turn on GitHub Pages, and point a `CNAME` DNS record at `<user>.github.io` in Cloudflare. The address bar shows `tools.onetobetter.com`. Update `TOOLS_BASE` in `library/tools_link.py`, and leave a redirect at `/tools/` on the Library.

Either way, link it from the One to Better site.

## Review checklist

- Gallery and List on a phone (folded and unfolded) and on desktop; light and dark.
- Search "video", "MCP", "open source"; tap a job tile; combine a job and a pillar; Clear.
- Sort by Newest in brief, A–Z and Price.
- Open a deep link such as `/tools/#nod`; Back closes the sheet; Copy link and Share… work.
- Turn on Reduce Motion: nothing animates.
- Turn off JavaScript: every listing and its details still read.
- Recheck each price against its linked source before merging; prices change often and promotions were running on Nov 28, 2026.
- "Seen in the brief" links open the right share page or the Library.
- Hermes Agent shows the "Used to build this directory" disclosure.
- No personal names beyond companies and public figures; images are the tools' own.
