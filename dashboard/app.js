// Rug-Guard Radar dashboard. Reads window.RADAR (written beside dashboard/
// by main.ts) and renders the risk-adjusted board, a per-protocol rug
// breakdown with a rug-aware farm plan, a live-token view, and the
// methodology. No network: every byte it shows is in data.js.
//
// Views (for screenshots and sharing): ?view=board (default),
// ?view=detail&slug=<slug>, ?view=filtered&band=LOW|GUARDED|ELEVATED|HIGH|SEVERE
(function () {
  'use strict';
  var D = window.RADAR;
  var root = document.getElementById('board');
  if (!D || !D.rows) { root.textContent = 'No radar data found.'; root.setAttribute('aria-busy', 'false'); return; }
  var params = new URLSearchParams(location.search);
  var BANDS = ['LOW', 'GUARDED', 'ELEVATED', 'HIGH', 'SEVERE'];
  var state = {
    q: params.get('q') || '',
    band: params.get('band') || (params.get('view') === 'filtered' ? 'LOW' : 'ALL'),
    cat: params.get('cat') || 'ALL',
    chain: params.get('chain') || 'ALL',
    sort: params.get('sort') || 'adjusted',
    hideRisky: params.get('hideRisky') === '1',
    selected: params.get('slug') || null,
  };
  var fmtUSD = function (n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  };
  var fmtPct = function (n) { return n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cats = Array.from(new Set(D.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
  var chains = Array.from(new Set(D.rows.flatMap(function (r) { return r.chains; }))).sort();
  var bySlug = {};
  D.rows.forEach(function (r) { bySlug[r.slug] = r; });

  function capitalFor(r) {
    if (r.risk_band === 'SEVERE' || r.risk_band === 'HIGH') return 25;
    if (r.tvl_usd >= 5e9) return 250;
    if (r.tvl_usd >= 1e9) return 150;
    if (r.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdFor(r) {
    if (r.risk_band === 'SEVERE') return 7;
    if (r.risk_band === 'HIGH') return 14;
    if (r.age_days === null) return 30;
    if (r.age_days < 180) return 45;
    return 30;
  }
  function actionFor(r, capital) {
    var c = (r.category || '').toLowerCase();
    var chain = r.chains[0] || 'its main chain';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + r.name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged') >= 0) return 'Provide $' + capital + ' of liquidity to ' + r.name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + r.name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + ' of the chain staking asset through ' + r.name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + r.name + ' and open one small hedge.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + r.name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + r.name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of the protocol yield asset on ' + chain + ' and hold it.';
    return 'Deposit $' + capital + ' of USDC into ' + r.name + ' on ' + chain + ' and keep the position open.';
  }
  function farmSteps(r) {
    var capital = capitalFor(r), hold = holdFor(r);
    var exitDrop = (r.risk_band === 'SEVERE' || r.risk_band === 'HIGH') ? 10 : 25;
    var check = 'Rug check first: this row scores ' + r.rug_score + '/100 ' + r.risk_band + ' risk, so verify the protocol own contract address, who holds the admin keys, and whether withdrawals work before any deposit.' +
      ((r.risk_band === 'SEVERE' || r.risk_band === 'HIGH') ? ' Treat it as unproven until a small test withdrawal succeeds twice, on different days.' : '');
    return [
      check,
      'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.',
      actionFor(r, capital),
      'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and re-check the 7-day TVL change each time.',
      'Hold the position for at least ' + hold + ' days, but exit at once if TVL falls ' + exitDrop + '% in a week or withdrawals slow down: that is the rug signal this radar watches.',
      'Before you withdraw, open the protocol own points or rewards page and claim only from the link it publishes.',
      'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.',
    ];
  }

  function filtered() {
    var rows = D.rows.slice();
    if (state.hideRisky) rows = rows.filter(function (r) { return r.risk_band !== 'HIGH' && r.risk_band !== 'SEVERE'; });
    if (state.band !== 'ALL') rows = rows.filter(function (r) { return r.risk_band === state.band; });
    if (state.cat !== 'ALL') rows = rows.filter(function (r) { return (r.category || 'Uncategorised') === state.cat; });
    if (state.chain !== 'ALL') rows = rows.filter(function (r) { return r.chains.indexOf(state.chain) >= 0; });
    if (state.q) { var q = state.q.toLowerCase(); rows = rows.filter(function (r) { return (r.name + ' ' + r.slug).toLowerCase().indexOf(q) >= 0; }); }
    var sorts = {
      adjusted: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      safest: function (a, b) { return a.rug_score - b.rug_score || b.implied_value_usd - a.implied_value_usd; },
      riskiest: function (a, b) { return b.rug_score - a.rug_score || b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      change: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
    };
    rows.sort(sorts[state.sort] || sorts.adjusted);
    return rows;
  }

  function signalRow(label, weight, value) {
    return '<div class="signal"><div class="lab"><span>' + label + ' <span style="color:var(--faint)">(' + weight + ')</span></span><span>' + value + ' / 100</span></div>' +
      '<div class="bar"><i style="width:' + value + '%"></i></div></div>';
  }

  function detailHtml(r) {
    var discount = r.raw_implied_value_usd > 0 ? Math.round((1 - r.implied_value_usd / r.raw_implied_value_usd) * 100) : 0;
    var steps = farmSteps(r).map(function (s, i) { return '<li><b>Step ' + (i + 1) + '.</b> ' + esc(s) + '</li>'; }).join('');
    return '<section class="detail" id="detail"><h2>#' + r.rank + ' ' + esc(r.name) + ' <span class="badge badge-' + r.risk_band + '">' + r.risk_band + ' ' + r.rug_score + '/100</span></h2>' +
      '<p>' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') +
      ' · listed ' + esc(r.listed_at || 'date unknown') + ' (' + (r.age_days === null ? 'age unknown' : r.age_days + ' days') + ')</p>' +
      '<div class="kv"><div><div class="k">Risk-adjusted value</div><div class="v">' + fmtUSD(r.implied_value_usd) + '</div></div>' +
      '<div><div class="k">Raw implied value</div><div class="v">' + fmtUSD(r.raw_implied_value_usd) + '</div></div>' +
      '<div><div class="k">Rug discount</div><div class="v">−' + discount + '%</div></div>' +
      '<div><div class="k">TVL · 7d</div><div class="v">' + fmtUSD(r.tvl_usd) + ' · ' + fmtPct(r.change_7d) + '</div></div></div>' +
      '<h3>Why this rug score — five signals, all from the snapshot</h3>' +
      signalRow('TVL flight (7d change)', '35%', r.rug.flight) +
      signalRow('Youth (age / listed date)', '20%', r.rug.youth) +
      signalRow('Concentration (chain count)', '20%', r.rug.concentration) +
      signalRow('Category base risk', '15%', r.rug.category) +
      signalRow('Thinness (TVL size)', '10%', r.rug.thinness) +
      '<p>Score ' + r.rug_score + '/100 = 0.35×flight + 0.20×youth + 0.20×concentration + 0.15×category + 0.10×thinness. ' +
      'Adjusted value = raw × (1 − 0.8 × score/100), floored at 15% of raw, so a severe row is demoted, never hidden.</p>' +
      '<h3>Farm plan — rug-aware, sized to ' + r.risk_band + ' risk</h3><ol class="steps">' + steps + '</ol></section>';
  }

  function render() {
    var rows = filtered();
    var counts = D.risk_counts || {};
    var bandChips = BANDS.map(function (b) {
      return '<button class="band-chip" data-band="' + b + '" aria-pressed="' + (state.band === b) + '"><span class="dot dot-' + b + '"></span>' + b + ' · ' + (counts[b] || 0) + '</button>';
    }).join('');
    var view = params.get('view') || 'board';
    var sel0 = state.selected && bySlug[state.selected] ? bySlug[state.selected] : (view === 'detail' ? filtered()[0] : null);
    var title = view === 'filtered' ? 'Filtered view — ' + (state.band === 'ALL' ? 'all bands' : state.band + ' risk only') : 'Rug-Guard Radar';
    var h = '<div class="wrap"><header class="hero"><h1>' + (view === 'filtered' ? 'Filtered view — <span class="guard">safest first</span>' : 'Rug-Guard <span class="guard">Radar</span>') + '</h1>' +
      '<p class="lede">Pre-token protocols ranked by <b>risk-adjusted</b> implied value: size, growth and maturity, discounted by a five-signal rug score. Big is not enough — a protocol whose TVL is fleeing, young, single-chain and thin gets demoted before you ever deposit.</p>' +
      '<div class="meta">Model <b>' + esc(D.model_version) + '</b> · Snapshot <b>' + esc(D.as_of) + '</b> · ' + D.board_size + ' rows (' + D.watchlist_size + ' watchlist + ' + D.early_size + ' early) · ' + D.live_size + ' live-token protocols set aside · Source: ' + esc(D.source) + '</div>' +
      '<div class="bands" role="group" aria-label="Filter by risk band"><button class="band-chip" data-band="ALL" aria-pressed="' + (state.band === 'ALL') + '">All bands · ' + D.board_size + '</button>' + bandChips + '</div></header>' +
      '<div class="controls"><input type="search" id="q" placeholder="Search name or slug…" value="' + esc(state.q) + '" aria-label="Search">' +
      '<select id="cat" aria-label="Category"><option value="ALL">All categories</option>' + cats.map(function (c) { return '<option' + (state.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="chain" aria-label="Chain"><option value="ALL">All chains</option>' + chains.map(function (c) { return '<option' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="sort" aria-label="Sort"><option value="adjusted"' + (state.sort === 'adjusted' ? ' selected' : '') + '>Risk-adjusted value</option><option value="safest"' + (state.sort === 'safest' ? ' selected' : '') + '>Safest first</option><option value="riskiest"' + (state.sort === 'riskiest' ? ' selected' : '') + '>Riskiest first</option><option value="tvl"' + (state.sort === 'tvl' ? ' selected' : '') + '>TVL</option><option value="change"' + (state.sort === 'change' ? ' selected' : '') + '>7d change</option></select>' +
      '<label><input type="checkbox" id="hideRisky"' + (state.hideRisky ? ' checked' : '') + '> Hide HIGH / SEVERE</label></div>' +
      '<p class="count-line">Showing <b>' + rows.length + '</b> of ' + D.board_size + ' rows' + (state.band !== 'ALL' ? ' · band ' + state.band : '') + (state.q ? ' · matching “' + esc(state.q) + '”' : '') + '. Click a row for its rug breakdown and farm plan.</p>' +
      (view === 'detail' && sel0 ? detailHtml(sel0) : '') +
      '<table class="board"><thead><tr><th>#</th><th>Protocol</th><th>TVL</th><th class="num">7d</th><th class="num">Age</th><th>Rug risk</th><th class="num">Adj. value</th><th class="num">Raw value</th></tr></thead><tbody>' +
      rows.slice(0, 60).map(function (r) {
        return '<tr data-slug="' + esc(r.slug) + '" class="' + (state.selected === r.slug ? 'selected' : '') + '"><td>' + r.rank + '</td>' +
          '<td><span class="name">' + esc(r.name) + '</span><br><span class="sub">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.slice(0, 3).join(', ')) + '</span></td>' +
          '<td class="num">' + fmtUSD(r.tvl_usd) + '</td>' +
          '<td class="num ' + (r.change_7d !== null && r.change_7d < 0 ? 'neg' : 'pos') + '">' + fmtPct(r.change_7d) + '</td>' +
          '<td class="num">' + (r.age_days === null ? '—' : r.age_days + 'd') + '</td>' +
          '<td><span class="rugbar rugbar-' + r.risk_band + '"><i style="width:' + r.rug_score + '%"></i></span><span class="badge badge-' + r.risk_band + '">' + r.risk_band + ' ' + r.rug_score + '</span></td>' +
          '<td class="num"><b>' + fmtUSD(r.implied_value_usd) + '</b></td><td class="num">' + fmtUSD(r.raw_implied_value_usd) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      (rows.length > 60 ? '<p class="count-line">First 60 of ' + rows.length + ' shown — narrow the filters to see the rest.</p>' : '');
    var sel = state.selected && bySlug[state.selected] ? bySlug[state.selected] : null;
    if (sel && view !== 'detail') h += detailHtml(sel);
    h += '<section class="block"><h2>Live-token protocols — already trading, shown at market value</h2>' +
      '<p>The top ' + D.live.length + ' protocols that already have a token, by market cap. They are never mixed into the pre-token board: their value is the market’s, not the model’s.</p>' +
      '<table class="mini"><thead><tr><th>Protocol</th><th>TVL</th><th>Market cap</th><th>7d</th></tr></thead><tbody>' +
      D.live.slice(0, 12).map(function (r) { return '<tr><td><b>' + esc(r.name) + '</b> <span style="color:var(--faint)">' + esc(r.category || '') + '</span></td><td>' + fmtUSD(r.tvl_usd) + '</td><td>' + (r.mcap_usd ? fmtUSD(r.mcap_usd) : '—') + '</td><td class="' + (r.change_7d !== null && r.change_7d < 0 ? 'neg' : 'pos') + '">' + fmtPct(r.change_7d) + '</td></tr>'; }).join('') +
      '</tbody></table></section>' +
      '<section class="block method"><h2>How the rug score works</h2>' +
      '<p>Every signal comes only from the sealed snapshot — no hand-kept lists, no name is special-cased. Raw implied value = TVL × 0.25 × growth × maturity (growth clamped −60%…+120%, maturity 0.6–1.0 over 3 years). Then:</p>' +
      '<ul><li><b>Flight (35%):</b> 7d TVL change. Outflow past −15% or inflow past +50% both score high; a flat week scores 10.</li>' +
      '<li><b>Youth (20%):</b> days since listing. Under 30 days scores 92; over 2 years scores 10; unknown date scores 70.</li>' +
      '<li><b>Concentration (20%):</b> one chain scores 58; five or more score 10.</li>' +
      '<li><b>Category (15%):</b> bridges 72, derivatives 66, yield 60, DEXs 55, lending 34, chains 30.</li>' +
      '<li><b>Thinness (10%):</b> under $10M TVL scores 72; over $1B scores 16.</li>' +
      '<li><b>Adjusted value = raw × (1 − 0.8 × score/100)</b>, floored at 15% of raw. Bands: LOW &lt;30, GUARDED 30–44, ELEVATED 45–57, HIGH 58–69, SEVERE ≥70.</li>' +
      '<li><b>Farm plans</b> start with a rug check, use $25 test sizes on HIGH/SEVERE rows, and carry an exit trigger: leave at once on a 10% weekly TVL fall (HIGH/SEVERE) or 25% (other bands).</li></ul>' +
      '<p>This radar cannot prove a protocol is safe — it can only show, from public TVL figures, which ones have the observable shape of a rug. Verify contracts and admin keys yourself before depositing.</p></section>' +
      '<footer>Snapshot ' + esc(D.as_of) + ' · ' + esc(D.source) + ' · Model ' + esc(D.model_version) + ' · Static page, no network: all data is in data.js beside this dashboard.</footer></div>';
    root.innerHTML = h;
    root.setAttribute('aria-busy', 'false');
    document.title = title + ' — Rug-Guard Radar';
    document.querySelectorAll('.band-chip').forEach(function (b) {
      b.addEventListener('click', function () { state.band = b.getAttribute('data-band'); state.selected = null; render(); });
    });
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; render(); var nq = document.getElementById('q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } });
    var cat = document.getElementById('cat'); if (cat) cat.addEventListener('change', function () { state.cat = cat.value; render(); });
    var ch = document.getElementById('chain'); if (ch) ch.addEventListener('change', function () { state.chain = ch.value; render(); });
    var so = document.getElementById('sort'); if (so) so.addEventListener('change', function () { state.sort = so.value; render(); });
    var hr = document.getElementById('hideRisky'); if (hr) hr.addEventListener('change', function () { state.hideRisky = hr.checked; render(); });
    document.querySelectorAll('tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { state.selected = tr.getAttribute('data-slug'); render(); var d = document.getElementById('detail'); if (d) d.scrollIntoView(); });
    });

  }
  render();
})();
