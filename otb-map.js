/* One to Better: the Who and where world map.
   A self-contained SVG on the Equal Earth projection, drawn from window.OTB_WORLD (otb-world.js, Natural Earth outlines).
   Company coordinates come from the inline visuals block (#brief-visuals, companies_geo); mentions and shared items from Connections.
   Hooks onto XVisuals.update(D), so it reads whatever data the page renders (the snapshot, then live data). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function str(v) { return String(v == null ? "" : v).trim(); }
  function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  function rows(D, tab) { return (D && Array.isArray(D[tab]) && D[tab]) || []; }
  function iso10(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(v)); return m ? m[0] : ""; }
  // 1 story, 2 stories; 1 company, 3 companies; 1 mention, 2 mentions
  function plural(n, w) { return n + " " + (n === 1 ? w : /[^aeiou]y$/i.test(w) ? w.slice(0, -1) + "ies" : w + "s"); }
  function logo(name) { try { return window.XVisuals && XVisuals.logo ? XVisuals.logo(name) : ""; } catch (e) { return ""; } }
  function isCo(t) { t = str(t); return t === "Company" || t === "Organization"; }

  var V = {};
  try { var vb = $("brief-visuals"); V = obj(JSON.parse((vb && vb.textContent) || "{}")); } catch (e) { V = {}; }
  var GEO = obj(V.companies_geo);
  var D = {};

  var MP = { sig: "", failed: false, wanted: false, built: false, ready: false, data: [], links: {}, countBy: {},
    v: { k: 1, x: 0, y: 0 }, w: 800, h: 400, s0: 1, focus: null, sticky: false, pop: null, hotC: null, ptype: "mouse", active: false };
  var MAXK = 24;
  // Country names in the brief that differ from the outline names
  var ALIAS = {
    "united states": "United States of America", "usa": "United States of America", "us": "United States of America", "u.s.": "United States of America",
    "czech republic": "Czechia", "uk": "United Kingdom", "great britain": "United Kingdom", "england": "United Kingdom",
    "korea": "South Korea", "republic of korea": "South Korea", "democratic republic of the congo": "Dem. Rep. Congo",
    "bosnia and herzegovina": "Bosnia and Herz.", "north macedonia": "Macedonia", "ivory coast": "Côte d'Ivoire",
    "dominican republic": "Dominican Rep.", "central african republic": "Central African Rep.", "south sudan": "S. Sudan",
    "eswatini": "eSwatini", "swaziland": "eSwatini", "uae": "United Arab Emirates"
  };
  var SHOW = { "United States of America": "United States", "Czechia": "Czech Republic" };

  /* Equal Earth projection (Šavrič, Patterson, Jenny 2018), in degrees-scaled units */
  var EE = [1.340264, -0.081106, 0.000893, 0.003796], EM = Math.sqrt(3) / 2, RAD = Math.PI / 180;
  function project(lng, lat) {
    var l = lng * RAD, t = Math.asin(EM * Math.sin(lat * RAD)), t2 = t * t, t6 = t2 * t2 * t2;
    return [
      180 * l * Math.cos(t) / (EM * (EE[0] + 3 * EE[1] * t2 + t6 * (7 * EE[2] + 9 * EE[3] * t2))),
      -180 * t * (EE[0] + EE[1] * t2 + t6 * (EE[2] + EE[3] * t2))
    ];
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function num(v) { var n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) ? n : NaN; }

  function mapData() {
    var about = {}, mentions = {}, stories = {};
    rows(D, "Companies").forEach(function (c) { var n = str(c.Name).toLowerCase(); if (n && !about[n]) about[n] = str(c.About); });
    var seen = {};
    rows(D, "Connections").forEach(function (c) {
      if (!isCo(c["Entity type"])) return;
      var n = str(c.Entity).toLowerCase();
      if (!n) return;
      mentions[n] = (mentions[n] || 0) + 1;
      if (str(c["Item type"]) === "Story") {
        var k = n + "\n" + iso10(c.Date) + "|" + str(c.Item);
        if (!seen[k]) { seen[k] = 1; stories[n] = (stories[n] || 0) + 1; }
      }
    });
    var list = Object.keys(GEO).map(function (name) {
      var g = obj(GEO[name]), lat = num(g.lat), lng = num(g.lng), lc = name.toLowerCase();
      if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      return { name: name, lat: lat, lng: lng, city: str(g.hq_city), country: str(g.country) || "Other", about: about[lc] || "", n: mentions[lc] || 0, stories: stories[lc] || 0 };
    }).filter(Boolean);
    list.sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name); });
    list.forEach(function (c, k) { c.top = k < 10 && c.n > 0; });
    return list;
  }
  function popupHtml(c) {
    var place = [c.city, c.country].filter(Boolean).join(", ");
    return '<div class="x-mpop"><p class="x-mpop__head">' + logo(c.name) + "<b>" + esc(c.name) + "</b></p>" +
      (place ? '<p class="x-mpop__place">' + esc(place) + "</p>" : "") +
      (c.about ? '<p class="x-mpop__about">' + esc(c.about) + "</p>" : "") +
      '<p class="x-mpop__n"><b>' + plural(c.stories, "story") + "</b> · " + plural(c.n, "mention") + "</p>" +
      '<button type="button" class="x-mpop__dir" data-mp-dir="' + esc(c.name) + '">Show in directory</button></div>';
  }
  function buildMapShell() {
    var box = $("mp-box");
    if (!box || MP.built) return;
    MP.built = true;
    box.innerHTML =
      '<div class="x-map__frame" id="mp-frame"><div class="x-map__canvas" id="mp-map" role="region" aria-label="World map of company headquarters. Who and where, in the Library, lists every company."></div>' +
      '<p class="x-map__loading" id="mp-loading">Loading the map…</p></div>' +
      '<div class="x-map__bar"><p class="x-count" id="mp-count"></p>' +
      '<ul class="x-arc__key" aria-label="Key"><li><i class="x-arc__sw is-update"></i>Top 10 by mentions</li><li><i class="x-arc__sw is-gray"></i>Other companies</li><li>Bigger circles, more mentions</li></ul></div>' +
      '<div class="x-wm__lb" id="mp-lb" hidden></div>' +
      '<p class="x-map__credit">Map outlines: Natural Earth</p>' +
      '<div class="x-map__fallback" id="mp-fallback" hidden></div>';
  }
  function renderFallback() {
    var f = $("mp-fallback"), fr = $("mp-frame");
    if (!f) return;
    var by = {}, tot = {};
    MP.data.forEach(function (c) { (by[c.country] = by[c.country] || []).push(c); tot[c.country] = (tot[c.country] || 0) + c.n; });
    var countries = Object.keys(by).sort(function (a, b) { return tot[b] - tot[a] || a.localeCompare(b); });
    f.innerHTML = '<p class="fineprint">The map could not load, so here are the companies by country, most mentioned first.</p>' +
      '<div class="cards">' + countries.map(function (k) {
        return "<div><h3>" + esc(k) + " <span class=\"pill\">" + by[k].length + "</span></h3><ul>" + by[k].map(function (c) {
          return "<li><b>" + esc(c.name) + "</b>" + (c.city ? " · " + esc(c.city) : "") + " · " + plural(c.stories, "story") + "</li>";
        }).join("") + "</ul></div>";
      }).join("") + "</div>";
    f.hidden = false;
    if (fr) fr.hidden = true;
    var lb = $("mp-lb"); if (lb) lb.hidden = true;
  }
  function fail() {
    if (MP.failed) return;
    MP.failed = true;
    renderFallback();
  }

  /* Outlines: project every ring once into map units. Rings that cross the date line (Fiji, Chukotka)
     are unwrapped so they do not streak across the map. */
  function prepGeo() {
    if (MP.geo) return;
    var gj = window.OTB_WORLD;
    if (!gj || !Array.isArray(gj.features) || !gj.features.length) throw new Error("No country outlines");
    var feats = [], x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    gj.features.forEach(function (f) {
      var g = f && f.geometry;
      var polys = g && g.type === "Polygon" ? [g.coordinates] : g && g.type === "MultiPolygon" ? g.coordinates : null;
      if (!polys) return;
      var pr = obj(f.properties), name = str(pr.name || pr.NAME || pr.ADMIN || pr.admin);
      var rings = [];
      polys.forEach(function (poly) {
        poly.forEach(function (ring) {
          var prev = null;
          rings.push(ring.map(function (p) {
            var lng = p[0];
            if (prev != null) { while (lng - prev > 180) lng -= 360; while (prev - lng > 180) lng += 360; }
            prev = lng;
            var q = project(lng, p[1]), qb = project(clamp(lng, -180, 180), p[1]);
            if (qb[0] < x0) x0 = qb[0]; if (qb[0] > x1) x1 = qb[0];
            if (qb[1] < y0) y0 = qb[1]; if (qb[1] > y1) y1 = qb[1];
            return q;
          }));
        });
      });
      feats.push({ name: name, polys: polys, rings: rings });
    });
    if (!feats.length) throw new Error("No country outlines");
    var ox = x0 - 6, oy = y0 - 6;
    feats.forEach(function (f) {
      f.d = f.rings.map(function (r) {
        return "M" + r.map(function (q) { return (q[0] - ox).toFixed(2) + "," + (q[1] - oy).toFixed(2); }).join("L") + "Z";
      }).join("");
      f.rings = null;
    });
    MP.geo = { feats: feats, ox: ox, oy: oy, W: x1 - x0 + 12, H: y1 - y0 + 12 };
  }
  function toMap(lng, lat) { var q = project(lng, lat); return [q[0] - MP.geo.ox, q[1] - MP.geo.oy]; }
  function inRing(x, y, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function featAt(lng, lat) {
    var hit = "";
    MP.geo.feats.some(function (f) {
      return f.polys.some(function (poly) {
        if (!inRing(lng, lat, poly[0])) return false;
        for (var h = 1; h < poly.length; h++) if (inRing(lng, lat, poly[h])) return false;
        hit = f.name;
        return true;
      });
    });
    return hit;
  }
  /* Companies that share a Story, Release or AI Business item */
  function partners() {
    var canon = {}, items = {}, out = {};
    MP.data.forEach(function (c) { canon[c.name.toLowerCase()] = c.name; });
    rows(D, "Connections").forEach(function (c) {
      var t = str(c["Item type"]);
      if ((t !== "Story" && t !== "Release" && t !== "AI Business") || !isCo(c["Entity type"])) return;
      var nm = canon[str(c.Entity).toLowerCase()], it = str(c.Item);
      if (!nm || !it) return;
      var k = t + "|" + iso10(c.Date) + "|" + it.toLowerCase();
      (items[k] = items[k] || {})[nm] = 1;
    });
    Object.keys(items).forEach(function (k) {
      var ns = Object.keys(items[k]);
      for (var i = 0; i < ns.length; i++) for (var j = i + 1; j < ns.length; j++) {
        var a = ns[i], b = ns[j];
        (out[a] = out[a] || {})[b] = (out[a][b] || 0) + 1;
        (out[b] = out[b] || {})[a] = (out[b][a] || 0) + 1;
      }
    });
    return out;
  }
  function placeOf(c) { return [c.city, c.place].filter(Boolean).join(", "); }

  function startMap() {
    if (MP.ready || MP.failed) return;
    // otb-world.js may still be loading (it is deferred); wait for the page load once, then give up to the list
    if (!window.OTB_WORLD && document.readyState !== "complete" && !MP.waiting) {
      MP.waiting = true;
      window.addEventListener("load", function () { MP.waiting = false; startMap(); });
      return;
    }
    if (MP.waiting) return;
    try { prepGeo(); initMap(); } catch (e) { if (window.console) console.warn(e); fail(); }
  }
  function initMap() {
    var host = $("mp-map");
    if (!host) return;
    var G = MP.geo;
    host.innerHTML =
      '<svg class="x-wm" id="mp-svg" xmlns="http://www.w3.org/2000/svg">' +
      '<g class="x-wm__land" id="mp-land">' + G.feats.map(function (f, i) {
        return '<path class="x-wm__c" data-c="' + i + '" d="' + f.d + '"></path>';
      }).join("") + "</g>" +
      '<g class="x-wm__arcs" id="mp-arcs"></g><g id="mp-pins"></g></svg>' +
      '<div class="x-wm__ctl"><button type="button" data-mp-z="1" aria-label="Zoom in">+</button>' +
      '<button type="button" data-mp-z="-1" aria-label="Zoom out">−</button>' +
      '<button type="button" class="x-wm__reset" id="mp-reset" hidden>Reset view</button></div>' +
      '<div class="x-wm__tip" id="mp-tip" aria-hidden="true"></div>' +
      '<p class="x-wm__ctry" id="mp-ctry" aria-hidden="true"></p>' +
      '<div class="x-wm__pop" id="mp-pop" role="dialog" aria-label="Company details" hidden></div>';
    MP.svg = $("mp-svg"); MP.land = $("mp-land"); MP.arcs = $("mp-arcs"); MP.pinG = $("mp-pins");
    MP.tip = $("mp-tip"); MP.ctry = $("mp-ctry"); MP.popEl = $("mp-pop");
    measure();
    MP.v = homeView();
    bindMap(host);
    MP.ready = true;
    refreshMap();
    var ld = $("mp-loading"); if (ld) ld.hidden = true;
    // Land fades in, then markers drop in, when the map itself comes into view
    var reveal = function () { MP.svg.classList.add("is-in"); MP.revealed = true; };
    if (REDUCED || !("IntersectionObserver" in window)) reveal();
    else {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); reveal(); }
      }, { threshold: 0.3 });
      io.observe(host);
    }
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(host);
  }
  function refreshMap() {
    var names = {};
    MP.geo.feats.forEach(function (f) { names[f.name.toLowerCase()] = f.name; });
    MP.countBy = {};
    MP.byName = {};
    MP.data.forEach(function (c) {
      var raw = c.country === "Other" ? "" : c.country, lc = raw.toLowerCase();
      var g = raw ? ALIAS[lc] || names[lc] || "" : featAt(c.lng, c.lat);
      c.geoName = g;
      c.place = raw || (g ? SHOW[g] || g : "");
      var p = toMap(c.lng, c.lat);
      c.mx = p[0]; c.my = p[1];
      if (g) MP.countBy[g] = (MP.countBy[g] || 0) + 1;
      MP.byName[c.name] = c;
    });
    unfocus(); closePop();
    drawPins();
    buildBoard();
    apply();
  }
  function drawPins() {
    var max = 1;
    MP.data.forEach(function (c) { max = Math.max(max, c.n); });
    // Hit area: at least 44px across on phones and touch screens, a tighter 22px with a mouse on wide screens
    var coarse = (window.matchMedia && matchMedia("(pointer: coarse)").matches) || MP.w < 700;
    var minHit = coarse ? 23 : 11;
    // MP.data is sorted by mentions: biggest drawn first (underneath) and dropped in first
    MP.pinG.innerHTML = MP.data.map(function (c, i) {
      var r = c.r = 3.5 + 12.5 * Math.sqrt(c.n / max);
      var d = MP.revealed ? 0 : 450 + Math.min(i * 14, 1400);
      return '<g class="x-wm__pin' + (c.top ? " is-top" : "") + '" data-i="' + i + '" tabindex="0" role="button" aria-label="' +
        esc(c.name + (placeOf(c) ? ", " + placeOf(c) : "") + ", " + plural(c.n, "mention")) + '">' +
        '<g class="x-wm__drop" style="--d:' + d + 'ms">' +
        (c.top ? '<circle class="x-wm__ring" r="' + r.toFixed(1) + '" style="--pd:' + (i * 0.32).toFixed(2) + 's"></circle>' : "") +
        '<circle class="x-wm__hit" r="' + Math.max(r + 3, minHit).toFixed(1) + '"></circle>' +
        '<circle class="x-wm__dot" r="' + r.toFixed(1) + '"></circle></g></g>';
    }).join("");
    MP.pins = [].slice.call(MP.pinG.children);
    MP.pins.forEach(function (el, i) { MP.data[i].el = el; });
  }
  function buildBoard() {
    var lb = $("mp-lb");
    if (!lb) return;
    var by = {};
    MP.data.forEach(function (c) { if (c.place) (by[c.place] = by[c.place] || []).push(c); });
    var top = Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length || a.localeCompare(b); }).slice(0, 5);
    if (!top.length) { lb.hidden = true; return; }
    var max = by[top[0]].length;
    lb.innerHTML = "<h3>Top countries by companies · tap to zoom</h3><ol>" + top.map(function (k) {
      var n = by[k].length;
      return '<li><button type="button" data-mp-ctry="' + esc(k) + '" aria-label="Zoom to ' + esc(k) + ", " + plural(n, "company") + '">' +
        "<span>" + esc(k) + '</span><span class="x-wm__bar" aria-hidden="true"><i style="--w:' + Math.max(4, Math.round(100 * n / max)) + '%"></i></span>' +
        '<span class="x-wm__n">' + n + "</span></button></li>";
    }).join("") + "</ol>";
    lb.hidden = false;
  }

  /* View: screen = map units × s0 × k + (x, y). Markers sit in screen space, so they keep their size when zoomed. */
  function measure() {
    var r = $("mp-map").getBoundingClientRect();
    MP.w = r.width || 800; MP.h = r.height || 400;
    MP.svg.setAttribute("viewBox", "0 0 " + MP.w + " " + MP.h);
    MP.s0 = Math.min(MP.w / MP.geo.W, MP.h / MP.geo.H);
  }
  function homeView() { return { k: 1, x: (MP.w - MP.geo.W * MP.s0) / 2, y: (MP.h - MP.geo.H * MP.s0) / 2 }; }
  function clampV(v) {
    var k = clamp(v.k, 1, MAXK), mw = MP.geo.W * MP.s0 * k, mh = MP.geo.H * MP.s0 * k;
    return {
      k: k,
      x: mw <= MP.w ? (MP.w - mw) / 2 : clamp(v.x, MP.w - mw, 0),
      y: mh <= MP.h ? (MP.h - mh) / 2 : clamp(v.y, MP.h - mh, 0)
    };
  }
  function resize() {
    if (!MP.ready) return;
    var v = MP.v, s = MP.s0 * v.k, cx = (MP.w / 2 - v.x) / s, cy = (MP.h / 2 - v.y) / s;
    measure();
    s = MP.s0 * v.k;
    MP.v = clampV({ k: v.k, x: MP.w / 2 - cx * s, y: MP.h / 2 - cy * s });
    apply();
  }
  function apply() {
    var v = MP.v, s = MP.s0 * v.k;
    MP.land.setAttribute("transform", "translate(" + v.x.toFixed(2) + "," + v.y.toFixed(2) + ") scale(" + s.toFixed(5) + ")");
    MP.data.forEach(function (c) {
      c.sx = c.mx * s + v.x; c.sy = c.my * s + v.y;
      if (c.el) c.el.setAttribute("transform", "translate(" + c.sx.toFixed(1) + "," + c.sy.toFixed(1) + ")");
    });
    var zoomed = v.k > 1.01;
    MP.svg.classList.toggle("is-zoomed", zoomed);
    $("mp-reset").hidden = !zoomed;
    var zi = document.querySelector('[data-mp-z="1"]'), zo = document.querySelector('[data-mp-z="-1"]');
    if (zi) zi.disabled = v.k >= MAXK - 0.01;
    if (zo) zo.disabled = !zoomed;
    if (MP.focus) { drawArcs(false); if (!MP.pop) placeAt(MP.tip, MP.focus); }
    if (MP.pop) placeAt(MP.popEl, MP.pop);
  }
  function animateTo(t) {
    t = clampV(t);
    if (MP.raf) cancelAnimationFrame(MP.raf);
    var f = MP.v;
    if (REDUCED) { MP.v = t; apply(); return; }
    var sf = MP.s0 * f.k, st = MP.s0 * t.k;
    var cfx = (MP.w / 2 - f.x) / sf, cfy = (MP.h / 2 - f.y) / sf, ctx = (MP.w / 2 - t.x) / st, cty = (MP.h / 2 - t.y) / st;
    var t0 = performance.now(), dur = 520;
    var step = function (now) {
      var p = Math.min(1, (now - t0) / dur), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      var k = f.k * Math.pow(t.k / f.k, e), s = MP.s0 * k;
      MP.v = { k: k, x: MP.w / 2 - (cfx + (ctx - cfx) * e) * s, y: MP.h / 2 - (cfy + (cty - cfy) * e) * s };
      if (p >= 1) MP.v = t;
      apply();
      MP.raf = p < 1 ? requestAnimationFrame(step) : 0;
    };
    MP.raf = requestAnimationFrame(step);
  }
  function zoomAt(px, py, factor, anim) {
    var v = MP.v, k = clamp(v.k * factor, 1, MAXK), s = MP.s0 * v.k, mx = (px - v.x) / s, my = (py - v.y) / s;
    var t = { k: k, x: px - mx * MP.s0 * k, y: py - my * MP.s0 * k };
    if (anim) animateTo(t); else { if (MP.raf) cancelAnimationFrame(MP.raf); MP.raf = 0; MP.v = clampV(t); apply(); }
  }
  function resetView() { clearPick(); closePop(); unfocus(); animateTo(homeView()); }
  function clearPick() {
    [].forEach.call(document.querySelectorAll("#mp-box .is-pick"), function (el) { el.classList.remove("is-pick"); });
  }
  function zoomCountry(name) {
    var list = MP.data.filter(function (c) { return c.place === name; });
    if (!list.length) return;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(function (c) { x0 = Math.min(x0, c.mx); x1 = Math.max(x1, c.mx); y0 = Math.min(y0, c.my); y1 = Math.max(y1, c.my); });
    var bw = Math.max(x1 - x0, 16), bh = Math.max(y1 - y0, 10), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var k = clamp(Math.min(MP.w / (bw * 1.5 * MP.s0), MP.h / (bh * 1.7 * MP.s0)), 1, 12);
    clearPick(); closePop(); unfocus();
    var g = list[0].geoName;
    if (g) MP.geo.feats.forEach(function (f, i) { if (f.name === g) MP.land.children[i].classList.add("is-pick"); });
    var b = document.querySelector('[data-mp-ctry="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]');
    if (b) b.classList.add("is-pick");
    animateTo({ k: k, x: MP.w / 2 - cx * MP.s0 * k, y: MP.h / 2 - cy * MP.s0 * k });
  }

  /* Focus: grow the marker, show the card, trace arcs to the companies it shares items with */
  function focusPin(c, sticky) {
    if (MP.focus === c) { MP.sticky = MP.sticky || !!sticky; return; }
    unfocus();
    MP.focus = c; MP.sticky = !!sticky;
    var rel = MP.links[c.name] || {};
    MP.svg.classList.add("is-focus");
    MP.data.forEach(function (o) {
      if (!o.el) return;
      o.el.classList.toggle("is-hot", o === c);
      o.el.classList.toggle("is-rel", !!rel[o.name]);
    });
    countryHot(null);
    drawArcs(true);
    if (!MP.pop) showTip(c);
  }
  function unfocus() {
    if (!MP.focus) return;
    MP.focus = null; MP.sticky = false;
    if (MP.svg) MP.svg.classList.remove("is-focus");
    MP.data.forEach(function (o) { if (o.el) { o.el.classList.remove("is-hot"); o.el.classList.remove("is-rel"); } });
    if (MP.arcs) MP.arcs.innerHTML = "";
    if (MP.tip) MP.tip.classList.remove("is-on");
  }
  function drawArcs(animate) {
    var c = MP.focus;
    if (!c) return;
    var rel = MP.links[c.name] || {};
    var list = Object.keys(rel).map(function (n) { return { c: MP.byName[n], w: rel[n] }; })
      .filter(function (o) { return o.c && o.c !== c; })
      .sort(function (a, b) { return b.w - a.w; }).slice(0, 40);
    MP.arcs.innerHTML = list.map(function (o, i) {
      var b = o.c, dx = b.sx - c.sx, dy = b.sy - c.sy, L = Math.sqrt(dx * dx + dy * dy);
      if (L < 2) return "";
      var nx = -dy / L, ny = dx / L;
      if (ny > 0) { nx = -nx; ny = -ny; }
      var bend = Math.min(L * 0.3, 180), qx = (c.sx + b.sx) / 2 + nx * bend, qy = (c.sy + b.sy) / 2 + ny * bend;
      return '<path pathLength="1"' + (animate && !REDUCED ? ' class="is-trace"' : "") +
        ' style="animation-delay:' + i * 45 + "ms;stroke-width:" + (1.2 + Math.min(o.w, 4) * 0.35).toFixed(2) + '"' +
        ' d="M' + c.sx.toFixed(1) + "," + c.sy.toFixed(1) + "Q" + qx.toFixed(1) + "," + qy.toFixed(1) + " " + b.sx.toFixed(1) + "," + b.sy.toFixed(1) + '"></path>';
    }).join("");
  }
  function showTip(c) {
    var nRel = Object.keys(MP.links[c.name] || {}).filter(function (n) { return MP.byName[n]; }).length;
    MP.tip.innerHTML = (logo(c.name) || "<span></span>") + "<b>" + esc(c.name) + "</b>" +
      "<span>" + esc(placeOf(c) || "Location unknown") + "</span>" +
      "<span><em>" + plural(c.n, "mention") + "</em>" + (nRel ? " · shares stories with " + plural(nRel, "company") : "") + "</span>" +
      (MP.ptype !== "mouse" ? '<span class="x-wm__hint">Tap again for details</span>' : "");
    placeAt(MP.tip, c);
    MP.tip.classList.add("is-on");
  }
  function placeAt(el, c) {
    var w = el.offsetWidth, h = el.offsetHeight, r = (c.r || 6) * 1.45 + 10;
    var left = c.sx + r, top = c.sy - h / 2;
    if (left + w > MP.w - 8) left = c.sx - r - w;
    if (left < 8) left = clamp(c.sx - w / 2, 8, Math.max(8, MP.w - w - 8));
    top = clamp(top, 8, Math.max(8, MP.h - h - 8));
    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top) + "px";
  }
  function openPop(c) {
    MP.pop = c;
    MP.tip.classList.remove("is-on");
    MP.popEl.innerHTML = '<button type="button" class="x-wm__x" data-mp-close aria-label="Close">×</button>' + popupHtml(c);
    MP.popEl.hidden = false;
    placeAt(MP.popEl, c);
  }
  function closePop() {
    if (!MP.pop) return;
    MP.pop = null;
    if (MP.popEl) MP.popEl.hidden = true;
  }
  function countryHot(path, p) {
    if (MP.hotC !== path) {
      if (MP.hotC) MP.hotC.classList.remove("is-hot");
      MP.hotC = path || null;
      if (path) path.classList.add("is-hot");
    }
    if (!path || !p) { if (MP.ctry) MP.ctry.classList.remove("is-on"); return; }
    var f = MP.geo.feats[+path.getAttribute("data-c")], n = MP.countBy[f.name] || 0;
    MP.ctry.textContent = (SHOW[f.name] || f.name) + " · " + plural(n, "company");
    var w = MP.ctry.offsetWidth, h = MP.ctry.offsetHeight;
    MP.ctry.style.left = Math.round(clamp(p.x + 14, 6, Math.max(6, MP.w - w - 6))) + "px";
    MP.ctry.style.top = Math.round(clamp(p.y + 16, 6, Math.max(6, MP.h - h - 6))) + "px";
    MP.ctry.classList.add("is-on");
  }
  /* Input: hover, tap, drag, pinch, wheel, double-click, keys */
  function bindMap(host) {
    var svg = MP.svg, ptrs = {}, drag = null, pinch = null;
    var pt = function (e) { var r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    var pinOf = function (t) { var el = t && t.closest ? t.closest(".x-wm__pin") : null; return el ? MP.data[+el.getAttribute("data-i")] : null; };
    var ids = function () { return Object.keys(ptrs); };
    var startPinch = function () {
      var k = ids(), a = ptrs[k[0]], b = ptrs[k[1]];
      pinch = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: MP.v };
    };
    svg.addEventListener("pointerdown", function (e) {
      MP.ptype = e.pointerType || "mouse";
      MP.active = true;
      MP.lastPtr = performance.now();
      if (e.pointerType === "mouse" && e.button !== 0) return;
      ptrs[e.pointerId] = pt(e);
      try { svg.setPointerCapture(e.pointerId); } catch (x) {}
      if (MP.raf) { cancelAnimationFrame(MP.raf); MP.raf = 0; }
      if (ids().length === 1) drag = { x0: ptrs[e.pointerId].x, y0: ptrs[e.pointerId].y, v0: MP.v, moved: false, target: e.target, type: MP.ptype };
      else if (ids().length === 2) { startPinch(); if (drag) drag.moved = true; }
    });
    svg.addEventListener("pointermove", function (e) {
      if (ptrs[e.pointerId]) ptrs[e.pointerId] = pt(e);
      var k = ids();
      if (k.length >= 2 && pinch) {
        var a = ptrs[k[0]], b = ptrs[k[1]], d = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        var z = clamp(pinch.v0.k * d / pinch.d0, 1, MAXK), s0 = MP.s0 * pinch.v0.k;
        var mx = (pinch.mid.x - pinch.v0.x) / s0, my = (pinch.mid.y - pinch.v0.y) / s0;
        MP.v = clampV({ k: z, x: mid.x - mx * MP.s0 * z, y: mid.y - my * MP.s0 * z });
        apply();
        return;
      }
      if (drag && k.length === 1) {
        var p = ptrs[k[0]], dx = p.x - drag.x0, dy = p.y - drag.y0;
        if (!drag.moved && dx * dx + dy * dy > 36) { drag.moved = true; svg.classList.add("is-drag"); countryHot(null); }
        if (drag.moved) { MP.v = clampV({ k: drag.v0.k, x: drag.v0.x + dx, y: drag.v0.y + dy }); apply(); }
        return;
      }
      if (e.pointerType !== "mouse" || drag) return;
      var c = pinOf(e.target);
      if (c) { if (!MP.sticky) focusPin(c, false); countryHot(null); svg.style.cursor = "pointer"; return; }
      svg.style.cursor = "";
      if (MP.focus && !MP.sticky) unfocus();
      var path = e.target.closest ? e.target.closest(".x-wm__c") : null;
      countryHot(path, path ? pt(e) : null);
    });
    var up = function (e) {
      MP.lastPtr = performance.now();
      var had = !!ptrs[e.pointerId];
      delete ptrs[e.pointerId];
      if (!had) return;
      var k = ids();
      if (k.length < 2) pinch = null;
      if (k.length === 1) { drag = { x0: ptrs[k[0]].x, y0: ptrs[k[0]].y, v0: MP.v, moved: true, target: null, type: MP.ptype }; return; }
      if (k.length) return;
      var d = drag;
      drag = null;
      svg.classList.remove("is-drag");
      if (!d || d.moved || e.type === "pointercancel") return;
      tap(d.target, d.type, pt(e));
    };
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    svg.addEventListener("pointerleave", function (e) {
      if (e.pointerType !== "mouse") return;
      MP.active = false;
      countryHot(null);
      if (!MP.sticky) unfocus();
    });
    // Hover previews on desktop; a click opens the popup. On touch, the first tap previews, the second opens the popup.
    function tap(target, type, p) {
      var c = pinOf(target);
      if (c) {
        if (type === "mouse") { focusPin(c, true); openPop(c); }
        else if (MP.focus === c && MP.sticky) openPop(c);
        else { closePop(); focusPin(c, true); }
        return;
      }
      closePop(); unfocus();
      var path = target && target.closest ? target.closest(".x-wm__c") : null;
      if (type !== "mouse") countryHot(path, path ? p : null);
    }
    svg.addEventListener("dblclick", function (e) {
      if (pinOf(e.target)) return;
      e.preventDefault();
      var p = pt(e);
      zoomAt(p.x, p.y, e.shiftKey ? 0.5 : 2, true);
    });
    // Wheel zooms once the reader is working the map (clicked it, zoomed it, or pinching a trackpad); otherwise the page scrolls
    host.addEventListener("wheel", function (e) {
      if (!(e.ctrlKey || MP.active || MP.v.k > 1.01)) return;
      e.preventDefault();
      var p = pt(e), dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      zoomAt(p.x, p.y, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0025)), false);
    }, { passive: false });
    host.addEventListener("click", function (e) {
      var z = e.target.closest("[data-mp-z]");
      if (z) { zoomAt(MP.w / 2, MP.h / 2, z.getAttribute("data-mp-z") === "1" ? 2 : 0.5, true); return; }
      if (e.target.closest("#mp-reset")) { resetView(); return; }
      if (e.target.closest("[data-mp-close]")) { closePop(); unfocus(); }
    });
    // Keyboard focus only: a pointer press also focuses the pin, and tap() handles that
    svg.addEventListener("focusin", function (e) {
      var c = pinOf(e.target);
      if (!c || performance.now() - (MP.lastPtr || -1e9) < 900) return;
      MP.ptype = "mouse";
      focusPin(c, true);
    });
    svg.addEventListener("focusout", function (e) {
      if (!svg.contains(e.relatedTarget) && !MP.pop) unfocus();
    });
    host.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closePop(); unfocus(); return; }
      var c = pinOf(e.target);
      if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPop(c); }
    });
    var lb = $("mp-lb");
    if (lb) lb.addEventListener("click", function (e) {
      var b = e.target.closest("[data-mp-ctry]");
      if (b) zoomCountry(b.getAttribute("data-mp-ctry"));
    });
  }
  function buildMap() {
    var box = $("mp-box");
    if (!box) return;
    var data = mapData();
    var sig = data.map(function (c) { return c.name + ":" + c.n + ":" + c.stories; }).join("|");
    if (sig === MP.sig) return;
    MP.sig = sig;
    MP.data = data;
    box.hidden = !data.length;
    // The Map section and its nav chip leave the page when there is nothing to plot
    var sec = $("map");
    if (sec) sec.hidden = !data.length;
    [].forEach.call(document.querySelectorAll('.nav a[href="#map"]'), function (a) { a.hidden = !data.length; });
    if (!data.length) return;
    buildMapShell();
    var countries = {};
    data.forEach(function (c) { countries[c.country] = 1; });
    $("mp-count").textContent = plural(data.length, "company") + " in " + plural(Object.keys(countries).length, "country");
    if (MP.failed) { renderFallback(); return; }
    MP.links = partners();
    if (MP.ready) { try { refreshMap(); } catch (e) { if (window.console) console.warn(e); fail(); } return; }
    if (MP.wanted) { startMap(); return; }
    // Project the outlines and draw the map once it is close to the screen
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); MP.wanted = true; startMap(); }
      }, { rootMargin: "800px 0px" });
      io.observe(box);
    } else { MP.wanted = true; startMap(); }
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-mp-dir]") : null;
    if (!b) return;
    var name = b.getAttribute("data-mp-dir");
    var tab = document.querySelector('#directory [data-tab="Company"]');
    if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
    var q = $("d-q");
    if (q) { q.value = name; q.dispatchEvent(new Event("input", { bubbles: true })); }
    closePop(); unfocus();
    var bar = document.querySelector("#directory .x-dir-bar");
    if (bar) bar.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
  });

  /* ---------- Hook ---------- */
  var ran = false;
  function update(data) {
    D = data && typeof data === "object" ? data : {};
    ran = true;
    try { buildMap(); } catch (e) { if (window.console) console.warn(e); fail(); }
  }
  function hook() {
    var X = window.XVisuals;
    if (!X || X.__map) return;
    var orig = X.update;
    X.update = function (data) {
      var r;
      try { r = orig.apply(X, arguments); } catch (e) {}
      update(data);
      return r;
    };
    X.__map = true;
    X.updateMap = update;
  }
  hook();
  if (window.BRIEF_SNAPSHOT && Object.keys(window.BRIEF_SNAPSHOT).length) {
    var go = function () { if (!ran) update(window.BRIEF_SNAPSHOT); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
  }
})();
