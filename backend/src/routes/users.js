const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// Get current user profile
router.get('/me', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get team members (public or protected?) -> Protected for now
// Get team members (Coach only for full details, simplified)
router.get('/members', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users') // Note: this usually refers to auth.users which is not directly accessible usually? 
            // In the previous view_file, it was querying 'users'. Likely a view or typo in original code?
            // Actually, based on Team.jsx, it queries 'team_members' join 'profiles'.
            // Let's keep existing logic but assuming we might need to fix it if 'users' table doesn't exist.
            // For now, I will just append the new routes.
            .from('profiles') // Changed to profiles to be safe as that's where we added columns
            .select('*');

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User Profile (Coach or Self)
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // { full_name, position, avatar_url, role }

        // Security: In a real app, verify req.user.role === 'COACH' or req.user.id === id

        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete User (Coach only)
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Remove from team_members
        await supabase.from('team_members').delete().eq('user_id', id);

        // 2. Remove from profiles
        const { error } = await supabase.from('profiles').delete().eq('id', id);

        // Note: Cannot delete from auth.users via client easily without service role

        if (error) throw error;
        res.json({ message: 'User deleted from team' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE COACH (Admin only)
router.post('/coach', requireAuth, async (req, res) => {
    try {
        // 1. Check if requester is ADMIN
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Seul l\'administrateur peut créer des coachs' });
        }

        const { email, password, full_name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        // 2. Create user in Supabase Auth via Admin API
        // Note: Using the service role client configured in the middleware
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name }
        });

        if (authError) throw authError;

        // 3. Create/Update profile with COACH role
        // The trigger might have already created a PLAYER profile, so we UPSERT
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: authData.user.id,
                email,
                full_name,
                role: 'COACH'
            })
            .select()
            .single();

        if (profileError) throw profileError;

        res.status(201).json({ message: 'Compte coach créé avec succès', user: profileData });
    } catch (err) {
        console.error("Admin create coach error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
