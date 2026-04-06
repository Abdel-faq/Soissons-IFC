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

// Mark messages as read in a room
router.post('/read', requireAuth, async (req, res) => {
    try {
        const { team_id, group_id } = req.body;
        const userId = req.user.id;

        // 1. Get the latest message ID in this room
        const query = supabase
            .from('messages')
            .select('id, created_at')
            .eq('team_id', team_id)
            .order('created_at', { ascending: false })
            .limit(1);

        if (group_id) {
            query.eq('group_id', group_id);
        } else {
            query.is('group_id', null);
        }

        const { data: latestMsg } = await query;
        if (!latestMsg || latestMsg.length === 0) return res.json({ success: true, message: 'No messages to read' });

        const messageId = latestMsg[0].id;

        // 2. Update chat_read_status
        // Use a find-then-upsert pattern for better compatibility with partial indexes
        const statusQuery = supabase
            .from('chat_read_status')
            .select('id')
            .eq('user_id', userId)
            .eq('team_id', team_id);

        if (group_id) {
            statusQuery.eq('group_id', group_id);
        } else {
            statusQuery.is('group_id', null);
        }

        const { data: existingStatus } = await statusQuery.maybeSingle();

        const statusUpdate = {
            user_id: userId,
            team_id,
            group_id: group_id || null,
            last_read_message_id: messageId,
            last_read_at: new Date()
        };

        if (existingStatus) {
            await supabase.from('chat_read_status').update(statusUpdate).eq('id', existingStatus.id);
        } else {
            await supabase.from('chat_read_status').insert(statusUpdate);
        }

        // 3. Mark specific message as read
        await supabase.from('message_reads').upsert({
            message_id: messageId,
            user_id: userId,
            read_at: new Date()
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get unread counts for a team
router.get('/unread-count/:teamId', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const teamId = req.params.teamId;

        // Fetch last read statuses for this team
        const { data: readStatuses } = await supabase
            .from('chat_read_status')
            .select('*')
            .eq('user_id', userId)
            .eq('team_id', teamId);

        // General Chat
        const generalStatus = readStatuses?.find(s => !s.group_id);
        const generalQuery = supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('team_id', teamId)
            .is('group_id', null)
            .neq('sender_id', userId); // Don't count own messages as unread

        if (generalStatus?.last_read_at) {
            generalQuery.gt('created_at', generalStatus.last_read_at);
        }

        const { count: generalUnread } = await generalQuery;

        res.json({
            total: generalUnread || 0,
            rooms: {
                general: generalUnread || 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

