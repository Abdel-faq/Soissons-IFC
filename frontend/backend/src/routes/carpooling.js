const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// Get rides for an event
router.get('/:eventId', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('carpooling_rides')
            .select(`
                *,
                driver:users(full_name),
                passengers:carpooling_passengers(
                    user:users(full_name)
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
        const { seats_available, departure_time, departure_location } = req.body;
        const { data, error } = await supabase
            .from('carpooling_rides')
            .insert([{
                event_id: req.params.eventId,
                driver_id: req.user.id,
                seats_available,
                departure_time,
                departure_location
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
        const { data, error } = await supabase
            .from('carpooling_passengers')
            .insert([{
                ride_id: req.params.rideId,
                user_id: req.user.id
            }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
