const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Supabase connection
const SUPABASE_URL = 'https://tzwsdqbrtohcxzvdfwdw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_frfpPpx6hXMGRdsJrDlW_A_9WTKqN1l';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// API: Login
app.post('/api/login', async (req, res) => {
  try {
    const { name, pin } = req.body;
    
    if (!name || !pin) {
      return res.status(400).json({ error: 'Missing name or pin' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('name', name)
      .eq('pin', pin)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get workers
app.get('/api/workers', async (req, res) => {
  try {
    const { data: workers, error } = await supabase
      .from('users')
      .select('id, name, rate, pin')
      .order('name');

    if (error) throw error;
    res.json(workers || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Save time entry
app.post('/api/entry', async (req, res) => {
  try {
    const { user_id, day, start_time, end_time, lunch_mins, job, materials } = req.body;

    if (!user_id || !day) {
      return res.status(400).json({ error: 'Missing user_id or day' });
    }

    // Check if entry exists
    const { data: existing } = await supabase
      .from('time_entries')
      .select('id')
      .eq('user_id', user_id)
      .eq('day', day)
      .single();

    let result;

    if (existing) {
      // Update
      const { data, error } = await supabase
        .from('time_entries')
        .update({
          start_time: start_time || undefined,
          end_time: end_time || undefined,
          lunch_mins: lunch_mins !== undefined ? lunch_mins : undefined,
          job: job || undefined,
          materials: materials || undefined
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          user_id,
          day,
          start_time: start_time || null,
          end_time: end_time || null,
          lunch_mins: lunch_mins || 0,
          job: job || null,
          materials: materials || null
        }])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get entries for a date range (from=YYYY-MM-DD&to=YYYY-MM-DD)
app.get('/api/entries/:user_id', async (req, res) => {
  try {
    let from = req.query.from;
    let to   = req.query.to;

    // If no range provided, default to current week
    if (!from || !to) {
      const now = new Date();
      const dow = now.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      from = monday.toISOString().split('T')[0];
      to   = friday.toISOString().split('T')[0];
    }

    // Query by the `day` field (YYYY-MM-DD string) — works for any week
    const { data: entries, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', req.params.user_id)
      .gte('day', from)
      .lte('day', to)
      .order('day');

    if (error) throw error;
    res.json(entries || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Payslip for current week
app.get('/api/payslip/:user_id', async (req, res) => {
  try {
    const TAX_RATE   = 0.20;
    const SUPER_RATE = 0.115;
    const WORKERS = {
      'ba97c403-596f-483b-8dd5-3c11131db62a': { name: 'Adam',  rate: 81.49 },
      '7b309a07-cfea-4e78-8109-e7b7d40f4cf4': { name: 'James', rate: 48.65 },
      'be3737d8-0235-4fb8-85a6-6150659a278f': { name: 'Brady', rate: 29.95 },
      '3397c62c-b85e-4cda-ac24-fd138b1eb74a': { name: 'Drew',  rate: 81.49 }
    };

    const worker = WORKERS[req.params.user_id];
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0) ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    const { data: entries, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', req.params.user_id)
      .gte('start_time', monday.toISOString())
      .lte('start_time', friday.toISOString());

    if (error) throw error;

    let totalHours = 0;
    (entries || []).forEach(e => {
      if (e.start_time && e.end_time) {
        const start = new Date(e.start_time);
        const end   = new Date(e.end_time);
        const mins  = (end - start) / 60000 - (e.lunch_mins || 0);
        totalHours += Math.max(0, mins / 60);
      }
    });

    const gross = totalHours * worker.rate;
    const tax   = gross * TAX_RATE;
    const super_ = gross * SUPER_RATE;
    const net   = gross - tax;

    res.json({
      worker: worker.name,
      rate: worker.rate,
      total_hours: Math.round(totalHours * 100) / 100,
      gross_pay: Math.round(gross * 100) / 100,
      tax_withholding: Math.round(tax * 100) / 100,
      super_contribution: Math.round(super_ * 100) / 100,
      net_pay: Math.round(net * 100) / 100,
      week_start: monday.toISOString().split('T')[0],
      week_end: friday.toISOString().split('T')[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
