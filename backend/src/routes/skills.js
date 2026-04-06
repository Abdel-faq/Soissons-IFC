const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// GET /api/skills/:category
// Fetch the complete referential of skills for a given category (e.g. 'U10-U11')
router.get('/:category', requireAuth, async (req, res) => {
    try {
        const { category } = req.params;

        // 1. Get the category ID
        const { data: catData, error: catError } = await supabase
            .from('skill_categories')
            .select('id')
            .eq('name', category)
            .single();

        if (catError) {
             if (catError.code === 'PGRST116') return res.status(404).json({ error: 'Category not found' });
             throw catError;
        }

        // 2. Fetch domains, skills and levels
        const { data: skillsData, error: skillsError } = await supabase
            .from('skills')
            .select(`
                id, name, sub_domain,
                skill_domains (id, name),
                skill_levels (id, level, description)
            `)
            .eq('category_id', catData.id);

        if (skillsError) throw skillsError;

        res.json(skillsData);
    } catch (err) {
        console.error("Error fetching skills referential:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/skills/next-level/:currentCategory/:skillName
// Fetch the details of a specific skill in the NEXT logical category
router.get('/next-level/:targetCategory/:skillName', requireAuth, async (req, res) => {
    try {
        const { targetCategory, skillName } = req.params;

        // 1. Get the target category ID (e.g., 'U7')
        const { data: catData, error: catError } = await supabase
            .from('skill_categories')
            .select('id')
            .eq('name', targetCategory)
            .single();

        if (catError) {
             if (catError.code === 'PGRST116') return res.status(404).json({ error: 'Target category not found' });
             throw catError;
        }

        // 2. Fetch the specific skill by name in that target category
        // We use ilike to be safe with casing 
        const { data: skillData, error: skillError } = await supabase
            .from('skills')
            .select(`
                id, name, sub_domain,
                skill_domains (id, name),
                skill_levels (id, level, description)
            `)
            .eq('category_id', catData.id)
            .ilike('name', skillName)
            .single();

        if (skillError) {
            if (skillError.code === 'PGRST116') return res.status(404).json({ error: 'Skill not found in target category' });
            throw skillError;
        }

        res.json(skillData);
    } catch (err) {
        console.error("Error fetching next level skill:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/skills/player/:playerId
// Fetch all evaluated skills for a specific player
router.get('/player/:playerId', requireAuth, async (req, res) => {
    try {
        const { playerId } = req.params;
        
        // Security checks are mostly handled by RLS in Supabase
        const { data, error } = await supabase
            .from('player_skills')
            .select('*')
            .eq('player_id', playerId);

        if (error) throw error;
        
        res.json(data);
    } catch (err) {
        console.error("Error fetching player skills:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/skills/player/:playerId
// Upsert an evaluated skill for a player (Coach only conceptually, but RLS protects it)
router.post('/player/:playerId', requireAuth, async (req, res) => {
    try {
        const { playerId } = req.params;
        const { skill_id, level, status } = req.body; // status: 'red', 'orange', 'green'
        
        if (!skill_id || !level || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await supabase
            .from('player_skills')
            .upsert({
                player_id: playerId,
                skill_id: skill_id,
                level: level,
                status: status,
                validated_by: req.user.id,
                updated_at: new Date()
            }, {
                onConflict: 'player_id, skill_id, level'
            })
            .select()
            .single();

        if (error) throw error;
        
        res.json(data);
    } catch (err) {
        console.error("Error updating player skill:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/skills/categories/all
// Utility to get all available categories
router.get('/categories/all', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('skill_categories')
            .select('id, name');

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error("Error fetching categories:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
