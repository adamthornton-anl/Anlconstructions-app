var WORKERS = {
  Adam:  {id:'ba97c403-596f-483b-8dd5-3c11131db62a', pin:'7264', rate:81.49},
  James: {id:'7b309a07-cfea-4e78-8109-e7b7d40f4cf4', pin:'5891', rate:48.65},
  Brady: {id:'be3737d8-0235-4fb8-85a6-6150659a278f', pin:'3742', rate:29.95},
  Drew:  {id:'3397c62c-b85e-4cda-ac24-fd138b1eb74a', pin:'8159', rate:81.49}
};
var TAX = 0.20, SUPER = 0.115;
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DNAMES = ['Mon','Tue','Wed','Thu','Fri'];
var user = null, entries = {}, weekDays = [], weekOffset = 0, pickTarget = null, snapT = {};

function pad(n) { return String(n).padStart(2,'0'); }

function buildDrum(id, vals) {
  var d = document.getElementById(id);
  d.querySelectorAll('.drum-item').forEach(function(e){ e.remove(); });
  var bot = d.lastElementChild;
  vals.forEach(function(v, i) {
    var el = document.createElement('div');
    el.className = 'drum-item' + (i === 0 ? ' sel' : '');
    el.dataset.v = v;
    el.textContent = v;
    d.insertBefore(el, bot);
  });
}
buildDrum('drum-h', Array.from({length:12}, function(_,i){ return pad(i+1); }));
buildDrum('drum-m', Array.from({length:60}, function(_,i){ return pad(i); }));
buildDrum('drum-p', ['AM','PM']);

function drumSet(id, val) {
  var d = document.getElementById(id);
  var items = Array.from(d.querySelectorAll('.drum-item'));
  var idx = items.findIndex(function(e){ return e.dataset.v === val; });
  if (idx < 0) return;
  d.scrollTop = idx * 50;
  hilite(d, idx);
}

function drumGet(id) {
  var d = document.getElementById(id);
  var idx = Math.round(d.scrollTop / 50);
  var items = Array.from(d.querySelectorAll('.drum-item'));
  return items[idx] ? items[idx].dataset.v : null;
}

function hilite(d, idx) {
  d.querySelectorAll('.drum-item').forEach(function(e, i) {
    e.classList.toggle('sel', i === idx);
  });
}

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms || 10);
}

function onScroll(k) {
  var ids = {h:'drum-h', m:'drum-m', p:'drum-p'};
  clearTimeout(snapT[k]);
  snapT[k] = setTimeout(function() {
    var d = document.getElementById(ids[k]);
    var idx = Math.round(d.scrollTop / 50);
    d.scrollTo({top: idx * 50, behavior: 'smooth'});
    var prev = parseInt(d.dataset.lastIdx || -1);
    if (prev !== idx) { vibrate(8); d.dataset.lastIdx = idx; }
    hilite(d, idx);
  }, 80);
}

function openTimeModal(dayObj, isStart) {
  pickTarget = {dayObj: dayObj, isStart: isStart};
  document.getElementById('modal-title').textContent = isStart ? 'Set Start Time' : 'Set End Time';
  document.getElementById('modal-sub').textContent = dayObj.label;
  var h24 = isStart ? 7 : 17, min = 0;
  var e = entries[dayObj.isoDate];
  if (e) {
    var ts = isStart ? e.start_time : e.end_time;
    if (ts) { var dd = new Date(ts); h24 = dd.getHours(); min = dd.getMinutes(); }
  }
  var ampm = h24 >= 12 ? 'PM' : 'AM';
  var h12  = h24 % 12 === 0 ? 12 : h24 % 12;
  document.getElementById('time-modal').classList.remove('hidden');
  setTimeout(function() {
    drumSet('drum-h', pad(h12));
    drumSet('drum-m', pad(min));
    drumSet('drum-p', ampm);
  }, 60);
}

function overlayTap(e) {
  if (e.target === document.getElementById('time-modal')) closeModal();
}

function closeModal() {
  document.getElementById('time-modal').classList.add('hidden');
  pickTarget = null;
}

function confirmTime() {
  if (!pickTarget) return;
  vibrate(20);
  var h24 = parseInt(drumGet('drum-h')) % 12;
  if (drumGet('drum-p') === 'PM') h24 += 12;
  var min = parseInt(drumGet('drum-m')) || 0;
  var dayObj = pickTarget.dayObj, isStart = pickTarget.isStart;
  var dt = new Date(dayObj.date);
  dt.setHours(h24, min, 0, 0);
  var payload = {user_id: user.id, day: dayObj.isoDate};
  if (isStart) payload.start_time = dt.toISOString();
  else         payload.end_time   = dt.toISOString();
  fetch('/api/entry', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  }).then(function(r){ return r.json(); })
    .then(function(){ showToast(isStart ? 'Start set' : 'End set'); loadEntries(); closeModal(); })
    .catch(function(e){ alert('Error: ' + e.message); });
}

