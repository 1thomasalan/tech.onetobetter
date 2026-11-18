/* The Tech Brief: app-style phone layout (approved by Alan 2026-11-14; no push or alerts).
   Below 1024px wide the page becomes an app: a slim header (text size, theme, Paper), bottom tabs
   Today · Library · Directory · Saved, a Today screen (date + issue, the Bottom line as a headline, the pillar pulse,
   the top 5 as swipe cards with Tell me more and Share, shortcuts to Releases, Business, GitHub and Research),
   a mini player for the podcast that keeps playing while you read, story bottom sheets (no page jumps),
   a thin reading-progress line and pull to refresh. Fold-aware: two columns from about 700px (inner display open).
   Desktop (1024px and up) keeps the current layout. Paper view, PDF and the podcast itself are unchanged.
   Needs otb-share.js (window.XNext). Works without localStorage (the Hark preview) and without a service worker. */
(function () {
  "use strict";
  var X = window.XNext;
  if (!X) return;
  var esc = X.esc, str = X.str;
  var H = document.documentElement;
  var MQ = window.matchMedia ? matchMedia("(max-width: 1023px)") : { matches: false };
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BASE = "https://tech.onetobetter.com";
  // Mobile v2 (Alan, 2026-11-16): Today · Explore · Library · Saved. Explore = who and where (directory, pillars, map, graph,
  // pulse, star race, story arcs); Library = past issues (issues, archive, covers, glossary).
  var GROUPS = {
    today: ["today", "stories", "releases", "ai-business", "github", "research"],
    explore: ["directory", "pillars", "pulse", "map", "graph", "star-race", "arcs"],
    library: ["issues", "archive", "covers", "glossary"],
    saved: ["following"]
  };
  var SUBS = ["releases", "ai-business", "github", "research"];
  var TABS = [
    ["today", "Today", '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>'],
    ["explore", "Explore", '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'],
    ["library", "Library", '<path d="M5 4h4v16H5zM10.5 4h4v16h-4zM16 5.2l3.6-1 3.4 15.5-3.6.9z" transform="translate(-1 0)"/>'],
    ["saved", "Saved", '<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z"/>']
  ];
  function groupOf(id) { for (var g in GROUPS) if (GROUPS[g].indexOf(id) >= 0) return g; return ""; }
  function $(id) { return document.getElementById(id); }
  var store = null;
  try { var t = "__otb_app"; localStorage.setItem(t, "1"); localStorage.removeItem(t); store = localStorage; } catch (e) { store = null; }
  function get(k) { try { return store ? store.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { try { if (store) store.setItem(k, v); } catch (e) {} }

  var on = false, tab = "today", scrollMem = {};
  function isApp() { return on; }

  // ---------- App chrome ----------
  var head, tabsEl, player, audio, ptr, prog, built = false;
  function svg(p, w) { return '<svg viewBox="0 0 24 24" width="' + (w || 22) + '" height="' + (w || 22) + '" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + p + "</g></svg>"; }
  function logoSrc() { var i = document.querySelector("img.x-logo-l"); return (i && i.getAttribute("src")) || "otb-logo-160.png"; }
  function logoDark() { var i = document.querySelector("img.x-logo-d"); return (i && i.getAttribute("src")) || ""; }
  function build() {
    if (built) return;
    built = true;
    head = document.createElement("header");
    head.id = "otb-apphead";
    head.className = "otba-head";
    head.innerHTML = '<a class="otba-brand" href="#today" data-otba-tab="today" aria-label="The Tech Brief, Today"><img class="otba-logo otba-logo--l" src="' + esc(logoSrc()) + '" alt="" width="24" height="24" />' +
      (logoDark() ? '<img class="otba-logo otba-logo--d" src="' + esc(logoDark()) + '" alt="" width="24" height="24" />' : "") + '<span>The Tech Brief</span></a>' +
      '<div class="otba-tools">' +
      '<button type="button" class="otba-ic" id="otba-text" aria-label="Reading settings" aria-haspopup="true" aria-expanded="false" aria-controls="otba-sizes">' + svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>', 20) + "</button>" +
      "</div>" +
      '<div class="otba-sizes otbm-set" id="otba-sizes" role="group" aria-label="Reading settings" hidden>' +
      '<p class="otbm-set__l">Text size</p><div class="otbm-set__row">' +
      [["0.9", "Smaller"], ["1", "Default"], ["1.12", "Larger"], ["1.25", "Largest"]].map(function (s, i) {
        return '<button type="button" data-otba-size="' + s[0] + '" aria-label="' + s[1] + ' text" style="font-size:' + (13 + i * 3) + 'px">A</button>';
      }).join("") + "</div>" +
      '<div class="otbm-set__row otbm-set__row--2">' +
      '<button type="button" class="otbm-set__b" id="otba-theme" aria-label="Switch to dark mode">' + svg('<path class="otba-moon" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/><g class="otba-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g>', 18) + '<span class="otbm-theme-t">Dark mode</span></button>' +
      '<button type="button" class="otbm-set__b" id="otba-paper" aria-label="Paper view">' + svg('<path d="M4 5h13v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v9a2 2 0 0 1-4 0M7 9h7M7 12.5h7M7 16h4"/>', 18) + "<span>Paper view</span></button>" +
      "</div></div>" +
      '<div class="otba-prog" aria-hidden="true"><i></i></div>';
    document.body.insertBefore(head, document.body.firstChild);
    prog = head.querySelector(".otba-prog i");

    tabsEl = document.createElement("nav");
    tabsEl.id = "otb-tabs";
    tabsEl.className = "otba-tabs";
    tabsEl.setAttribute("aria-label", "Sections");
    tabsEl.innerHTML = TABS.map(function (t) {
      return '<a href="#' + GROUPS[t[0]][0] + '" class="otba-tab" data-otba-tab="' + t[0] + '">' + svg(t[2]) + "<span>" + t[1] + '</span><b class="otba-badge" hidden></b></a>';
    }).join("");
    document.body.appendChild(tabsEl);

    ptr = document.createElement("div");
    ptr.id = "otb-ptr";
    ptr.className = "otba-ptr";
    ptr.setAttribute("aria-hidden", "true");
    ptr.innerHTML = '<span class="otba-ptr__i">' + svg('<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/>', 18) + '</span><span class="otba-ptr__t">Pull to refresh</span>';
    document.body.appendChild(ptr);

    head.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("button, a") : null;
      if (!b) return;
      if (b.id === "otba-theme") { var t = $("x-theme"); if (t) t.click(); syncTheme(); }
      else if (b.id === "otba-paper") { var p = $("paperToggle"); if (p) p.click(); }
      else if (b.id === "otba-text") { var s = $("otba-sizes"), open = s.hidden; s.hidden = !open; b.setAttribute("aria-expanded", open ? "true" : "false"); markSize(); }
      else if (b.hasAttribute("data-otba-size")) { setSize(b.getAttribute("data-otba-size")); }
    });
    document.addEventListener("click", function (ev) {
      var s = $("otba-sizes");
      if (s && !s.hidden && !(ev.target.closest && ev.target.closest("#otba-sizes, #otba-text"))) { s.hidden = true; $("otba-text").setAttribute("aria-expanded", "false"); }
    });
    buildPlayer();
    libNav();
    syncTheme();
    var mo = window.MutationObserver ? new MutationObserver(syncTheme) : null;
    if (mo) mo.observe(H, { attributes: true, attributeFilter: ["data-theme"] });
  }
  // Library tab: a chip row to its parts (Explore and Library sections)
  function libNav() {
    var NAVS = {
      explore: [["directory", "Directory"], ["pillars", "Pillars"], ["map", "Map"], ["graph", "Graph"], ["pulse", "Pulse"], ["star-race", "Star race"], ["arcs", "Story arcs"]],
      library: [["issues", "Past issues"], ["archive", "Archive"], ["covers", "Covers"], ["glossary", "Glossary"]]
    };
    Object.keys(NAVS).forEach(function (g) {
      if ($("otb-libnav-" + g)) return;
      var have = NAVS[g].filter(function (x) { return $(x[0]); });
      if (!have.length) return;
      var first = have.map(function (x) { return $(x[0]); }).sort(function (p, q) { return p.compareDocumentPosition(q) & 4 ? -1 : 1; })[0];
      var n = document.createElement("nav");
      n.id = "otb-libnav-" + g;
      n.className = "otba-libnav otbm-libnav";
      n.setAttribute("data-otbm-group", g);
      n.setAttribute("aria-label", g === "explore" ? "Explore" : "Library");
      n.innerHTML = '<h2 class="otbm-tabh">' + (g === "explore" ? "Explore" : "Library") + '</h2><div class="otba-secs otba-secs--wrap">' + have.map(function (x) { return '<a class="otba-sec" href="#' + x[0] + '">' + x[1] + "</a>"; }).join("") + "</div>";
      first.parentNode.insertBefore(n, first);
    });
  }
  function syncTheme() {
    var b = $("otba-theme");
    if (!b) return;
    var dark = H.getAttribute("data-theme") === "dark";
    b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    b.classList.toggle("is-dark", dark);
    var t = b.querySelector(".otbm-theme-t");
    if (t) t.textContent = dark ? "Light mode" : "Dark mode";
  }

  // Text size (applies to the reading area and the sheets on phones)
  var size = parseFloat(get("otb-text-size") || "1") || 1;
  function setSize(v) {
    size = Math.max(0.85, Math.min(1.3, parseFloat(v) || 1));
    set("otb-text-size", String(size));
    applySize();
    markSize();
  }
  function applySize() { H.style.setProperty("--otb-zoom", on ? String(size) : "1"); H.classList.toggle("otba-zoomed", on && size !== 1); }
  function markSize() {
    [].forEach.call(document.querySelectorAll("[data-otba-size]"), function (b) { b.setAttribute("aria-pressed", Math.abs(parseFloat(b.getAttribute("data-otba-size")) - size) < 0.01 ? "true" : "false"); });
  }

  // ---------- Tabs ----------
  function markTabs() {
    [].forEach.call(document.querySelectorAll("#otb-tabs [data-otba-tab]"), function (a) {
      var me = a.getAttribute("data-otba-tab") === tab;
      a.classList.toggle("is-on", me);
      if (me) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function setTab(name, opts) {
    opts = opts || {};
    if (!GROUPS[name]) return;
    if (!on) { tab = name; return; }
    if (name === tab && !opts.force) { if (sub && name === "today") { setSub(""); return; } if (opts.top) scrollTop(); return; }
    if (sub) setSub("", { noScroll: true });
    scrollMem[tab] = window.scrollY;
    tab = name;
    H.setAttribute("data-otba-tab", name);
    markTabs();
    if (!opts.keepScroll) window.scrollTo(0, opts.top ? 0 : (scrollMem[name] || 0));
    try { window.dispatchEvent(new Event("resize")); } catch (e) {}
    progress();
  }
  function scrollTop() { try { window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" }); } catch (e) { window.scrollTo(0, 0); } }
  function sectionOf(el) {
    var n = el;
    while (n && n !== document.body) {
      if (n.tagName === "SECTION" && n.parentNode && n.parentNode.classList && n.parentNode.classList.contains("main")) return n;
      n = n.parentNode;
    }
    return null;
  }
  // Anything that scrolls a section into view (map "Show in directory", cover taps, nav links) switches tabs first
  var origSIV = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function () {
    if (on) {
      var sec = sectionOf(this), g = sec ? groupOf(sec.id) : "";
      if (g && g !== tab) setTab(g, { keepScroll: true });
      if (sec && SUBS.indexOf(sec.id) >= 0 && sub !== sec.id) setSub(sec.id, { noScroll: true });
    }
    return origSIV.apply(this, arguments);
  };
  document.addEventListener("click", function (ev) {
    if (!on) return;
    var a = ev.target.closest ? ev.target.closest("a[href^='#'], a[data-otba-tab]") : null;
    if (!a || a.hasAttribute("data-otba-open")) return;
    var t = a.getAttribute("data-otba-tab");
    if (t) { ev.preventDefault(); setTab(t, { top: t === tab }); return; }
    var id = (a.getAttribute("href") || "").slice(1), el = id && $(id);
    if (!el) return;
    var sec = sectionOf(el) || el, g = groupOf(sec.id);
    if (g && g !== tab) {
      ev.preventDefault();
      setTab(g, { keepScroll: true });
      if (SUBS.indexOf(sec.id) >= 0) { setSub(sec.id); if (el !== sec) setTimeout(function () { jump(el); }, 20); return; }
      setTimeout(function () { jump(el); }, 20);
    } else if (g) {
      ev.preventDefault();
      if (SUBS.indexOf(sec.id) >= 0 && sub !== sec.id) { setSub(sec.id); if (el !== sec) setTimeout(function () { jump(el); }, 20); return; }
      jump(el);
    }
  }, true);
  function headH() { return head && on ? head.offsetHeight : 0; }
  function jump(el) {
    var y = el.getBoundingClientRect().top + window.scrollY - headH() - 8;
    try { window.scrollTo({ top: Math.max(0, y), behavior: REDUCED ? "auto" : "smooth" }); } catch (e) { window.scrollTo(0, y); }
  }
  window.addEventListener("hashchange", function () {
    if (!on) return;
    var el = $(location.hash.slice(1)), sec = el && (sectionOf(el) || el), g = sec && groupOf(sec.id);
    if (g && g !== tab) setTab(g, { keepScroll: true });
    if (sec && SUBS.indexOf(sec.id) >= 0) { if (sub !== sec.id) setSub(sec.id); if (el !== sec) setTimeout(function () { jump(el); }, 20); return; }
    if (g) setTimeout(function () { jump(el); }, 20);
  });
  // The Saved count follows the page's own badge
  function syncBadge() {
    var src = document.querySelector('.nav a[href="#following"] .x-badge'), b = document.querySelector('#otb-tabs [data-otba-tab="saved"] .otba-badge');
    if (!b) return;
    var n = src ? str(src.textContent) : "";
    b.hidden = !n;
    b.textContent = n;
    var a = b.parentNode;
    a.setAttribute("aria-label", "Saved" + (n ? ", " + n + " saved" : ""));
  }

  // ---------- Today screen (mobile v2, Alan 2026-11-16) ----------
  // Date + AI-curated pill; the Bottom line card (one-sentence headline, Listen, Read in N min); Today's top 3 as photo
  // swipe cards; today's stories by pillar as one chip row; "More in today's issue" rows with small thumbnails that open
  // each section as its own screen. Phone data (short headlines, top 3, pictures) comes from visuals.json "mobile".
  function todayRow() { var d = X.today(); return X.issueRow(d) || {}; }
  function blParts(row) { try { return window.XBlufFor ? XBlufFor(row) : { bl: str(row["Day bottom line"]), pv: [] }; } catch (e) { return { bl: str(row["Day bottom line"]), pv: [] }; } }
  function splitFirst(t) {
    t = str(t);
    var m = /^([\s\S]{20,}?[.!?])(\s+[A-Z\u201c"\u2018(][\s\S]*)?$/.exec(t);
    return m ? [m[1], str(m[2])] : [t, ""];
  }
  function mob(d) { var m = X.visuals().mobile; return (m && m[d || X.today()]) || {}; }
  function ik(it) { return it.type + "|" + it.title; }
  function imgUrl(p) { return !p ? "" : /^https?:/.test(p) ? p : (location.hostname === "tech.onetobetter.com" || window.OTB_AUDIO_LOCAL ? "" : BASE) + p; }
  function imgOf(it) { var m = mob(it.date); return imgUrl(m.img && m.img[ik(it)]); }
  function shortOf(it) { var m = mob(it.date); return str(m.short && m.short[ik(it)]) || it.title; }
  function img(src, alt, cls) { return src ? '<img class="' + (cls || "") + '" src="' + esc(src) + '" alt="' + esc(alt || "") + '" loading="lazy" decoding="async" onerror="this.parentNode&&this.parentNode.classList.add(\'otbm-noimg\');this.remove()" />' : ""; }
  var PL = [["AI", "AI", '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'],
    ["Robotics", "Robotics", '<rect x="5" y="8" width="14" height="10" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01"/>'],
    ["Advanced manufacturing", "Manufacturing", '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'],
    ["Biotechnology", "Biotech", '<path d="M8 3c0 6 8 6 8 12M16 3c0 6-8 6-8 12M8 21c0-2 1-3 2-4M16 21c0-2-1-3-2-4M9 7h6M9 13h6"/>'],
    ["Energy", "Energy", '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'],
    ["Semiconductors", "Chips", '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>']];
  function plLabel(p) { var x = PL.filter(function (q) { return q[0] === p; })[0]; return x ? x[1] : p; }
  function readMin(d, r) {
    var t = [r.bl].concat((r.pv || []).map(function (x) { return str(x.text); }));
    X.items(d).forEach(function (it) { var w = it.row || {}; t.push(str(w["Bottom line"]), str(w["So what"])); });
    var words = t.join(" ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  }
  var heroKey = "";
  function drawHero() {
    var sec = $("today");
    if (!sec) return;
    var hero = $("otb-today");
    if (!hero) {
      hero = document.createElement("div");
      hero.id = "otb-today";
      hero.className = "otba-hero otbm-hero";
      sec.insertBefore(hero, sec.firstChild);
      hero.addEventListener("click", heroClick);
    }
    var row = todayRow(), d = X.today(), r = blParts(row), m = mob(d), a = audioUrl();
    var stories = X.items(d).filter(function (x) { return x.type === "Story"; });
    var top = topOf(stories, m);
    var key = d + "|" + r.bl + "|" + JSON.stringify(r.pv) + "|" + str(row.Issue) + "|" + JSON.stringify(m) + "|" + (a ? a.sec : "");
    if (key === heroKey) return;
    heroKey = key;
    var two = splitFirst(r.bl), h1 = str(m.bluf_short) || two[0], dek = str(m.bluf_dek) || (m.bluf_short ? "" : two[1]);
    var date = X.dateLong(d).replace(/^(\w{3}), (\w{3}) (\d+), \d{4}$/, "$1, $2 $3");
    var thumbs = top.map(imgOf).filter(Boolean).slice(0, 3);
    var disc = document.querySelector(".x-disclaim");
    var dtext = disc ? str(disc.textContent) : "Curated and checked with AI. AI can make mistakes, so check the sources on anything important.";
    var h = '<div class="otbm-dl"><p class="otba-date">' + esc(date) + (str(row.Issue) ? " \u00b7 Issue " + esc(row.Issue) : "") + "</p>" +
      '<button type="button" class="otbm-pill" aria-expanded="false" aria-controls="otbm-disc"><i aria-hidden="true"></i>AI-curated</button></div>' +
      '<p class="otbm-disc" id="otbm-disc" hidden>' + esc(dtext) + "</p>" +
      '<div class="otbm-blc"><div class="otbm-ebrow"><p class="otba-k">The bottom line</p>' +
      (thumbs.length ? '<span class="otbm-trio" aria-hidden="true">' + thumbs.map(function (u) { return img(u, ""); }).join("") + "</span>" : "") + "</div>" +
      '<h1 class="otba-h1 otbm-h1">' + esc(h1) + "</h1>" + (dek ? '<p class="otbm-dek">' + esc(dek) + "</p>" : "") +
      '<div class="otbm-ctas">' + (a ? '<button type="button" class="otbm-listen" data-otbm="listen"><svg viewBox="0 0 10 12" width="12" height="12" aria-hidden="true"><path d="M0 0l10 6-10 6z" fill="currentColor"/></svg>Listen' + (mins(a.sec) ? " \u00b7 " + mins(a.sec) : "") + "</button>" : "") +
      '<button type="button" class="otbm-read" data-otbm="read">Read in ' + readMin(d, r) + " min</button></div></div>";
    hero.innerHTML = h;
  }
  function heroClick(ev) {
    var b = ev.target.closest ? ev.target.closest("button") : null;
    if (!b) return;
    if (b.classList.contains("otbm-pill")) { var p = $("otbm-disc"), o = p.hidden; p.hidden = !o; b.setAttribute("aria-expanded", o ? "true" : "false"); return; }
    var w = b.getAttribute("data-otbm");
    if (w === "listen") { listen(); }
    else if (w === "read") { readSheet(b); }
  }
  function readSheet(from) {
    var row = todayRow(), r = blParts(row), m = mob();
    var h = '<div class="otbm-read-s"><p class="otba-k">The bottom line</p><h2 class="otbm-rh">' + esc(str(m.bluf_short) || splitFirst(r.bl)[0]) + "</h2>" +
      '<p class="otbm-rp">' + esc(r.bl) + "</p>" +
      (r.pv && r.pv.length ? r.pv.map(function (x) { return '<div class="otbm-rpart"><p class="otba-k">' + esc(str(x.label)) + '</p><p class="otbm-rp">' + esc(str(x.text)) + "</p></div>"; }).join("") : "");
    var pdf = $("btn-pdf");
    if (pdf && !pdf.hidden && /^https?:/.test(pdf.getAttribute("href") || "")) h += '<p class="otba-links"><a class="otba-link" href="' + esc(pdf.getAttribute("href")) + '" target="_blank" rel="noopener">Read today\u2019s PDF \u2197</a></p>';
    openHtml(h + "</div>", "The bottom line", from);
  }
  function topOf(stories, m) {
    var idx = Array.isArray(m.top3) && m.top3.length ? m.top3 : [0, 1, 2], out = [];
    idx.forEach(function (i) { var s = stories.filter(function (x) { return x.index === i; })[0]; if (s && out.indexOf(s) < 0) out.push(s); });
    stories.forEach(function (s) { if (out.length < Math.min(3, stories.length) && out.indexOf(s) < 0) out.push(s); });
    return out.slice(0, 3);
  }
  function savedOf(it) {
    var c = X.cardOf(it), i = c && c.querySelector("input[data-follow]");
    return i || null;
  }
  var BM = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  var CHEV = '<svg class="otbm-chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var railKey = "";
  function drawRail() {
    var sec = $("today");
    if (!sec) return;
    var wrap = $("otb-railwrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "otb-railwrap";
      wrap.className = "otba-railwrap otbm-wrap";
      var hero = $("otb-today");
      sec.insertBefore(wrap, hero ? hero.nextSibling : sec.firstChild);
      wrap.addEventListener("click", wrapClick);
    } else {
      var hero2 = $("otb-today");
      if (hero2 && hero2.nextSibling !== wrap) sec.insertBefore(wrap, hero2.nextSibling);
    }
    var d = X.today(), all = X.items(d), m = mob(d);
    var stories = all.filter(function (x) { return x.type === "Story"; });
    var top = topOf(stories, m), rest = stories.filter(function (s) { return top.indexOf(s) < 0; });
    var glr = X.rows("Glossary").filter(function (g) { return str(g["First seen"]).slice(0, 10) === d; }), gl = glr.length;
    var key = d + "|" + all.map(function (x) { return x.slug; }).join(",") + "|" + JSON.stringify(m) + "|" + gl;
    if (key === railKey && wrap.firstChild) { syncMarks(); return; }
    railKey = key;
    // Top 3
    var h = '<div class="otbm-sh"><h2>Today\u2019s top ' + top.length + '</h2><span class="otbm-pos" aria-hidden="true">1 of ' + top.length + "</span></div>" +
      '<div class="otba-rail otbm-rail" role="list" aria-label="Today\u2019s top stories" tabindex="0">';
    top.forEach(function (it, i) {
      var kn = m.kn && m.kn[ik(it)], pics = imgOf(it), pls = X.pillarsOf(it.type, it.date, it.title), pl = pls[1] || pls[0] || "AI";
      var co = m.co && m.co[ik(it)];
      h += '<article class="otbm-card' + (pics ? "" : " otbm-noimg") + '" role="listitem" data-otb-item="' + esc(it.slug) + '">' +
        '<div class="otbm-band">' + img(pics, "") +
        (kn ? '<p class="otbm-kn"><b>' + esc(kn.n) + "</b><span>" + esc(kn.label) + "</span></p>" : "") +
        '<span class="otbm-tag' + (pl === "AI" ? " otbm-tag--ai" : "") + '">' + esc(plLabel(pl)) + "</span></div>" +
        '<div class="otbm-cb"><h3 class="otbm-ct"><a href="#stories" data-otba-open="' + esc(it.slug) + '">' + esc(shortOf(it)) + "</a></h3>" +
        '<div class="otbm-meta"><span>' + (co ? esc(co) + " \u00b7 " : "") + (i + 1) + " of " + top.length + '</span>' +
        '<button type="button" class="otbm-save" data-otbm-save="' + esc(it.slug) + '" aria-pressed="false" aria-label="Save ' + esc(shortOf(it)) + '">' + BM + "</button></div></div></article>";
    });
    h += '</div><div class="otba-dots otbm-dots" aria-hidden="true">' + top.map(function (x, i) { return "<i" + (i ? "" : ' class="is-on"') + "></i>"; }).join("") + "</div>";
    // Pillars today
    var cnt = {};
    stories.forEach(function (s) { X.pillarsOf("Story", d, s.title).forEach(function (p) { cnt[p] = (cnt[p] || 0) + 1; }); });
    h += '<div class="otbm-sh"><h2>Today across the pillars</h2><a class="otbm-shl" href="#pillars">What\u2019s this?</a></div>' +
      '<div class="otbm-pulse"><p class="otba-k">Stories today, by pillar</p><div class="otbm-chips">' + PL.map(function (p) {
        var n = cnt[p[0]] || 0;
        return '<span class="otbm-chip' + (n ? "" : " is-zero") + '">' + svg(p[2], 14) + esc(p[1]) + (n ? " <b>" + n + "</b>" : " " + n) + "</span>";
      }).join("") + "</div></div>";
    // More in today's issue
    function stack(list, cls) {
      var u = list.map(imgOf).filter(Boolean).slice(0, 3);
      return '<span class="otbm-stack ' + (cls || "") + (u.length === 1 ? " is-one" : "") + '" aria-hidden="true">' + (u.length ? u.map(function (x) { return img(x, ""); }).join("") : '<span class="otbm-ph"></span>') + "</span>";
    }
    function names(list, f) { return list.map(f).filter(Boolean).join(", "); }
    var by = function (t) { return all.filter(function (x) { return x.type === t; }); };
    var rows = [];
    if (rest.length) rows.push(["stories", "More stories", rest.length, names(rest, function (x) { return shortOf(x); }), stack(rest)]);
    [["Release", "releases", "New to try", "", function (x) { return x.title; }],
     ["Business", "ai-business", "AI & small business", "", function (x) { return shortOf(x) !== x.title ? shortOf(x) : str((x.row || {}).Business) || x.title; }],
     ["Repo", "github", "Hot on GitHub", "is-round", function (x) { return x.title.split("/").pop(); }],
     ["Paper", "research", "Research", "is-paper", function (x) { return shortOf(x) !== x.title ? shortOf(x) : x.title.split(":")[0]; }]].forEach(function (k) {
      var l = by(k[0]);
      if (l.length) rows.push([k[1], k[2], l.length, names(l, k[4]), stack(l, k[3])]);
    });
    rows.push(["glossary", "Words to know", gl, gl ? "New terms in today\u2019s issue" : "Every term so far", '<span class="otbm-stack is-one" aria-hidden="true"><span class="otbm-aa">Aa</span></span>']);
    h += '<div class="otbm-sh"><h2>More in today\u2019s issue</h2></div><div class="otbm-list">' + rows.map(function (r) {
      var inner = r[4] + '<span class="otbm-rt"><b>' + esc(r[1]) + (r[2] ? "<em>" + r[2] + "</em>" : "") + "</b><small>" + esc(r[3]) + "</small></span>" + CHEV;
      if (r[0] === "stories") {
        return '<details class="otbm-row otbm-more"><summary class="otbm-rowi">' + inner + '</summary><div class="otbm-mini">' + rest.map(function (it) {
          var u = imgOf(it);
          return '<a class="otbm-minii" href="#stories" data-otba-open="' + esc(it.slug) + '">' + (u ? '<span class="otbm-stack is-one" aria-hidden="true">' + img(u, "") + "</span>" : "") + "<span>" + esc(shortOf(it)) + "</span></a>";
        }).join("") + "</div></details>";
      }
      if (r[0] === "glossary" && gl) {
        return '<details class="otbm-row otbm-more otbm-gl"><summary class="otbm-rowi">' + inner + '</summary><div class="otbm-mini otbm-terms">' + glr.map(function (g) {
          return '<div class="otbm-term"><b>' + esc(str(g.Term)) + '</b><span>' + esc(str(g.Meaning)) + '</span></div>';
        }).join("") + '<a class="otbm-allterms" href="#glossary" data-otbm-row="glossary">See all terms</a></div></details>';
      }
      return '<a class="otbm-row otbm-rowi" href="#' + r[0] + '" data-otbm-row="' + r[0] + '">' + inner + "</a>";
    }).join("") + "</div>";
    wrap.innerHTML = h;
    var rail = wrap.querySelector(".otbm-rail");
    rail.addEventListener("scroll", dots, { passive: true });
    dots();
    syncMarks();
  }
  function syncMarks() {
    [].forEach.call(document.querySelectorAll("[data-otbm-save]"), function (b) {
      var it = X.findBySlug(b.getAttribute("data-otbm-save")), i = it && savedOf(it), on = !!(i && i.checked);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("is-on", on);
      b.hidden = !i;
    });
  }
  function wrapClick(ev) {
    var b = ev.target.closest ? ev.target.closest("[data-otbm-save]") : null;
    if (b) {
      ev.preventDefault(); ev.stopPropagation();
      var it = X.findBySlug(b.getAttribute("data-otbm-save")), i = it && savedOf(it);
      if (i) { i.click(); setTimeout(syncMarks, 30); }
      return;
    }
    var r = ev.target.closest ? ev.target.closest("[data-otbm-row]") : null;
    if (r) {
      var id = r.getAttribute("data-otbm-row");
      ev.preventDefault(); ev.stopPropagation();
      if (id === "glossary") { setTab("library", { keepScroll: true }); setTimeout(function () { var g = $("glossary"); if (g) jump(g); }, 20); return; }
      setSub(id);
    }
  }
  var dotT = 0;
  function dots() {
    clearTimeout(dotT);
    dotT = setTimeout(function () {
      var rail = document.querySelector("#otb-railwrap .otbm-rail");
      if (!rail) return;
      var cards = [].filter.call(rail.children, function (c) { return c.offsetParent !== null; }), best = 0, bd = 1e9, rl = rail.getBoundingClientRect().left;
      cards.forEach(function (c, i) { var dd = Math.abs(c.getBoundingClientRect().left - rl - 16); if (dd < bd) { bd = dd; best = i; } });
      cards.forEach(function (c, i) { c.classList.toggle("is-on", i === best); });
      var ds = document.querySelectorAll("#otb-railwrap .otba-dots i");
      [].forEach.call(ds, function (dd, i) { dd.classList.toggle("is-on", i === best); dd.hidden = i >= cards.length; });
      var pos = document.querySelector("#otb-railwrap .otbm-pos");
      if (pos) pos.textContent = (best + 1) + " of " + cards.length;
    }, 40);
  }
  // One section as its own screen (Releases, AI & small business, GitHub, Research), with a back bar to Today
  var sub = "", subY = 0, subBar = null;
  var SUBNAME = { releases: "New to try", "ai-business": "AI & small business", github: "Hot on GitHub", research: "Research" };
  function setSub(id, opts) {
    opts = opts || {};
    if (!on) return;
    if (id && SUBS.indexOf(id) < 0) return;
    if (id && !sub) subY = window.scrollY;
    sub = id || "";
    [].forEach.call(document.querySelectorAll(".otba-subon"), function (n) { n.classList.remove("otba-subon"); });
    if (sub) {
      var el = $(sub);
      if (el) el.classList.add("otba-subon");
      if (!subBar) {
        subBar = document.createElement("div");
        subBar.id = "otbm-subbar";
        subBar.className = "otbm-subbar";
        subBar.innerHTML = '<button type="button" class="otbm-back"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Today</button><span class="otbm-subt"></span>';
        subBar.querySelector("button").addEventListener("click", function () { setSub(""); });
      }
      var t = $("today");
      if (t && t.parentNode && subBar.parentNode !== t.parentNode) t.parentNode.insertBefore(subBar, t);
      subBar.querySelector(".otbm-subt").textContent = SUBNAME[sub] || "";
      H.setAttribute("data-otba-sub", sub);
      if (!opts.noScroll) window.scrollTo(0, 0);
    } else {
      H.removeAttribute("data-otba-sub");
      if (!opts.noScroll) window.scrollTo(0, subY || 0);
    }
    try { window.dispatchEvent(new Event("resize")); } catch (e) {}
    progress();
  }

  // ---------- Story bottom sheet: the full card, moved in and put back on close ----------
  var sheetL, sheetBody, moved = null, sheetOpener = null, sheetCloseT = 0;
  function buildSheet() {
    sheetL = document.createElement("div");
    sheetL.id = "otb-story";
    sheetL.className = "x-dig-layer otba-sheet";
    sheetL.hidden = true;
    sheetL.innerHTML = '<div class="x-dig-scrim" data-otba-close></div><div class="x-dig-sheet otba-sheet__s" role="dialog" aria-modal="true" aria-label="Story">' +
      '<div class="x-dig-top"><span class="x-dig-handle" aria-hidden="true"></span><button type="button" class="x-dig-x" aria-label="Close" data-otba-close><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
      '<div class="x-dig-body otba-sheet__b"></div></div>';
    document.body.appendChild(sheetL);
    sheetBody = sheetL.querySelector(".otba-sheet__b");
    sheetL.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest("[data-otba-close]")) closeSheet(); });
    dragClose(sheetL.querySelector(".x-dig-top"), sheetL.querySelector(".x-dig-sheet"), closeSheet);
  }
  function openStory(it, from) {
    var card = X.cardOf(it);
    if (!card) return false;
    if (!sheetL) buildSheet();
    clearTimeout(sheetCloseT);
    putBack();
    var mark = document.createComment("otb-story-slot");
    card.parentNode.insertBefore(mark, card);
    moved = { card: card, mark: mark };
    sheetBody.innerHTML = "";
    sheetL.querySelector(".x-dig-sheet").setAttribute("aria-label", "Story");
    sheetBody.appendChild(card);
    card.classList.add("otba-incard");
    sheetOpener = from || document.activeElement;
    sheetL.hidden = false;
    H.style.overflow = "hidden";
    var page = document.querySelector(".page");
    if (page) page.setAttribute("inert", "");
    void sheetL.offsetWidth;
    sheetL.classList.add("is-open");
    sheetBody.scrollTop = 0;
    var x = sheetL.querySelector(".x-dig-x");
    if (x) try { x.focus({ preventScroll: true }); } catch (e) {}
    return true;
  }
  // A sheet with its own content (the full Bottom line)
  function openHtml(html, label, from) {
    if (!sheetL) buildSheet();
    clearTimeout(sheetCloseT);
    putBack();
    sheetBody.innerHTML = html;
    sheetL.querySelector(".x-dig-sheet").setAttribute("aria-label", label || "Details");
    sheetOpener = from || document.activeElement;
    sheetL.hidden = false;
    H.style.overflow = "hidden";
    var page = document.querySelector(".page");
    if (page) page.setAttribute("inert", "");
    void sheetL.offsetWidth;
    sheetL.classList.add("is-open");
    sheetBody.scrollTop = 0;
    var x = sheetL.querySelector(".x-dig-x");
    if (x) try { x.focus({ preventScroll: true }); } catch (e) {}
  }
  function putBack() {
    if (!moved) return;
    var m = moved;
    moved = null;
    m.card.classList.remove("otba-incard", "otbs-hit");
    if (m.mark.parentNode) { m.mark.parentNode.insertBefore(m.card, m.mark); m.mark.parentNode.removeChild(m.mark); }
    else if (m.card.parentNode) m.card.parentNode.removeChild(m.card);
  }
  function closeSheet() {
    if (!sheetL || sheetL.hidden) return;
    sheetL.classList.remove("is-open");
    H.style.overflow = "";
    var page = document.querySelector(".page");
    if (page) page.removeAttribute("inert");
    sheetCloseT = setTimeout(function () { sheetL.hidden = true; putBack(); }, REDUCED ? 0 : 280);
    if (sheetOpener && document.contains(sheetOpener)) try { sheetOpener.focus({ preventScroll: true }); } catch (e) {}
  }
  function dragClose(handle, sheet, done) {
    var y0 = null, dy = 0;
    handle.addEventListener("pointerdown", function (ev) {
      if (ev.target.closest && ev.target.closest(".x-dig-x")) return;
      y0 = ev.clientY; dy = 0; sheet.classList.add("is-drag");
      try { handle.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    handle.addEventListener("pointermove", function (ev) { if (y0 == null) return; dy = Math.max(0, ev.clientY - y0); sheet.style.transform = "translateY(" + dy + "px)"; });
    function end() { if (y0 == null) return; y0 = null; sheet.classList.remove("is-drag"); sheet.style.transform = ""; if (dy > 90) done(); }
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
  document.addEventListener("click", function (ev) {
    if (!on) return;
    var t = ev.target.closest ? ev.target : null;
    if (!t) return;
    var o = t.closest("[data-otba-open]");
    if (o) { ev.preventDefault(); openStory(X.findBySlug(o.getAttribute("data-otba-open")), o); return; }
    var card = t.closest(".otba-card, .otbm-card");
    if (card && !t.closest("button, a")) openStory(X.findBySlug(card.getAttribute("data-otb-item")), card);
  });
  document.addEventListener("keydown", function (ev) {
    if ((ev.key === "Escape" || ev.key === "Esc") && sheetL && !sheetL.hidden) {
      var other = [].some.call(document.querySelectorAll(".x-dig-layer:not(#otb-story)"), function (l) { return !l.hidden; });
      if (!other) { ev.preventDefault(); closeSheet(); }
    }
  });
  // Landing from a shared link on a phone: a top story opens in its sheet, anything else scrolls into view on Today
  function reveal(it) {
    if (!on || !it) return false;
    setTab(it.date === X.today() && groupOf(it.anchor) ? groupOf(it.anchor) : "today", { keepScroll: true });
    if (it.type === "Story") {
      if (!openStory(it)) return false;
      var c = moved && moved.card;
      if (c) { c.classList.remove("otbs-hit"); void c.offsetWidth; c.classList.add("otbs-hit"); }
      return true;
    }
    var card = X.cardOf(it);
    if (!card) return false;
    X.highlight(card, false);
    jump(card);
    return true;
  }

  // ---------- Mini player ----------
  function audioUrl() {
    var d = X.today(), a = X.visuals().audio;
    a = a && a[d];
    if (a && a.url) return { url: /^https?:/.test(a.url) ? a.url : (location.hostname === "tech.onetobetter.com" || window.OTB_AUDIO_LOCAL ? "" : BASE) + a.url, sec: a.seconds || 0, date: d };
    var p = str(todayRow().Podcast);
    if (/\.mp3(\?|$)/i.test(p)) return { url: p, sec: 0, date: d };
    return null;
  }
  function mins(s) { return s ? Math.max(1, Math.round(s / 60)) + " min" : ""; }
  function clock(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
  var aInfo = null, listened = false;
  // The mini player shows only after Listen is tapped (mobile v2), then stays while you read
  function listen() {
    listened = true;
    if (player) player.removeAttribute("data-closed");
    drawPlayer();
    if (audio && audio.paused) togglePlay();
  }
  function buildPlayer() {
    player = document.createElement("div");
    player.id = "otb-player";
    player.className = "otba-player";
    player.hidden = true;
    player.setAttribute("role", "region");
    player.setAttribute("aria-label", "Podcast player");
    player.innerHTML = '<button type="button" class="otba-play" aria-label="Play today\u2019s podcast"><svg class="otba-i-play" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg><svg class="otba-i-pause" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg></button>' +
      '<div class="otba-pt"><b class="otba-pt__t">Listen</b><span class="otba-pt__s"></span></div>' +
      '<button type="button" class="otba-skip" aria-label="Back 15 seconds">' + svg('<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5"/>', 18) + '<small aria-hidden="true">15</small></button>' +
      '<button type="button" class="otba-px" aria-label="Close the player">' + svg('<path d="M6 6l12 12M18 6 6 18"/>', 16) + "</button>" +
      '<div class="otba-bar" role="slider" tabindex="0" aria-label="Position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>';
    document.body.appendChild(player);
    player.querySelector(".otba-play").addEventListener("click", togglePlay);
    player.querySelector(".otba-skip").addEventListener("click", function () { if (audio) audio.currentTime = Math.max(0, audio.currentTime - 15); });
    player.querySelector(".otba-px").addEventListener("click", function () { if (audio) audio.pause(); player.hidden = true; player.setAttribute("data-closed", "1"); H.classList.remove("otba-has-player"); });
    var bar = player.querySelector(".otba-bar");
    bar.addEventListener("click", function (ev) {
      if (!audio || !audio.duration) return;
      var r = bar.getBoundingClientRect();
      audio.currentTime = audio.duration * Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    });
    bar.addEventListener("keydown", function (ev) {
      if (!audio) return;
      if (ev.key === "ArrowRight") { audio.currentTime += 10; ev.preventDefault(); }
      if (ev.key === "ArrowLeft") { audio.currentTime -= 10; ev.preventDefault(); }
    });
  }
  function drawPlayer() {
    if (!player) return;
    var a = audioUrl();
    if (!a || !listened || player.getAttribute("data-closed")) { player.hidden = true; H.classList.remove("otba-has-player"); return; }
    if (!aInfo || aInfo.url !== a.url) {
      aInfo = a;
      if (audio) { audio.pause(); audio.removeAttribute("src"); }
      audio = new Audio();
      audio.preload = "none";
      audio.src = a.url;
      audio.addEventListener("play", syncPlay);
      audio.addEventListener("pause", syncPlay);
      audio.addEventListener("ended", syncPlay);
      audio.addEventListener("timeupdate", tick);
      audio.addEventListener("loadedmetadata", tick);
      audio.addEventListener("error", function () { player.querySelector(".otba-pt__s").textContent = "The podcast could not load right now."; });
    }
    player.hidden = false;
    H.classList.add("otba-has-player");
    player.querySelector(".otba-pt__t").textContent = "Listen" + (mins(a.sec) ? " \u00b7 " + mins(a.sec) : "");
    player.querySelector(".otba-pt__s").textContent = "Adam Stone \u00b7 The Tech Brief, " + X.dateShort(a.date).replace(/, \d{4}$/, "");
  }
  function togglePlay() {
    if (!audio) return;
    if (audio.paused) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { player.querySelector(".otba-pt__s").textContent = "Tap play again to start."; });
      media();
    } else audio.pause();
  }
  function syncPlay() {
    var playing = audio && !audio.paused && !audio.ended;
    player.classList.toggle("is-playing", !!playing);
    player.querySelector(".otba-play").setAttribute("aria-label", playing ? "Pause the podcast" : "Play today\u2019s podcast");
  }
  function tick() {
    if (!audio) return;
    var d = audio.duration || (aInfo && aInfo.sec) || 0, pct = d ? (audio.currentTime / d) * 100 : 0;
    player.querySelector(".otba-bar i").style.width = pct.toFixed(2) + "%";
    var bar = player.querySelector(".otba-bar");
    bar.setAttribute("aria-valuenow", String(Math.round(pct)));
    bar.setAttribute("aria-valuetext", clock(audio.currentTime) + " of " + clock(d));
    if (audio.currentTime > 0) player.querySelector(".otba-pt__t").textContent = "Listen \u00b7 " + clock(audio.currentTime) + " / " + clock(d);
  }
  function media() {
    try {
      if (!("mediaSession" in navigator) || !window.MediaMetadata) return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: "The Tech Brief, " + X.dateShort(aInfo.date), artist: "Adam Stone", album: "The Tech Brief by One to Better",
        artwork: [{ src: (location.hostname === "tech.onetobetter.com" ? "" : BASE) + "/icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
      navigator.mediaSession.setActionHandler("play", function () { audio.play(); });
      navigator.mediaSession.setActionHandler("pause", function () { audio.pause(); });
      navigator.mediaSession.setActionHandler("seekbackward", function () { audio.currentTime = Math.max(0, audio.currentTime - 15); });
      navigator.mediaSession.setActionHandler("seekforward", function () { audio.currentTime += 15; });
    } catch (e) {}
  }

  // ---------- Reading progress, pull to refresh ----------
  var progQ = 0;
  function progress() {
    if (progQ) return;
    progQ = requestAnimationFrame(function () {
      progQ = 0;
      if (!prog) return;
      var max = document.documentElement.scrollHeight - innerHeight;
      prog.style.width = (on && max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0).toFixed(2) + "%";
    });
  }
  window.addEventListener("scroll", progress, { passive: true });
  var py0 = null, pdy = 0, pulling = false;
  function anyLayer() { return [].some.call(document.querySelectorAll(".x-dig-layer"), function (l) { return !l.hidden; }) || H.classList.contains("paper"); }
  document.addEventListener("touchstart", function (ev) {
    if (!on || window.scrollY > 0 || anyLayer() || ev.touches.length !== 1) { py0 = null; return; }
    if (ev.target.closest && ev.target.closest(".otba-rail, .x-graph, .x-map, canvas, input, textarea, select")) { py0 = null; return; }
    py0 = ev.touches[0].clientY; pdy = 0; pulling = false;
  }, { passive: true });
  document.addEventListener("touchmove", function (ev) {
    if (py0 == null) return;
    pdy = ev.touches[0].clientY - py0;
    if (pdy <= 0 || window.scrollY > 0) { ptrShow(0); return; }
    pulling = true;
    ptrShow(Math.min(90, pdy * 0.5));
  }, { passive: true });
  document.addEventListener("touchend", function () {
    if (py0 == null) return;
    py0 = null;
    if (pulling && pdy > 150) {
      ptr.classList.add("is-busy");
      ptr.querySelector(".otba-ptr__t").textContent = "Refreshing\u2026";
      setTimeout(function () { location.reload(); }, 250);
    } else ptrShow(0);
    pulling = false;
  });
  function ptrShow(y) {
    if (!ptr) return;
    ptr.style.transform = "translate(-50%," + (y - 56) + "px)";
    ptr.style.opacity = y > 4 ? String(Math.min(1, y / 60)) : "0";
    ptr.querySelector(".otba-ptr__t").textContent = y >= 75 ? "Release to refresh" : "Pull to refresh";
    ptr.classList.toggle("is-ready", y >= 75);
  }

  // ---------- Mode switch and redraws ----------
  function enter() {
    build();
    on = true;
    H.classList.add("x-app");
    if (!H.getAttribute("data-otba-tab")) {
      var id = location.hash.slice(1), el = id && $(id), sec = el && (sectionOf(el) || el), g = sec && groupOf(sec.id);
      tab = g || "today";
    }
    H.setAttribute("data-otba-tab", tab);
    markTabs();
    applySize();
    redraw();
  }
  function leave() {
    on = false;
    closeSheet();
    if (sub) setSub("", { noScroll: true });
    H.classList.remove("x-app", "otba-has-player");
    H.removeAttribute("data-otba-tab");
    applySize();
  }
  function mode() { if (MQ.matches) { if (!on) enter(); } else if (on) leave(); }
  var rq = 0;
  function redraw() {
    rq = 0;
    if (!on) return;
    try { drawHero(); } catch (e) { if (window.console) console.warn(e); }
    try { drawRail(); } catch (e) { if (window.console) console.warn(e); }
    try { drawPlayer(); } catch (e) { if (window.console) console.warn(e); }
    try { syncBadge(); } catch (e) {}
    progress();
  }
  function queue() { if (!rq) rq = setTimeout(redraw, 80); }
  function start() {
    mode();
    if (MQ.addEventListener) MQ.addEventListener("change", mode); else if (MQ.addListener) MQ.addListener(mode);
    var main = document.querySelector(".main"), nav = $("x-nav");
    if (window.MutationObserver) {
      if (main) new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) {
          var n = ms[i].target;
          if (n && n.closest && (n.closest("#otb-today") || n.closest("#otb-railwrap") || n.closest("#otbm-subbar"))) continue;
          queue();
          return;
        }
      }).observe(main, { childList: true, subtree: true });
      if (nav) new MutationObserver(syncBadge).observe(nav, { childList: true, subtree: true, characterData: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.XApp = { isApp: isApp, tab: function (n) { if (n) setTab(n, { keepScroll: false, top: true }); return tab; }, reveal: reveal, openStory: openStory, closeStory: closeSheet, headH: headH,
    onFilter: function () { dots(); }, audio: function () { return audio; }, sub: function (id) { if (id !== undefined) setSub(id); return sub; }, listen: listen };
})();
