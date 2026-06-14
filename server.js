// v4 - Fix time saving: use service role key, fix upsert logic
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
// Use service role key (bypasses RLS — safe for server-side use only)
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_KEY env var is not set! Time saving will NOT work.');
}
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY || 'placeholder');
const resend       = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY not set in environment - emails will not send');
} else {
  console.log('✅ RESEND_API_KEY configured');
}

const ADMIN_EMAIL  = 'adam_thornton@y7mail.com';
const FROM_EMAIL   = 'onboarding@resend.dev'; // Resend test domain (works without verification)

// ─── IMPORTANT: UPDATE THESE PASSWORDS IMMEDIATELY ──────────────────────────────
// These are temporary defaults. Use strong, unique passwords.
const WORKER_CREDS = {
  'adam':  'SecurePass123!',
  'james': 'SecurePass456!',
  'brady': 'SecurePass789!',
  'drew':  'SecurePass012!'
};

const WORKERS = {
  'ba97c403-596f-483b-8dd5-3c11131db62a': { name:'Adam',  rate:81.49  },
  '7b309a07-cfea-4e78-8109-e7b7d40f4cf4': { name:'James', rate:48.65  },
  'be3737d8-0235-4fb8-85a6-6150659a278f': { name:'Brady', rate:29.95  },
  '3397c62c-b85e-4cda-ac24-fd138b1eb74a': { name:'Drew',  rate:81.49  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Times are stored as plain 'HH:MM' strings (e.g. '07:00').
// Legacy entries may still be ISO timestamps — handle both.
function toHHMM(ts) {
  if (!ts) return null;
  if (/^\d{2}:\d{2}$/.test(ts)) return ts;  // already HH:MM
  // Legacy ISO: convert using Perth offset (+8h)
  const d = new Date(ts);
  const perthMs = d.getTime() + 8 * 60 * 60 * 1000;
  const p = new Date(perthMs);
  const h = String(p.getUTCHours()).padStart(2,'0');
  const m = String(p.getUTCMinutes()).padStart(2,'0');
  return h + ':' + m;
}

function fmtTime(ts) {
  const hhmm = toHHMM(ts);
  if (!hhmm) return '--';
  let [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return h + ':' + String(m).padStart(2,'0') + ' ' + ampm;
}

function calcHours(entry) {
  if (!entry || !entry.start_time || !entry.end_time) return 0;
  const s = toHHMM(entry.start_time), e = toHHMM(entry.end_time);
  if (!s || !e) return 0;
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm) - (entry.lunch_mins || 0);
  return Math.max(0, mins / 60);
}

function todayISO() {
  // Perth date (AWST = UTC+8)
  const now = new Date();
  const perthMs = now.getTime() + 8 * 60 * 60 * 1000;
  const p = new Date(perthMs);
  return p.toISOString().split('T')[0];
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
app.get('/api/health', async (req, res) => {
  // Test Supabase connectivity
  let dbOk = false, dbError = null;
  try {
    const { error } = await supabase.from('time_entries').select('id').limit(1);
    if (error) { dbError = error.message; } else { dbOk = true; }
  } catch (e) { dbError = e.message; }
  return res.json({ 
    ok: dbOk, 
    time: new Date().toISOString(),
    supabaseConfigured: !!process.env.SUPABASE_KEY,
    resendConfigured: !!process.env.RESEND_API_KEY,
    dbOk,
    dbError
  });
});

// ─── API: Change password ──────────────────────────────────────────────────────
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Note: In production, implement via Supabase Auth
    res.json({ ok: true, message: 'Password change noted - implement server-side auth' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ─── API: Save entry (GET for test calls) ────────────────────────────────────
app.get('/api/email/daily', async (req, res) => {
  console.log('⏱️  GET /api/email/daily called (testing)');
  // Forward to POST handler
  return new Promise((resolve) => {
    req.method = 'POST';
    const originalSend = res.send;
    res.send = function(data) {
      console.log('📧 Response:', data);
      originalSend.call(res, data);
      resolve();
    };
  });
});

app.get('/api/email/payroll', async (req, res) => {
  console.log('⏱️  GET /api/email/payroll called (testing)');
  return res.json({ ok: true, test: true });
});

// ─── API: Save entry ──────────────────────────────────────────────────────────
app.post('/api/entry', async (req, res) => {
  try {
    const { user_id, day, start_time, end_time, lunch_mins, job, materials } = req.body;
    if (!user_id || !day) return res.status(400).json({ error:'Missing user_id or day' });

    const patch = {};
    if (start_time  !== undefined) patch.start_time  = start_time;
    if (end_time    !== undefined) patch.end_time     = end_time;
    if (lunch_mins  !== undefined) patch.lunch_mins   = lunch_mins;
    if (job         !== undefined) patch.job          = job;
    if (materials   !== undefined) patch.materials    = materials;

    // Use upsert with onConflict to atomically insert-or-update
    // Requires a UNIQUE constraint on (user_id, day) in Supabase
    const { data, error } = await supabase
      .from('time_entries')
      .upsert({ user_id, day, ...patch }, { onConflict: 'user_id,day', ignoreDuplicates: false })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Entry save error:', err.message, err);
    res.status(500).json({ error: err.message });
  }
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

    // Build one card per worker
    const workerCards = rows.map(r => {
      const hasData = r.start !== '--' || r.end !== '--';
      return `
      <div style="margin:0 16px 12px;border:1px solid #e8e8e8;border-radius:10px;overflow:hidden">
        <!-- Worker name bar -->
        <div style="background:#f0f0f0;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:800;font-size:15px;color:#1a1a1a">${r.name}</span>
          <span style="font-size:13px;color:#28a745;font-weight:700">${r.gross}</span>
        </div>
        <!-- Time row -->
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:10px 14px;width:25%;border-right:1px solid #f0f0f0">
              <div style="font-size:10px;color:#999;text-transform:uppercase;margin-bottom:3px">In</div>
              <div style="font-size:14px;font-weight:600;color:#1a1a1a">${r.start}</div>
            </td>
            <td style="padding:10px 14px;width:25%;border-right:1px solid #f0f0f0">
              <div style="font-size:10px;color:#999;text-transform:uppercase;margin-bottom:3px">Out</div>
              <div style="font-size:14px;font-weight:600;color:#1a1a1a">${r.end}</div>
            </td>
            <td style="padding:10px 14px;width:20%;border-right:1px solid #f0f0f0">
              <div style="font-size:10px;color:#999;text-transform:uppercase;margin-bottom:3px">Lunch</div>
              <div style="font-size:14px;font-weight:600;color:#1a1a1a">${r.lunch}</div>
            </td>
            <td style="padding:10px 14px;width:30%">
              <div style="font-size:10px;color:#999;text-transform:uppercase;margin-bottom:3px">Hours</div>
              <div style="font-size:14px;font-weight:600;color:#1a1a1a">${r.hrs}</div>
            </td>
          </tr>
        </table>
        <!-- Job -->
        <div style="padding:8px 14px;border-top:1px solid #f0f0f0;background:#fafafa">
          <span style="font-size:10px;color:#999;text-transform:uppercase">Job: </span>
          <span style="font-size:13px;color:#0066cc">${r.job}</span>
        </div>
        ${r.materials && r.materials !== '--' ? `
        <div style="padding:8px 14px;border-top:1px solid #f0f0f0;background:#fffbf0">
          <span style="font-size:10px;color:#999;text-transform:uppercase">Materials: </span>
          <span style="font-size:13px;color:#555">${r.materials}</span>
        </div>` : ''}
      </div>`;
    }).join('');

    const html = `
<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f0f0f0">
<div style="max-width:480px;margin:0 auto;background:#f0f0f0;padding:16px 0 24px">
  <!-- Header -->
  <div style="background:#1a1a1a;color:white;padding:20px 20px 16px;margin-bottom:16px">
    <div style="font-size:18px;font-weight:800;letter-spacing:1px">ANL CONSTRUCTIONS</div>
    <div style="font-size:12px;opacity:.6;margin-top:3px">Daily Summary — ${label}</div>
  </div>
  <!-- Worker cards -->
  ${workerCards}
  <!-- Footer -->
  <div style="padding:16px;font-size:11px;color:#aaa;text-align:center">
    ANL Constructions · Auto-generated · Confidential
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
// Rebuild trigger Fri Jun 12 13:59:01 UTC 2026