var toastT;
function showToast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = setTimeout(function(){ el.classList.add('hidden'); }, 2200);
}

function login() {
  var name = document.getElementById('worker-select').value;
  var pin  = document.getElementById('pin-input').value;
  var err  = document.getElementById('err');
  err.classList.add('hidden');
  if (!name) { err.textContent = 'Please select a worker'; err.classList.remove('hidden'); return; }
  if (pin.length !== 4) { err.textContent = 'PIN must be 4 digits'; err.classList.remove('hidden'); return; }
  var w = WORKERS[name];
  if (!w || pin !== w.pin) { err.textContent = 'Invalid PIN'; err.classList.remove('hidden'); return; }
  user = {name: name, id: w.id, rate: w.rate};
  document.getElementById('page-login').classList.add('hidden');
  document.getElementById('page-tracker').classList.remove('hidden');
  document.getElementById('action-bar').classList.remove('hidden');
  document.getElementById('t-name').textContent = name;
  weekOffset = 0;
  buildWeekDays();
  loadEntries();
}

function logout() {
  user = null; entries = {};
  document.getElementById('page-tracker').classList.add('hidden');
  document.getElementById('page-login').classList.remove('hidden');
  document.getElementById('action-bar').classList.add('hidden');
  document.getElementById('worker-select').value = '';
  document.getElementById('pin-input').value = '';
}

function buildWeekDays() {
  var now = new Date(), dow = now.getDay(), diff = dow === 0 ? -6 : 1 - dow;
  var mon = new Date(now);
  mon.setDate(now.getDate() + diff + weekOffset * 7);
  mon.setHours(0, 0, 0, 0);
  weekDays = DNAMES.map(function(name, i) {
    var d = new Date(mon);
    d.setDate(mon.getDate() + i);
    var dd = d.getDate(), mo = MONTHS[d.getMonth()], yyyy = d.getFullYear();
    var iso = yyyy + '-' + pad(d.getMonth() + 1) + '-' + pad(dd);
    return {name: name, date: d, label: name + ' ' + dd + ' ' + mo + ' ' + yyyy, isoDate: iso};
  });
  var s = weekDays[0], e = weekDays[4];
  document.getElementById('t-week').textContent =
    s.date.getDate() + '\u2013' + e.date.getDate() + ' ' + MONTHS[e.date.getMonth()] + ' ' + e.date.getFullYear();
  document.getElementById('nav-label').textContent =
    s.date.getDate() + ' ' + MONTHS[s.date.getMonth()] + ' \u2013 ' + e.date.getDate() + ' ' + MONTHS[e.date.getMonth()];
}

function prevWeek() { weekOffset--; buildWeekDays(); loadEntries(); }
function nextWeek() { weekOffset++; buildWeekDays(); loadEntries(); }

function loadEntries() {
  if (!user) return;
  var from = weekDays[0].isoDate, to = weekDays[4].isoDate;
  fetch('/api/entries/' + user.id + '?from=' + from + '&to=' + to)
    .then(function(r){ return r.json(); })
    .then(function(data) {
      entries = {};
      (Array.isArray(data) ? data : []).forEach(function(e){ entries[e.day] = e; });
      renderTable();
    }).catch(function(e){ console.error('Load:', e); });
}

function saveEntry() {
  if (!user) return;
  var lunch     = parseInt(document.getElementById('lunch-select').value) || 0;
  var job       = document.getElementById('job-input').value;
  var materials = document.getElementById('materials-input').value;
  var now = new Date();
  var todayIso = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var found = weekDays.find(function(d){ return d.isoDate === todayIso; }) || weekDays[0];
  fetch('/api/entry', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({user_id: user.id, day: found.isoDate, lunch_mins: lunch, job: job, materials: materials})
  }).then(function(r){ return r.json(); })
    .then(function(){ showToast('Saved'); loadEntries(); })
    .catch(function(e){ alert('Error: ' + e.message); });
}

