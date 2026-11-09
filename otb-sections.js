/* One to Better sections: the lead-story hero, Latest releases and AI & small business.
   Feature logic only. The page passes in whatever data it renders through XSections.update(D, M),
   and the model asks XSections.items(D) for the release and business rows, so they join the
   Archive, the graph and the directory. Every part tolerates a missing tab or key. */
window.XSections = (function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function str(v) { return String(v == null ? "" : v).trim(); }
  function url(u) { u = str(u); return /^https?:\/\//i.test(u) ? u : ""; }
  function ext(href, text, cls) {
    var h = url(href);
    return h ? '<a class="' + (cls || "link") + '" href="' + esc(h) + '" target="_blank" rel="noopener">' + text + "</a>" : text;
  }
  function rows(D, tab) { return (D && Array.isArray(D[tab]) && D[tab]) || []; }
  function iso10(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(v)); return m ? m[0] : str(v); }
  function parts(iso) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str(iso));
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }
  function shortDate(iso) { var d = parts(iso); return d ? MON[d.getUTCMonth()].slice(0, 3) + " " + d.getUTCDate() + ", " + d.getUTCFullYear() : str(iso); }
  function longDate(iso) { var d = parts(iso); return d ? DAYS[d.getUTCDay()] + ", " + MON[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear() : str(iso); }
  function byDateDesc(a, b) { return str(b.Date).localeCompare(str(a.Date)); }
  function hostOf(u) { var m = /^https?:\/\/(?:www\.)?([^\/?#]+)/i.exec(str(u)); return m ? m[1] : ""; }
  function initials(name) {
    var w = str(name).replace(/\(.*?\)/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    if (!w.length) return "?";
    return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
  }
  var uid = 0;

  // Rows, cleaned
  function releases(D) { return rows(D, "Releases").filter(function (r) { return str(r.Name); }).slice().sort(byDateDesc); }
  function business(D) { return rows(D, "AI Business").filter(function (r) { return str(r.Headline); }).slice().sort(byDateDesc); }

  // Items for the model (Archive, graph, directory)
  function items(D) {
    var out = [];
    releases(D).forEach(function (r) {
      out.push({ date: r.Date, type: "Release", cat: str(r.Category), title: r.Name, link: url(r.Link) || url(r.Source), line: r["Bottom line"],
        hay: [r.Name, r.Company, r.Category, r["Bottom line"], r["Similar to"], r.Pricing].join(" ") });
    });
    business(D).forEach(function (b) {
      out.push({ date: b.Date, type: "AI Business", cat: "", title: b.Headline, link: url(b.Link) || url(b.Source), line: b["Bottom line"],
        hay: [b.Headline, b.Business, b.Founders, b.Revenue, b["Bottom line"], b["How AI is used"], b.Lesson].join(" ") });
    });
    return out;
  }

  // Connected companies and people, as the same chips the rest of the page uses
  var M = { itemBy: {} };
  function chips(type, title, date) {
    var it = M.itemBy[type + "|" + str(title) + "|" + str(date)];
    var ents = it && it.ents ? it.ents.filter(function (e) { return e.group === "Company" || e.group === "Person"; }) : [];
    if (!ents.length) return "";
    var list = ents.map(function (e) {
      return '<button type="button" class="x-ent" data-t="' + e.group + '" data-ent="' + esc(e.key) + '" title="' + esc(e.etype) + '">' + esc(e.name) + "</button>";
    });
    return '<div class="x-ents" aria-label="Connected companies and people">' + (window.XChips ? XChips(list) : list.join("")) + "</div>";
  }
  // One source-link style across every card
  function srcLink(href, label) {
    var h = url(href);
    return h ? '<p class="x-srcs"><a class="x-src" href="' + esc(h) + '" target="_blank" rel="noopener">Read source' + (label ? " · " + esc(label) : "") + " ↗</a></p>" : "";
  }
  function fbox(type, id, title) { try { return window.XFollow ? XFollow.box(type, id, title) : ""; } catch (e) { return ""; } }
  function logo(name) { try { return window.XVisuals && XVisuals.logo ? XVisuals.logo(name) : ""; } catch (e) { return ""; } }
  function cover(date) { try { return window.XVisuals && XVisuals.cover ? XVisuals.cover(date) : ""; } catch (e) { return ""; } }
  function companiesFor(D, type, item) {
    var out = [], seen = {};
    rows(D, "Connections").forEach(function (c) {
      var t = str(c["Entity type"]);
      if (str(c["Item type"]) !== type || str(c.Item) !== item || (t !== "Company" && t !== "Organization")) return;
      var n = str(c.Entity);
      if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; out.push(n); }
    });
    return out;
  }
  function more(body) {
    if (!body) return "";
    var id = "xs-more-" + ++uid;
    return '<button type="button" class="x-more" data-guide aria-expanded="false" aria-controls="' + id + '">More</button>' +
      '<div class="x-more-panel" id="' + id + '" hidden>' + body + "</div>";
  }

  // A section with no rows leaves the page and the nav
  function showSection(id, on) {
    var s = $(id);
    if (!s) return;
    s.hidden = !on;
    if (!s.getAttribute("data-label")) s.setAttribute("data-label", s.getAttribute("data-nav") || "");
    if (on) s.setAttribute("data-nav", s.getAttribute("data-label"));
    else s.removeAttribute("data-nav");
    [].forEach.call(document.querySelectorAll('.nav a[href="#' + id + '"], .foot a[href="#' + id + '"]'), function (a) { a.hidden = !on; });
  }
  var shown = {};
  function syncNav() { Object.keys(shown).forEach(function (id) { showSection(id, shown[id]); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(syncNav, 0); });

  // Hero: the lead story under today's cover
  function renderLead(D) {
    var box = $("lead");
    if (!box) return;
    var issues = rows(D, "Issues").slice().sort(byDateDesc), today = issues[0] || {};
    var d = iso10(today.Date);
    var stories = rows(D, "Stories").filter(function (s) { return iso10(s.Date) === d && str(s.Headline); });
    var s = stories[0], src = d ? cover(d) : "";
    var no = str(today.Issue) ? "Issue " + str(today.Issue) : "";
    var line = [no, d ? longDate(d) : ""].filter(Boolean).join(" · ");
    var kicker = [no, "Lead story", d ? longDate(d) : ""].filter(Boolean).join(" · ");
    if (!s && !src) { box.innerHTML = line ? '<p class="x-kicker">' + esc(line) + "</p>" : ""; return; }
    var html = "";
    if (src) {
      html += '<figure class="x-lead__cover" data-xv-box><img src="' + esc(src) + '" alt="Cover of ' + esc(no ? no : "today's issue") + (d ? ", " + esc(shortDate(d)) : "") + '" data-xv-hide />' +
        (no ? '<span class="x-lead__no" aria-hidden="true">' + esc(no) + "</span>" : "") + "</figure>";
    }
    html += '<div class="x-lead__copy">';
    html += '<p class="x-kicker">' + esc(kicker) + "</p>";
    if (s) {
      var names = companiesFor(D, "Story", str(s.Headline));
      if (names.length && logo(names[0])) html += '<div class="x-logos">' + names.slice(0, 6).map(logo).join("") + (names.length > 6 ? '<span class="x-logos__more">+' + (names.length - 6) + "</span>" : "") + "</div>";
      html += '<h2 class="x-lead__h" id="lead-h">' + ext(s.Link, esc(s.Headline)) + "</h2>";
      if (str(s["Bottom line"])) html += '<p class="x-lead__line">' + esc(s["Bottom line"]) + "</p>";
      if (str(s["So what"])) html += '<p><span class="x-label">So what:</span> ' + esc(s["So what"]) + "</p>";
      html += '<div class="links">' + (url(s.Link) ? '<a class="x-src" href="' + esc(url(s.Link)) + '" target="_blank" rel="noopener">Read source' + (str(s.Source) ? " · " + esc(s.Source) : "") + " ↗</a>" : "") +
        fbox("Story", iso10(s.Date) + "|" + str(s.Headline), s.Headline) + "</div>";
      html += more((str(s.Details) ? "<p>" + esc(s.Details) + "</p>" : "") + chips("Story", s.Headline, s.Date));
    }
    html += "</div>";
    box.className = "x-lead" + (src ? " has-cover" : "");
    box.innerHTML = html;
  }

  // Latest releases
  function relLogo(r) {
    var d = str(r.Domain).replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d) || /^(www\.)?(zest\.app|alibabagroup\.com|nju\.edu\.cn|hexafuture\.ai|iquest\.ai|ruc\.edu\.cn|sjtu\.edu\.cn|sensenova\.cn|myflorida\.com|jd\.com|new\.quest|zju\.edu\.cn)$/i.test(d)) d = "";
    var who = str(r.Company) || str(r.Name);
    return '<span class="x-logo x-logo--lg' + (d ? "" : " is-initials") + '" role="img" aria-label="' + esc(who) + ' logo">' +
      (d ? '<img class="x-logo__img" src="https://www.google.com/s2/favicons?domain=' + encodeURIComponent(d) + '&amp;sz=128" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' : "") +
      '<span class="x-logo__ini" aria-hidden="true">' + esc(initials(who)) + "</span></span>";
  }
  function releaseCard(r) {
    var similar = str(r["Similar to"]), price = str(r.Pricing), src = url(r.Source);
    return '<div class="x-stack x-rel">' +
      '<div class="x-rel__top">' + relLogo(r) + '<div><h3>' + esc(r.Name) + "</h3>" + (str(r.Company) ? '<p class="x-rel__co">' + esc(r.Company) + "</p>" : "") + "</div></div>" +
      "<p>" + (str(r.Category) ? '<span class="x-cat" data-t="Release">' + esc(r.Category) + "</span>" : "") + fbox("release", str(r.Name), r.Name) + "</p>" +
      (str(r.Launched) ? '<p class="x-meta">Launched ' + esc(shortDate(r.Launched)) + "</p>" : "") +
      (str(r["Bottom line"]) ? "<p>" + esc(r["Bottom line"]) + "</p>" : "") +
      (similar ? '<p><span class="x-label">Similar to:</span> ' + esc(similar) + "</p>" : "") +
      (price ? '<p><span class="pill x-price">' + esc(price) + "</span></p>" : "") +
      chips("Release", r.Name, r.Date) +
      '<div class="x-rel__foot">' + (url(r.Link) ? ext(r.Link, "Try it", "btn x-btn--primary x-try") : "") +
      srcLink(src, hostOf(src)) + "</div></div>";
  }
  function renderReleases(D) {
    var all = releases(D);
    shown.releases = all.length > 0;
    showSection("releases", shown.releases);
    if (!all.length) return;
    var newest = iso10(all[0].Date);
    var now = all.filter(function (r) { return iso10(r.Date) === newest; });
    var prev = all.filter(function (r) { return iso10(r.Date) !== newest; });
    $("rl-sub").textContent = "Products launched or announced around the " + shortDate(newest) + " brief.";
    $("rl-cards").innerHTML = now.map(releaseCard).join("");
    $("rl-prev").hidden = !prev.length;
    $("rl-prev-list").innerHTML = prev.map(function (r) {
      return '<li><span class="x-when">' + esc(shortDate(r.Date)) + (str(r.Category) ? " · " + esc(r.Category) : "") + "</span>" +
        "<span><b>" + ext(r.Link, esc(r.Name)) + "</b>" + (str(r.Company) ? " · " + esc(r.Company) : "") +
        (str(r["Bottom line"]) ? '<span class="x-oneline">' + esc(r["Bottom line"]) + "</span>" : "") + "</span></li>";
    }).join("");
    if (window.XClamp) XClamp($("rl-prev-list"), 8);
  }

  // AI & small business
  var FIG = /^(?:(?:more than|over|about|almost|nearly|roughly|around|~)\s+)?[$€£¥]\s?[\d][\d,.]*\s?(?:[KMB]\b|million|billion|thousand)?/i;
  function revenue(text) {
    var t = str(text), self = /\(self-reported\)/i.test(t);
    t = t.replace(/\s*\(self-reported\)/ig, "").trim();
    var m = FIG.exec(t), fig = "", rest = t;
    if (m) { fig = m[0].trim(); rest = t.slice(m[0].length).replace(/^[\s,;:]+/, ""); }
    else {
      var m2 = /[$€£¥]\s?[\d][\d,.]*\s?(?:[KMB]\b|million|billion)?/i.exec(t);
      if (m2 && t.length > 32) { fig = m2[0].trim(); }
      else if (t.length <= 32) { fig = t; rest = ""; }
    }
    if (!fig) return t ? '<div class="x-rev"><p class="x-rev__note">' + esc(t) + (self ? " <small>(self-reported)</small>" : "") + "</p></div>" : "";
    fig = fig.charAt(0).toUpperCase() + fig.slice(1);
    return '<div class="x-rev"><p class="x-rev__fig">' + esc(fig) + "</p>" +
      (rest || self ? '<p class="x-rev__note">' + esc(rest) + (self ? " <small>(self-reported)</small>" : "") + "</p>" : "") + "</div>";
  }
  function bizCard(b) {
    var who = [str(b.Business), str(b.Founders)].filter(Boolean).join(" · "), src = url(b.Source) || url(b.Link);
    return '<div class="x-stack x-biz">' +
      "<h3>" + ext(b.Link || b.Source, esc(b.Headline)) + "</h3>" +
      (who ? '<p class="x-rel__co">' + esc(who) + "</p>" : "") +
      revenue(b.Revenue) +
      (str(b["Team size"]) ? '<p><span class="pill x-price">Team: ' + esc(b["Team size"]) + "</span></p>" : "") +
      (str(b["Bottom line"]) ? "<p>" + esc(b["Bottom line"]) + "</p>" : "") +
      (str(b["How AI is used"]) ? '<p><span class="x-label">How AI is used:</span> ' + esc(b["How AI is used"]) + "</p>" : "") +
      (str(b.Lesson) ? '<div class="x-lesson"><p class="x-kicker">Lesson</p><p>' + esc(b.Lesson) + "</p></div>" : "") +
      chips("AI Business", b.Headline, b.Date) +
      srcLink(src, hostOf(src)) + "</div>";
  }
  function renderBusiness(D) {
    var all = business(D);
    shown["ai-business"] = all.length > 0;
    showSection("ai-business", shown["ai-business"]);
    if (!all.length) return;
    var newest = iso10(all[0].Date);
    var now = all.filter(function (b) { return iso10(b.Date) === newest; });
    var prev = all.filter(function (b) { return iso10(b.Date) !== newest; });
    $("ab-cards").innerHTML = now.map(bizCard).join("");
    $("ab-prev").hidden = !prev.length;
    $("ab-prev-list").innerHTML = prev.map(function (b) {
      return '<li><span class="x-when">' + esc(shortDate(b.Date)) + (str(b.Business) ? " · " + esc(b.Business) : "") + "</span>" +
        "<span>" + ext(b.Link || b.Source, esc(b.Headline)) +
        (str(b["Bottom line"]) ? '<span class="x-oneline">' + esc(b["Bottom line"]) + "</span>" : "") + "</span></li>";
    }).join("");
    if (window.XClamp) XClamp($("ab-prev-list"), 8);
  }

  function update(D, model) {
    M = model && model.itemBy ? model : { itemBy: {} };
    uid = 0;
    [renderLead, renderReleases, renderBusiness].forEach(function (f) { try { f(D || {}); } catch (e) {} });
  }

  return { items: items, update: update };
})();
