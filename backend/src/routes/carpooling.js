const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// Get rides for an event
router.get('/:eventId', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('rides')
            .select(`
                *,
                driver:profiles(full_name),
                passengers:ride_passengers(
                    player:players(full_name)
                )
            `)
            .eq('event_id', req.params.eventId);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Offer a ride
router.post('/:eventId/ride', requireAuth, async (req, res) => {
    try {
        const { seats_available, departure_time, departure_location, driver_relation, restrictions } = req.body;
        const { data, error } = await supabase
            .from('rides')
            .insert([{
                event_id: req.params.eventId,
                driver_id: req.user.id,
                seats_available: seats_available || 4,
                departure_time,
                departure_location,
                driver_relation: driver_relation || 'PAPA',
                restrictions: restrictions || 'NONE'
            }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Join a ride
router.post('/ride/:rideId/join', requireAuth, async (req, res) => {
    try {
        const { player_id, seat_count } = req.body;
        const { data, error } = await supabase
            .from('ride_passengers')
            .insert([{
                ride_id: req.params.rideId,
                player_id: player_id,
                seat_count: seat_count || 1
            }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