function renderTable() {
  var tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  var totHrs = 0, totGross = 0;
  var now = new Date();
  var todayIso = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

  weekDays.forEach(function(day) {
    var e = entries[day.isoDate];
    var hrs = 0, gross = 0;
    if (e && e.start_time && e.end_time) {
      var mins = (new Date(e.end_time) - new Date(e.start_time)) / 60000 - (e.lunch_mins || 0);
      hrs = Math.max(0, mins / 60);
      gross = hrs * user.rate;
      totHrs += hrs;
      totGross += gross;
    }
    var fmt = function(ts) {
      return new Date(ts).toLocaleTimeString('en-AU', {hour: '2-digit', minute: '2-digit', hour12: true});
    };
    var sLbl = (e && e.start_time) ? fmt(e.start_time) : 'Tap';
    var eLbl = (e && e.end_time)   ? fmt(e.end_time)   : 'Tap';
    var sCls = (e && e.start_time) ? 'col-time done' : 'col-time';
    var eCls = (e && e.end_time)   ? 'col-time done' : 'col-time';
    var isToday = day.isoDate === todayIso;
    var safe = JSON.stringify(day);
    var tr = document.createElement('tr');
    if (isToday) tr.className = 'today-row';
    tr.innerHTML =
      '<td class="col-day"><div class="dn">' + day.name + '</div><div class="dd">' + day.date.getDate() + ' ' + MONTHS[day.date.getMonth()] + '</div></td>' +
      '<td class="' + sCls + '" data-iso="' + day.isoDate + '" data-start="1">' + sLbl + '</td>' +
      '<td class="' + eCls + '" data-iso="' + day.isoDate + '" data-start="0">' + eLbl + '</td>' +
      '<td class="col-hrs">' + (hrs > 0 ? hrs.toFixed(1) + 'h' : '--') + '</td>' +
      '<td class="col-pay">' + (gross > 0 ? '$' + gross.toFixed(2) : '--') + '</td>';
    tbody.appendChild(tr);
  });

  // Attach click handlers using stored ISO dates
  tbody.querySelectorAll('.col-time').forEach(function(td) {
    td.addEventListener('click', function() {
      vibrate(12);
      var iso = td.dataset.iso;
      var isStart = td.dataset.start === '1';
      var dayObj = weekDays.find(function(d){ return d.isoDate === iso; });
      if (dayObj) openTimeModal(dayObj, isStart);
    });
  });

  document.getElementById('tot-hrs').textContent  = totHrs.toFixed(1) + 'h';
  document.getElementById('tot-gross').textContent = '$' + totGross.toFixed(2);

  var tax = totGross * TAX, superC = totGross * SUPER, net = totGross - tax;
  document.getElementById('ps-rate').textContent  = '$' + user.rate.toFixed(2) + '/h';
  document.getElementById('ps-hrs').textContent   = totHrs.toFixed(2) + ' hrs';
  document.getElementById('ps-gross').textContent = '$' + totGross.toFixed(2);
  document.getElementById('ps-tax').textContent   = '-$' + tax.toFixed(2);
  document.getElementById('ps-super').textContent = '$' + superC.toFixed(2);
  document.getElementById('ps-net').textContent   = '$' + net.toFixed(2);
}

