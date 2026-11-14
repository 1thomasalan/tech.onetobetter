/* The Tech Brief: Five Pillars lens (approved by Alan 2026-11-14). The news stays AI-only.
   1. Pillar pulse strip on Today: AI, Robotics, Manufacturing, Biotech, Energy tiles + the Semiconductors foundation bar,
      with today's item count per pillar. Tap a tile to filter Today; tap it again (or Clear) to show everything.
   2. "Where it lands": an optional one-liner on an item (visuals.json where_it_lands), only when it truly reaches another pillar.
   3. "Beyond the chatbot": the weekly (Monday) AI story from robotics, biotech, manufacturing or energy (visuals.json beyond).
   4. Weekly pillar trends in the Library's Pillars section: a bar per pillar per week, from every issue.
   5. Pillar badge on cards (pillars other than AI; AI runs through everything).
   Needs otb-share.js (window.XNext). Reads data only; never invents a tag: an item without pillars is simply AI. */
(function () {
  "use strict";
  var X = window.XNext;
  if (!X) return;
  var esc = X.esc, str = X.str;
  var TILES = ["AI", "Robotics", "Advanced manufacturing", "Biotechnology", "Energy"];
  var SHORT = X.PILLAR_SHORT, INI = X.PILLAR_INI;
  var BOXES = ["story-cards", "rl-cards", "ab-cards", "repo-cards", "paper-cards"];
  var SECTION_OF = { "story-cards": "stories", "rl-cards": "releases", "ab-cards": "ai-business", "repo-cards": "github", "paper-cards": "research" };
  var filter = "";

  function counts(date) {
    var c = { Semiconductors: 0 }, list = X.items(date);
    TILES.forEach(function (p) { c[p] = 0; });
    list.forEach(function (it) { X.pillarsOf(it.type, it.date, it.title).forEach(function (p) { if (c.hasOwnProperty(p)) c[p]++; }); });
    return { c: c, n: list.length };
  }

  // 1. The pulse strip
  function strip() {
    var box = document.getElementById("otb-pulse");
    if (!box) {
      var top = document.querySelector("#today .x-bluf--top");
      if (!top) return null;
      box = document.createElement("section");
      box.id = "otb-pulse";
      box.className = "otbp";
      box.setAttribute("aria-label", "Today across the five pillars");
      top.parentNode.insertBefore(box, top.nextSibling);
      if (window.ResizeObserver) { var w0 = 0; new ResizeObserver(function () { var w = box.clientWidth; if (w !== w0) { w0 = w; fitLabels(); } }).observe(box); }
    }
    return box;
  }
  var lastKey = "";
  function drawStrip() {
    var box = strip();
    if (!box) return;
    var date = X.today(), k = counts(date), key = date + JSON.stringify(k.c) + filter;
    if (key === lastKey && box.firstChild) return;
    lastKey = key;
    var h = '<div class="otbp-head"><h2 class="otbp-k">Today across the five pillars</h2><a class="otbp-what" href="#pillars" data-otbp-what>What\u2019s this?</a></div>';
    h += '<div class="otbp-tiles" role="group" aria-label="Filter today by pillar">';
    TILES.forEach(function (p) {
      var n = k.c[p], on = filter === p;
      h += '<button type="button" class="otbp-tile' + (n ? " has" : " is-zero") + (on ? " is-on" : "") + '" data-otbp="' + esc(p) + '" aria-pressed="' + (on ? "true" : "false") + '"' +
        ' aria-label="' + esc(p) + ": " + n + (n === 1 ? " item" : " items") + ' today' + (n ? ". Show only these" : "") + '">' +
        '<b class="otbp-ico" aria-hidden="true">' + esc(INI[p]) + '</b><span class="otbp-l" aria-hidden="true">' + (p === "Advanced manufacturing" ? '<span class="otbp-full">Manufacturing</span><span class="otbp-abbr">Mfg</span>' : esc(SHORT[p])) + '</span><span class="otbp-n" aria-hidden="true">' + n + "</span></button>";
    });
    h += "</div>";
    var sn = k.c.Semiconductors, son = filter === "Semiconductors";
    h += '<button type="button" class="otbp-found' + (sn ? " has" : "") + (son ? " is-on" : "") + '" data-otbp="Semiconductors" aria-pressed="' + (son ? "true" : "false") + '" aria-label="Semiconductors, the foundation: ' + sn + (sn === 1 ? " item" : " items") + ' today">' +
      '<span class="otbp-found__l"><b>Semiconductors</b> · the foundation</span><span class="otbp-found__n">' + sn + " today</span></button>";
    h += '<p class="otbp-status" role="status" aria-live="polite"></p>';
    box.innerHTML = h;
    fitLabels();
    status();
  }
  // Keep every pillar name whole: shrink a label's type a little when its tile is narrow (no truncation, no mid-word break)
  function fitLabels() {
    [].forEach.call(document.querySelectorAll("#otb-pulse .otbp-l"), function (l) {
      l.style.fontSize = "";
      l.classList.remove("is-short");
      var size = parseFloat(getComputedStyle(l).fontSize) || 12, guard = 0;
      while (l.scrollWidth > l.clientWidth + 0.5 && size > 10.5 && guard++ < 6) { size -= 0.5; l.style.fontSize = size + "px"; }
      // The approved phone mockup shortens Manufacturing to "Mfg" when the tile is too narrow
      if (l.scrollWidth > l.clientWidth + 0.5 && l.querySelector(".otbp-abbr")) { l.style.fontSize = ""; l.classList.add("is-short"); }
    });
  }
  var rz = 0;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(fitLabels, 120); });
  function status(msg) {
    var s = document.querySelector("#otb-pulse .otbp-status");
    if (!s) return;
    if (msg) { s.innerHTML = esc(msg); return; }
    if (!filter) { s.innerHTML = ""; return; }
    var n = visibleCount();
    s.innerHTML = (filter === "AI" ? "All " + n + " of today\u2019s items touch AI. AI runs through every item in the brief." :
      "Showing " + n + (n === 1 ? " item" : " items") + " in " + esc(filter) + ".") +
      ' <button type="button" class="otbp-clear" data-otbp-clear>Clear</button>';
  }

  // Filter Today
  function matches(it) { return !filter || (it && X.pillarsOf(it.type, it.date, it.title).indexOf(filter) >= 0); }
  var nVisible = 0;
  function visibleCount() { return nVisible; }
  function apply() {
    var today = X.today();
    nVisible = 0;
    var lead = document.getElementById("lead");
    if (lead) {
      var li = X.items(today).filter(function (x) { return x.lead; })[0];
      var show = matches(li);
      lead.classList.toggle("otbp-out", !show);
      if (show && li) nVisible++;
    }
    BOXES.forEach(function (id) {
      var box = document.getElementById(id), any = false;
      if (!box) return;
      [].forEach.call(box.children, function (card) {
        var it = X.cardItem(card), show = matches(it);
        card.classList.toggle("otbp-out", !show);
        if (show) any = true;
        if (show && it) nVisible++;
      });
      var sec = document.getElementById(SECTION_OF[id]);
      if (sec) sec.classList.toggle("otbp-none", !!filter && !any);
    });
    [].forEach.call(document.querySelectorAll("[data-otb-item]"), function (card) {
      var it = X.findBySlug(card.getAttribute("data-otb-item"));
      card.classList.toggle("otbp-out", !matches(it));
    });
    document.documentElement.classList.toggle("otbp-filtering", !!filter);
    if (window.XApp && XApp.onFilter) try { XApp.onFilter(filter); } catch (e) {}
  }
  function setFilter(p) {
    var k = counts(X.today());
    if (p && p !== filter && !k.c[p]) {
      status("Nothing in " + p + " today. The brief tags a pillar only when a story genuinely reaches it.");
      return;
    }
    filter = p === filter ? "" : p;
    lastKey = "";
    drawStrip();
    apply();
    status();
    var b = document.querySelector('#otb-pulse [data-otbp="' + (filter || p) + '"]');
    if (b) try { b.focus({ preventScroll: true }); } catch (e) {}
  }

  // 2, 3, 5. Badges, Where it lands, Beyond the chatbot on cards
  function icoChip(p) {
    return '<span class="otb-pbadge" title="Pillar: ' + esc(p) + '"><b aria-hidden="true">' + esc(INI[p] || p.charAt(0)) + "</b>" + esc(SHORT[p] || p) + "</span>";
  }
  function decorate(card, it) {
    if (!card || !it || card.getAttribute("data-otbp-done") === it.slug) return;
    card.setAttribute("data-otbp-done", it.slug);
    var ps = X.pillarsOf(it.type, it.date, it.title).filter(function (p) { return p !== "AI"; });
    var already = txtOf(card.querySelectorAll(".x-vchip"));
    var badges = ps.filter(function (p) { return already.indexOf(p) < 0; }).map(icoChip).join("");
    var bc = X.extra("beyond", it.date), isBc = bc && it.type === (bc.type || "Story") && str(bc.title) === it.title;
    var tags = (isBc ? '<span class="otb-bc">Beyond the chatbot</span>' : "") + badges;
    if (tags) {
      var row = card.id === "lead" ? card.querySelector(".x-lead__copy > .x-kicker") : null;
      if (row) {
        var p = document.createElement("p");
        p.className = "otb-prow";
        p.innerHTML = tags;
        row.parentNode.insertBefore(p, row.nextSibling);
      } else {
        row = [].filter.call(card.children, function (c) { return c.tagName === "P" && c.querySelector(".x-cat"); })[0];
        if (row) row.insertAdjacentHTML("beforeend", tags);
        else {
          var h3 = card.querySelector("h3"), pr = document.createElement("p");
          pr.className = "otb-prow";
          pr.innerHTML = tags;
          if (h3) { var anchor = h3.closest(".x-rel__top") || h3; anchor.parentNode.insertBefore(pr, anchor); }
        }
      }
    }
    var lines = "";
    if (isBc && str(bc.note)) lines += '<p class="otb-wil otb-wil--bc"><span class="otb-wil__k">Beyond the chatbot</span> ' + esc(bc.note) + "</p>";
    var w = X.extra("where_it_lands", it.type + "|" + it.date + "|" + it.title);
    if (str(w)) lines += '<p class="otb-wil"><span class="otb-wil__k">Where it lands' + (ps[0] ? " · " + esc(SHORT[ps[0]] || ps[0]) : "") + "</span> " + esc(w) + "</p>";
    if (lines) {
      var scope = card.id === "lead" ? (card.querySelector(".x-lead__copy") || card) : card;
      var after = [].filter.call(scope.children, function (c) { var l = c.querySelector && c.querySelector(".x-label"); return c.tagName === "P" && l && /^(BLUF|Why it matters|Why trending|Similar to)/.test(l.textContent); })[0] ||
        scope.querySelector(".x-lead__line");
      if (after) after.insertAdjacentHTML("afterend", lines);
      else { var dr = scope.querySelector(".x-dig-row"); if (dr) dr.insertAdjacentHTML("beforebegin", lines); else scope.insertAdjacentHTML("beforeend", lines); }
    }
  }
  function txtOf(list) { return [].map.call(list, function (n) { return n.textContent; }).join(" "); }
  function decorateAll() {
    var today = X.today(), lead = document.getElementById("lead");
    if (lead && lead.querySelector(".x-lead__h")) decorate(lead, X.items(today).filter(function (x) { return x.lead; })[0]);
    BOXES.forEach(function (id) {
      var box = document.getElementById(id);
      if (box) [].forEach.call(box.children, function (card) { decorate(card, X.cardItem(card)); });
    });
  }

  // 4. Weekly pillar trends
  function monday(iso) {
    var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
    var wd = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - wd);
    return d.toISOString().slice(0, 10);
  }
  var trendKey = "";
  function drawTrends() {
    var host = document.getElementById("pl-box");
    if (!host) return;
    var box = document.getElementById("otb-trends");
    if (!box) {
      box = document.createElement("figure");
      box.id = "otb-trends";
      box.className = "otbt";
      host.parentNode.insertBefore(box, host.nextSibling);
    }
    var dates = X.rows("Issues").map(function (i) { return X.d10(i.Date); }).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); });
    dates = dates.filter(function (d, i) { return dates.indexOf(d) === i; }).sort();
    var key = dates.join(",") + "|" + X.rows("Stories").length;
    if (key === trendKey && box.firstChild) return;
    trendKey = key;
    var weeks = {}, order = [];
    dates.forEach(function (d) {
      var w = monday(d);
      if (!weeks[w]) { weeks[w] = { n: 0, issues: 0 }; order.push(w); }
      weeks[w].issues++;
      X.items(d).forEach(function (it) {
        weeks[w].n++;
        X.pillarsOf(it.type, it.date, it.title).forEach(function (p) { weeks[w][p] = (weeks[w][p] || 0) + 1; });
      });
    });
    order.sort();
    var show = order.slice(-10), cur = monday(X.today());
    var ROWS = ["AI", "Robotics", "Advanced manufacturing", "Biotechnology", "Energy", "Semiconductors"];
    var h = '<figcaption class="otbt-cap"><span class="otbt-k">Week by week</span><span class="otbt-t">How often each pillar shows up in the brief</span>' +
      '<small>Items per week (stories, releases, business stories, repos and papers). Each row has its own scale. AI runs through every item. Before Nov 14 only stories were tagged beyond AI.</small></figcaption>';
    h += '<div class="otbt-scroll"><table class="otbt-tab"><thead><tr><th scope="col"><span class="x-sr">Pillar</span></th>';
    show.forEach(function (w, i) {
      var d = new Date(w + "T00:00:00Z");
      h += '<th scope="col" class="' + (w === cur ? "is-cur" : "") + (i < show.length - 6 ? " otbt-old" : "") + '">' + (w === cur ? "This week" : X.dateShort(w).replace(/, \d{4}$/, "")) + "</th>";
    });
    h += "</tr></thead><tbody>";
    ROWS.forEach(function (p) {
      var vals = show.map(function (w) { return weeks[w][p] || 0; }), max = Math.max.apply(null, vals) || 1;
      h += '<tr class="' + (p === "Semiconductors" ? "is-found" : "") + '"><th scope="row"><b class="otbp-ico" aria-hidden="true">' + esc(INI[p]) + "</b>" + esc(SHORT[p]) + "</th>";
      show.forEach(function (w, i) {
        var v = weeks[w][p] || 0, ht = v ? Math.max(3, Math.round(34 * v / max)) : 0;
        h += '<td class="' + (w === cur ? "is-cur" : "") + (i < show.length - 6 ? " otbt-old" : "") + '"><span class="otbt-bar" style="height:' + ht + 'px" aria-hidden="true"></span><span class="otbt-v">' + (v || "\u2013") + '</span><span class="x-sr"> ' + esc(p) + " items, week of " + esc(X.dateShort(w)) + "</span></td>";
      });
      h += "</tr>";
    });
    h += "</tbody></table></div>";
    box.innerHTML = h;
  }

  // Wire up
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest ? ev.target : null;
    if (!t) return;
    var b = t.closest("[data-otbp]");
    if (b) { ev.preventDefault(); setFilter(b.getAttribute("data-otbp")); return; }
    if (t.closest("[data-otbp-clear]")) { ev.preventDefault(); filter = ""; lastKey = ""; drawStrip(); apply(); return; }
    var w = t.closest("[data-otbp-what]");
    if (w) {
      ev.preventDefault();
      if (window.XApp && XApp.tab) XApp.tab("library");
      var sec = document.getElementById("pillars");
      if (sec) setTimeout(function () { sec.scrollIntoView({ block: "start" }); }, 30);
    }
  });
  var q = 0;
  function run() {
    q = 0;
    try { drawStrip(); } catch (e) { if (window.console) console.warn(e); }
    try { decorateAll(); } catch (e) { if (window.console) console.warn(e); }
    try { apply(); status(); } catch (e) {}
    try { drawTrends(); } catch (e) { if (window.console) console.warn(e); }
  }
  function queue() { if (!q) q = setTimeout(run, 70); }
  function start() {
    run();
    var main = document.querySelector(".main");
    if (main && window.MutationObserver) new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var n = ms[i].target;
        if (n && n.closest && (n.closest("#otb-pulse") || n.closest("#otb-trends"))) continue;
        queue();
        return;
      }
    }).observe(main, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  window.XPillars = { filter: function () { return filter; }, set: setFilter, counts: counts, apply: apply, redraw: function () { lastKey = ""; trendKey = ""; run(); } };
})();
