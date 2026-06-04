const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Resend }       = require('resend');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Clients ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://tzwsdqbrtohcxzvdfwdw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_frfpPpx6hXMGRdsJrDlW_A_9WTKqN1l';
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);
const resend       = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const ADMIN_EMAIL  = 'adam_thornton@y7mail.com';
const FROM_EMAIL   = 'onboarding@resend.dev'; // Resend test domain (works without verification)

const WORKERS = {
  'ba97c403-596f-483b-8dd5-3c11131db62a': { name:'Adam',  rate:81.49,  weeklyGross:3015.04, weeklyTax:692,    weeklySuper:323.04 },
  '7b309a07-cfea-4e78-8109-e7b7d40f4cf4': { name:'James', rate:48.65,  weeklyGross:1800.00, weeklyTax:400,    weeklySuper:216.00 },
  'be3737d8-0235-4fb8-85a6-6150659a278f': { name:'Brady', rate:29.95,  weeklyGross:1108.00, weeklyTax:178,    weeklySuper:132.96 },
  '3397c62c-b85e-4cda-ac24-fd138b1eb74a': { name:'Drew',  rate:81.49,  weeklyGross:3015.04, weeklyTax:692,    weeklySuper:323.04 }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleTimeString('en-AU', {hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'Australia/Sydney'});
}

function calcHours(entry) {
  if (!entry || !entry.start_time || !entry.end_time) return 0;
  const mins = (new Date(entry.end_time) - new Date(entry.start_time)) / 60000 - (entry.lunch_mins || 0);
  return Math.max(0, mins / 60);
}

function todayISO() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function currentWeekRange() {
  const now = new Date();
  const dow  = now.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0,0,0,0);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  fri.setHours(23,59,59,999);
  return {
    from: mon.toISOString().split('T')[0],
    to:   fri.toISOString().split('T')[0],
    label: mon.toLocaleDateString('en-AU', {day:'numeric', month:'short'}) + ' – ' +
           fri.toLocaleDateString('en-AU', {day:'numeric', month:'short', year:'numeric'})
  };
}

// ─── API: Health ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok:true, time:new Date().toISOString() }));

// ─── API: Save entry ──────────────────────────────────────────────────────────
app.post('/api/entry', async (req, res) => {
  try {
    const { user_id, day, start_time, end_time, lunch_mins, job, materials } = req.body;
    if (!user_id || !day) return res.status(400).json({ error:'Missing user_id or day' });

    const { data: existing } = await supabase
      .from('time_entries').select('id').eq('user_id', user_id).eq('day', day).single();

    const patch = {};
    if (start_time  !== undefined) patch.start_time  = start_time;
    if (end_time    !== undefined) patch.end_time     = end_time;
    if (lunch_mins  !== undefined) patch.lunch_mins   = lunch_mins;
    if (job         !== undefined) patch.job          = job;
    if (materials   !== undefined) patch.materials    = materials;

    let result;
    if (existing) {
      const { data, error } = await supabase.from('time_entries').update(patch).eq('id', existing.id).select().single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase.from('time_entries').insert([{ user_id, day, ...patch }]).select().single();
      if (error) throw error;
      result = data;
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error:err.message }); }
});

// ─── API: Get entries ─────────────────────────────────────────────────────────
app.get('/api/entries/:user_id', async (req, res) => {
  try {
    let { from, to } = req.query;
    if (!from || !to) {
      const r = currentWeekRange();
      from = r.from; to = r.to;
    }
    const { data, error } = await supabase.from('time_entries').select('*')
      .eq('user_id', req.params.user_id).gte('day', from).lte('day', to).order('day');
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error:err.message }); }
});

// ─── API: Daily email (call from cron at 5pm AEST) ────────────────────────────
app.post('/api/email/daily', async (req, res) => {
  try {
    if (!resend) return res.status(503).json({ error: 'RESEND_API_KEY not configured' });
    const today = req.body.date || todayISO();
    const dow   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(today + 'T12:00:00Z').getDay()];
    const label = dow + ' ' + new Date(today + 'T12:00:00Z').toLocaleDateString('en-AU', {day:'numeric', month:'long', year:'numeric'});

    // Fetch all workers' entries for today
    const rows = [];
    for (const [uid, w] of Object.entries(WORKERS)) {
      const { data } = await supabase.from('time_entries').select('*').eq('user_id', uid).eq('day', today).single();
      const hrs   = calcHours(data);
      const gross = hrs * w.rate;
      rows.push({
        name:      w.name,
        start:     fmtTime(data && data.start_time),
        end:       fmtTime(data && data.end_time),
        lunch:     (data && data.lunch_mins) ? data.lunch_mins + ' min' : 'None',
        hrs:       hrs > 0 ? hrs.toFixed(2) + 'h' : '--',
        gross:     gross > 0 ? '$' + gross.toFixed(2) : '--',
        job:       (data && data.job)       || '--',
        materials: (data && data.materials) || '--'
      });
    }

    const tableRows = rows.map(r => `
      <tr>
        <td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #eee">${r.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee">${r.start}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee">${r.end}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee">${r.lunch}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right">${r.hrs}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right;color:#28a745;font-weight:700">${r.gross}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#0066cc">${r.job}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#666;font-size:13px">${r.materials}</td>
      </tr>`).join('');

    const html = `
<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:20px;background:#f5f5f5">
<div style="max-width:700px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">
  <div style="background:#1a1a1a;color:white;padding:24px 28px">
    <div style="font-size:20px;font-weight:800;letter-spacing:1px">ANL CONSTRUCTIONS</div>
    <div style="font-size:13px;opacity:.6;margin-top:4px">Daily Summary — ${label}</div>
  </div>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#f8f8f8">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">Worker</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">In</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">Out</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">Lunch</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">Hours</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">Gross</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">Job</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #eee">Notes</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div style="padding:16px 28px;font-size:12px;color:#bbb;border-top:1px solid #eee;text-align:center">
    ANL Constructions · Auto-generated daily summary · Confidential
  </div>
</div>
</body></html>`;

    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      ADMIN_EMAIL,
      subject: `ANL Daily Summary — ${label}`,
      html
    });

    res.json({ ok:true, date:today });
  } catch (err) { res.status(500).json({ error:err.message }); }
});

