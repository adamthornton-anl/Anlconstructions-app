// ─── Config ───────────────────────────────────────────────────────────────────
var WORKERS = {
  adam:  {id:'ba97c403-596f-483b-8dd5-3c11131db62a', name:'Adam',  password:'SecurePass123!', rate:81.49},
  james: {id:'7b309a07-cfea-4e78-8109-e7b7d40f4cf4', name:'James', password:'SecurePass456!', rate:48.65},
  brady: {id:'be3737d8-0235-4fb8-85a6-6150659a278f', name:'Brady', password:'SecurePass789!', rate:29.95},
  drew:  {id:'3397c62c-b85e-4cda-ac24-fd138b1eb74a', name:'Drew',  password:'SecurePass012!', rate:81.49}
};
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DNAMES = ['Mon','Tue','Wed','Thu','Fri'];
var user = null, entries = {}, weekDays = [], weekOffset = 0;
var pickTarget = null, lunchTarget = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2,'0'); }

function vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms || 8); }

var toastT;
function showToast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = setTimeout(function(){ el.classList.add('hidden'); }, 2500);
}

function nowTimeStr() {
  var n = new Date();
  return pad(n.getHours()) + ':' + pad(n.getMinutes());
}

// Return HH:MM from either a stored HH:MM string or a legacy ISO timestamp
function fmtHHMM(ts) {
  if (!ts) return '00:00';
  if (ts.length === 5) return ts;          // already HH:MM
  var d = new Date(ts);                    // legacy ISO — use device local time
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// Return human-readable 12h time e.g. '7:00 am'
function fmtDisplay(ts) {
  if (!ts) return '--';
  var parts = fmtHHMM(ts).split(':');
  var h = parseInt(parts[0]), m = parseInt(parts[1]);
  var ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return h + ':' + pad(m) + ' ' + ampm;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function login() {
  var username = document.getElementById('username-input').value.toLowerCase().trim();
  var password = document.getElementById('password-input').value;
  var err = document.getElementById('err');
  err.classList.add('hidden');
  if (!username) { err.textContent = 'Please enter username'; err.classList.remove('hidden'); return; }
  if (!password) { err.textContent = 'Please enter password'; err.classList.remove('hidden'); return; }
  var w = WORKERS[username];
  if (!w || password !== w.password) { err.textContent = 'Invalid username or password'; err.classList.remove('hidden'); return; }
  user = {name: w.name, id: w.id, rate: w.rate};
  document.getElementById('page-login').classList.add('hidden');
  document.getElementById('page-tracker').classList.remove('hidden');
  document.getElementById('action-bar').classList.remove('hidden');
  document.getElementById('t-name').textContent = w.name;
  weekOffset = 0;
  buildWeekDays();
  loadEntries();
}

function logout() {
  user = null; entries = {};
  document.getElementById('page-tracker').classList.add('hidden');
  document.getElementById('page-login').classList.remove('hidden');
  document.getElementById('action-bar').classList.add('hidden');
  document.getElementById('username-input').value = '';
  document.getElementById('password-input').value = '';
}

// ─── Week ─────────────────────────────────────────────────────────────────────
function buildWeekDays() {
  var now = new Date(), dow = now.getDay(), diff = dow === 0 ? -6 : 1 - dow;
  var mon = new Date(now);
  mon.setDate(now.getDate() + diff + weekOffset * 7);
  mon.setHours(0,0,0,0);
  weekDays = DNAMES.map(function(name, i) {
    var d = new Date(mon);
    d.setDate(mon.getDate() + i);
    var iso = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
    return {name: name, date: d, label: name + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()], isoDate: iso};
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

function postEntry(payload) {
  return fetch('/api/entry', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  }).then(function(r){ return r.json(); });
}

function saveNotes() {
  if (!user) return;
  var materials = document.getElementById('materials-input').value.trim();
  var now = new Date();
  var todayIso = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate());
  var found = weekDays.find(function(d){ return d.isoDate === todayIso; }) || weekDays[0];
  postEntry({user_id: user.id, day: found.isoDate, materials: materials})
    .then(function(){ showToast('✓ Materials saved'); loadEntries(); })
    .catch(function(e){ alert('Error: ' + e.message); });
}

// ─── Time Modal ───────────────────────────────────────────────────────────────
function openTimeModal(dayObj, isStart) {
  pickTarget = {dayObj: dayObj, isStart: isStart};
  document.getElementById('modal-title').textContent = isStart ? 'Set Start Time' : 'Set End Time';
  document.getElementById('modal-sub').textContent   = dayObj.label;

  // Default to current time
  var timeStr = nowTimeStr();
  // If entry already has a time, pre-fill that instead
  var e = entries[dayObj.isoDate];
  if (e) {
    var ts = isStart ? e.start_time : e.end_time;
    if (ts) {
      // ts stored as HH:MM string; handle legacy ISO too
      timeStr = ts.length === 5 ? ts : ts.substring(11, 16);
    }
  }
  document.getElementById('time-input').value = timeStr;
  document.getElementById('time-modal').classList.remove('hidden');
  // Auto-focus the input on iOS
  setTimeout(function(){ document.getElementById('time-input').focus(); }, 50);
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
  var val = document.getElementById('time-input').value;
  if (!val) { showToast('Please pick a time'); return; }
  var parts = val.split(':');
  var h = parseInt(parts[0]), m = parseInt(parts[1]);

  var dayObj = pickTarget.dayObj, isStart = pickTarget.isStart;
  // Store as plain HH:MM — no timezone conversion, no ambiguity
  var payload = {user_id: user.id, day: dayObj.isoDate};
  if (isStart) payload.start_time = val;
  else         payload.end_time   = val;

  vibrate(15);
  postEntry(payload)
    .then(function(){ showToast(isStart ? '✓ Start set' : '✓ End set'); loadEntries(); closeModal(); })
    .catch(function(e){ alert('Error: ' + e.message); });
}

// ─── Lunch Modal ──────────────────────────────────────────────────────────────
function openLunchModal(dayObj) {
  lunchTarget = dayObj;
  document.getElementById('lunch-modal-title').textContent = 'Lunch Break';
  document.getElementById('lunch-modal-sub').textContent   = dayObj.label;
  // Highlight current value
  var cur = (entries[dayObj.isoDate] && entries[dayObj.isoDate].lunch_mins) || 0;
  document.querySelectorAll('.lunch-btn').forEach(function(btn){
    btn.classList.toggle('active', parseInt(btn.getAttribute('data-mins')||btn.textContent) === cur);
  });
  document.getElementById('lunch-modal').classList.remove('hidden');
}

function lunchOverlayTap(e) {
  if (e.target === document.getElementById('lunch-modal')) closeLunchModal();
}

function closeLunchModal() {
  document.getElementById('lunch-modal').classList.add('hidden');
  lunchTarget = null;
}

function setLunch(mins) {
  if (!lunchTarget) return;
  vibrate(12);
  postEntry({user_id: user.id, day: lunchTarget.isoDate, lunch_mins: mins})
    .then(function(){
      showToast(mins ? '✓ Lunch: ' + mins + ' min' : '✓ No lunch');
      loadEntries();
      closeLunchModal();
    })
    .catch(function(e){ alert('Error: ' + e.message); });
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderTable() {
  var tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  var totHrs = 0, totGross = 0;
  var now = new Date();
  var todayIso = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate());

  weekDays.forEach(function(day) {
    var e = entries[day.isoDate];
    var hrs = 0, gross = 0;
    if (e && e.start_time && e.end_time) {
      var sp = fmtHHMM(e.start_time).split(':'), ep = fmtHHMM(e.end_time).split(':');
      var mins = (parseInt(ep[0])*60+parseInt(ep[1])) - (parseInt(sp[0])*60+parseInt(sp[1])) - (e.lunch_mins || 0);
      hrs   = Math.max(0, mins / 60);
      gross = hrs * user.rate;
      totHrs  += hrs;
      totGross += gross;
    }
    var fmt = function(ts) { return fmtDisplay(ts); };
    var sLbl = (e && e.start_time) ? fmt(e.start_time) : 'In';
    var eLbl = (e && e.end_time)   ? fmt(e.end_time)   : 'Out';
    var lunchMins = (e && e.lunch_mins) || 0;
    var lunchLbl  = lunchMins ? lunchMins + 'm' : '–';
    var sCls = (e && e.start_time) ? 'col-time done' : 'col-time';
    var eCls = (e && e.end_time)   ? 'col-time done' : 'col-time';
    var lCls = lunchMins ? 'col-lunch set' : 'col-lunch';
    var isToday = day.isoDate === todayIso;

    var jobVal = (e && e.job) || '';
    var tr = document.createElement('tr');
    if (isToday) tr.className = 'today-row';
    tr.innerHTML =
      '<td class="col-day"><div class="dn">' + day.name + '</div><div class="dd">' + day.date.getDate() + ' ' + MONTHS[day.date.getMonth()] + '</div></td>' +
      '<td class="' + sCls + '" data-iso="' + day.isoDate + '" data-start="1">' + sLbl + '</td>' +
      '<td class="' + eCls + '" data-iso="' + day.isoDate + '" data-start="0">' + eLbl + '</td>' +
      '<td class="' + lCls + '" data-iso="' + day.isoDate + '">' + lunchLbl + '</td>' +
      '<td class="col-hrs">' + (hrs > 0 ? hrs.toFixed(1)+'h' : '–') + '</td>' +
      '<td class="col-pay">' + (gross > 0 ? '$'+gross.toFixed(2) : '–') + '</td>';
    tbody.appendChild(tr);

    // Job input row
    var jobTr = document.createElement('tr');
    jobTr.className = 'job-row';
    jobTr.innerHTML = '<td colspan="6" class="job-cell">' +
      '<input class="job-field" type="text" placeholder="Job / client for ' + day.name + '..." value="' + jobVal.replace(/"/g, '&quot;') + '" data-iso="' + day.isoDate + '">' +
      '</td>';
    tbody.appendChild(jobTr);
  });

  // Time tap listeners
  tbody.querySelectorAll('.col-time').forEach(function(td) {
    td.addEventListener('click', function() {
      vibrate(10);
      var iso = td.dataset.iso;
      var isStart = td.dataset.start === '1';
      var dayObj = weekDays.find(function(d){ return d.isoDate === iso; });
      if (dayObj) openTimeModal(dayObj, isStart);
    });
  });

  // Lunch tap listeners
  tbody.querySelectorAll('.col-lunch').forEach(function(td) {
    td.addEventListener('click', function() {
      vibrate(10);
      var iso = td.dataset.iso;
      var dayObj = weekDays.find(function(d){ return d.isoDate === iso; });
      if (dayObj) openLunchModal(dayObj);
    });
  });

  // Job field save on blur/enter
  tbody.querySelectorAll('.job-field').forEach(function(input) {
    function saveJob() {
      var iso = input.dataset.iso;
      var val = input.value.trim();
      postEntry({user_id: user.id, day: iso, job: val})
        .then(function(){ entries[iso] = entries[iso] || {}; entries[iso].job = val; })
        .catch(function(e){ console.error('Job save:', e); });
    }
    input.addEventListener('blur', saveJob);
    input.addEventListener('keydown', function(e){ if (e.key === 'Enter') { input.blur(); } });
  });

  document.getElementById('tot-hrs').textContent   = totHrs.toFixed(1) + 'h';
  document.getElementById('tot-gross').textContent = '$' + totGross.toFixed(2);

  // Populate materials textarea with today's saved materials
  var now2 = new Date();
  var todayIso2 = now2.getFullYear() + '-' + pad(now2.getMonth()+1) + '-' + pad(now2.getDate());
  var todayEntry = entries[todayIso2];
  document.getElementById('materials-input').value = (todayEntry && todayEntry.materials) || '';

  // Build materials list for the week
  var matList = document.getElementById('materials-list');
  if (matList) {
    var matItems = weekDays.filter(function(d){ return entries[d.isoDate] && entries[d.isoDate].materials; })
      .map(function(d){ return '<li><strong>' + d.name + ':</strong> ' + entries[d.isoDate].materials + '</li>'; });
    matList.innerHTML = matItems.length ? '<ul style="margin:8px 0;padding-left:18px">' + matItems.join('') + '</ul>' : '<p style="color:#999;font-size:13px">No materials logged this week.</p>';
  }

  var ratio  = totHrs / 37;
  var tax    = user.weeklyTax   * ratio;
  var superC = user.weeklySuper * ratio;
  var net    = totGross - tax - superC;
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
  var rows = weekDays.map(function(day) {
    var e = entries[day.isoDate];
    var s  = (e && e.start_time) ? fmtDisplay(e.start_time) : '--';
    var en = (e && e.end_time)   ? fmtDisplay(e.end_time)   : '--';
    var hrs = 0;
    if (e && e.start_time && e.end_time) {
      var sp2 = fmtHHMM(e.start_time).split(':'), ep2 = fmtHHMM(e.end_time).split(':');
      var mins = (parseInt(ep2[0])*60+parseInt(ep2[1])) - (parseInt(sp2[0])*60+parseInt(sp2[1])) - (e.lunch_mins || 0);
      hrs = Math.max(0, mins / 60);
    }
    var gross = hrs * user.rate;
    totHrs += hrs; totGross += gross;
    return {day: day.name, date: day.isoDate, start: s, end: en, hrs: hrs, gross: gross,
            job: (e && e.job) || '', lunch: (e && e.lunch_mins) || 0};
  });

  var ratio  = totHrs / 37;
  var tax    = user.weeklyTax   * ratio;
  var superC = user.weeklySuper * ratio;
  var net    = totGross - tax - superC;
  var weekLabel = weekDays[0].date.getDate() + ' ' + MONTHS[weekDays[0].date.getMonth()] +
                  ' - ' + weekDays[4].date.getDate() + ' ' + MONTHS[weekDays[4].date.getMonth()] +
                  ' ' + weekDays[4].date.getFullYear();
  var generated = new Date().toLocaleDateString('en-AU', {day:'2-digit', month:'long', year:'numeric'});

  var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  var W = 210, margin = 14;

  // Header
  doc.setFillColor(26,26,26); doc.rect(0,0,W,28,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text('TIMESHEET PRO', margin, 12);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text('Hours Summary', margin, 20);
  doc.setFillColor(0,102,204);
  doc.roundedRect(W-margin-24, 8, 24, 10, 3, 3, 'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('SUMMARY', W-margin-12, 14.5, {align:'center'});

  // Meta
  doc.setTextColor(26,26,26);
  var metaY = 36;
  var metaItems = [
    ['EMPLOYEE', user.name === 'Adam' ? 'Adam Conan Thornton' : user.name],
    ['WEEK', weekLabel],
    ['HOURLY RATE', '$' + user.rate.toFixed(2) + '/hr'],
    ['GENERATED', generated],
    ['WORKER TYPE', 'Contractor']
  ];
  metaItems.forEach(function(m, i) {
    var x = margin + (i % 2) * 90;
    var y = metaY + Math.floor(i / 2) * 14;
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(150,150,150);
    doc.text(m[0], x, y);
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(26,26,26);
    doc.text(m[1], x, y+6);
  });
  doc.setDrawColor(220,220,220); doc.setLineWidth(0.4);
  doc.line(margin, metaY+42, W-margin, metaY+42);

  // Table
  var tY = metaY + 48;
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
  doc.setFillColor(248,248,248); doc.rect(margin, tY, W-margin*2, 8, 'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(100,100,100);
  var cx = margin+2;
  cols.forEach(function(c) {
    var tx = c.align==='right' ? cx+c.w-2 : c.align==='center' ? cx+c.w/2 : cx;
    doc.text(c.label, tx, tY+5.5, {align:c.align==='center'?'center':c.align==='right'?'right':'left'});
    cx += c.w;
  });
  var rowY = tY+8;
  rows.forEach(function(r, ri) {
    if (ri%2===1) { doc.setFillColor(252,252,252); doc.rect(margin, rowY, W-margin*2, 9, 'F'); }
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(26,26,26);
    var vals = [r.day, r.date, r.start, r.end,
      r.lunch ? r.lunch+'m' : '--',
      r.hrs>0 ? r.hrs.toFixed(2)+'h' : '--',
      r.gross>0 ? '$'+r.gross.toFixed(2) : '--',
      r.job||'--'];
    cx = margin+2;
    cols.forEach(function(c, ci) {
      var tx = c.align==='right' ? cx+c.w-2 : c.align==='center' ? cx+c.w/2 : cx;
      doc.text(String(vals[ci]), tx, rowY+6, {align:c.align==='center'?'center':c.align==='right'?'right':'left'});
      cx += c.w;
    });
    doc.setDrawColor(235,235,235); doc.line(margin, rowY+9, W-margin, rowY+9);
    rowY += 9;
  });

  // Summary
  var sumY = rowY+8;
  doc.setFillColor(248,248,248); doc.rect(margin, sumY, W-margin*2, 50, 'F');
  doc.setDrawColor(220,220,220); doc.rect(margin, sumY, W-margin*2, 50, 'S');
  var sumRows = [
    {label:'Total Hours',            val:totHrs.toFixed(2)+' hrs', color:[26,26,26]},
    {label:'Gross Pay',              val:'$'+totGross.toFixed(2),   color:[40,167,69]},
    {label:'Tax Withheld',           val:'-$'+tax.toFixed(2),       color:[220,53,69]},
    {label:'Superannuation',         val:'$'+superC.toFixed(2),     color:[0,102,204]}
  ];
  sumRows.forEach(function(s, i) {
    var y = sumY+8+i*10;
    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100);
    doc.text(s.label, margin+4, y);
    doc.setFont('helvetica','bold'); doc.setTextColor(s.color[0],s.color[1],s.color[2]);
    doc.text(s.val, W-margin-4, y, {align:'right'});
    if (i<3) { doc.setDrawColor(235,235,235); doc.line(margin+4, y+3, W-margin-4, y+3); }
  });

  // Net Pay bar
  var netY = sumY+54;
  doc.setFillColor(26,26,26); doc.rect(margin, netY, W-margin*2, 18, 'F');
  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text('NET PAY (Take-home)', margin+4, netY+11);
  doc.setFontSize(16); doc.setTextColor(77,212,128);
  doc.text('$'+net.toFixed(2), W-margin-4, netY+12, {align:'right'});

  // Footer
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
  doc.text('ANL Constructions  ·  Generated '+generated+'  ·  Confidential', W/2, netY+28, {align:'center'});

  doc.save('Hours-'+user.name+'-'+weekDays[0].isoDate+'.pdf');
  showToast('⬇ PDF downloaded');
}
