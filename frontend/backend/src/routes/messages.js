const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// Get messages for a team
router.get('/:teamId', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                sender:profiles(id, full_name, role)
            `)
            .eq('team_id', req.params.teamId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send a message
router.post('/', requireAuth, async (req, res) => {
    try {
        const { team_id, content, file_url, file_type } = req.body;
        const { data, error } = await supabase
            .from('messages')
            .insert([{
                team_id,
                sender_id: req.user.id,
                content,
                file_url,
                file_type
            }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
