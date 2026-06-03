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

// API: Get entries
app.get('/api/entries/:user_id', async (req, res) => {
  try {
    const { data: entries, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', req.params.user_id)
      .order('day');

    if (error) throw error;
    res.json(entries || []);
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
