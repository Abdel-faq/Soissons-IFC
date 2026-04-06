const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// Get feed for current team context
router.get('/:teamId', requireAuth, async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const userId = req.user.id;

        // Fetch posts that are not expired
        // RLS will handle most of the filtering (PUBLIC vs PRIVATE + recipient check)
        // But we add an extra safety filter for expiration
        const { data, error } = await supabase
            .from('team_posts')
            .select(`
                *,
                author:author_id(full_name, role)
            `)
            .eq('team_id', teamId)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new post (Coach/Admin only)
router.post('/', requireAuth, async (req, res) => {
    try {
        const { team_id, content, images, visibility_type, recipient_ids } = req.body;

        // 1. Create Post
        const { data: post, error: postError } = await supabase
            .from('team_posts')
            .insert([{
                team_id,
                author_id: req.user.id,
                content,
                images: images || [],
                visibility_type: visibility_type || 'PUBLIC'
            }])
            .select()
            .single();

        if (postError) throw postError;

        // 2. If PRIVATE and recipients specified, insert mappings
        if (visibility_type === 'PRIVATE' && recipient_ids && recipient_ids.length > 0) {
            const recipientInserts = recipient_ids.map(pid => ({
                post_id: post.id,
                player_id: pid
            }));
            const { error: recError } = await supabase
                .from('team_post_recipients')
                .insert(recipientInserts);

            if (recError) throw recError;
        }

        res.status(201).json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a post
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { error } = await supabase
            .from('team_posts')
            .delete()
            .eq('id', req.params.id)
            .eq('author_id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
