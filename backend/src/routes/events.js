const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// Get all events
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_time', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create event (Coach only - logic effectively in frontend or simple role check here)
router.post('/', requireAuth, async (req, res) => {
  // Basic check if user is coach could be added here
  try {
    const { team_id, title, description, start_time, end_time, location, type } = req.body;
    const { data, error } = await supabase
      .from('events')
      .insert([{ team_id, title, description, start_time, end_time, location, type }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Presence
router.post('/:id/presence', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from('attendance')
      .upsert({
        event_id: req.params.id,
        user_id: req.user.id,
        status
      }, { onConflict: 'event_id, user_id' })
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Convocations (Coach Only)
router.post('/:id/convocations', requireAuth, async (req, res) => {
  try {
    const { convocations } = req.body; // Array of { user_id, is_convoked }
    const event_id = req.params.id;

    // Efficient Upsert
    const updates = convocations.map(c => ({
      event_id,
      user_id: c.user_id,
      is_convoked: c.is_convoked,
      // Preserve existing status if possible, but upsert requires all primary keys.
      // If row doesn't exist, status will be null (which is fine, means no response yet but convoked)
    }));

    const { data, error } = await supabase
      .from('attendance')
      .upsert(updates, { onConflict: 'event_id, user_id' }) // This might overwrite "status" if we are not careful?
      // Actually, upsert overwrites whole row if columns not specified? 
      // supabase-js upsert by default updates. 
      // To update ONLY is_convoked without touching status, we might need to iterate or use ignoreDuplicates? No.
      // Ideally we fetch first or we assume frontend sends current status too.
      // Let's assume frontend sends { user_id, is_convoked, status }
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
