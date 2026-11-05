/* One to Better visuals, batch 2: star race, pulse calendar, five pillars wheel.
   Hooks onto XVisuals.update(D), so it reads whatever data the page renders (the snapshot, then live data).
   The pillar tags come from the inline visuals block (#brief-visuals). */
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
  function dayMs(iso) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str(iso));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }
  function isoOf(ms) { return new Date(ms).toISOString().slice(0, 10); }
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
  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }
  function okUrl(u) { return /^https?:\/\//i.test(str(u)) ? str(u) : ""; }
  function narrow() { return window.matchMedia ? matchMedia("(max-width: 599px)").matches : window.innerWidth < 600; }
  function plural(n, w) { return n + " " + (n === 1 ? w : /[^aeiou]y$/i.test(w) ? w.slice(0, -1) + "ies" : w + "s"); }

  var V = {};
  try { var vb = $("brief-visuals"); V = obj(JSON.parse((vb && vb.textContent) || "{}")); } catch (e) { V = {}; }
  var PILLARS_RAW = obj(V.story_pillars);
  var D = {};

  /* ---------- 1. Star race ---------- */
  var SR = { names: [], dates: [], frames: [], full: {}, links: {}, pos: 0, playing: false, chart: null, raf: 0, last: 0, built: false, sig: "" };
  var SR_MS = 1100, SR_TOP = 10;
  function starsOf(v) {
    var s = str(v).toLowerCase().replace(/,/g, "");
    var m = /^([\d.]+)\s*([km])?/.exec(s);
    if (!m) return NaN;
    var n = parseFloat(m[1]);
    return m[2] === "k" ? n * 1e3 : m[2] === "m" ? n * 1e6 : n;
  }
  function raceData() {
    var by = {}, dset = {}, links = {};
    rows(D, "GitHub Repos").forEach(function (r) {
      var d = iso10(r.Date), name = str(r.Repo), n = starsOf(r["Total stars"]);
      if (!d || !name || isNaN(n)) return;
      dset[d] = 1;
      by[name] = by[name] || {};
      by[name][d] = Math.max(by[name][d] || 0, n);
      if (!links[name] && okUrl(r.Link)) links[name] = okUrl(r.Link);
    });
    var dates = Object.keys(dset).sort(), names = Object.keys(by);
    var cur = {}, frames = dates.map(function (d) {
      names.forEach(function (n) { if (by[n][d] != null) cur[n] = by[n][d]; });
      var f = {};
      Object.keys(cur).forEach(function (n) { f[n] = cur[n]; });
      return f;
    });
    return { dates: dates, frames: frames, links: links };
  }
  function frameAt(pos) {
    var n = SR.frames.length, i = Math.max(0, Math.min(n - 1, Math.floor(pos))), t = pos - i;
    var a = SR.frames[i], b = SR.frames[Math.min(i + 1, n - 1)], out = [];
    Object.keys(b).forEach(function (k) {
      var v;
      if (a[k] != null) v = a[k] + (b[k] - a[k]) * t;
      else if (t >= 0.999) v = b[k];
      else return;
      out.push({ name: k, v: v });
    });
    out.sort(function (x, y) { return y.v - x.v || x.name.localeCompare(y.name); });
    return out.slice(0, SR_TOP);
  }
  function shortRepo(full) {
    var s = full.indexOf("/") > 0 ? full.slice(full.indexOf("/") + 1) : full;
    var max = narrow() ? 14 : 26;
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }
  function drawRace() {
    if (!SR.chart) return;
    var top = frameAt(SR.pos);
    SR.chart.data.labels = top.map(function (r) { return r.name; });
    var ds = SR.chart.data.datasets[0];
    ds.data = top.map(function (r) { return r.v; });
    SR.chart.update("none");
    var i = Math.min(SR.dates.length - 1, Math.round(SR.pos));
    var d = SR.dates[Math.min(SR.dates.length - 1, Math.floor(SR.pos + 0.0001))];
    $("sr-date").textContent = shortDate(d);
    var lead = $("sr-lead");
    if (lead) {
      lead.hidden = !top.length;
      if (top.length) {
        $("sr-lead-k").textContent = "Leader · " + top[0].name;
        $("sr-lead-n").textContent = fmt(top[0].v);
        // Change against the previous brief, only when both briefs carry the leader's count
        var fi = Math.min(SR.frames.length - 1, Math.floor(SR.pos + 0.0001)), dl = $("sr-delta");
        var now = SR.frames[fi] && SR.frames[fi][top[0].name], prev = fi > 0 && SR.frames[fi - 1] ? SR.frames[fi - 1][top[0].name] : null;
        var pct = now != null && prev ? ((now - prev) / prev) * 100 : null;
        if (pct != null && Math.abs(pct) >= 0.05) {
          dl.hidden = false;
          dl.className = "x-delta " + (pct > 0 ? "is-up" : "is-down");
          dl.textContent = (pct > 0 ? "▲ " : "▼ ") + Math.abs(pct).toFixed(1) + "% vs last brief";
        } else dl.hidden = true;
      }
    }
    var sl = $("sr-scrub");
    if (+sl.value !== i) sl.value = i;
    sl.setAttribute("aria-valuetext", shortDate(SR.dates[i]) + ", brief " + (i + 1) + " of " + SR.dates.length);
    $("sr-canvas").setAttribute("aria-label", "Top " + top.length + " AI repos by total stars on " + shortDate(d) + (top.length ? ". " + top[0].name + " leads with " + fmt(top[0].v) + " stars" : ""));
  }
  function setPlay(on) {
    SR.playing = on;
    var b = $("sr-play");
    b.textContent = on ? "Pause" : "Play";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    cancelAnimationFrame(SR.raf);
    if (on) { SR.last = 0; SR.raf = requestAnimationFrame(tick); }
  }
  function tick(ts) {
    if (!SR.playing) return;
    if (!SR.last) SR.last = ts;
    var dt = ts - SR.last;
    if (REDUCED) {
      if (dt < SR_MS) { SR.raf = requestAnimationFrame(tick); return; }
      SR.pos = Math.floor(SR.pos) + 1;
      SR.last = ts;
    } else {
      SR.pos += Math.min(dt, 100) / SR_MS;
      SR.last = ts;
    }
    if (SR.pos >= SR.dates.length - 1) { SR.pos = SR.dates.length - 1; drawRace(); setPlay(false); return; }
    drawRace();
    SR.raf = requestAnimationFrame(tick);
  }
  function buildRace() {
    var box = $("sr-box"), sec = $("star-race");
    if (!box) return;
    var r = raceData();
    var sig = r.dates.join(",") + "|" + rows(D, "GitHub Repos").length;
    if (sig === SR.sig) return;
    SR.sig = sig;
    if (sec) sec.hidden = !r.dates.length;
    if (!r.dates.length || !window.Chart) return;
    SR.dates = r.dates; SR.frames = r.frames; SR.links = r.links;
    var keepPos = SR.built && !SR.playing ? Math.min(SR.pos, r.dates.length - 1) : r.dates.length - 1;
    if (SR.built && SR.playing) keepPos = Math.min(SR.pos, r.dates.length - 1);
    SR.pos = keepPos;
    if (!SR.built) {
      SR.built = true;
      box.innerHTML =
        '<figure class="chart x-race">' +
        '<figcaption class="chart__cap">Total GitHub stars of the AI repos the brief has covered' +
        "<small>Top 10 on each brief date. A repo keeps its last reported total until the brief covers it again.</small></figcaption>" +
        '<div class="x-race__bar"><p class="x-race__date" id="sr-date" aria-live="off"></p><p class="x-race__lead" id="sr-lead"><span class="x-big__k" id="sr-lead-k"></span><span class="x-big" id="sr-lead-n"></span><span class="x-big__k">Stars</span><span class="x-delta" id="sr-delta" hidden></span></p></div>' +
        '<div class="chart__canvas chart__canvas--tall"><canvas id="sr-canvas" role="img" aria-label="Top AI repos by total stars"></canvas></div>' +
        '<div class="x-race__ctl">' +
        '<button type="button" class="btn x-race__play" id="sr-play" aria-pressed="false">Play</button>' +
        '<label class="x-race__scrub"><span class="x-race__k">Brief date</span>' +
        '<input type="range" id="sr-scrub" min="0" step="1" value="0" /></label>' +
        '<p class="x-race__ends"><span id="sr-first"></span><span id="sr-lastd"></span></p>' +
        "</div></figure>";
      $("sr-play").addEventListener("click", function () {
        if (SR.playing) { setPlay(false); return; }
        if (SR.pos >= SR.dates.length - 1) { SR.pos = 0; drawRace(); }
        setPlay(true);
      });
      $("sr-scrub").addEventListener("input", function () {
        if (SR.playing) setPlay(false);
        SR.pos = +this.value;
        drawRace();
      });
      SR.chart = new Chart($("sr-canvas"), {
        type: "bar",
        data: { labels: [], datasets: [{ label: "Total stars", data: [], maxBarThickness: 26, borderWidth: 0,
          // Leader in red, the rest gray; a function, so the theme resolves it on every frame without piling up tokens
          backgroundColor: function (ctx) { return ctx.dataIndex === 0 ? "var(--x-red)" : "var(--chart-muted)"; } }] },
        options: {
          indexAxis: "y",
          animation: false,
          layout: { padding: { right: 8 } },
          scales: {
            x: { beginAtZero: true, ticks: { callback: function (v) { return v >= 1000 ? fmt(v / 1000) + "k" : v; } } },
            y: { ticks: { autoSkip: false, callback: function (v) { return shortRepo(this.getLabelForValue(v)); } } }
          },
          plugins: {
            legend: { display: false },
            datalabels: Object.assign({}, window.Hark && Hark.labels ? Hark.labels.values : {}, { formatter: function (v) { return fmt(v); } }),
            tooltip: { callbacks: { label: function (ctx) { return fmt(ctx.raw) + " stars"; } } }
          },
          onClick: function (ev, els) {
            if (!els || !els.length) return;
            var n = SR.chart.data.labels[els[0].index], u = SR.links[n];
            if (u) window.open(u, "_blank", "noopener");
          }
        }
      });
      var rt = 0;
      window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (SR.chart) SR.chart.update("none"); }, 150); }, { passive: true });
    }
    var sl = $("sr-scrub");
    sl.max = String(SR.dates.length - 1);
    sl.disabled = SR.dates.length < 2;
    $("sr-play").disabled = SR.dates.length < 2;
    $("sr-first").textContent = shortDate(SR.dates[0]);
    $("sr-lastd").textContent = shortDate(SR.dates[SR.dates.length - 1]);
    drawRace();
  }

  /* ---------- 2. Pulse calendar ---------- */
  var PU = { sel: "", byDate: {}, colors: {}, sig: "" };
  var CAT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--x-cat-8)", "var(--x-cat-9)", "var(--x-cat-10)"];
  function buildPulse() {
    var box = $("pu-box"), sec = $("pulse");
    if (!box) return;
    var by = {}, totals = {}, issues = {};
    rows(D, "Issues").forEach(function (i) { var d = iso10(i.Date); if (d && str(i.Issue)) issues[d] = str(i.Issue); });
    rows(D, "Stories").forEach(function (s) {
      var d = iso10(s.Date);
      if (!d || !str(s.Headline)) return;
      (by[d] = by[d] || []).push(s);
      var c = str(s.Category) || "Other";
      totals[c] = (totals[c] || 0) + 1;
      if (!issues[d] && str(s.Issue)) issues[d] = str(s.Issue);
    });
    var dates = Object.keys(by).sort();
    if (sec) sec.hidden = !dates.length;
    if (!dates.length) { box.innerHTML = ""; return; }
    var cats = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a] || a.localeCompare(b); });
    var colors = {};
    cats.forEach(function (c, k) { colors[c] = CAT_COLORS[k] || "var(--chart-muted)"; });
    var info = {}, min = Infinity, max = 0;
    dates.forEach(function (d) {
      var cnt = {}, best = "", bestN = 0;
      by[d].forEach(function (s) {
        var c = str(s.Category) || "Other";
        cnt[c] = (cnt[c] || 0) + 1;
        if (cnt[c] > bestN) { bestN = cnt[c]; best = c; }
      });
      info[d] = { n: by[d].length, cat: best, catN: bestN };
      min = Math.min(min, by[d].length); max = Math.max(max, by[d].length);
    });
    PU.byDate = by; PU.colors = colors; PU.info = info; PU.issues = issues;
    if (!PU.sel || !by[PU.sel]) PU.sel = dates[dates.length - 1];

    var t0 = dayMs(dates[0]), t1 = dayMs(dates[dates.length - 1]);
    var dow0 = (new Date(t0).getUTCDay() + 6) % 7, dow1 = (new Date(t1).getUTCDay() + 6) % 7;
    var start = t0 - dow0 * 864e5, end = t1 + (6 - dow1) * 864e5;
    var weeks = Math.round((end - start) / 864e5 / 7) + 1;
    var cells = "", months = "", lastMonth = -1;
    for (var w = 0; w < weeks; w++) {
      var wk = start + w * 7 * 864e5;
      // Label a column with the month its last day falls in, once per month
      var mo = new Date(wk + 6 * 864e5).getUTCMonth();
      if (mo !== lastMonth) {
        lastMonth = mo;
        months += '<span class="x-pulse__mon" style="grid-column:' + (w + 2) + '">' + MONTHS[mo] + "</span>";
      }
      for (var r = 0; r < 7; r++) {
        var t = wk + r * 864e5, d = isoOf(t), dt = new Date(t), day = dt.getUTCDate();
        var pos = 'style="grid-column:' + (w + 2) + ";grid-row:" + (r + 2);
        var it = info[d];
        if (!it) {
          cells += '<span class="x-pulse__sq is-empty" ' + pos + '" aria-hidden="true"></span>';
          continue;
        }
        var a = max > min ? Math.round(40 + 60 * (it.n - min) / (max - min)) : 100;
        cells += '<button type="button" class="x-pulse__sq" data-pu="' + d + '" ' + pos + ";--c:" + colors[it.cat] + ";--a:" + a + '%"' +
          ' aria-pressed="' + (d === PU.sel ? "true" : "false") + '" aria-label="' + esc(longDate(d) + ": " + plural(it.n, "story") + ", mostly " + it.cat) + '">' +
          '<span aria-hidden="true">' + day + "</span></button>";
      }
    }
    var dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function (l, k) {
      return '<span class="x-pulse__day" style="grid-row:' + (k + 2) + '">' + l + "</span>";
    }).join("");
    var legend = cats.map(function (c) {
      return '<li><span class="x-pulse__sw" style="--c:' + colors[c] + '"></span>' + esc(c) + "</li>";
    }).join("");
    var scale = max > min
      ? '<p class="x-pulse__scale"><span>' + plural(min, "story") + '</span><span class="x-pulse__ramp" aria-hidden="true"><i style="--a:40%"></i><i style="--a:70%"></i><i style="--a:100%"></i></span><span>' + plural(max, "story") + "</span></p>"
      : '<p class="x-pulse__scale">Every brief carried ' + plural(max, "story") + ", so every square is at full strength.</p>";
    box.innerHTML =
      '<div class="x-pulse__wrap"><div class="x-pulse__scroll" id="pu-scroll">' +
      '<div class="x-pulse__grid" role="group" aria-label="Brief calendar, one square per brief date" style="grid-template-columns:auto repeat(' + weeks + ',var(--x-sq))">' +
      months + dayLabels + cells + "</div></div>" +
      '<div class="x-pulse__key"><ul class="x-pulse__legend" aria-label="Dominant category">' + legend + "</ul>" + scale + "</div></div>" +
      '<div class="x-pulse__panel" id="pu-panel" aria-live="polite"></div>';
    var sc = $("pu-scroll");
    if (sc) sc.scrollLeft = sc.scrollWidth;
    showPulseDay();
  }
  function showPulseDay() {
    var p = $("pu-panel"), d = PU.sel, list = PU.byDate[d] || [];
    if (!p) return;
    [].forEach.call(document.querySelectorAll("[data-pu]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-pu") === d ? "true" : "false"); });
    var it = PU.info[d] || {};
    p.innerHTML =
      '<p class="x-pulse__ph"><b>' + esc(longDate(d)) + "</b>" + (PU.issues[d] ? " · Issue " + esc(PU.issues[d]) : "") + " · " + plural(list.length, "story") +
      (it.cat ? ' · mostly <span class="x-pulse__sw" style="--c:' + PU.colors[it.cat] + '"></span>' + esc(it.cat) : "") + "</p>" +
      '<ol class="x-pulse__list">' + list.map(function (s) {
        var u = okUrl(s.Link), c = str(s.Category) || "Other";
        var h = u ? '<a class="link" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(s.Headline) + "</a>" : esc(s.Headline);
        return '<li><span class="x-pulse__cat"><span class="x-pulse__sw" style="--c:' + PU.colors[c] + '"></span>' + esc(c) + "</span>" +
          '<span class="x-pulse__hl">' + h + (str(s.Source) ? "<small>" + esc(s.Source) + "</small>" : "") + "</span></li>";
      }).join("") + "</ol>";
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-pu]") : null;
    if (!b) return;
    PU.sel = b.getAttribute("data-pu");
    showPulseDay();
  });

  /* ---------- 3. Five pillars wheel ---------- */
  var PILLARS = ["Semiconductors", "Robotics", "Advanced manufacturing", "Biotechnology", "Energy"];
  var PL = { range: "all", sel: "", chart: null, built: false, items: [] };
  function pillarItems() {
    var map = {}, lc = {};
    rows(D, "Stories").forEach(function (s) {
      var k = iso10(s.Date) + "|" + str(s.Headline);
      map[k] = s; lc[k.toLowerCase()] = s;
    });
    return Object.keys(PILLARS_RAW).map(function (k) {
      var cut = k.indexOf("|"), d = iso10(k.slice(0, cut)), h = str(k.slice(cut + 1));
      var tags = Array.isArray(PILLARS_RAW[k]) ? PILLARS_RAW[k].map(str) : [];
      var s = map[d + "|" + h] || lc[(d + "|" + h).toLowerCase()] || {};
      return { date: d, headline: h, tags: tags, link: okUrl(s.Link), cat: str(s.Category), source: str(s.Source) };
    }).filter(function (x) { return x.date && x.headline; });
  }
  function pillarsInRange() {
    var all = PL.items, newest = "";
    all.forEach(function (x) { if (x.date > newest) newest = x.date; });
    rows(D, "Stories").forEach(function (s) { var d = iso10(s.Date); if (d > newest && all.some(function (x) { return x.date === d; })) newest = d; });
    var cutoff = newest ? isoOf(dayMs(newest) - 6 * 864e5) : "";
    var list = PL.range === "week" ? all.filter(function (x) { return x.date >= cutoff; }) : all;
    return { list: list, from: cutoff, to: newest };
  }
  function buildPillars() {
    var box = $("pl-box"), sec = $("pillars");
    if (!box) return;
    PL.items = pillarItems();
    if (sec) sec.hidden = !PL.items.length;
    if (!PL.items.length || !window.Chart) return;
    if (!PL.built) {
      PL.built = true;
      box.innerHTML =
        '<div class="x-seg x-pl__seg" role="tablist" aria-label="Time range">' +
        '<button type="button" role="tab" data-pl-range="week" aria-selected="false" tabindex="-1">This week</button>' +
        '<button type="button" role="tab" data-pl-range="all" aria-selected="true">All time</button></div>' +
        '<p class="x-count" id="pl-scope" aria-live="polite"></p>' +
        '<div class="pair x-pl">' +
        '<figure class="chart x-pl__chart"><figcaption class="chart__cap">Stories by pillar<small>AI runs through every story; the slices are the other five pillars. A story can sit in more than one.</small></figcaption>' +
        '<div class="chart__canvas"><canvas id="pl-canvas" role="img" aria-label="Stories by pillar"></canvas>' +
        '<p class="x-pl__center" aria-hidden="true"><b>AI</b><span id="pl-ai"></span></p></div>' +
        '<ul class="x-pl__keys" id="pl-keys" aria-label="Pillars"></ul></figure>' +
        '<div class="x-pl__panel" id="pl-panel" aria-live="polite"></div></div>';
      box.addEventListener("click", function (ev) {
        var r = ev.target.closest("[data-pl-range]");
        if (r) {
          PL.range = r.getAttribute("data-pl-range");
          [].forEach.call(box.querySelectorAll("[data-pl-range]"), function (b) {
            var on = b === r;
            b.setAttribute("aria-selected", on ? "true" : "false");
            b.tabIndex = on ? 0 : -1;
          });
          drawPillars();
          return;
        }
        var k = ev.target.closest("[data-pl]");
        if (k && !k.disabled) { PL.sel = k.getAttribute("data-pl"); drawPillars(); }
      });
      PL.chart = new Chart($("pl-canvas"), {
        type: "doughnut",
        data: { labels: PILLARS.slice(), datasets: [{ data: [], backgroundColor: PILLARS.map(function (p, k) { return "var(--chart-" + (k + 1) + ")"; }), offset: [], hoverOffset: 6 }] },
        options: {
          cutout: "66%",
          layout: { padding: 10 },
          plugins: {
            legend: { display: false },
            datalabels: { display: false },
            tooltip: { filter: function () { return !PL.empty; }, callbacks: { label: function (ctx) { return " " + plural(ctx.raw, "story"); } } }
          },
          onClick: function (ev, els) {
            if (PL.empty || !els || !els.length) return;
            PL.sel = PILLARS[els[0].index];
            drawPillars();
          },
          onHover: function (ev, els) { var c = ev.native && ev.native.target; if (c) c.style.cursor = els.length && !PL.empty ? "pointer" : "default"; }
        }
      });
    }
    drawPillars();
  }
  function drawPillars() {
    var r = pillarsInRange(), list = r.list;
    var counts = PILLARS.map(function (p) { return list.filter(function (x) { return x.tags.indexOf(p) >= 0; }).length; });
    var ai = list.filter(function (x) { return x.tags.indexOf("AI") >= 0; }).length;
    var total = counts.reduce(function (a, b) { return a + b; }, 0);
    PL.empty = total === 0;
    if (!PL.sel || counts[PILLARS.indexOf(PL.sel)] === 0) {
      var best = -1;
      counts.forEach(function (c, k) { if (c > 0 && (best < 0 || c > counts[best])) best = k; });
      PL.sel = best >= 0 ? PILLARS[best] : "";
    }
    var ds = PL.chart.data.datasets[0];
    if (PL.empty) {
      PL.chart.data.labels = ["None"];
      ds.data = [1];
      ds.backgroundColor = ["var(--chart-muted)"];
      ds.offset = [0];
    } else {
      PL.chart.data.labels = PILLARS.slice();
      ds.data = counts;
      ds.backgroundColor = PILLARS.map(function (p, k) { return "var(--chart-" + (k + 1) + ")"; });
      ds.offset = PILLARS.map(function (p) { return p === PL.sel ? 10 : 0; });
    }
    PL.chart.update(REDUCED ? "none" : undefined);
    $("pl-ai").textContent = plural(ai, "story");
    $("pl-scope").textContent = PL.range === "week"
      ? "This week: " + shortDate(r.from) + " to " + shortDate(r.to) + " · " + plural(list.length, "story")
      : "All time · " + plural(list.length, "story");
    $("pl-canvas").setAttribute("aria-label", "AI on " + plural(ai, "story") + ". " + PILLARS.map(function (p, k) { return p + " " + counts[k]; }).join(", "));
    $("pl-keys").innerHTML = PILLARS.map(function (p, k) {
      return '<li><button type="button" class="x-pl__key" data-pl="' + esc(p) + '" aria-pressed="' + (p === PL.sel ? "true" : "false") + '"' + (counts[k] ? "" : " disabled") + ">" +
        '<span class="x-pulse__sw" style="--c:var(--chart-' + (k + 1) + ')"></span><span>' + esc(p) + "</span><b>" + counts[k] + "</b></button></li>";
    }).join("");
    var panel = $("pl-panel");
    if (!PL.sel) {
      panel.innerHTML = '<p class="x-empty">No stories ' + (PL.range === "week" ? "this week" : "yet") + " touch a pillar beyond AI.</p>";
      return;
    }
    var mine = list.filter(function (x) { return x.tags.indexOf(PL.sel) >= 0; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    panel.innerHTML =
      '<p class="x-pulse__ph"><span class="x-pulse__sw" style="--c:var(--chart-' + (PILLARS.indexOf(PL.sel) + 1) + ')"></span><b>' + esc(PL.sel) + "</b> · " + plural(mine.length, "story") + "</p>" +
      '<ol class="x-pulse__list">' + mine.map(function (x) {
        var h = x.link ? '<a class="link" href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.headline) + "</a>" : esc(x.headline);
        var also = x.tags.filter(function (t) { return t !== "AI" && t !== PL.sel; });
        return '<li><span class="x-pulse__cat">' + esc(shortDate(x.date)) + "</span>" +
          '<span class="x-pulse__hl">' + h + "<small>" + esc([x.cat, also.length ? "Also " + also.join(", ") : ""].filter(Boolean).join(" · ")) + "</small></span></li>";
      }).join("") + "</ol>";
  }

  /* ---------- Hook ---------- */
  var ran2 = false;
  function update(data) {
    D = data && typeof data === "object" ? data : {};
    ran2 = true;
    // Heavy visuals draw only when their section scrolls near (XLazy), always from the newest data
    [["star-race", buildRace], ["pulse", buildPulse], ["pillars", buildPillars]].forEach(function (p) {
      var run = function () { try { p[1](); } catch (e) { if (window.console) console.warn(e); } };
      if (window.XLazy) XLazy("v2-" + p[0], document.getElementById(p[0]), run); else run();
    });
  }
  function hook() {
    var X = window.XVisuals;
    if (!X || X.__batch2) return;
    var orig = X.update;
    X.update = function (data) {
      var r;
      try { r = orig.apply(X, arguments); } catch (e) {}
      update(data);
      return r;
    };
    X.__batch2 = true;
    X.update2 = update;
  }
  hook();
  // If the page rendered before this file loaded, draw from the snapshot now
  if (window.BRIEF_SNAPSHOT && Object.keys(window.BRIEF_SNAPSHOT).length) {
    var go = function () { if (!ran2) update(window.BRIEF_SNAPSHOT); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
  }
})();
