/* One to Better visuals, batch 1: daily covers, paper previews, company logos, glossary flashcards.
   Reads the inline visuals block (#brief-visuals) and whatever data the page renders, through XVisuals.update(D).
   Every part tolerates missing keys: a missing cover, thumb or domain simply falls back. */
window.XVisuals = (function () {
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
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dayMs(iso) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str(iso));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }
  function shortDate(iso) {
    var t = dayMs(iso);
    if (isNaN(t)) return str(iso);
    var d = new Date(t);
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  }
  function iso10(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(v)); return m ? m[0] : str(v); }

  // Visuals block
  var V = {};
  try {
    var el = $("brief-visuals");
    V = obj(JSON.parse((el && el.textContent) || "{}"));
  } catch (e) { V = {}; }
  var COVERS = obj(V.covers), THUMBS = obj(V.paper_thumbs), GEO = obj(V.companies_geo);
  var GEO_LC = {}, THUMB_LC = {};
  Object.keys(GEO).forEach(function (k) { GEO_LC[k.toLowerCase()] = obj(GEO[k]); });
  Object.keys(THUMBS).forEach(function (k) { THUMB_LC[k.toLowerCase()] = THUMBS[k]; });
  function cover(date) { var c = COVERS[iso10(date)]; return typeof c === "string" && /^(data:image\/|https?:\/\/)/.test(c) ? c : ""; }
  function thumb(title) { var t = THUMBS[title] || THUMB_LC[str(title).toLowerCase()]; return typeof t === "string" && /^https?:\/\//.test(t) ? t : ""; }
  function domainOf(name) {
    var g = GEO[name] || GEO_LC[str(name).toLowerCase()] || {};
    var d = str(g.domain).replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d) && !NO_FAVICON.test(d) ? d : "";
  }
  // Domains the favicon service answers with a 404: show initials without requesting
  var NO_FAVICON = /^(www\.)?(zest\.app|alibabagroup\.com|nju\.edu\.cn|hexafuture\.ai|iquest\.ai|ruc\.edu\.cn|sjtu\.edu\.cn|sensenova\.cn|myflorida\.com|jd\.com|new\.quest|zju\.edu\.cn)$/i;
  function initials(name) {
    var w = str(name).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    if (!w.length) return "?";
    return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
  }

  // Logos: favicon in a round frame, initials when it fails
  function logo(name) {
    var d = domainOf(name), ini = esc(initials(name));
    var img = d ? '<img class="x-logo__img" src="https://www.google.com/s2/favicons?domain=' + encodeURIComponent(d) + '&amp;sz=64" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' : "";
    return '<span class="x-logo' + (d ? "" : " is-initials") + '" title="' + esc(name) + '" role="img" aria-label="' + esc(name) + '">' +
      img + '<span class="x-logo__ini" aria-hidden="true">' + ini + "</span></span>";
  }
  function logoFail(img) {
    var s = img.closest(".x-logo");
    if (s) s.classList.add("is-initials");
    img.remove();
  }
  // Errors don't bubble, so catch them on the way down
  document.addEventListener("error", function (ev) {
    var t = ev.target;
    if (!t || t.tagName !== "IMG") return;
    if (t.classList.contains("x-logo__img")) logoFail(t);
    else if (t.hasAttribute("data-xv-hide")) {
      var box = t.closest("[data-xv-box]") || t;
      box.hidden = true;
    }
  }, true);
  // The favicon service answers unknown domains with a 16px globe: treat that as missing
  document.addEventListener("load", function (ev) {
    var t = ev.target;
    if (t && t.tagName === "IMG" && t.classList.contains("x-logo__img") && t.naturalWidth && t.naturalWidth < 32) logoFail(t);
  }, true);

  var D = {};
  function companiesFor(headline) {
    var out = [], seen = {};
    rows(D, "Connections").forEach(function (c) {
      var t = str(c["Entity type"]);
      if (str(c["Item type"]) !== "Story" || str(c.Item) !== headline || (t !== "Company" && t !== "Organization")) return;
      var n = str(c.Entity);
      if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; out.push(n); }
    });
    return out;
  }

  function decorateStories() {
    var box = $("story-cards");
    if (!box) return;
    [].forEach.call(box.querySelectorAll(".x-stack"), function (card) {
      if (card.querySelector(".x-logos")) return;
      var h = card.querySelector("h3");
      if (!h) return;
      var names = companiesFor(str(h.textContent));
      if (!names.length) return;
      var row = document.createElement("div");
      row.className = "x-logos";
      row.innerHTML = names.slice(0, 6).map(logo).join("") + (names.length > 6 ? '<span class="x-logos__more">+' + (names.length - 6) + "</span>" : "");
      h.parentNode.insertBefore(row, h);
    });
  }

  function decoratePapers() {
    var box = $("paper-cards");
    if (!box) return;
    [].forEach.call(box.querySelectorAll(".x-stack"), function (card) {
      if (card.querySelector(".x-thumb")) return;
      var h = card.querySelector("h3");
      var src = h ? thumb(str(h.textContent)) : "";
      if (!src) return;
      var f = document.createElement("figure");
      f.className = "x-thumb";
      f.setAttribute("data-xv-box", "");
      f.innerHTML = '<img src="' + esc(src) + '" alt="Preview of the paper ' + esc(str(h.textContent)) + '" loading="lazy" decoding="async" data-xv-hide />';
      card.insertBefore(f, card.firstChild);
    });
  }

  function decorateDir() {
    var list = $("d-list");
    if (!list) return;
    [].forEach.call(list.querySelectorAll('details[data-key^="Company|"]'), function (d) {
      var nameEl = d.querySelector(".x-dir__name");
      if (!nameEl || nameEl.querySelector(".x-logo")) return;
      var name = d.getAttribute("data-key").slice(8);
      nameEl.insertAdjacentHTML("afterbegin", logo(name));
    });
  }
  var dl = $("d-list");
  if (dl && "MutationObserver" in window) new MutationObserver(decorateDir).observe(dl, { childList: true });

  // Covers
  function issueList() {
    var by = {};
    rows(D, "Issues").forEach(function (i) {
      var d = iso10(i.Date);
      if (d && !by[d]) by[d] = { date: d, issue: str(i.Issue) };
    });
    Object.keys(COVERS).forEach(function (d) { if (!isNaN(dayMs(d)) && !by[d]) by[d] = { date: d, issue: "" }; });
    var lead = {};
    rows(D, "Stories").forEach(function (s) {
      var d = iso10(s.Date);
      if (d && !lead[d] && str(s.Headline)) lead[d] = str(s.Headline);
      if (by[d] && !by[d].issue && str(s.Issue)) by[d].issue = str(s.Issue);
    });
    return Object.keys(by).sort().reverse().map(function (d) { by[d].lead = lead[d] || ""; return by[d]; });
  }
  function newestDate() {
    var ds = rows(D, "Issues").map(function (i) { return iso10(i.Date); }).filter(function (d) { return !isNaN(dayMs(d)); }).sort();
    return ds.length ? ds[ds.length - 1] : "";
  }
  function renderTodayCover() {
    var f = $("today-cover");
    if (!f) return;
    var d = newestDate(), src = d ? cover(d) : "";
    var issue = (rows(D, "Issues").filter(function (i) { return iso10(i.Date) === d; })[0] || {}).Issue;
    f.hidden = !src;
    f.innerHTML = src ? '<img src="' + esc(src) + '" alt="Cover of ' + (issue ? "Issue " + esc(issue) : "today's issue") + ", " + esc(shortDate(d)) + '" data-xv-hide />' : "";
    if (src) f.setAttribute("data-xv-box", "");
  }
  function renderWall() {
    var wall = $("cv-wall");
    if (!wall) return;
    var list = issueList();
    var sec = $("covers");
    if (sec) sec.hidden = !list.length;
    wall.innerHTML = list.map(function (it, n) {
      var src = cover(it.date), no = it.issue ? "Issue " + esc(it.issue) : "";
      var media = src
        ? '<img src="' + esc(src) + '" alt=""' + (n > 5 ? ' loading="lazy"' : "") + ' decoding="async" data-xv-swap />'
        : "";
      return '<button type="button" class="x-cv" data-cv="' + esc(it.date) + '" aria-label="' + esc((no ? no + ", " : "") + shortDate(it.date) + (it.lead ? ". " + it.lead : "") + ". Show in Archive") + '">' +
        '<span class="x-cv__media' + (src ? "" : " is-empty") + '">' + media + '<span class="x-cv__no" aria-hidden="true">' + (no || esc(shortDate(it.date))) + "</span></span>" +
        '<span class="x-cv__meta"><span>' + esc(shortDate(it.date)) + "</span>" + (no ? "<b>" + no + "</b>" : "") + "</span>" +
        (it.lead ? '<span class="x-cv__lead">' + esc(it.lead) + "</span>" : "") + "</button>";
    }).join("");
  }
  // A cover that fails to load turns into the gray tile
  document.addEventListener("error", function (ev) {
    var t = ev.target;
    if (t && t.tagName === "IMG" && t.hasAttribute("data-xv-swap")) {
      var m = t.parentNode;
      if (m) m.classList.add("is-empty");
      t.remove();
    }
  }, true);
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-cv]") : null;
    if (!b) return;
    var d = b.getAttribute("data-cv"), sel = $("f-date"), arc = $("archive");
    if (sel) {
      var has = [].some.call(sel.options, function (o) { return o.value === d; });
      if (!has) {
        var o = document.createElement("option");
        o.value = d; o.textContent = shortDate(d);
        sel.appendChild(o);
      }
      sel.value = d;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (arc) arc.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
  });

  // Glossary flashcards
  var FC = { on: false, built: false, deck: [], i: 0, flipped: false, newOnly: false, shuffled: false };
  function glossary() {
    return rows(D, "Glossary").filter(function (g) { return str(g.Term); });
  }
  function isNewTerm(g, newest) {
    var a = dayMs(g["First seen"]), b = dayMs(newest);
    if (isNaN(a) || isNaN(b)) return false;
    var days = (b - a) / 864e5;
    return days >= 0 && days < 7;
  }
  function newestGlossDate() {
    var d = newestDate();
    if (d) return d;
    var ds = glossary().map(function (g) { return iso10(g["First seen"]); }).filter(function (x) { return !isNaN(dayMs(x)); }).sort();
    return ds.length ? ds[ds.length - 1] : "";
  }
  function buildFC() {
    var box = $("g-flash");
    if (!box || FC.built) return;
    FC.built = true;
    box.innerHTML =
      '<div class="x-fc__bar"><label class="x-fc__chk"><input type="checkbox" id="fc-new" /> New this week</label>' +
      '<span class="x-count" id="fc-prog" aria-live="polite"></span></div>' +
      '<div class="x-fc__stage" id="fc-stage">' +
      '<button type="button" class="x-fc__card" id="fc-card" aria-label="Flip card">' +
      '<span class="x-fc__inner">' +
      '<span class="x-fc__face x-fc__front" id="fc-front"><span class="x-fc__k">Term</span><span class="x-fc__term" id="fc-term"></span><span class="x-fc__hint">Tap to see the meaning</span></span>' +
      '<span class="x-fc__face x-fc__back" id="fc-back" aria-hidden="true"><span class="x-fc__k">Meaning</span><span class="x-fc__mean" id="fc-mean"></span></span>' +
      "</span></button></div>" +
      '<p class="x-empty" id="fc-empty" hidden>No terms match.</p>' +
      '<div class="links x-fc__nav">' +
      '<button type="button" class="btn" id="fc-prev">Previous</button>' +
      '<button type="button" class="btn" id="fc-next">Next</button>' +
      '<button type="button" class="btn" id="fc-shuffle">Shuffle</button></div>';
    $("fc-card").addEventListener("click", function () {
      if (FC.swiped) { FC.swiped = false; return; }
      flip();
    });
    $("fc-prev").addEventListener("click", function () { go(-1); });
    $("fc-next").addEventListener("click", function () { go(1); });
    $("fc-shuffle").addEventListener("click", function () {
      var a = FC.deck;
      for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; }
      FC.shuffled = true; FC.i = 0; FC.flipped = false; showFC();
    });
    $("fc-new").addEventListener("change", function () { FC.newOnly = this.checked; FC.shuffled = false; deckFC(); });
    box.addEventListener("keydown", function (ev) {
      if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
      if (ev.key === "ArrowRight") { ev.preventDefault(); go(1); }
      else if (ev.key === "ArrowLeft") { ev.preventDefault(); go(-1); }
    });
    var sx = 0, sy = 0, st = $("fc-stage");
    st.addEventListener("touchstart", function (ev) { var t = ev.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    st.addEventListener("touchend", function (ev) {
      var t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { FC.swiped = true; setTimeout(function () { FC.swiped = false; }, 400); go(dx < 0 ? 1 : -1); }
    }, { passive: true });
  }
  function deckFC() {
    if (!FC.built) return;
    var cur = FC.deck[FC.i] && str(FC.deck[FC.i].Term);
    var q = str($("g-q") && $("g-q").value).toLowerCase(), newest = newestGlossDate();
    var all = glossary();
    var nNew = all.filter(function (g) { return isNewTerm(g, newest); }).length;
    var lab = document.querySelector(".x-fc__chk");
    if (lab) lab.lastChild.textContent = " New this week (" + nNew + ")";
    FC.deck = all.filter(function (g) {
      if (FC.newOnly && !isNewTerm(g, newest)) return false;
      return !q || (str(g.Term) + " " + str(g.Meaning)).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return str(a.Term).localeCompare(str(b.Term), "en", { sensitivity: "base" }); });
    var at = -1;
    FC.deck.forEach(function (g, k) { if (at < 0 && str(g.Term) === cur) at = k; });
    FC.i = at >= 0 ? at : 0;
    FC.flipped = false;
    showFC();
  }
  function showFC() {
    var n = FC.deck.length, g = FC.deck[FC.i] || {};
    $("fc-empty").hidden = n > 0;
    $("fc-empty").textContent = FC.newOnly ? "No new terms this week." : "No terms match.";
    $("fc-stage").hidden = !n;
    $("fc-prog").textContent = n ? FC.i + 1 + " of " + n : "0 of 0";
    $("fc-term").textContent = str(g.Term);
    $("fc-mean").textContent = str(g.Meaning);
    ["fc-prev", "fc-next", "fc-shuffle"].forEach(function (id) { $(id).disabled = n < 2; });
    setFlip();
  }
  function setFlip() {
    var c = $("fc-card");
    c.classList.toggle("is-flipped", FC.flipped);
    c.setAttribute("aria-label", FC.flipped ? "Showing the meaning. Flip back to the term" : "Showing the term. Flip to see the meaning");
    $("fc-front").setAttribute("aria-hidden", FC.flipped ? "true" : "false");
    $("fc-back").setAttribute("aria-hidden", FC.flipped ? "false" : "true");
  }
  function flip() { if (!FC.deck.length) return; FC.flipped = !FC.flipped; setFlip(); }
  function go(d) {
    var n = FC.deck.length;
    if (n < 2) return;
    FC.i = (FC.i + d + n) % n;
    FC.flipped = false;
    showFC();
  }
  function setFC(on) {
    FC.on = on;
    var b = $("g-flash-toggle"), box = $("g-flash"), list = $("g-list"), sec = $("glossary");
    if (on) { buildFC(); deckFC(); }
    if (b) { b.setAttribute("aria-pressed", on ? "true" : "false"); b.textContent = on ? "Show list" : "Flashcards"; }
    if (box) box.hidden = !on;
    if (list) list.hidden = on;
    if (sec) sec.classList.toggle("x-fc-on", on);
  }
  var tg = $("g-flash-toggle");
  if (tg) tg.addEventListener("click", function () { setFC(!FC.on); });
  var gq = $("g-q");
  if (gq) gq.addEventListener("input", function () { if (FC.on) { FC.shuffled = false; deckFC(); } });

  function update(data) {
    D = data && typeof data === "object" ? data : {};
    [renderTodayCover, renderWall, decorateStories, decoratePapers, decorateDir].forEach(function (f) { try { f(); } catch (e) {} });
    if (FC.on && !FC.shuffled) try { deckFC(); } catch (e) {}
  }

  return { update: update, logo: logo, cover: cover };
})();
