/* One to Better visuals, batch 3: story arcs.
   Hooks onto XVisuals.update(D), so it reads whatever data the page renders (the snapshot, then live data).
   The Who and where world map lives in otb-map.js. */
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
  function rows(D, tab) { return (D && Array.isArray(D[tab]) && D[tab]) || []; }
  function iso10(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(v)); return m ? m[0] : ""; }
  function dayMs(iso) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str(iso));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function shortDate(iso) {
    var t = dayMs(iso);
    if (isNaN(t)) return str(iso);
    var d = new Date(t);
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  }
  function longDate(iso) {
    var t = dayMs(iso);
    return isNaN(t) ? str(iso) : DAYS[new Date(t).getUTCDay()] + " " + shortDate(iso);
  }
  function okUrl(u) { return /^https?:\/\//i.test(str(u)) ? str(u) : ""; }
  function plural(n, w) { return n + " " + (n === 1 ? w : /[^aeiou]y$/i.test(w) ? w.slice(0, -1) + "ies" : w + "s"); }
  function logo(name) { try { return window.XVisuals && XVisuals.logo ? XVisuals.logo(name) : ""; } catch (e) { return ""; } }
  function isCo(t) { t = str(t); return t === "Company" || t === "Organization"; }

  var D = {};

  /* Stories per company, from Connections (one per distinct date + headline) */
  function storyIndex() {
    var by = {}, byH = {};
    rows(D, "Stories").forEach(function (s, k) {
      var h = str(s.Headline), d = iso10(s.Date);
      if (!h) return;
      var rec = { date: d, headline: h, link: okUrl(s.Link), source: str(s.Source), issue: str(s.Issue), cat: str(s.Category), order: k };
      by[d + "|" + h] = rec;
      if (!byH[h.toLowerCase()]) byH[h.toLowerCase()] = rec;
    });
    return { by: by, byH: byH };
  }
  function companyStories() {
    var idx = storyIndex(), out = {}, canon = {};
    rows(D, "Connections").forEach(function (c) {
      if (str(c["Item type"]) !== "Story" || !isCo(c["Entity type"])) return;
      var name = str(c.Entity), h = str(c.Item);
      if (!name || !h) return;
      var lc = name.toLowerCase();
      if (!canon[lc]) canon[lc] = name;
      name = canon[lc];
      var d = iso10(c.Date);
      var s = idx.by[d + "|" + h] || idx.byH[h.toLowerCase()] || { date: d, headline: h, link: "", source: "", issue: "", cat: "", order: 1e9 };
      var date = d || s.date;
      if (!date) return;
      var e = out[name] = out[name] || { name: name, list: [], seen: {} };
      var key = date + "|" + h;
      if (e.seen[key]) return;
      e.seen[key] = 1;
      e.list.push({ date: date, headline: h, link: s.link, source: s.source, issue: s.issue, cat: s.cat, order: s.order, update: /^update\s*:/i.test(h) });
    });
    return out;
  }

  /* ---------- 1. Story arcs ---------- */
  var COL = 48, PADX = 30, STEP = 44;
  var AR = { arcs: [], sel: "", node: -1, dates: [], sig: "", built: false };
  function briefDates() {
    var set = {};
    rows(D, "Issues").forEach(function (i) { var d = iso10(i.Date); if (d) set[d] = 1; });
    rows(D, "Stories").forEach(function (s) { var d = iso10(s.Date); if (d) set[d] = 1; });
    return Object.keys(set).sort();
  }
  function buildArcs() {
    var box = $("arc-box"), sec = $("arcs");
    if (!box) return;
    var cs = companyStories();
    var arcs = Object.keys(cs).map(function (k) { return cs[k]; })
      .sort(function (a, b) { return b.list.length - a.list.length || a.name.localeCompare(b.name); })
      .slice(0, 6);
    arcs.forEach(function (a) {
      a.list.sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : x.order - y.order; });
    });
    var dates = briefDates();
    var sig = dates.join(",") + "|" + arcs.map(function (a) { return a.name + ":" + a.list.length; }).join(",");
    if (sig === AR.sig) return;
    AR.sig = sig;
    if (sec) sec.hidden = !arcs.length;
    if (!arcs.length) { box.innerHTML = ""; return; }
    arcs.forEach(function (a) { a.list.forEach(function (s) { if (dates.indexOf(s.date) < 0) dates.push(s.date); }); });
    dates.sort();
    AR.arcs = arcs; AR.dates = dates;
    if (!AR.sel || !arcs.some(function (a) { return a.name === AR.sel; })) AR.sel = arcs[0].name;
    if (!AR.built) {
      AR.built = true;
      box.innerHTML =
        '<div class="x-arc__chips" id="arc-chips" role="group" aria-label="Pick a story arc"></div>' +
        '<div class="x-arc__bar"><p class="x-arc__count" id="arc-count" aria-live="polite"></p>' +
        '<ul class="x-arc__key" aria-label="Key"><li><i class="x-arc__sw"></i>New story</li><li><i class="x-arc__sw is-update"></i>Update</li></ul></div>' +
        '<div class="x-arc__scroll" id="arc-scroll" tabindex="0" role="region" aria-label="Story arc timeline, scroll sideways"><div class="x-arc__track" id="arc-track"></div></div>' +
        '<div class="x-arc__panel" id="arc-panel" aria-live="polite"></div>';
      box.addEventListener("click", function (ev) {
        var c = ev.target.closest("[data-arc]");
        if (c) { if (c.getAttribute("data-arc") !== AR.sel) { AR.sel = c.getAttribute("data-arc"); AR.node = -1; drawArc(true); } return; }
        var n = ev.target.closest("[data-arc-n]");
        if (n) { AR.node = +n.getAttribute("data-arc-n"); markNode(); showNode(AR.node); return; }
        var s = ev.target.closest("[data-arc-step]");
        if (s && !s.disabled) stepNode(+s.getAttribute("data-arc-step"));
      });
      var tr = $("arc-track");
      tr.addEventListener("pointerover", function (ev) {
        if (ev.pointerType && ev.pointerType !== "mouse") return;
        var n = ev.target.closest("[data-arc-n]");
        if (n) showNode(+n.getAttribute("data-arc-n"), true);
      });
      tr.addEventListener("pointerleave", function (ev) {
        if (ev.pointerType && ev.pointerType !== "mouse") return;
        showNode(AR.node);
      });
      tr.addEventListener("focusin", function (ev) {
        var n = ev.target.closest("[data-arc-n]");
        if (n) showNode(+n.getAttribute("data-arc-n"), true);
      });
      tr.addEventListener("focusout", function () { setTimeout(function () { if (!tr.contains(document.activeElement)) showNode(AR.node); }, 0); });
      tr.addEventListener("keydown", function (ev) {
        if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
        var n = ev.target.closest("[data-arc-n]");
        if (!n) return;
        ev.preventDefault();
        AR.node = +n.getAttribute("data-arc-n");
        stepNode(ev.key === "ArrowRight" ? 1 : -1, true);
      });
    }
    drawArc(false);
  }
  function curArc() { return AR.arcs.filter(function (a) { return a.name === AR.sel; })[0] || AR.arcs[0]; }
  function drawArc(scrollEnd) {
    var arc = curArc(), dates = AR.dates;
    $("arc-chips").innerHTML = AR.arcs.map(function (a) {
      return '<button type="button" class="x-arc__chip" data-arc="' + esc(a.name) + '" aria-pressed="' + (a.name === arc.name ? "true" : "false") + '">' +
        logo(a.name) + "<span>" + esc(a.name) + "</span><b>" + a.list.length + "</b></button>";
    }).join("");
    var list = arc.list;
    var first = list.length ? list[0].date : "", last = list.length ? list[list.length - 1].date : "";
    var nUp = list.filter(function (s) { return s.update; }).length;
    $("arc-count").innerHTML = "<b>" + esc(arc.name) + "</b> · " + plural(list.length, "story") +
      (nUp ? " · " + plural(nUp, "update") : "") + (first ? '<span class="x-arc__span"> · ' + esc(shortDate(first)) + " to " + esc(shortDate(last)) + "</span>" : "");

    // Lay out: one column per brief date, stories on a date stacked around the river's middle
    var col = {}, perDate = {};
    dates.forEach(function (d, k) { col[d] = k; });
    list.forEach(function (s) { (perDate[s.date] = perDate[s.date] || []).push(s); });
    var maxStack = 1;
    Object.keys(perDate).forEach(function (d) { maxStack = Math.max(maxStack, perDate[d].length); });
    var W = PADX * 2 + Math.max(0, dates.length - 1) * COL;
    var riverH = Math.max(120, maxStack * STEP + 36), axisH = 44, H = riverH + axisH, mid = riverH / 2;
    var xOf = function (k) { return PADX + k * COL; };

    // The river: a band whose width follows the stories per date
    var pts = dates.map(function (d, k) { var n = (perDate[d] || []).length; return { x: xOf(k), h: n ? n * STEP / 2 + 8 : 3 }; });
    var top = "", bot = "";
    if (pts.length === 1) pts.push({ x: pts[0].x + 1, h: pts[0].h });
    pts.forEach(function (p, k) {
      if (!k) { top = "M" + (p.x - PADX + 6) + "," + (mid - p.h) + " L" + p.x + "," + (mid - p.h); return; }
      var q = pts[k - 1], cx = (q.x + p.x) / 2;
      top += " C" + cx + "," + (mid - q.h) + " " + cx + "," + (mid - p.h) + " " + p.x + "," + (mid - p.h);
    });
    var lastP = pts[pts.length - 1];
    top += " L" + (lastP.x + PADX - 6) + "," + (mid - lastP.h);
    bot = " L" + (lastP.x + PADX - 6) + "," + (mid + lastP.h);
    for (var k = pts.length - 1; k >= 0; k--) {
      var p = pts[k];
      if (k === pts.length - 1) { bot += " L" + p.x + "," + (mid + p.h); continue; }
      var q = pts[k + 1], cx = (q.x + p.x) / 2;
      bot += " C" + cx + "," + (mid + q.h) + " " + cx + "," + (mid + p.h) + " " + p.x + "," + (mid + p.h);
    }
    bot += " L" + (pts[0].x - PADX + 6) + "," + (mid + pts[0].h) + " Z";
    var svg = '<svg class="x-arc__river" width="' + W + '" height="' + riverH + '" viewBox="0 0 ' + W + " " + riverH + '" aria-hidden="true" focusable="false">' +
      '<path class="x-arc__band" d="' + top + bot + '"/>' +
      '<line class="x-arc__mid" x1="' + (PADX - 18) + '" y1="' + mid + '" x2="' + (W - PADX + 18) + '" y2="' + mid + '"/>' +
      dates.map(function (d, k) { return perDate[d] ? "" : '<circle class="x-arc__tick" cx="' + xOf(k) + '" cy="' + mid + '" r="2"/>'; }).join("") +
      "</svg>";

    // Axis: day numbers per brief date, month names where the month changes
    var axis = "", lastMo = -1;
    dates.forEach(function (d, k) {
      var t = new Date(dayMs(d)), mo = t.getUTCMonth();
      axis += '<span class="x-arc__day' + (perDate[d] ? " is-on" : "") + '" style="left:' + xOf(k) + "px;top:" + (riverH + 4) + 'px">' + t.getUTCDate() + "</span>";
      if (mo !== lastMo) {
        lastMo = mo;
        axis += '<span class="x-arc__mon" style="left:' + Math.max(4, xOf(k) - 10) + "px;top:" + (riverH + 22) + 'px">' + MONTHS[mo] + (k === 0 || mo === 0 ? " " + t.getUTCFullYear() : "") + "</span>";
      }
    });

    var nodes = "", idx = 0;
    list.forEach(function (s, n) { s._n = n; });
    Object.keys(perDate).forEach(function (d) {
      var group = perDate[d], c = group.length;
      group.forEach(function (s, i) {
        var y = mid + (i - (c - 1) / 2) * STEP;
        nodes += '<button type="button" class="x-arc__node' + (s.update ? " is-update" : "") + '" data-arc-n="' + s._n + '" style="left:' + xOf(col[d]) + "px;top:" + y + 'px"' +
          ' aria-pressed="false" aria-label="' + esc(shortDate(s.date) + (s.update ? ", update" : "") + ": " + s.headline) + '"><i aria-hidden="true"></i></button>';
        idx++;
      });
    });
    var tr = $("arc-track");
    tr.style.width = W + "px";
    tr.style.height = H + "px";
    tr.innerHTML = svg + axis + nodes;
    $("arc-scroll").setAttribute("aria-label", arc.name + " story arc, " + plural(list.length, "story") + ", scroll sideways");
    if (AR.node < 0 || AR.node >= list.length) AR.node = list.length - 1;
    markNode();
    showNode(AR.node);
    var sc = $("arc-scroll");
    if (scrollEnd || !sc.getAttribute("data-init")) {
      sc.setAttribute("data-init", "1");
      var target = list.length ? xOf(col[list[list.length - 1].date]) : W;
      sc.scrollLeft = Math.max(0, target - sc.clientWidth + PADX * 2);
    }
  }
  function markNode() {
    [].forEach.call(document.querySelectorAll("[data-arc-n]"), function (b) {
      b.setAttribute("aria-pressed", +b.getAttribute("data-arc-n") === AR.node ? "true" : "false");
    });
  }
  function stepNode(d, focus) {
    var list = curArc().list;
    if (!list.length) return;
    AR.node = Math.max(0, Math.min(list.length - 1, AR.node + d));
    markNode();
    showNode(AR.node);
    var b = document.querySelector('[data-arc-n="' + AR.node + '"]'), sc = $("arc-scroll");
    if (b && sc) {
      var x = b.offsetLeft;
      if (x < sc.scrollLeft + 40 || x > sc.scrollLeft + sc.clientWidth - 40) sc.scrollTo({ left: Math.max(0, x - sc.clientWidth / 2), behavior: REDUCED ? "auto" : "smooth" });
      if (focus) b.focus({ preventScroll: true });
    }
  }
  function showNode(n, preview) {
    var p = $("arc-panel"), arc = curArc(), list = arc.list, s = list[n];
    if (!p) return;
    if (!s) { p.innerHTML = '<p class="x-empty">No stories yet.</p>'; return; }
    var h = s.link ? '<a class="link" href="' + esc(s.link) + '" target="_blank" rel="noopener">' + esc(s.headline) + "</a>" : esc(s.headline);
    p.classList.toggle("is-preview", !!preview && n !== AR.node);
    p.innerHTML =
      '<p class="x-pulse__ph"><b>' + esc(longDate(s.date)) + "</b>" + (s.issue ? " · Issue " + esc(s.issue) : "") +
      " · Story " + (n + 1) + " of " + list.length + (s.update ? ' <span class="x-arc__tag">Update</span>' : "") + "</p>" +
      '<p class="x-arc__hl">' + h + "</p>" +
      (s.source || s.cat ? '<p class="x-arc__src">' + esc([s.cat, s.source].filter(Boolean).join(" · ")) + "</p>" : "") +
      '<div class="links x-arc__nav"><button type="button" class="btn" data-arc-step="-1"' + (AR.node <= 0 ? " disabled" : "") + ">Earlier</button>" +
      '<button type="button" class="btn" data-arc-step="1"' + (AR.node >= list.length - 1 ? " disabled" : "") + ">Later</button></div>";
  }

  /* ---------- Hook ---------- */
  var ran = false;
  function update(data) {
    D = data && typeof data === "object" ? data : {};
    ran = true;
    try { buildArcs(); } catch (e) { if (window.console) console.warn(e); }
  }
  function hook() {
    var X = window.XVisuals;
    if (!X || X.__batch3) return;
    var orig = X.update;
    X.update = function (data) {
      var r;
      try { r = orig.apply(X, arguments); } catch (e) {}
      update(data);
      return r;
    };
    X.__batch3 = true;
    X.update3 = update;
  }
  hook();
  if (window.BRIEF_SNAPSHOT && Object.keys(window.BRIEF_SNAPSHOT).length) {
    var go = function () { if (!ran) update(window.BRIEF_SNAPSHOT); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
  }
})();