function exportCSV() {
  var totHrs = 0, totGross = 0;
  var fmt = function(ts){ return new Date(ts).toLocaleTimeString('en-AU', {hour:'2-digit', minute:'2-digit', hour12:true}); };

  // Build rows
  var rows = weekDays.map(function(day) {
    var e = entries[day.isoDate];
    var s  = (e && e.start_time) ? fmt(e.start_time) : '--';
    var en = (e && e.end_time)   ? fmt(e.end_time)   : '--';
    var hrs = 0;
    if (e && e.start_time && e.end_time) {
      var mins = (new Date(e.end_time) - new Date(e.start_time)) / 60000 - (e.lunch_mins || 0);
      hrs = Math.max(0, mins / 60);
    }
    var gross = hrs * user.rate;
    totHrs += hrs; totGross += gross;
    return {day: day.name, date: day.isoDate, start: s, end: en, hrs: hrs, gross: gross,
            job: (e && e.job) || '', lunch: (e && e.lunch_mins) || 0};
  });

  var tax = totGross * TAX, superC = totGross * SUPER, net = totGross - tax;
  var weekLabel = weekDays[0].date.getDate() + ' ' + MONTHS[weekDays[0].date.getMonth()] +
                  ' – ' + weekDays[4].date.getDate() + ' ' + MONTHS[weekDays[4].date.getMonth()] +
                  ' ' + weekDays[4].date.getFullYear();
  var generated = new Date().toLocaleDateString('en-AU', {day:'2-digit', month:'long', year:'numeric'});

  var rowsHtml = rows.map(function(r) {
    return '<tr>' +
      '<td>' + r.day + '</td>' +
      '<td>' + r.date + '</td>' +
      '<td style="text-align:center">' + r.start + '</td>' +
      '<td style="text-align:center">' + r.end + '</td>' +
      '<td style="text-align:center">' + (r.lunch ? r.lunch + ' min' : '--') + '</td>' +
      '<td style="text-align:right">' + (r.hrs > 0 ? r.hrs.toFixed(2) : '--') + '</td>' +
      '<td style="text-align:right">' + (r.gross > 0 ? '$' + r.gross.toFixed(2) : '--') + '</td>' +
      '<td style="color:#666">' + (r.job || '--') + '</td>' +
    '</tr>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<title>Payslip - ' + user.name + '</title>'
    + '<style>'
    + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:30px;background:#f5f5f5;color:#1a1a1a;}'
    + '.wrapper{max-width:700px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12);}'
    + '.top-bar{background:#1a1a1a;color:white;padding:28px 30px;display:flex;justify-content:space-between;align-items:center;}'
    + '.company{font-size:22px;font-weight:800;letter-spacing:1px;}'
    + '.doc-title{font-size:13px;opacity:.6;margin-top:4px;}'
    + '.badge{background:#0066cc;color:white;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;}'
    + '.meta{padding:24px 30px;display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:2px solid #f0f0f0;}'
    + '.meta-item .lbl{font-size:11px;font-weight:700;text-transform:uppercase;color:#999;letter-spacing:.5px;}'
    + '.meta-item .val{font-size:15px;font-weight:600;margin-top:4px;}'
    + 'table{width:100%;border-collapse:collapse;}'
    + 'thead{background:#f8f8f8;}'
    + 'th{padding:10px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#666;letter-spacing:.5px;border-bottom:2px solid #ddd;}'
    + 'td{padding:11px 12px;border-bottom:1px solid #eee;font-size:13px;}'
    + 'tr:last-child td{border-bottom:none;}'
    + '.summary{padding:24px 30px;background:#f8f8f8;border-top:2px solid #ddd;}'
    + '.sum-row{display:flex;justify-content:space-between;padding:8px 0;font-size:14px;border-bottom:1px solid #eee;}'
    + '.sum-row:last-child{border-bottom:none;}'
    + '.sum-lbl{color:#666;}'
    + '.sum-val{font-weight:700;}'
    + '.green{color:#28a745;} .red{color:#dc3545;} .blue{color:#0066cc;}'
    + '.net-bar{background:#1a1a1a;color:white;padding:20px 30px;display:flex;justify-content:space-between;align-items:center;}'
    + '.net-bar .lbl{font-size:14px;font-weight:600;opacity:.8;}'
    + '.net-bar .amt{font-size:28px;font-weight:800;color:#4dd480;}'
    + '.footer{padding:16px 30px;text-align:center;font-size:11px;color:#bbb;border-top:1px solid #eee;}'
    + '</style></head><body>'
    + '<div class="wrapper">'
    + '<div class="top-bar">'
    + '<div><div class="company">ANL CONSTRUCTIONS</div><div class="doc-title">Weekly Payslip</div></div>'
    + '<div class="badge">PAYSLIP</div>'
    + '</div>'
    + '<div class="meta">'
    + '<div class="meta-item"><div class="lbl">Employee</div><div class="val">' + user.name + '</div></div>'
    + '<div class="meta-item"><div class="lbl">Week</div><div class="val">' + weekLabel + '</div></div>'
    + '<div class="meta-item"><div class="lbl">Hourly Rate</div><div class="val">$' + user.rate.toFixed(2) + '/hr</div></div>'
    + '<div class="meta-item"><div class="lbl">Generated</div><div class="val">' + generated + '</div></div>'
    + '</div>'
    + '<table><thead><tr>'
    + '<th>Day</th><th>Date</th><th style="text-align:center">Start</th><th style="text-align:center">End</th>'
    + '<th style="text-align:center">Lunch</th><th style="text-align:right">Hours</th><th style="text-align:right">Gross</th><th>Job</th>'
    + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>'
    + '<div class="summary">'
    + '<div class="sum-row"><span class="sum-lbl">Total Hours</span><span class="sum-val">' + totHrs.toFixed(2) + ' hrs</span></div>'
    + '<div class="sum-row"><span class="sum-lbl">Gross Pay</span><span class="sum-val green">$' + totGross.toFixed(2) + '</span></div>'
    + '<div class="sum-row"><span class="sum-lbl">Tax Withheld (20%)</span><span class="sum-val red">-$' + tax.toFixed(2) + '</span></div>'
    + '<div class="sum-row"><span class="sum-lbl">Superannuation (11.5%)</span><span class="sum-val blue">$' + superC.toFixed(2) + '</span></div>'
    + '</div>'
    + '<div class="net-bar"><span class="lbl">&#128181; NET PAY (Take-home)</span><span class="amt">$' + net.toFixed(2) + '</span></div>'
    + '<div class="footer">ANL Constructions &bull; Generated ' + generated + ' &bull; Confidential</div>'
    + '</div></body></html>';

  var blob = new Blob([html], {type: 'text/html'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url;
  a.download = 'Payslip-' + user.name + '-' + weekDays[0].isoDate + '.html';
  a.click();
  showToast('&#8681; Payslip downloaded');
}
