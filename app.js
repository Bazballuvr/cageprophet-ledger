/* The Cage Prophet · Public Ledger. Reads ledger.json (built from ledger.md by
   tools/update_ledger_site.py) and renders the record + every call. The HTML is
   prerendered by the same tool, so the page still works without JS or offline. */
(function () {
  "use strict";
  var LABEL = { hit: "Hit", miss: "Miss", no_action: "No action", pending: "Pending", none: "—" };
  var ICON = { hit: "✓", miss: "✗", no_action: "○", pending: "…", none: "" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }[c];
    });
  }
  function rec(p) { return p[0] + "–" + p[1]; }
  function pct(p) { var t = p[0] + p[1]; return t ? Math.round((100 * p[0]) / t) + "%" : "—"; }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  function records(d) {
    return d.records.map(function (r) {
      var extra = [];
      if (r.no_action) extra.push(r.no_action + " no action");
      if (r.pending) extra.push(r.pending + " pending");
      return '<article class="rec' + (r.season !== "Pre-season" ? " rec--live" : "") + '" aria-label="' + esc(r.label) + ' record">' +
        '<h3 class="rec__title">' + esc(r.label) + '<span class="rec__sub">' + esc(r.subtitle) + "</span></h3>" +
        '<dl class="rec__grid">' +
        '<div><dt>Winners</dt><dd><span class="rec__num">' + rec(r.winners) + '</span><span class="rec__pct">' + pct(r.winners) + "</span></dd></div>" +
        '<div><dt>Method <small>(when called)</small></dt><dd><span class="rec__num">' + rec(r.method) + '</span><span class="rec__pct">' + pct(r.method) + "</span></dd></div>" +
        "</dl>" +
        (extra.length ? '<p class="rec__extra">' + esc(extra.join(" · ")) + "</p>" : "") +
        (r.note && r.pending ? '<p class="rec__note">' + esc(r.note) + ".</p>" : "") +
        "</article>";
    }).join("\n");
  }

  function row(c) {
    var call;
    if (c.sealed) call = '<span class="sealed">Sealed until the pick is posted on X</span>';
    else if (!c.call) call = "—";
    else if (c.call_quoted) call = '<q class="call">' + esc(c.call) + "</q>";
    else if (c.call_source === "post") call = '<span class="call">' + esc(c.call) + "</span>";
    else call = '<span class="call call--pick">Pick: ' + esc(c.call) + "</span>";
    var many = c.posts.length > 1;
    var posts = c.posts.map(function (p, i) {
      return '<a class="post" href="' + esc(p.url) + '" target="_blank" rel="noopener" aria-label="Original post on X' +
        (many ? ", part " + (i + 1) : "") + '">Post' + (many ? " " + (i + 1) : "") + ' <span aria-hidden="true">↗</span></a>';
    }).join(" ") || '<span class="muted">—</span>';
    var ms = c.method_status;
    var conf = c.confidence ? esc(c.confidence) : c.sealed ? "<span class=muted>sealed</span>" : "<span class=muted>—</span>";
    return '<tr data-status="' + esc(c.status) + '">' +
      '<td data-label="Date"><time datetime="' + esc(c.date_iso || "") + '">' + esc(c.date || "—") + "</time>" +
      (c.called ? '<span class="called">Called ' + esc(c.called) + "</span>" : "") + "</td>" +
      '<td data-label="Event">' + esc(c.event || "—") + "</td>" +
      '<td data-label="Fight"><span class="fight">' + esc(c.fight) + "</span>" +
      (c.fight_detail ? '<span class="fight__detail">' + esc(c.fight_detail) + "</span>" : "") + "</td>" +
      '<td data-label="Call">' + call + "</td>" +
      '<td data-label="Confidence">' + conf + "</td>" +
      '<td data-label="Result">' + esc(c.result) + "</td>" +
      '<td data-label="Status"><span class="badge badge--' + esc(c.status) + '"><span aria-hidden="true">' + ICON[c.status] + "</span> " + LABEL[c.status] + "</span>" +
      '<span class="m m--' + ms + '">Method: ' + (ms !== "none" ? LABEL[ms] : "not called") + "</span></td>" +
      '<td data-label="X post">' + posts + "</td></tr>";
  }

  function tables(d) {
    return d.records.map(function (r) {
      var id = slug(r.season);
      var rows = d.calls.filter(function (c) { return c.season === r.season; });
      return '<section class="tblwrap" aria-labelledby="t-' + id + '">' +
        '<h3 id="t-' + id + '" class="tblwrap__title">' + esc(r.label) + " <span>" + esc(r.subtitle) + "</span></h3>" +
        '<table class="ledger"><caption class="sr-only">' + esc(r.label) + " calls, newest first</caption>" +
        '<thead><tr><th scope="col">Date</th><th scope="col">Event</th><th scope="col">Fight</th>' +
        '<th scope="col">Call</th><th scope="col">Conf.</th><th scope="col">Result</th>' +
        '<th scope="col">Status</th><th scope="col">X post</th></tr></thead><tbody>' +
        rows.map(row).join("") + "</tbody></table></section>";
    }).join("\n");
  }

  var current = "all";
  function applyFilter(f) {
    current = f;
    var shown = 0;
    document.querySelectorAll(".ledger tbody tr").forEach(function (tr) {
      var on = f === "all" || tr.getAttribute("data-status") === f;
      tr.hidden = !on;
      if (on) shown++;
    });
    document.querySelectorAll(".tblwrap").forEach(function (s) {
      s.hidden = !s.querySelector("tbody tr:not([hidden])");
    });
    document.querySelectorAll(".chip").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === f));
    });
    var st = document.getElementById("filter-status");
    if (st) st.textContent = shown + (shown === 1 ? " call" : " calls") + " shown";
  }

  function init() {
    document.querySelectorAll(".chip").forEach(function (b) {
      b.addEventListener("click", function () { applyFilter(b.getAttribute("data-filter")); });
    });
    if (!window.fetch) return;
    fetch("ledger.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        document.getElementById("records").innerHTML = records(d);
        document.getElementById("tables").innerHTML = tables(d);
        var t = document.getElementById("updated");
        if (t) { t.textContent = d.generated_label; t.setAttribute("datetime", d.generated_at); }
        applyFilter(current);
      })
      .catch(function () { /* keep the prerendered ledger */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
