const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// Get all groups for a team
router.get('/:teamId', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('custom_groups')
            .select(`
                *,
                members:group_members(
                    user:profiles(id, full_name, avatar_url, position)
                )
            `)
            .eq('team_id', req.params.teamId);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a group
router.post('/', requireAuth, async (req, res) => {
    try {
        const { team_id, name, user_ids } = req.body;

        const { data: group, error: groupError } = await supabase
            .from('custom_groups')
            .insert([{ team_id, name }])
            .select()
            .single();

        if (groupError) throw groupError;

        if (user_ids && user_ids.length > 0) {
            const members = user_ids.map(uid => ({
                group_id: group.id,
                user_id: uid
            }));
            await supabase.from('group_members').insert(members);
        }

        res.status(201).json(group);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add member to group
router.post('/:groupId/members', requireAuth, async (req, res) => {
    try {
        const { user_id } = req.body;
        const { data, error } = await supabase
            .from('group_members')
            .insert([{ group_id: req.params.groupId, user_id }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove member from group
router.delete('/:groupId/members/:userId', requireAuth, async (req, res) => {
    try {
        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', req.params.groupId)
            .eq('user_id', req.params.userId);

        if (error) throw error;
        res.json({ message: 'Member removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