// ─── API: Friday payroll email ────────────────────────────────────────────────
app.post('/api/email/payroll', async (req, res) => {
  try {
    if (!resend) return res.status(503).json({ error: 'RESEND_API_KEY not configured' });
    const range = currentWeekRange();
    const rows  = [];

    for (const [uid, w] of Object.entries(WORKERS)) {
      const { data: entries } = await supabase.from('time_entries').select('*')
        .eq('user_id', uid).gte('day', range.from).lte('day', range.to).order('day');

      let totHrs = 0;
      const dayRows = (entries || []).map(e => {
        const hrs = calcHours(e);
        totHrs += hrs;
        return { day:e.day, start:fmtTime(e.start_time), end:fmtTime(e.end_time),
                 lunch:(e.lunch_mins||0), hrs, job:e.job||'--' };
      });

      const ratio  = totHrs / 37;
      const gross  = totHrs * w.rate;
      const tax    = w.weeklyTax   * ratio;
      const superC = w.weeklySuper * ratio;
      const net    = gross - tax - superC;
      rows.push({ ...w, uid, totHrs, gross, tax, superC, net, dayRows });
    }

    const workerBlocks = rows.map(w => {
      const dayTableRows = w.dayRows.map(d => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${d.day}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${d.start}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${d.end}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${d.lunch ? d.lunch+'m' : 'None'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${d.hrs > 0 ? d.hrs.toFixed(2)+'h' : '--'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#0066cc">${d.job}</td>
        </tr>`).join('');

      return `
      <div style="margin-bottom:28px;border:1px solid #eee;border-radius:10px;overflow:hidden">
        <div style="background:#1a1a1a;color:white;padding:14px 18px;font-size:16px;font-weight:700">${w.name}</div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f8f8f8">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:1px solid #eee">Date</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:1px solid #eee">In</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:1px solid #eee">Out</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:1px solid #eee">Lunch</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;color:#999;text-transform:uppercase;border-bottom:1px solid #eee">Hours</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#999;text-transform:uppercase;border-bottom:1px solid #eee">Job</th>
            </tr>
          </thead>
          <tbody>${dayTableRows}</tbody>
        </table>
        <div style="background:#f8f8f8;padding:14px 18px;border-top:2px solid #eee">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="color:#666">Total Hours</span><strong>${w.totHrs.toFixed(2)}h</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="color:#666">Gross Pay</span><strong style="color:#28a745">$${w.gross.toFixed(2)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="color:#666">Tax Withheld</span><strong style="color:#dc3545">-$${w.tax.toFixed(2)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="color:#666">Superannuation</span><strong style="color:#0066cc">$${w.superC.toFixed(2)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #ddd">
            <span style="font-weight:700;font-size:15px">NET PAY</span>
            <strong style="font-size:18px;color:#1a1a1a">$${w.net.toFixed(2)}</strong>
          </div>
        </div>
      </div>`;
    }).join('');

    const html = `
<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:20px;background:#f5f5f5">
<div style="max-width:700px;margin:0 auto">
  <div style="background:#1a1a1a;color:white;padding:24px 28px;border-radius:12px 12px 0 0">
    <div style="font-size:22px;font-weight:800;letter-spacing:1px">ANL CONSTRUCTIONS</div>
    <div style="font-size:14px;opacity:.6;margin-top:4px">Weekly Payroll — ${range.label}</div>
  </div>
  <div style="background:white;padding:24px;border-radius:0 0 12px 12px;box-shadow:0 2px 12px rgba(0,0,0,.1)">
    ${workerBlocks}
  </div>
  <div style="text-align:center;font-size:12px;color:#bbb;margin-top:16px">
    ANL Constructions · Auto-generated Friday payroll · Confidential
  </div>
</div>
</body></html>`;

    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      ADMIN_EMAIL,
      subject: `ANL Weekly Payroll — ${range.label}`,
      html
    });

    res.json({ ok:true, week:range.label });
  } catch (err) { res.status(500).json({ error:err.message }); }
});

// ─── Serve frontend ───────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
