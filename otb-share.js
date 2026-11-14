/* The Tech Brief: Share (approved by Alan 2026-11-14).
   A quiet share icon on every story, release, business story, repo, paper, saved card and Directory profile.
   The sheet shows the 1200x630 branded card, Copy link, Share..., X, LinkedIn and Save image.
   Links: https://tech.onetobetter.com/s/<YYYY-MM-DD>-<item-slug>/ (static page with og tags, redirects to /?item=<slug>#<section>).
   Feature logic only: it reads the page's data (window.XBrief, XVis, visuals.json) and the rendered cards,
   and re-attaches whenever cards redraw. Also exposes window.XNext (shared helpers for the pillar and app modules)
   and XShare.renderCard(slug) / XShare.items(date), used by library/make_share.py to render the card PNGs. */
(function () {
  "use strict";
  var BASE = "https://tech.onetobetter.com";
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PILLAR_ORDER = ["AI", "Robotics", "Advanced manufacturing", "Biotechnology", "Energy", "Semiconductors"];
  var PILLAR_SHORT = { "AI": "AI", "Robotics": "Robotics", "Advanced manufacturing": "Manufacturing", "Biotechnology": "Biotech", "Energy": "Energy", "Semiconductors": "Semiconductors" };
  var PILLAR_INI = { "AI": "A", "Robotics": "R", "Advanced manufacturing": "M", "Biotechnology": "B", "Energy": "E", "Semiconductors": "S" };

  function str(v) { return v == null ? "" : typeof v === "object" ? "" : String(v).trim(); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function d10(v) { var m = /^\d{4}-\d{2}-\d{2}/.exec(str(v)); return m ? m[0] : str(v); }
  function dparts(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(iso)); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  function dateLong(iso) { var d = dparts(iso); return d ? DAY[d.getUTCDay()] + ", " + MON[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear() : str(iso); }
  function dateShort(iso) { var d = dparts(iso); return d ? MON[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear() : str(iso); }
  function fmt(n) { n = str(n).replace(/^\+/, ""); return /^\d+$/.test(n) ? (+n).toLocaleString("en-US") : n; }
  function txt(el) {
    if (!el) return "";
    if (el.querySelector && el.querySelector(".x-unc, .x-sr, .otb-pbadge, .otb-bc")) {
      el = el.cloneNode(true);
      [].forEach.call(el.querySelectorAll(".x-unc, .x-sr, .otb-pbadge, .otb-bc"), function (n) { n.parentNode.removeChild(n); });
    }
    return String(el.textContent || "").replace(/\s+/g, " ").trim();
  }
  function clip(s, n) { s = str(s); if (s.length <= n) return s; var c = s.slice(0, n - 1); var sp = c.lastIndexOf(" "); return (sp > n * 0.6 ? c.slice(0, sp) : c).replace(/[,;:\s]+$/, "") + "…"; }

  // The slug: same rule in library/make_share.py (which calls this file), so links and pages always agree.
  function slug(s) {
    s = String(s == null ? "" : s);
    try { s = s.normalize("NFKD"); } catch (e) {}
    s = s.replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’‘`]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    var w = s.split("-").filter(Boolean), out = [];
    for (var i = 0; i < w.length && out.length < 7; i++) {
      if (out.length && (out.join("-") + "-" + w[i]).length > 48) break;
      out.push(w[i].slice(0, 30));
    }
    while (out.length > 3 && /^(a|an|the|and|or|of|to|for|from|with|in|on|at|by|as|its|their|is|are|after|into|over)$/.test(out[out.length - 1])) out.pop();
    return out.join("-") || "item";
  }

  // Data
  function D() { try { return (window.XBrief && XBrief.D()) || window.BRIEF_SNAPSHOT || {}; } catch (e) { return window.BRIEF_SNAPSHOT || {}; } }
  function rows(t) { var d = D(); return d && Array.isArray(d[t]) ? d[t] : []; }
  var VJ = null;
  function V() {
    if (VJ) return VJ;
    try { var el = document.getElementById("brief-visuals"); VJ = JSON.parse((el && el.textContent) || "{}") || {}; } catch (e) { VJ = {}; }
    return VJ;
  }
  function todayDate() {
    var best = "";
    rows("Issues").forEach(function (i) { var d = d10(i && i.Date); if (d > best) best = d; });
    return best;
  }
  function issueRow(date) { return rows("Issues").filter(function (i) { return d10(i.Date) === date; })[0] || null; }
  var TYPES = {
    Story: { tab: "Stories", key: "Headline", anchor: "stories", word: "story", section: "Top story" },
    Release: { tab: "Releases", key: "Name", anchor: "releases", word: "release", section: "Latest release" },
    Business: { tab: "AI Business", key: "Headline", anchor: "ai-business", word: "business story", section: "AI & small business" },
    Repo: { tab: "GitHub Repos", key: "Repo", anchor: "github", word: "repo", section: "Hot on GitHub" },
    Paper: { tab: "Research Papers", key: "Title", anchor: "research", word: "paper", section: "Research to watch" }
  };
  function vis(tab, row) { try { return window.XVis ? XVis(tab, row) : null; } catch (e) { return null; } }

  // Pillars of an item: AI always (the news stays AI-only), plus any genuine extra pillars from visuals.json.
  function pillarsOf(type, date, title) {
    var v = V(), out = ["AI"];
    var ip = v.item_pillars && v.item_pillars[type + "|" + d10(date) + "|" + str(title)];
    var sp = type === "Story" && v.story_pillars ? v.story_pillars[d10(date) + "|" + str(title)] : null;
    [].concat(Array.isArray(ip) ? ip : [], Array.isArray(sp) ? sp : []).forEach(function (p) {
      p = str(p);
      var canon = PILLAR_ORDER.filter(function (x) { return x.toLowerCase() === p.toLowerCase(); })[0];
      if (canon && out.indexOf(canon) < 0) out.push(canon);
    });
    return out;
  }
  function extra(v, key) { var o = V()[v]; return o && typeof o === "object" ? o[key] : undefined; }

  // Every shareable item of one issue, in page order (lead first). Slugs get -2, -3 on a clash.
  function items(date) {
    date = d10(date || todayDate());
    var out = [], used = {};
    function add(type, row, i) {
      var t = TYPES[type], title = str(row[t.key]);
      if (!title) return;
      var s = date + "-" + slug(title), n = 2;
      while (used[s]) s = date + "-" + slug(title) + "-" + n++;
      used[s] = 1;
      out.push({ type: type, title: title, date: date, slug: s, anchor: type === "Story" && i === 0 ? "today" : t.anchor, row: row, lead: type === "Story" && i === 0, index: i });
    }
    ["Story", "Release", "Business", "Repo", "Paper"].forEach(function (type) {
      var seen = {}, i = 0;
      rows(TYPES[type].tab).forEach(function (r) {
        if (d10(r.Date) !== date) return;
        var k = str(r[TYPES[type].key]);
        if (!k || seen[k]) return;
        seen[k] = 1;
        add(type, r, i++);
      });
    });
    return out;
  }
  // Companies and people named in that issue (for profile pages)
  function entities(date) {
    date = d10(date || todayDate());
    var seen = {}, out = [];
    rows("Connections").forEach(function (c) {
      if (d10(c.Date) !== date) return;
      var t = str(c["Entity type"]), g = t === "Person" ? "Person" : (t === "Company" || t === "Organization") ? "Company" : "";
      var name = str(c.Entity);
      if (!g || !name) return;
      var k = (g + "|" + name).toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push(entItem(g, name));
    });
    return out;
  }
  function entItem(group, name) {
    return { type: group, title: name, slug: (group === "Person" ? "person-" : "company-") + slug(name), key: group + "|" + name };
  }
  function findBySlug(s) {
    s = str(s).toLowerCase().replace(/\/+$/, "");
    var m = /^(\d{4}-\d{2}-\d{2})-/.exec(s);
    if (m) {
      var list = items(m[1]);
      for (var i = 0; i < list.length; i++) if (list[i].slug === s) return list[i];
      return null;
    }
    m = /^(company|person)-(.+)$/.exec(s);
    if (m) {
      var g = m[1] === "person" ? "Person" : "Company", tab = g === "Person" ? "People" : "Companies", hit = null;
      rows(tab).some(function (r) { if (slug(r.Name) === m[2]) { hit = str(r.Name); return true; } return false; });
      if (!hit) rows("Connections").some(function (c) {
        var t = str(c["Entity type"]), cg = t === "Person" ? "Person" : "Company";
        if (cg === g && slug(c.Entity) === m[2]) { hit = str(c.Entity); return true; }
        return false;
      });
      return hit ? entItem(g, hit) : null;
    }
    return null;
  }
  function itemFor(type, title, date) {
    date = d10(date);
    var list = items(date);
    for (var i = 0; i < list.length; i++) if (list[i].type === type && list[i].title === str(title)) return list[i];
    return null;
  }
  // The newest date an item of this type and title appears on
  function latestDate(type, title) {
    var t = TYPES[type], best = "";
    if (!t) return "";
    rows(t.tab).forEach(function (r) { if (str(r[t.key]) === str(title) && d10(r.Date) > best) best = d10(r.Date); });
    return best;
  }
  function shareUrl(it) { return BASE + "/s/" + it.slug + "/"; }
  function localBase() { return window.OTB_SHARE_BASE || (location.hostname === "tech.onetobetter.com" ? "" : BASE); }
  function cardPng(it) { return localBase() + "/s/" + it.slug + "/card.png"; }

  // The card model, read from the data (the same for the sheet preview and the PNG)
  function model(it) {
    var m = { type: it.type, title: it.title, url: shareUrl(it), chips: [], bars: null, qtr: null, note: "", bluf: "", sub: "", mono: false, pillars: [], badge: "" };
    if (it.type === "Company" || it.type === "Person") return entModel(it, m);
    var r = it.row || {}, t = TYPES[it.type], v = vis(t.tab, r) || { unconfirmed: [], keyNumbers: [], money: [] };
    m.date = dateLong(it.date);
    m.dateShort = dateShort(it.date);
    m.pillars = pillarsOf(it.type, it.date, it.title);
    m.section = t.section;
    if (it.type === "Story") {
      m.section = "Top story" + (str(r.Category) ? " · " + str(r.Category) : "");
      m.bluf = str(r["So what"]) || str(r["Bottom line"]);
      m.desc = str(r["Bottom line"]) || m.bluf;
      (v.keyNumbers || []).forEach(function (k) { m.chips.push({ n: k.n, l: k.label }); });
      var bc = extra("beyond", it.date);
      if (bc && str(bc.title) === it.title) m.badge = "Beyond the chatbot";
    } else if (it.type === "Release") {
      m.sub = [str(r.Company), str(r.Category)].filter(Boolean).join(" · ");
      if (str(r.Launched)) m.date = "Launched " + dateShort(r.Launched);
      if (v.priceTier) m.chips.push({ n: v.priceTier, l: "Price" });
      if (v.platform) m.chips.push({ n: v.platform, l: "Platform", small: v.platform.length > 12 });
      if (v.audience) m.chips.push({ aud: v.audience });
      m.bluf = str(r["Bottom line"]);
      if (str(r["Similar to"])) m.note = "Similar to " + str(r["Similar to"]).replace(/\.$/, "") + ".";
      m.desc = m.bluf;
    } else if (it.type === "Business") {
      m.sub = [str(r.Business), str(r.Founders)].filter(Boolean).join(" · ");
      if (v.money && v.money.length) {
        m.bars = v.money.slice(0, 3);
        m.note = v.moneyNote;
      } else if (str(r.Revenue)) {
        var rv = str(r.Revenue), self = /self-reported/i.test(rv) || /\b(says|say)\b/i.test(rv);
        rv = rv.replace(/\s*\(self-reported\)/ig, "").trim();
        var fm = /^(?:(?:more than|over|about|almost|nearly|roughly|around|~)\s+)?[$€£¥]\s?\d[\d,.]*\s?(?:[KMB]\b|million|billion|thousand)?/i.exec(rv);
        if (fm) {
          var rest = rv.slice(fm[0].length).replace(/^[\s,;:]+/, "");
          m.chips.push({ n: fm[0].charAt(0).toUpperCase() + fm[0].slice(1), l: clip(rest || "Revenue", 60) + (self && !/says?\b/i.test(rest) ? ", they say" : "") });
        } else m.chips.push({ s: clip(rv, 70) });
      }
      m.bluf = str(r["Bottom line"]);
      m.desc = m.bluf;
    } else if (it.type === "Repo") {
      m.mono = true;
      m.badge = "For developers";
      if (str(r["Total stars"])) m.chips.push({ n: "★ " + fmt(r["Total stars"]), l: "stars" });
      if (str(r["Stars this week"])) m.chips.push({ n: "+" + fmt(r["Stars this week"]), l: "this week" });
      if (v.language) m.chips.push({ s: v.language, dot: true });
      m.bluf = str(r["What it does"]);
      m.desc = m.bluf;
    } else if (it.type === "Paper") {
      if (v.qtr) m.qtr = v.qtr;
      if (v.evidence) m.chips.push({ s: /^preprint/i.test(v.evidence) ? "Preprint, not peer reviewed" : v.evidence });
      if (str(r.Upvotes)) m.chips.push({ s: "▲ " + str(r.Upvotes) + (str(r.Upvotes) === "1" ? " vote" : " votes") });
      if (str(r.Org)) m.chips.push({ s: clip(r.Org, 34) });
      m.bluf = str(r["Bottom line"]);
      m.desc = m.bluf;
    }
    m.ogTitle = it.title;
    m.ogDesc = clip(m.desc || m.bluf, 200);
    return m;
  }
  function entModel(it, m) {
    var b = window.XBrief, st = null, shared = [], about = "";
    try { st = b.stats(it.key); shared = b.shared(it.key) || []; } catch (e) {}
    (it.type === "Person" ? rows("People") : rows("Companies")).some(function (r) {
      if (str(r.Name).toLowerCase() === it.title.toLowerCase() && str(r.Role || r.About)) { about = str(r.Role || r.About); return true; }
      return false;
    });
    m.section = "Directory · " + (it.type === "Person" ? "Person" : "Company");
    m.date = st && st.latest ? "Latest " + dateShort(st.latest) : "";
    m.bluf = about;
    m.pillars = st && st.pillars && st.pillars.length ? st.pillars.slice(0, 1) : ["AI"];
    if (st && st.issues) m.chips.push({ n: String(st.issues), l: st.issues === 1 ? "issue" : "issues" });
    if (st && st.first) m.chips.push({ n: dateShort(st.first).replace(/, \d{4}$/, ""), l: "first seen" });
    m.map = { name: it.title, person: it.type === "Person", nodes: shared.slice(0, 8) };
    m.ogTitle = it.title + " in The Tech Brief";
    m.ogDesc = clip((about ? about + ". " : "") + (st && st.issues ? "In " + st.issues + (st.issues === 1 ? " issue" : " issues") + " of The Tech Brief." : ""), 200);
    return m;
  }

  // The card, 1200x630, white and branded (always light: it is the image people will see)
  function logoSrc() {
    var i = document.querySelector("img.x-logo-l");
    return (i && i.getAttribute("src")) || "otb-logo-160.png";
  }
  function pillBadge(p) {
    return '<span class="otbc-pp"><b>' + esc(PILLAR_INI[p] || p.charAt(0)) + "</b>" + esc(PILLAR_SHORT[p] || p) + "</span>";
  }
  function chipHtml(c) {
    if (c.aud) {
      return '<div class="otbc-chip otbc-chip--s">For ' + [["everyday", "Everyday"], ["work", "Work"], ["developers", "Developers"]].map(function (a) {
        return '<i class="otbc-dot' + (a[0] === c.aud ? " is-on" : "") + '"></i>' + a[1];
      }).join(" ") + "</div>";
    }
    if (c.s) return '<div class="otbc-chip otbc-chip--s">' + (c.dot ? '<i class="otbc-lang"></i>' : "") + esc(c.s) + "</div>";
    return '<div class="otbc-chip"><span class="otbc-n' + (c.small ? " is-small" : "") + '">' + esc(c.n) + "</span>" + esc(c.l || "") + "</div>";
  }
  function mapSvg(map) {
    var nodes = map.nodes || [], W = 820, H = 230, cx = W / 2, cy = H / 2, n = nodes.length;
    if (!n) return "";
    var max = Math.max.apply(null, nodes.map(function (x) { return x.n; })) || 1, out = "";
    var pts = nodes.map(function (o, i) {
      var a = n <= 2 ? (i ? Math.PI : 0) : -Math.PI / 2 + (i + 0.5) * (2 * Math.PI / n);
      return { o: o, x: cx + 250 * Math.cos(a), y: cy + 82 * Math.sin(a), r: 11 + 12 * (o.n / max), c: Math.cos(a) };
    });
    pts.forEach(function (p) { out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" stroke="#d4d4d0" stroke-width="' + (1.5 + 3 * (p.o.n / max)).toFixed(1) + '"/>'; });
    pts.forEach(function (p) {
      var person = p.o.group === "Person", right = p.c >= 0;
      out += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + p.r.toFixed(1) + '" fill="' + (person ? "#fff" : "#171717") + '" stroke="#171717" stroke-width="2.5"/>' +
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 5).toFixed(1) + '" text-anchor="middle" font-size="15" font-weight="700" fill="' + (person ? "#171717" : "#fff") + '">' + p.o.n + "</text>" +
        '<text x="' + (p.x + (right ? 1 : -1) * (p.r + 8)).toFixed(1) + '" y="' + (p.y + 6).toFixed(1) + '" text-anchor="' + (right ? "start" : "end") + '" font-size="18" fill="#333">' + esc(clip(p.o.name, 18)) + "</text>";
    });
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="34" fill="#C81018"/>' +
      '<text x="' + cx + '" y="' + (cy + 8) + '" text-anchor="middle" font-size="24" font-weight="700" fill="#fff">' + esc((map.name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?") + "</text>";
    return '<svg class="otbc-map" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">' + out + "</svg>";
  }
  function cardHtml(m) {
    var p = m.pillars && m.pillars.length ? (m.pillars.filter(function (x) { return x !== "AI"; })[0] || m.pillars[0]) : "";
    var right = (m.badge ? '<span class="otbc-pp otbc-pp--tag">' + esc(m.badge) + "</span>" : "") + (p ? pillBadge(p) : "") + (m.date ? '<span class="otbc-date">' + esc(m.date) + "</span>" : "");
    var h = '<div class="otbc-top"><span class="otbc-cat">' + esc(m.section) + '</span><span class="otbc-right">' + right + "</span></div>";
    h += '<h1 class="otbc-h' + (m.mono ? " otbc-h--mono" : "") + '">' + esc(m.title) + "</h1>";
    if (m.sub) h += '<p class="otbc-sub">' + esc(m.sub) + "</p>";
    var body = "";
    if (m.map) {
      if (m.bluf) body += '<p class="otbc-bl otbc-bl--about">' + esc(clip(m.bluf, 140)) + "</p>";
      body += '<div class="otbc-ent">' + (m.chips.length ? '<div class="otbc-vis otbc-vis--col">' + m.chips.map(chipHtml).join("") + "</div>" : "") + mapSvg(m.map) + "</div>";
    } else {
      if (m.qtr) {
        body += '<div class="otbc-qtr">' + [["Question", m.qtr.q], ["Test", m.qtr.t], ["Result", m.qtr.r]].filter(function (x) { return x[1]; }).map(function (x) {
          return '<div class="otbc-st"><em>' + x[0] + "</em>" + esc(x[1]) + "</div>";
        }).join("") + "</div>";
      }
      if (m.bars) {
        var max = Math.max.apply(null, m.bars.map(function (b) { return b.value; })) || 1;
        body += '<div class="otbc-bars">' + m.bars.map(function (b, i) {
          return '<div class="otbc-bar"><span>' + esc(b.label) + '</span><i style="width:' + Math.max(8, Math.round(560 * b.value / max)) + "px;background:" + (i ? "#9a9a9a" : "#C81018") + '"></i><b>' + esc(b.text) + "</b></div>";
        }).join("") + "</div>";
        if (m.note) body += '<p class="otbc-who">' + esc(clip(m.note, 150)) + "</p>";
      }
      if (m.chips.length) body += '<div class="otbc-vis">' + m.chips.map(chipHtml).join("") + "</div>";
      if (m.bluf && !m.bars && !m.qtr) body += '<p class="otbc-bl">' + (m.type === "Story" || m.type === "Repo" ? "<b>BLUF</b>" : "") + esc(m.bluf) + "</p>";
      else if (m.bluf && m.bars) body += '<p class="otbc-bl otbc-bl--sm">' + esc(m.bluf) + "</p>";
      if (m.note && !m.bars) body += '<p class="otbc-bl otbc-bl--note">' + esc(m.note) + "</p>";
    }
    h += '<div class="otbc-body">' + body + "</div>";
    h += '<div class="otbc-foot"><div class="otbc-br"><img src="' + esc(logoSrc()) + '" alt="" width="56" height="56" /><div><div class="otbc-nm">The Tech Brief</div><div class="otbc-sb">What moved in tech, in five minutes</div></div></div>' +
      '<div class="otbc-url">tech.onetobetter.com<br /><span>A One to Better project</span></div></div>';
    return h;
  }
  // Build the card element and fit the headline (shrinks until it takes at most 3 lines and the body fits)
  function cardEl(m) {
    var el = document.createElement("div");
    el.className = "otbc otbc--" + m.type.toLowerCase();
    el.innerHTML = cardHtml(m);
    return el;
  }
  function fit(el) {
    var h = el.querySelector(".otbc-h"), body = el.querySelector(".otbc-body"), foot = el.querySelector(".otbc-foot");
    if (!h || !body || !foot) return;
    var size = el.classList.contains("otbc--story") && !el.querySelector(".otbc-vis") ? 60 : 54;
    if (h.classList.contains("otbc-h--mono")) size = Math.min(50, Math.floor(1950 / Math.max(20, h.textContent.length)));
    for (var i = 0; i < 24; i++) {
      h.style.fontSize = size + "px";
      var lh = size * 1.08, lines = Math.round(h.offsetHeight / lh);
      var bottom = body.offsetTop + body.scrollHeight;
      if ((lines <= 3 || size <= 34) && (bottom <= foot.offsetTop - 18 || size <= 30)) break;
      size -= 2;
    }
    // Last resort: clamp the body text
    [].forEach.call(el.querySelectorAll(".otbc-bl"), function (p) {
      var guard = 0;
      while (body.offsetTop + body.scrollHeight > foot.offsetTop - 14 && guard++ < 40) {
        var t = p.textContent;
        if (t.length < 40) break;
        p.lastChild.textContent = clip(p.lastChild.textContent, Math.max(20, p.lastChild.textContent.length - 12));
      }
    });
  }

  // For library/make_share.py: draw one card at the top-left of the page, 1200x630, and return its page data
  function renderCard(s) {
    var it = findBySlug(s);
    if (!it) return null;
    var m = model(it), stage = document.getElementById("otbc-stage");
    if (!stage) { stage = document.createElement("div"); stage.id = "otbc-stage"; document.body.appendChild(stage); }
    stage.innerHTML = "";
    var el = cardEl(m);
    stage.appendChild(el);
    fit(el);
    return { slug: it.slug, type: it.type, title: it.title, date: it.date || "", anchor: it.anchor || "", ogTitle: m.ogTitle, ogDesc: m.ogDesc, section: m.section,
      deep: it.date ? "/?item=" + it.slug + "#" + (it.anchor || "today") : "/?ent=" + encodeURIComponent(it.key) + "#directory" };
  }

  // Which item a rendered card is
  function cardItem(card) {
    if (!card) return null;
    var today = todayDate();
    if (card.closest && card.closest("#lead")) {
      var l = items(today).filter(function (x) { return x.lead; })[0];
      return l || null;
    }
    var box = card.parentNode, id = box && box.id;
    var map = { "story-cards": "Story", "rl-cards": "Release", "ab-cards": "Business", "repo-cards": "Repo", "paper-cards": "Paper" };
    var h = card.querySelector("h3");
    if (map[id] && h) return itemFor(map[id], txt(h), today) || null;
    if (card.classList && card.classList.contains("x-fl-card")) {
      var tag = card.querySelector(".x-fl-top .x-cat"), t = tag ? tag.getAttribute("data-t") : "";
      var u = card.querySelector("[data-unfollow]"), fid = u ? u.getAttribute("data-fid") || "" : "";
      if (t === "Story") { var cut = fid.indexOf("|"); return cut > 0 ? itemFor("Story", fid.slice(cut + 1), fid.slice(0, cut)) : null; }
      if (t === "Repo" || t === "Release") { var dd = latestDate(t, fid); return dd ? itemFor(t, fid, dd) : null; }
    }
    if (card.hasAttribute && card.hasAttribute("data-otb-item")) return findBySlug(card.getAttribute("data-otb-item"));
    return null;
  }

  // The quiet icon button
  var ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/></g></svg>';
  function btn(it, label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "otbs-btn" + (label ? " otbs-btn--text" : "");
    b.setAttribute("data-otb-share", it.slug);
    b.setAttribute("aria-label", "Share " + it.title);
    b.setAttribute("aria-haspopup", "dialog");
    b.innerHTML = ICON + (label ? "<span>" + esc(label) + "</span>" : "");
    return b;
  }
  function place(card, it) {
    if (!card || !it || card.querySelector(":scope > .x-dig-row .otbs-btn, :scope > .otbs-row .otbs-btn, .x-lead__copy > .x-dig-row .otbs-btn")) return;
    var row = null;
    [].some.call(card.querySelectorAll(".x-dig-row"), function (r) { if (r.parentNode === card || (card.id === "lead" && r.parentNode.classList.contains("x-lead__copy"))) { row = r; return true; } return false; });
    if (!row) { row = document.createElement("p"); row.className = "x-dig-row otbs-row"; card.appendChild(row); }
    row.classList.add("otbs-has");
    row.appendChild(btn(it));
  }
  function attach() {
    var lead = document.getElementById("lead");
    if (lead && lead.querySelector(".x-lead__h") && lead.querySelector(".x-dig-row") && !lead.querySelector(".otbs-btn")) {
      var l = cardItem(lead);
      if (l) place(lead, l);
    }
    ["story-cards", "rl-cards", "ab-cards", "repo-cards", "paper-cards"].forEach(function (id) {
      var box = document.getElementById(id);
      if (!box) return;
      [].forEach.call(box.children, function (card) {
        if (card.querySelector(".otbs-btn") || !card.querySelector(".x-dig-row")) return;
        var it = cardItem(card);
        if (it) place(card, it);
      });
    });
    var fl = document.getElementById("fl-cards");
    if (fl) [].forEach.call(fl.querySelectorAll(".x-fl-card"), function (card) {
      if (card.querySelector(".otbs-btn") || !card.querySelector(".x-dig-row")) return;
      var it = cardItem(card);
      if (it) place(card, it);
    });
    // Directory profile sheet
    var acts = document.querySelector("#x-pf .x-pf-acts");
    if (acts && !acts.querySelector(".otbs-btn")) {
      var key = acts.getAttribute("data-dig-ent") || "", cut = key.indexOf("|");
      if (cut > 0) {
        var g = key.slice(0, cut) === "Person" ? "Person" : "Company", it = entItem(g, acts.getAttribute("data-dig-name") || key.slice(cut + 1));
        it.key = key;
        acts.appendChild(btn(it, "Share"));
      }
    }
  }
  var ENT = {};
  function itemFromBtn(b) {
    var s = b.getAttribute("data-otb-share") || "";
    var acts = b.closest(".x-pf-acts");
    if (acts) {
      var key = acts.getAttribute("data-dig-ent") || "", cut = key.indexOf("|");
      var it = entItem(key.slice(0, cut) === "Person" ? "Person" : "Company", acts.getAttribute("data-dig-name") || key.slice(cut + 1));
      it.key = key;
      return it;
    }
    return findBySlug(s);
  }

  // The sheet
  var layer, sheet, titleEl, prevBox, linkTxt, copyB, nativeB, xA, liA, saveA, status, cur = null, curUrl = "", opener = null, closeT = 0, msgT = 0;
  function el(tag, cls, attrs, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  var ACT_ICONS = {
    native: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></svg>',
    li: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4z"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function build() {
    layer = el("div", "x-dig-layer otbs-layer", { id: "otb-share" });
    layer.hidden = true;
    sheet = el("div", "x-dig-sheet otbs-sheet", { role: "dialog", "aria-modal": "true", "aria-labelledby": "otbs-title", "aria-describedby": "otbs-sub" });
    var top = el("div", "x-dig-top", null, '<span class="x-dig-handle" aria-hidden="true"></span>');
    var x = el("button", "x-dig-x", { type: "button", "aria-label": "Close", "data-otbs-close": "" },
      '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>');
    top.appendChild(x);
    var body = el("div", "x-dig-body otbs-body");
    titleEl = el("h2", "x-dig-title otbs-title", { id: "otbs-title", tabindex: "-1" });
    var sub = el("p", "otbs-sub", { id: "otbs-sub" });
    sub.textContent = "The card your friends will see";
    prevBox = el("div", "otbs-prev", { "aria-hidden": "true" });
    var lr = el("div", "otbs-link");
    linkTxt = el("span", "otbs-link__t");
    copyB = el("button", "otbs-copy", { type: "button" });
    copyB.textContent = "Copy";
    lr.appendChild(linkTxt);
    lr.appendChild(copyB);
    var acts = el("div", "otbs-acts");
    nativeB = el("button", "otbs-act", { type: "button", "data-k": "native" }, '<span class="otbs-ico otbs-ico--native">' + ACT_ICONS.native + "</span><span>Share…</span>");
    xA = el("a", "otbs-act", { target: "_blank", rel: "noopener", "data-k": "x" }, '<span class="otbs-ico otbs-ico--x">' + ACT_ICONS.x + "</span><span>X</span>");
    liA = el("a", "otbs-act", { target: "_blank", rel: "noopener", "data-k": "li" }, '<span class="otbs-ico otbs-ico--li">' + ACT_ICONS.li + "</span><span>LinkedIn</span>");
    saveA = el("a", "otbs-act", { target: "_blank", rel: "noopener", "data-k": "save" }, '<span class="otbs-ico otbs-ico--save">' + ACT_ICONS.save + "</span><span>Save image</span>");
    [nativeB, xA, liA, saveA].forEach(function (a) { acts.appendChild(a); });
    status = el("p", "x-dig-status otbs-status", { role: "status", "aria-live": "polite" });
    var note = el("p", "x-dig-note otbs-note");
    note.textContent = "\u201cShare\u2026\u201d opens your phone\u2019s own menu (Messages, WhatsApp, LINE, email). No sign-in, and the links carry no tracking codes.";
    [titleEl, sub, prevBox, lr, acts, status, note].forEach(function (n) { body.appendChild(n); });
    sheet.appendChild(top);
    sheet.appendChild(body);
    layer.appendChild(el("div", "x-dig-scrim", { "data-otbs-close": "" }));
    layer.appendChild(sheet);
    document.body.appendChild(layer);
    layer.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest("[data-otbs-close]")) close(); });
    copyB.addEventListener("click", function () { copyLink(copyB); });
    nativeB.addEventListener("click", nativeShare);
    drag(top);
  }
  var WORD = { Story: "story", Release: "release", Business: "story", Repo: "repo", Paper: "paper", Company: "profile", Person: "profile" };
  function sizePreview() {
    var card = prevBox.firstChild;
    if (!card) return;
    var w = prevBox.clientWidth || 320, s = w / 1200;
    card.style.transform = "scale(" + s + ")";
    prevBox.style.height = Math.round(630 * s) + "px";
  }
  function open(it, from) {
    if (!it) return;
    try {
      if (!layer) build();
      clearTimeout(closeT);
      opener = from || document.activeElement;
      cur = it;
      var m = model(it);
      curUrl = m.url;
      titleEl.textContent = "Share this " + (WORD[it.type] || "item");
      prevBox.innerHTML = "";
      var card = cardEl(m);
      prevBox.appendChild(card);
      linkTxt.textContent = curUrl.replace(/^https:\/\//, "").replace(/\/$/, "");
      linkTxt.title = curUrl;
      copyB.textContent = "Copy";
      copyB.setAttribute("aria-label", "Copy link to " + it.title);
      xA.href = "https://x.com/intent/post?text=" + encodeURIComponent(it.title) + "&url=" + encodeURIComponent(curUrl);
      xA.setAttribute("aria-label", "Share on X");
      liA.href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(curUrl);
      liA.setAttribute("aria-label", "Share on LinkedIn");
      var png = cardPng(it);
      saveA.href = png;
      saveA.setAttribute("download", "tech-brief-" + it.slug + ".png");
      saveA.setAttribute("aria-label", "Save the card image");
      saveA.hidden = false;
      checkPng(png);
      status.textContent = "";
      layer.hidden = false;
      document.documentElement.style.overflow = "hidden";
      inert(true);
      void layer.offsetWidth;
      layer.classList.add("is-open");
      sizePreview();
      fit(card);
      var xb = sheet.querySelector(".x-dig-x");
      if (xb) xb.focus({ preventScroll: true });
    } catch (e) { if (window.console) console.warn(e); }
  }
  var pngOk = {};
  function checkPng(png) {
    if (pngOk[png] === false) { saveA.hidden = true; return; }
    if (pngOk[png] || !window.fetch) return;
    try {
      fetch(png, { method: "HEAD", mode: "cors", cache: "no-store" }).then(function (r) {
        pngOk[png] = r.ok;
        if (!r.ok && saveA.href === png) saveA.hidden = true;
      }, function () { /* offline or blocked: keep the button, the link still opens the image */ });
    } catch (e) {}
  }
  function close() {
    if (!layer || layer.hidden) return;
    layer.classList.remove("is-open");
    inert(false);
    document.documentElement.style.overflow = "";
    closeT = setTimeout(function () { layer.hidden = true; prevBox.innerHTML = ""; }, REDUCED ? 0 : 280);
    if (opener && document.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (e) {} }
    opener = null;
  }
  function inert(on) {
    var page = document.querySelector(".page"), pf = document.getElementById("x-pf");
    [page, pf && !pf.hidden ? pf : null].forEach(function (n) {
      if (!n) return;
      if (on) { n.setAttribute("inert", ""); n.setAttribute("aria-hidden", "true"); }
      else if (n === page && document.getElementById("x-pf") && !document.getElementById("x-pf").hidden) { /* profile still open: it keeps the page inert */ }
      else { n.removeAttribute("inert"); n.removeAttribute("aria-hidden"); }
    });
  }
  function say(t) { clearTimeout(msgT); status.textContent = t; msgT = setTimeout(function () { status.textContent = ""; copyB.textContent = "Copy"; }, 2600); }
  function copyText(text, done, fail) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { legacy(text, done, fail); }); return; }
    } catch (e) {}
    legacy(text, done, fail);
  }
  function legacy(text, done, fail) {
    var ok = false, ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
    (layer || document.body).appendChild(ta);
    try { ta.select(); ta.setSelectionRange(0, text.length); ok = document.execCommand && document.execCommand("copy"); } catch (e) { ok = false; }
    ta.parentNode.removeChild(ta);
    if (ok) done(); else fail();
  }
  function selectLink() {
    try { var r = document.createRange(); r.selectNodeContents(linkTxt); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
  }
  function copyLink(b) {
    copyText(curUrl, function () { b.textContent = "Copied"; say("Link copied."); }, function () { selectLink(); say("Link selected. Press and hold to copy."); });
  }
  function nativeShare() {
    var data = { title: "The Tech Brief", text: cur ? cur.title : "", url: curUrl };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        navigator.share(data).then(function () { say("Shared."); }, function (e) { if (!e || e.name !== "AbortError") copyLink(copyB); });
        return;
      }
    } catch (e) {}
    copyLink(copyB);
  }
  function onKey(ev) {
    if (!layer || layer.hidden) return;
    if (ev.key === "Escape" || ev.key === "Esc") { ev.preventDefault(); ev.stopPropagation(); close(); return; }
    if (ev.key !== "Tab") return;
    var f = [].filter.call(sheet.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])"), function (n) { return !n.disabled && !n.hidden && n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (ev.shiftKey && (a === first || !sheet.contains(a))) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && (a === last || !sheet.contains(a))) { ev.preventDefault(); first.focus(); }
  }
  function drag(handle) {
    var y0 = null, dy = 0;
    handle.addEventListener("pointerdown", function (ev) {
      if (!window.matchMedia || !matchMedia("(max-width: 599px)").matches || (ev.target.closest && ev.target.closest(".x-dig-x"))) return;
      y0 = ev.clientY; dy = 0; sheet.classList.add("is-drag");
      try { handle.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    handle.addEventListener("pointermove", function (ev) { if (y0 == null) return; dy = Math.max(0, ev.clientY - y0); sheet.style.transform = "translateY(" + dy + "px)"; });
    function end() { if (y0 == null) return; y0 = null; sheet.classList.remove("is-drag"); sheet.style.transform = ""; if (dy > 90) close(); }
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  // Landing from a shared link: scroll to the item, a red outline that fades, and a slim dismissible bar
  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(location.search || "");
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
  }
  function cardOf(it) {
    if (!it) return null;
    if (it.lead) return document.getElementById("lead");
    var box = document.getElementById({ Story: "story-cards", Release: "rl-cards", Business: "ab-cards", Repo: "repo-cards", Paper: "paper-cards" }[it.type]);
    if (!box) return null;
    return [].filter.call(box.children, function (c) { var x = cardItem(c); return x && x.slug === it.slug; })[0] || null;
  }
  var landed = null;
  function bar(text) {
    if (document.getElementById("otbs-bar")) return;
    var b = el("div", "otbs-bar", { id: "otbs-bar", role: "region", "aria-label": "Shared link" },
      '<span class="otbs-bar__t">Shared<span class="otbs-bar__w"> with you</span> from <b>The Tech Brief</b></span><span class="otbs-bar__sep" aria-hidden="true">·</span>' +
      '<a class="otbs-bar__a" href="#today">Read today\u2019s brief</a>' +
      '<button type="button" class="otbs-bar__x" aria-label="Dismiss"><svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>');
    document.body.appendChild(b);
    b.querySelector(".otbs-bar__x").addEventListener("click", function () { b.parentNode.removeChild(b); document.documentElement.classList.remove("otbs-barred"); });
    b.querySelector(".otbs-bar__a").addEventListener("click", function (ev) {
      ev.preventDefault();
      if (window.XApp && XApp.tab) XApp.tab("today");
      var t = document.getElementById("top") || document.body;
      try { window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" }); } catch (e) { window.scrollTo(0, 0); }
      b.parentNode.removeChild(b);
      document.documentElement.classList.remove("otbs-barred");
    });
    document.documentElement.classList.add("otbs-barred");
  }
  function highlight(card, scroll) {
    if (!card) return;
    card.classList.remove("otbs-hit");
    void card.offsetWidth;
    card.classList.add("otbs-hit");
    if (scroll) {
      try { card.scrollIntoView({ block: card.offsetHeight > innerHeight * 0.8 ? "start" : "center", behavior: "auto" }); } catch (e) { card.scrollIntoView(); }
      var navH = 0, nav = document.getElementById("x-nav");
      if (window.XApp && XApp.isApp && XApp.isApp()) navH = XApp.headH();
      else if (nav && getComputedStyle(nav).position === "sticky" && nav.offsetHeight) navH = nav.offsetHeight;
      var r = card.getBoundingClientRect();
      if (r.top < navH + 8) window.scrollBy(0, r.top - navH - 12);
    }
  }
  function land() {
    var s = param("item"), ent = param("ent");
    if (!s && !ent) return;
    landed = { s: s, ent: ent, t: Date.now() };
    bar();
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    function go(scroll) {
      if (landed.ent) {
        var name = landed.ent.slice(landed.ent.indexOf("|") + 1);
        if (window.XApp && XApp.tab) XApp.tab("directory");
        if (window.XProfile && XProfile.open(name) !== false) { landed.done = true; }
        return;
      }
      var it = findBySlug(landed.s);
      if (!it) return;
      var today = todayDate();
      if (it.date !== today) {
        // An older item: show it in the Archive search
        if (window.XApp && XApp.tab) XApp.tab("library");
        var q = document.getElementById("f-q"), sec = document.getElementById("archive");
        if (q && sec && !landed.done) {
          q.value = it.title;
          try { q.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
          sec.scrollIntoView({ block: "start" });
          landed.done = true;
        }
        return;
      }
      if (window.XApp && XApp.reveal && XApp.reveal(it)) { landed.done = true; return; }
      var card = cardOf(it);
      if (card) { highlight(card, scroll); landed.card = card; landed.done = true; }
    }
    setTimeout(function () { go(true); }, 450);
    // The live Sheet may redraw the cards a moment later: put the outline back if it was lost
    [1800, 3800].forEach(function (ms) {
      setTimeout(function () {
        if (landed.ent) { if (!landed.done) go(true); return; }
        if (!landed.card || !document.contains(landed.card)) {
          var it = findBySlug(landed.s), c = it && cardOf(it);
          if (c && (!window.XApp || !XApp.isApp || !XApp.isApp())) { var r = c.getBoundingClientRect(); highlight(c, r.bottom < 0 || r.top > innerHeight); landed.card = c; }
          else if (!landed.done) go(true);
        }
      }, ms);
    });
  }

  // Wire up
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-otb-share]") : null;
    if (!b) return;
    ev.preventDefault();
    open(itemFromBtn(b), b);
  });
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", function () { if (layer && !layer.hidden) sizePreview(); });
  var queued = 0;
  function queue() { if (queued) return; queued = setTimeout(function () { queued = 0; try { attach(); } catch (e) {} }, 60); }
  function start() {
    try { attach(); } catch (e) {}
    if (window.MutationObserver) new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
    land();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.XNext = {
    slug: slug, items: items, entities: entities, findBySlug: findBySlug, itemFor: itemFor, cardItem: cardItem, cardOf: cardOf,
    pillarsOf: pillarsOf, visuals: V, extra: extra, today: todayDate, issueRow: issueRow, rows: rows, D: D, dateLong: dateLong, dateShort: dateShort,
    PILLARS: PILLAR_ORDER, PILLAR_SHORT: PILLAR_SHORT, PILLAR_INI: PILLAR_INI, esc: esc, str: str, d10: d10, txt: txt, clip: clip, highlight: highlight
  };
  window.XShare = { open: open, close: close, attach: attach, items: items, entities: entities, model: model, renderCard: renderCard, btn: btn, url: shareUrl, findBySlug: findBySlug };
})();
