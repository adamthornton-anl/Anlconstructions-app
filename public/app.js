// ─── Config ───────────────────────────────────────────────────────────────────
var WORKERS = {
  Adam:  {id:'ba97c403-596f-483b-8dd5-3c11131db62a', pin:'7264', rate:81.49},
  James: {id:'7b309a07-cfea-4e78-8109-e7b7d40f4cf4', pin:'5891', rate:48.65},
  Brady: {id:'be3737d8-0235-4fb8-85a6-6150659a278f', pin:'3742', rate:29.95},
  Drew:  {id:'3397c62c-b85e-4cda-ac24-fd138b1eb74a', pin:'8159', rate:81.49}
};
var TAX = 0.20, SUPER = 0.115;
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DNAMES = ['Mon','Tue','Wed','Thu','Fri'];
var user = null, entries = {}, weekDays = [], weekOffset = 0, pickTarget = null;

// ─── Drum rollers ─────────────────────────────────────────────────────────────
var drumH, drumM, drumP;
var HOURS = Array.from({length:12}, function(_,i){ return pad(i+1); });
var MINS  = Array.from({length:60}, function(_,i){ return pad(i); });
var AMPM  = ['AM','PM'];

function initDrums() {
  drumH = new DrumRoller(document.getElementById('drum-h'), HOURS, 6);
  drumM = new DrumRoller(document.getElementById('drum-m'), MINS,  0);
  drumP = new DrumRoller(document.getElementById('drum-p'), AMPM,  0);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2,'0'); }

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms || 8);
}

var toastT;
function showToast(msg) {
  var el = document.getElementById('toast');
  el.innerHTML = msg;
  el.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = setTimeout(function(){ el.classList.add('hidden'); }, 2500);
}

// ─── Time Modal ───────────────────────────────────────────────────────────────
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
    drumH.setByValue(pad(h12), false);
    drumM.setByValue(pad(min), false);
    drumP.setByValue(ampm, false);
  }, 50);
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
  var h12  = parseInt(drumH.getValue()) % 12;
  var min  = parseInt(drumM.getValue()) || 0;
  var ampm = drumP.getValue();
  var h24  = h12 + (ampm === 'PM' ? 12 : 0);

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
  })
  .then(function(r){ return r.json(); })
  .then(function(){ showToast(isStart ? '✓ Start set' : '✓ End set'); loadEntries(); closeModal(); })
  .catch(function(e){ alert('Error: ' + e.message); });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
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

// ─── Week ─────────────────────────────────────────────────────────────────────
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
    s.date.getDate() + '–' + e.date.getDate() + ' ' + MONTHS[e.date.getMonth()] + ' ' + e.date.getFullYear();
  document.getElementById('nav-label').textContent =
    s.date.getDate() + ' ' + MONTHS[s.date.getMonth()] + ' – ' + e.date.getDate() + ' ' + MONTHS[e.date.getMonth()];
}

function prevWeek() { weekOffset--; buildWeekDays(); loadEntries(); }
function nextWeek() { weekOffset++; buildWeekDays(); loadEntries(); }

// ─── Entries ──────────────────────────────────────────────────────────────────
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
  })
  .then(function(r){ return r.json(); })
  .then(function(){ showToast('✓ Saved'); loadEntries(); })
  .catch(function(e){ alert('Error: ' + e.message); });
}

// ─── Render ───────────────────────────────────────────────────────────────────
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
      return new Date(ts).toLocaleTimeString('en-AU', {hour:'2-digit', minute:'2-digit', hour12:true});
    };
    var sLbl = (e && e.start_time) ? fmt(e.start_time) : 'Tap';
    var eLbl = (e && e.end_time)   ? fmt(e.end_time)   : 'Tap';
    var sCls = (e && e.start_time) ? 'col-time done' : 'col-time';
    var eCls = (e && e.end_time)   ? 'col-time done' : 'col-time';
    var isToday = day.isoDate === todayIso;
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

