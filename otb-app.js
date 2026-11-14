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
  var GROUPS = {
    today: ["today", "stories", "releases", "ai-business", "github", "research"],
    library: ["arcs", "pulse", "star-race", "pillars", "map", "graph", "archive", "covers", "issues", "glossary"],
    directory: ["directory"],
    saved: ["following"]
  };
  var TABS = [
    ["today", "Today", '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>'],
    ["library", "Library", '<path d="M5 4h4v16H5zM10.5 4h4v16h-4zM16 5.2l3.6-1 3.4 15.5-3.6.9z" transform="translate(-1 0)"/>'],
    ["directory", "Directory", '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>'],
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
      '<button type="button" class="otba-ic" id="otba-text" aria-label="Text size" aria-haspopup="true" aria-expanded="false"><span aria-hidden="true" class="otba-aa">A<small>A</small></span></button>' +
      '<button type="button" class="otba-ic" id="otba-paper" aria-label="Paper view">' + svg('<path d="M4 5h13v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v9a2 2 0 0 1-4 0M7 9h7M7 12.5h7M7 16h4"/>', 20) + "</button>" +
      '<button type="button" class="otba-ic" id="otba-theme" aria-label="Switch to dark mode">' + svg('<path class="otba-moon" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/><g class="otba-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g>', 20) + "</button>" +
      "</div>" +
      '<div class="otba-sizes" id="otba-sizes" role="group" aria-label="Text size" hidden>' +
      [["0.9", "Smaller"], ["1", "Default"], ["1.12", "Larger"], ["1.25", "Largest"]].map(function (s, i) {
        return '<button type="button" data-otba-size="' + s[0] + '" aria-label="' + s[1] + ' text" style="font-size:' + (13 + i * 3) + 'px">A</button>';
      }).join("") + "</div>" +
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
    var first = $("arcs");
    if (!first || $("otb-libnav")) return;
    var L = [["archive", "Archive"], ["covers", "Covers"], ["issues", "Past issues"], ["glossary", "Glossary"], ["arcs", "Story arcs"], ["pulse", "Pulse"], ["star-race", "Star race"], ["pillars", "Pillars"], ["map", "Map"], ["graph", "Graph"]];
    var n = document.createElement("nav");
    n.id = "otb-libnav";
    n.className = "otba-libnav";
    n.setAttribute("aria-label", "Library");
    n.innerHTML = '<p class="otba-lbl">Library</p><div class="otba-secs otba-secs--wrap">' + L.filter(function (x) { return $(x[0]); }).map(function (x) { return '<a class="otba-sec" href="#' + x[0] + '">' + x[1] + "</a>"; }).join("") + "</div>";
    first.parentNode.insertBefore(n, first);
  }
  function syncTheme() {
    var b = $("otba-theme");
    if (!b) return;
    var dark = H.getAttribute("data-theme") === "dark";
    b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    b.classList.toggle("is-dark", dark);
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
    if (name === tab && !opts.force) { if (opts.top) scrollTop(); return; }
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
      setTimeout(function () { jump(el); }, 20);
    } else if (g) { ev.preventDefault(); jump(el); }
  }, true);
  function headH() { return head && on ? head.offsetHeight : 0; }
  function jump(el) {
    var y = el.getBoundingClientRect().top + window.scrollY - headH() - 8;
    try { window.scrollTo({ top: Math.max(0, y), behavior: REDUCED ? "auto" : "smooth" }); } catch (e) { window.scrollTo(0, y); }
  }
  window.addEventListener("hashchange", function () {
    if (!on) return;
    var el = $(location.hash.slice(1)), sec = el && (sectionOf(el) || el), g = sec && groupOf(sec.id);
    if (g && g !== tab) { setTab(g, { keepScroll: true }); setTimeout(function () { jump(el); }, 20); }
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

  // ---------- Today screen ----------
  function todayRow() { var d = X.today(); return X.issueRow(d) || {}; }
  function blParts(row) { try { return window.XBlufFor ? XBlufFor(row) : { bl: str(row["Day bottom line"]), pv: [] }; } catch (e) { return { bl: str(row["Day bottom line"]), pv: [] }; } }
  function splitFirst(t) {
    t = str(t);
    var m = /^([\s\S]{20,}?[.!?])(\s+[A-Z“"‘(][\s\S]*)?$/.exec(t);
    return m ? [m[1], str(m[2])] : [t, ""];
  }
  var heroKey = "";
  function drawHero() {
    var sec = $("today");
    if (!sec) return;
    var hero = $("otb-today");
    if (!hero) {
      hero = document.createElement("div");
      hero.id = "otb-today";
      hero.className = "otba-hero";
      sec.insertBefore(hero, sec.firstChild);
    }
    var row = todayRow(), d = X.today(), r = blParts(row);
    var key = d + "|" + r.bl + "|" + JSON.stringify(r.pv) + "|" + str(row.Issue);
    if (key === heroKey) return;
    heroKey = key;
    var two = splitFirst(r.bl);
    var date = X.dateLong(d).replace(/^(\w{3}), (\w{3}) (\d+), \d{4}$/, function (m, a, b, c) { return { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" }[a] + ", " + b + " " + c; });
    var h = '<p class="otba-date">' + esc(date) + (str(row.Issue) ? " · Issue " + esc(row.Issue) : "") + "</p>" +
      '<p class="otba-k">Bottom line</p><h1 class="otba-h1">' + esc(two[0]) + "</h1>" + (two[1] ? '<p class="otba-bl">' + esc(two[1]) + "</p>" : "");
    if (r.pv && r.pv.length) {
      h += '<details class="otba-more"><summary>The bottom line in full</summary><div class="otba-pv">' + r.pv.map(function (x) {
        return "<p><b>" + esc(str(x.label)) + ":</b> " + esc(str(x.text)) + "</p>";
      }).join("") + "</div></details>";
    }
    var pdf = $("btn-pdf");
    if (pdf && !pdf.hidden && /^https?:/.test(pdf.getAttribute("href") || "")) h += '<p class="otba-links"><a class="otba-link" href="' + esc(pdf.getAttribute("href")) + '" target="_blank" rel="noopener">Read today\u2019s PDF \u2197</a></p>';
    hero.innerHTML = h;
  }
  var railKey = "";
  function drawRail() {
    var pulse = $("otb-pulse"), sec = $("today");
    if (!sec) return;
    var wrap = $("otb-railwrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "otb-railwrap";
      wrap.className = "otba-railwrap";
      var lead = $("lead");
      sec.insertBefore(wrap, lead || null);
    }
    if (pulse && pulse.nextSibling !== wrap && pulse.parentNode === sec) sec.insertBefore(wrap, pulse.nextSibling);
    var d = X.today(), list = X.items(d).filter(function (x) { return x.type === "Story"; }).slice(0, 5);
    var key = d + "|" + list.map(function (x) { return x.slug; }).join(",");
    var counts = { Release: 0, Business: 0, Repo: 0, Paper: 0 };
    X.items(d).forEach(function (x) { if (counts.hasOwnProperty(x.type)) counts[x.type]++; });
    key += JSON.stringify(counts);
    if (key === railKey && wrap.firstChild) return;
    railKey = key;
    var h = '<p class="otba-lbl">Top ' + list.length + '<span class="otba-swipe"> <span aria-hidden="true">·</span> swipe</span></p><div class="otba-rail" role="list" aria-label="Top stories" tabindex="0">';
    list.forEach(function (it, i) {
      var r = it.row || {}, src = str(r.Link);
      h += '<article class="x-stack otba-card" role="listitem" data-otb-item="' + esc(it.slug) + '" aria-label="' + esc((i + 1) + ". " + it.title) + '">' +
        '<p class="otba-n" aria-hidden="true">' + (i < 9 ? "0" : "") + (i + 1) + "</p>" +
        '<p class="otba-c">' + esc(str(r.Category) || "Top story") + "</p>" +
        '<h3 class="otba-t"><a href="#stories" data-otba-open="' + esc(it.slug) + '">' + esc(it.title) + "</a></h3>" +
        '<p style="display:none">' + esc(str(r["Bottom line"])) + "</p>" +
        (/^https?:/.test(src) ? '<a class="x-src" href="' + esc(src) + '" hidden>source</a>' : "") +
        '<div class="otba-acts"></div></article>';
    });
    h += '</div><div class="otba-dots" aria-hidden="true">' + list.map(function (x, i) { return "<i" + (i ? "" : ' class="is-on"') + "></i>"; }).join("") + "</div>";
    var M = [["releases", "Releases", counts.Release], ["ai-business", "Business", counts.Business], ["github", "GitHub", counts.Repo], ["research", "Research", counts.Paper]];
    h += '<p class="otba-lbl">More today</p><div class="otba-secs">' + M.filter(function (m) { return m[2] > 0; }).map(function (m) {
      return '<a class="otba-sec" href="#' + m[0] + '">' + m[1] + " <b>" + m[2] + "</b></a>";
    }).join("") + "</div>";
    wrap.innerHTML = h;
    [].forEach.call(wrap.querySelectorAll(".otba-card"), function (card, i) {
      var it = list[i], acts = card.querySelector(".otba-acts");
      if (window.XBrief && XBrief.digBtn) acts.insertAdjacentHTML("beforeend", XBrief.digBtn("Story", it.title));
      if (window.XShare) acts.appendChild(XShare.btn(it, "Share"));
    });
    var rail = wrap.querySelector(".otba-rail");
    rail.addEventListener("scroll", dots, { passive: true });
    dots();
    if (window.XPillars) try { XPillars.apply(); } catch (e) {}
  }
  var dotT = 0;
  function dots() {
    clearTimeout(dotT);
    dotT = setTimeout(function () {
      var rail = document.querySelector("#otb-railwrap .otba-rail");
      if (!rail) return;
      var cards = [].filter.call(rail.children, function (c) { return c.offsetParent !== null; }), best = 0, bd = 1e9, rl = rail.getBoundingClientRect().left;
      cards.forEach(function (c, i) { var dd = Math.abs(c.getBoundingClientRect().left - rl - 16); if (dd < bd) { bd = dd; best = i; } });
      cards.forEach(function (c, i) { c.classList.toggle("is-on", i === best); });
      var ds = document.querySelectorAll("#otb-railwrap .otba-dots i");
      [].forEach.call(ds, function (dd, i) { dd.classList.toggle("is-on", i === best); dd.hidden = i >= cards.length; });
    }, 40);
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
    var card = t.closest(".otba-card");
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
  var aInfo = null;
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
    if (!a || player.getAttribute("data-closed")) { player.hidden = true; H.classList.remove("otba-has-player"); return; }
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
          if (n && n.closest && (n.closest("#otb-today") || n.closest("#otb-railwrap"))) continue;
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
    onFilter: function () { dots(); }, audio: function () { return audio; } };
})();
