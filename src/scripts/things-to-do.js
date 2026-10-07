// Client behavior for the Things To Do pages: calendar, featured and ongoing events, past events,
// weekend ideas, saved ideas, and detail dialogs. Data comes from the JSON block written by Todo.astro.
(function () {
  var dataEl = document.getElementById('td-data');
  if (!dataEl) return;
  var D = JSON.parse(dataEl.textContent);
  var URLS = D.urls, EVENTS = D.events, IDEAS = D.ideas;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var ICON = {
    tree: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M12 15v6M9 21h6"/></svg>',
    cup: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/></svg>',
    art: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2.2-.6-1.4.4-2.8 2-2.8H18a3 3 0 0 0 3-3c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>',
    cart: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14l-1 11H6z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/></svg>',
    family: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="7" r="2.5"/><circle cx="17" cy="9" r="2"/><path d="M3 20v-3a5 5 0 0 1 10 0v3M14 20v-2a4 4 0 0 1 7 0v2"/></svg>',
    music: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>'
  };
  var BOOK = '<svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 2h10v14l-5-3.5L3 16z"/></svg>';

  function $(id) { return document.getElementById(id); }
  function pad(n) { return ('0' + n).slice(-2); }
  function ds(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function md(d) { var m = d.split('-'); return MON[+m[1] - 1] + ' ' + (+m[2]); }
  function get(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function toast(m) { var t = $('td-toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('on'); }, 1800); }
  function isRange(e) { return e.end && e.end !== e.date; }
  function activeOn(e, d) { return !e.monthOnly && (isRange(e) ? (e.date <= d && d <= e.end) : e.date === d); }
  function byDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }

  // Today in Houston, so the calendar does not shift for visitors in other time zones.
  var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-');
  var nowY = +parts[0], nowM = +parts[1] - 1, nowD = +parts[2];
  var todayS = ds(nowY, nowM, nowD);

  var ALL = EVENTS;
  var upcoming = ALL.filter(function (e) { return (e.end || e.date) >= todayS; });
  var pastTl = ALL.filter(function (e) { return e.src === 'tl' && (e.end || e.date) < todayS; });
  var ongoingNow = ALL.filter(function (e) { return isRange(e) && activeOn(e, todayS); });
  function uniq(k) { var o = {}, a = []; IDEAS.forEach(function (r) { if (!o[r[k]]) { o[r[k]] = 1; a.push(r[k]); } }); return a.sort(); }
  IDEAS.forEach(function (r, i) { r.ix = i; });
  var saved = get('tl-todo-saved', []);

  function stats() {
    var v = {
      upcoming: upcoming.length,
      now: ongoingNow.length,
      ideas: IDEAS.length,
      areas: uniq('area').length,
      tl: upcoming.filter(function (e) { return e.src === 'tl'; }).length,
      past: pastTl.length,
      saved: saved.length
    };
    document.querySelectorAll('[data-stat]').forEach(function (el) { var k = el.getAttribute('data-stat'); if (v[k] != null) el.textContent = v[k]; });
  }

  // ---------- shared rows and cards ----------
  function badge(e) {
    return isRange(e) ? '<small>Through</small><b>' + md(e.end) + '</b>' : '<small>' + MON[+e.date.split('-')[1] - 1] + '</small><b>' + (+e.date.split('-')[2]) + '</b>';
  }
  function detailBtn(e, sm) {
    var cls = 'td-pill line' + (sm ? ' sm' : '');
    return e.src === 'tl' ? '<a class="' + cls + '" href="' + esc(e.url) + '">View details</a>' : '<button class="' + cls + '" type="button" data-ev="' + esc(e.id) + '">View details</button>';
  }
  function srcTag(e) { return '<span class="td-src ' + e.src + '">' + (e.src === 'tl' ? 'Tradition Local' : (e.source || 'Visit Houston')) + '</span>'; }
  function eventRow(e) {
    var through = isRange(e);
    return '<div class="td-evrow"><div class="td-date">' + badge(e) + '</div><div><h3>' + esc(e.title) + srcTag(e) + '</h3><div class="td-meta">' + esc(e.venue) + (through ? ' · ' + md(e.date) + ' to ' + md(e.end) : '') + '</div></div>' + detailBtn(e, true) + '</div>';
  }
  function eventTile(e) {
    var through = isRange(e);
    return '<article class="td-tile"><div class="td-date">' + badge(e) + '</div><h3>' + esc(e.title) + '</h3>' + srcTag(e) + '<div class="td-meta">' + esc(e.venue) + (through ? ' · ' + md(e.date) + ' to ' + md(e.end) : '') + '</div>' + detailBtn(e, true) + '</article>';
  }
  function ideaCard(r) {
    var on = saved.indexOf(r.ix) > -1;
    return '<article class="td-idea"><div class="td-art" aria-hidden="true">' + (ICON[r.icon] || '') + '</div><div class="td-ibody"><div class="td-meta">' + esc(r.area) + ' · ' + esc(r.int) + ' · ' + (r.kind === 'weekend' ? 'Weekend' : 'Anytime') + '</div><h3>' + esc(r.t) + '</h3><p>' + esc(r.b) + '</p><div class="td-irow"><button class="td-pill line sm" type="button" data-idea="' + r.ix + '">Explore idea</button><button class="td-save" type="button" data-save="' + r.ix + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove from saved' : 'Save idea') + ': ' + esc(r.t) + '">' + BOOK + '</button></div></div></article>';
  }

  // ---------- featured events ----------
  // Single-day events sort by their date; ongoing (ranged) events sort by their end date, so an
  // event that is wrapping up soon surfaces ahead of one that runs for months yet. Earliest first.
  function featKey(e) { return isRange(e) ? e.end : e.date; }
  function byFeat(a, b) { var ka = featKey(a), kb = featKey(b); return ka < kb ? -1 : ka > kb ? 1 : 0; }
  function renderFeatured() {
    var box = $('td-feat'); if (!box) return;
    var nextTl = ALL.filter(function (e) { return e.src === 'tl' && e.date >= todayS && !e.monthOnly; }).sort(byDate)[0];
    var list = ALL.filter(function (e) { return e.feat && (e.end || e.date) >= todayS; });
    if (nextTl) list.push(nextTl);
    list.sort(byFeat);
    // De-dupe (nextTl may already be in the feat list); show every featured event, flowing left to right.
    var seen = {}; var tiles = [];
    list.forEach(function (e) { if (!seen[e.id]) { seen[e.id] = 1; tiles.push(e); } });
    box.innerHTML = tiles.length
      ? '<div class="td-feat-row">' + tiles.map(eventTile).join('') + '</div>'
      : '<p class="td-note">New featured events are added often. Check back soon.</p>';
  }

  // ---------- calendar ----------
  var vy = nowY, vm = nowM, selDay = todayS;
  function renderCal() {
    var grid = $('td-calGrid'); if (!grid) return;
    $('td-calLabel').textContent = MONTHS[vm] + ' ' + vy;
    var first = new Date(vy, vm, 1).getDay(), days = new Date(vy, vm + 1, 0).getDate(), h = '';
    WDAYS.forEach(function (w) { h += '<div class="td-wd" role="columnheader">' + w + '</div>'; });
    for (var b = 0; b < first; b++) h += '<div class="td-dc blank" aria-hidden="true"></div>';
    for (var d = 1; d <= days; d++) {
      var s2 = ds(vy, vm, d);
      var singles = ALL.filter(function (e) { return !e.monthOnly && !isRange(e) && e.date === s2; });
      var closes = ALL.filter(function (e) { return isRange(e) && e.end === s2; });
      var dots = singles.slice(0, 2).map(function (e) { return '<i class="td-dot ' + (e.src === 'tl' ? 'tl' : 'ot') + '"></i>'; }).join('') + (closes.length ? '<i class="td-dot ld"></i>' : '');
      var cls = 'td-dc' + (closes.length ? ' last' : '') + (s2 === todayS ? ' today' : '') + (s2 === selDay ? ' sel' : '');
      var lab = MONTHS[vm] + ' ' + d + ', ' + vy + ', ' + singles.length + (singles.length === 1 ? ' event' : ' events') + (closes.length ? ', last day of ' + closes.length + (closes.length === 1 ? ' longer run' : ' longer runs') : '');
      h += '<button type="button" class="' + cls + '" data-day="' + s2 + '" role="gridcell" aria-label="' + lab + '"' + (s2 === selDay ? ' aria-selected="true"' : '') + '>' + d + '<span class="td-dots">' + dots + '</span></button>';
    }
    grid.innerHTML = h;
    renderDay();
  }
  function renderDay() {
    var p = selDay.split('-'), dt = new Date(+p[0], +p[1] - 1, +p[2]);
    $('td-dayTitle').textContent = WDAYS[dt.getDay()] + ', ' + MONTHS[dt.getMonth()] + ' ' + dt.getDate();
    var single = ALL.filter(function (e) { return !e.monthOnly && !isRange(e) && e.date === selDay; });
    var opens = ALL.filter(function (e) { return isRange(e) && e.date === selDay; });
    var closes = ALL.filter(function (e) { return isRange(e) && e.end === selDay; });
    var html = '';
    function item(e, label) {
      var isPast = (e.end || e.date) < todayS;
      return '<div class="td-dayitem"><h4>' + esc(e.title) + '</h4><div class="td-meta">' + (label ? '<span class="td-lab">' + label + '</span>' : '') + esc(e.venue) + (isPast && e.src === 'tl' ? ' · Past event' : '') + '</div><div class="td-x">' + srcTag(e) + detailBtn(e, true) + '</div></div>';
    }
    single.forEach(function (e) { html += item(e, ''); });
    opens.forEach(function (e) { html += item(e, 'Opens'); });
    closes.forEach(function (e) { html += item(e, 'Last day'); });
    if (!html) html = '<p class="td-dayempty">No events scheduled for this day.</p>';
    var run = ALL.filter(function (e) { return isRange(e) && activeOn(e, selDay); }).length;
    if (run) {
      var ongoSec = $('ongoing');
      var link = ongoSec ? '<a href="#ongoing">See what is happening now</a>' : '<a href="' + esc(URLS.events) + '#ongoing">See what is happening now</a>';
      html += '<p class="td-ongo">' + run + ' exhibit' + (run === 1 ? '' : 's') + ' and show' + (run === 1 ? ' is' : 's are') + ' also running. ' + link + '</p>';
    }
    var ym = vy + '-' + pad(vm + 1);
    var tbc = ALL.filter(function (e) { return e.monthOnly && e.date.slice(0, 7) === ym; });
    if (tbc.length) html += '<p class="td-ongo">Also this month, exact date to be confirmed: ' + tbc.map(function (e) { return '<a href="' + esc(e.url) + '">' + esc(e.title) + '</a>'; }).join('; ') + '.</p>';
    $('td-dayList').innerHTML = html;
  }
  function shift(n) {
    vm += n; if (vm < 0) { vm = 11; vy--; } if (vm > 11) { vm = 0; vy++; }
    var dim = new Date(vy, vm + 1, 0).getDate(), sp = selDay.split('-');
    selDay = ds(vy, vm, Math.min(+sp[2], dim)); renderCal();
  }

  // ---------- ongoing ----------
  var ongoCat = 'All';
  var ongoExpanded = false;
  var ONGO_CAP = 9;
  function renderOngoing() {
    var grid = $('td-ongoGrid'); if (!grid) return;
    var list = ongoingNow, cats = ['All'];
    list.forEach(function (e) { if (cats.indexOf(e.cat) < 0) cats.push(e.cat); });
    if (cats.indexOf(ongoCat) < 0) ongoCat = 'All';
    $('td-ongoChips').innerHTML = cats.map(function (c) { return '<button class="td-fc" type="button" data-cat="' + esc(c) + '" aria-pressed="' + (c === ongoCat) + '">' + esc(c) + '</button>'; }).join('');
    var rows = list.filter(function (e) { return ongoCat === 'All' || e.cat === ongoCat; }).sort(function (a, b) { return a.end < b.end ? -1 : a.end > b.end ? 1 : 0; });
    var shown = ongoExpanded ? rows : rows.slice(0, ONGO_CAP);
    var cards = shown.map(function (e) {
      return '<article class="td-ocard"><span class="td-through">Through ' + md(e.end) + '</span><h3>' + esc(e.title) + '</h3><div class="td-meta">' + esc(e.venue) + '</div><div class="td-meta"><span class="td-src vh" style="margin-left:0">' + esc(e.cat) + '</span></div><div class="td-orow">' + detailBtn(e, true) + '</div></article>';
    }).join('') || '<div class="td-empty">Nothing is running right now in this group.</div>';
    var more = (!ongoExpanded && rows.length > ONGO_CAP)
      ? '<div class="td-seeall"><button class="td-pill line" type="button" id="td-ongoMore">See all ' + rows.length + ' &rarr;</button></div>'
      : '';
    grid.innerHTML = cards + more;
  }

  // ---------- past events ----------
  function renderPast() {
    var ul = $('td-pastlist'); if (!ul) return;
    ul.innerHTML = pastTl.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (e) {
      var when = e.monthOnly ? MONTHS[+e.date.split('-')[1] - 1] + ' ' + e.date.slice(0, 4) : md(e.date) + ', ' + e.date.slice(0, 4);
      return '<li><b>' + esc(when) + '</b><a href="' + esc(e.url) + '">' + esc(e.title) + '</a><span>' + esc(e.venue) + '</span></li>';
    }).join('') || '<li>No past events yet.</li>';
  }

  // ---------- ideas ----------
  var tab = 'all', savedOnly = false;
  var TABS = [['all', 'All discoveries'], ['weekend', 'Weekend ideas'], ['anytime', 'Anytime activities']];
  function renderHubIdeas() { var box = $('td-hub-ideas'); if (box) box.innerHTML = IDEAS.slice(0, 3).map(ideaCard).join(''); }
  function renderIdeas() {
    var grid = $('td-ideaGrid'); if (!grid) return;
    var a = $('td-fArea').value, i = $('td-fInt').value;
    var rows = IDEAS.filter(function (r) {
      if (tab === 'weekend' && r.kind !== 'weekend') return false;
      if (tab === 'anytime' && r.kind !== 'anytime') return false;
      if (a && r.area !== a) return false; if (i && r.int !== i) return false;
      if (savedOnly && saved.indexOf(r.ix) < 0) return false; return true;
    });
    $('td-ideaCount').textContent = rows.length + ' idea' + (rows.length === 1 ? '' : 's');
    grid.innerHTML = rows.length ? rows.map(ideaCard).join('') : '<div class="td-empty">' + (savedOnly ? 'You have not saved any ideas that match yet.' : 'No ideas match those filters. Try another area or interest.') + '</div>';
    $('td-tabs').innerHTML = TABS.map(function (t) { return '<button class="td-tab" role="tab" type="button" data-t="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '<button class="td-tab saved" type="button" id="td-savedBtn" aria-pressed="' + savedOnly + '">Saved (' + saved.length + ')</button>';
  }
  function fillSelect(id, key) {
    var el = $(id); if (!el) return;
    uniq(key).forEach(function (a) { var o = document.createElement('option'); o.textContent = a; el.appendChild(o); });
  }

  // ---------- dialogs ----------
  function openDlg(title, meta, body, actions) {
    var dlg = $('td-dlg'); if (!dlg || typeof dlg.showModal !== 'function') return;
    $('td-dT').textContent = title; $('td-dM').textContent = meta; $('td-dB').textContent = body; $('td-dX').innerHTML = actions;
    dlg.showModal();
  }
  function openEvent(id) {
    var ev = ALL.filter(function (x) { return x.id === id; })[0]; if (!ev) return;
    var yr = ev.date.slice(0, 4);
    openDlg(ev.title, ev.venue + ' · ' + (isRange(ev) ? md(ev.date) + ' to ' + md(ev.end) + ', ' + yr : md(ev.date) + ', ' + yr), (ev.note || '') + ' Confirm dates and times with the organizer before you go.',
      '<a class="td-pill gold sm" href="' + esc(ev.url) + '" target="_blank" rel="noopener">See the source listing</a><button class="td-pill line sm" type="button" data-close>Close</button>');
  }
  function openIdea(ix) {
    var r = IDEAS[ix];
    openDlg(r.t, r.area + ' · ' + r.int + ' · ' + (r.kind === 'weekend' ? 'Weekend idea' : 'Anytime activity'), r.d + ' This is an illustrative idea. Final guides would include verified places, hours, and details.',
      '<a class="td-pill gold sm" href="' + esc(URLS.cities) + '">Browse neighborhood guides</a><button class="td-pill line sm" type="button" data-close>Close</button>');
  }
  var dlgEl = $('td-dlg');
  if (dlgEl) dlgEl.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close') || e.target === dlgEl) dlgEl.close(); });

  // ---------- events ----------
  document.addEventListener('click', function (e) {
    var ev = e.target.closest('[data-ev]'); if (ev) { openEvent(ev.getAttribute('data-ev')); return; }
    var id = e.target.closest('[data-idea]'); if (id) { openIdea(+id.getAttribute('data-idea')); return; }
    var sv = e.target.closest('[data-save]');
    if (sv) {
      var ix = +sv.getAttribute('data-save'), p = saved.indexOf(ix);
      if (p > -1) { saved.splice(p, 1); toast('Removed from saved'); } else { saved.push(ix); toast('Saved'); }
      put('tl-todo-saved', saved); renderHubIdeas(); renderIdeas(); stats(); return;
    }
    var t = e.target.closest('[data-t]'); if (t) { tab = t.getAttribute('data-t'); savedOnly = false; renderIdeas(); return; }
    if (e.target.closest('#td-savedBtn')) { savedOnly = !savedOnly; renderIdeas(); return; }
    var dc = e.target.closest('[data-day]'); if (dc) { selDay = dc.getAttribute('data-day'); renderCal(); return; }
    var ct = e.target.closest('[data-cat]'); if (ct) { ongoCat = ct.getAttribute('data-cat'); ongoExpanded = false; renderOngoing(); return; }
    if (e.target.closest('#td-ongoMore')) { ongoExpanded = true; renderOngoing(); return; }
  });
  if ($('td-calPrev')) {
    $('td-calPrev').onclick = function () { shift(-1); };
    $('td-calNext').onclick = function () { shift(1); };
    $('td-calToday').onclick = function () { vy = nowY; vm = nowM; selDay = todayS; renderCal(); };
  }
  if ($('td-fArea')) {
    fillSelect('td-fArea', 'area'); fillSelect('td-fInt', 'int');
    var qa = new URLSearchParams(location.search).get('area');
    if (qa && uniq('area').indexOf(qa) > -1) $('td-fArea').value = qa;
    $('td-fArea').addEventListener('change', renderIdeas); $('td-fInt').addEventListener('change', renderIdeas);
  }

  // keep the section bar in sync while scrolling
  var barLinks = document.querySelectorAll('.td-bar a[data-sec]');
  if (barLinks.length) {
    window.addEventListener('scroll', function () {
      var cur = barLinks[0].getAttribute('data-sec');
      barLinks.forEach(function (a) { var el = document.getElementById(a.getAttribute('data-sec')); if (el && el.getBoundingClientRect().top <= 140) cur = a.getAttribute('data-sec'); });
      barLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-sec') === cur); });
    }, { passive: true });
  }

  stats(); renderFeatured(); renderCal(); renderOngoing(); renderPast(); renderHubIdeas(); renderIdeas();
})();