// ─── PDF Export ───────────────────────────────────────────────────────────────
function exportCSV() {
  var totHrs = 0, totGross = 0;
  var fmt = function(ts){ return new Date(ts).toLocaleTimeString('en-AU', {hour:'2-digit', minute:'2-digit', hour12:true}); };

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
                  ' - ' + weekDays[4].date.getDate() + ' ' + MONTHS[weekDays[4].date.getMonth()] +
                  ' ' + weekDays[4].date.getFullYear();
  var generated = new Date().toLocaleDateString('en-AU', {day:'2-digit', month:'long', year:'numeric'});

  var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  var W = 210, margin = 14;

  // Header bar
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('ANL CONSTRUCTIONS', margin, 12);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Weekly Payslip', margin, 20);
  doc.setFillColor(0, 102, 204);
  doc.roundedRect(W - margin - 24, 8, 24, 10, 3, 3, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', W - margin - 12, 14.5, {align:'center'});

  // Meta
  doc.setTextColor(26, 26, 26);
  var metaY = 36;
  var metaItems = [
    ['EMPLOYEE', user.name],
    ['WEEK', weekLabel],
    ['HOURLY RATE', '$' + user.rate.toFixed(2) + '/hr'],
    ['GENERATED', generated]
  ];
  metaItems.forEach(function(m, i) {
    var x = margin + (i % 2) * 90;
    var y = metaY + Math.floor(i / 2) * 14;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(150,150,150);
    doc.text(m[0], x, y);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(26,26,26);
    doc.text(m[1], x, y + 6);
  });
  doc.setDrawColor(220,220,220); doc.setLineWidth(0.4);
  doc.line(margin, metaY + 28, W - margin, metaY + 28);

  // Table
  var tY = metaY + 34;
  var cols = [
    {label:'DAY',   w:18, align:'left'},
    {label:'DATE',  w:28, align:'left'},
    {label:'START', w:22, align:'center'},
    {label:'END',   w:22, align:'center'},
    {label:'LUNCH', w:20, align:'center'},
    {label:'HRS',   w:18, align:'right'},
    {label:'GROSS', w:26, align:'right'},
    {label:'JOB',   w:38, align:'left'}
  ];
  doc.setFillColor(248,248,248); doc.rect(margin, tY, W - margin*2, 8, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100,100,100);
  var cx = margin + 2;
  cols.forEach(function(c) {
    var tx = c.align === 'right' ? cx+c.w-2 : c.align === 'center' ? cx+c.w/2 : cx;
    doc.text(c.label, tx, tY+5.5, {align: c.align==='center'?'center':c.align==='right'?'right':'left'});
    cx += c.w;
  });

  var rowY = tY + 8;
  rows.forEach(function(r, ri) {
    if (ri % 2 === 1) { doc.setFillColor(252,252,252); doc.rect(margin, rowY, W-margin*2, 9, 'F'); }
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(26,26,26);
    var vals = [r.day, r.date, r.start, r.end,
      r.lunch ? r.lunch+'m' : '--',
      r.hrs > 0 ? r.hrs.toFixed(2)+'h' : '--',
      r.gross > 0 ? '$'+r.gross.toFixed(2) : '--',
      r.job || '--'];
    cx = margin + 2;
    cols.forEach(function(c, ci) {
      var tx = c.align==='right' ? cx+c.w-2 : c.align==='center' ? cx+c.w/2 : cx;
      doc.text(String(vals[ci]), tx, rowY+6, {align: c.align==='center'?'center':c.align==='right'?'right':'left'});
      cx += c.w;
    });
    doc.setDrawColor(235,235,235); doc.line(margin, rowY+9, W-margin, rowY+9);
    rowY += 9;
  });

  // Summary box
  var sumY = rowY + 8;
  doc.setFillColor(248,248,248); doc.rect(margin, sumY, W-margin*2, 50, 'F');
  doc.setDrawColor(220,220,220); doc.rect(margin, sumY, W-margin*2, 50, 'S');
  var sumRows = [
    {label:'Total Hours',            val:totHrs.toFixed(2)+' hrs', color:[26,26,26]},
    {label:'Gross Pay',              val:'$'+totGross.toFixed(2),   color:[40,167,69]},
    {label:'Tax Withheld (20%)',     val:'-$'+tax.toFixed(2),       color:[220,53,69]},
    {label:'Superannuation (11.5%)', val:'$'+superC.toFixed(2),     color:[0,102,204]}
  ];
  sumRows.forEach(function(s, i) {
    var y = sumY + 8 + i * 10;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100,100,100);
    doc.text(s.label, margin+4, y);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(s.color[0], s.color[1], s.color[2]);
    doc.text(s.val, W-margin-4, y, {align:'right'});
    if (i < 3) { doc.setDrawColor(235,235,235); doc.line(margin+4, y+3, W-margin-4, y+3); }
  });

  // Net Pay bar
  var netY = sumY + 54;
  doc.setFillColor(26,26,26); doc.rect(margin, netY, W-margin*2, 18, 'F');
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255);
  doc.text('NET PAY (Take-home)', margin+4, netY+11);
  doc.setFontSize(16); doc.setTextColor(77,212,128);
  doc.text('$'+net.toFixed(2), W-margin-4, netY+12, {align:'right'});

  // Footer
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(180,180,180);
  doc.text('ANL Constructions  ·  Generated ' + generated + '  ·  Confidential', W/2, netY+28, {align:'center'});

  doc.save('Payslip-' + user.name + '-' + weekDays[0].isoDate + '.pdf');
  showToast('⬇ PDF downloaded');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function() {
  initDrums();
});
