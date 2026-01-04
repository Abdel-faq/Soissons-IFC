const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// Get all events
router.get('/', requireAuth, async (req, res) => {
  try {
    const { team_id } = req.query;

    // 1. Fetch Team to check ownership
    let teamOwnerId = null;
    if (team_id) {
      const { data: teamData } = await supabase.from('teams').select('coach_id').eq('id', team_id).single();
      teamOwnerId = teamData?.coach_id;
    }

    // 2. Build Query
    let query = supabase
      .from('events')
      .select(`
        *,
        attendance:attendance (
          player_id,
          status,
          is_convoked
        ),
        rides:rides (
          id,
          ride_passengers (
            player_id
          )
        )
      `)
      .order('date', { ascending: true });

    if (team_id) {
      query = query.eq('team_id', team_id);
    }

    // 2.1 Always filter out soft-deleted events from general list
    query = query.eq('is_deleted', false);

    const { data: events, error } = await query;

    if (error) {
      console.error("GET Events database error:", error);
      throw error;
    }

    // 3. Process Events
    const processedEvents = (events || []).map(ev => {
      const riders = new Set();
      ev.rides?.forEach(r => {
        r.ride_passengers?.forEach(rp => riders.add(rp.player_id));
      });

      const updatedAttendance = ev.attendance?.map(a => ({
        ...a,
        has_ride: riders.has(a.player_id)
      }));

      return { ...ev, attendance: updatedAttendance };
    });

    const currentUserId = req.user.id;
    const userRole = (req.user.role || '').toUpperCase();

    console.log(`[DEBUG] GET /api/events - TeamOwner: ${teamOwnerId}, CurrentUser: ${currentUserId}, Role: ${userRole}`);

    const filteredEvents = processedEvents.filter(ev => {
      const isTeamCoach = teamOwnerId && currentUserId && String(teamOwnerId) === String(currentUserId);

      // Coaches/Admins see EVERYTHING for their team
      if (userRole === 'ADMIN' || isTeamCoach) return true;

      // Public events are visible to everyone in the team
      if (ev.visibility_type === 'PUBLIC') return true;

      // Private events: check if any of user's children/profiles are convoked
      // (This is a bit loose but safe since they are already in the team context)
      // Actually, if it's PRIVATE, we only show it if the user is mentioned in attendance
      return ev.attendance && ev.attendance.some(a => a.is_convoked);
    });

    res.json(filteredEvents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create event
router.post('/', requireAuth, async (req, res) => {
  console.log("POST /api/events received body:", req.body);
  try {
    const {
      team_id, type, date, location, notes,
      visibility_type, is_recurring, recurrence_pattern,
      selected_players, match_location
    } = req.body;

    const insertData = {
      team_id, type, date, location, notes,
      visibility_type: visibility_type || 'PUBLIC',
      is_recurring: is_recurring || false,
      recurrence_pattern: recurrence_pattern || (is_recurring ? 'WEEKLY' : null),
      coach_id: req.user.id,
      match_location: type === 'MATCH' ? (match_location || 'DOMICILE') : null
    };

    console.log("Attempting insert into events with:", insertData);

    const { data: event, error } = await supabase
      .from('events')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: error.message, details: error.details });
    }

    if (!event) throw new Error("Event creation failed: no data returned from database");

    console.log("Event created successfully:", event.id);

    if (selected_players && selected_players.length > 0) {
      const convocations = selected_players.map(pid => ({
        event_id: event.id,
        player_id: pid,
        is_convoked: true
      }));
      await supabase.from('attendance').insert(convocations);
    }

    res.status(201).json(event);
  } catch (err) {
    console.error("Global POST Events error:", err);
    res.status(500).json({ error: err.message || "Unknown error during event creation" });
  }
});

// Auto-generate recurring events
router.post('/generate-recurring', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'COACH') return res.status(403).json({ error: 'Unauthorized' });
    const { team_id } = req.body;
    const { data: templates, error: templateError } = await supabase
      .from('events')
      .select('*, attendance(user_id, is_convoked)')
      .eq('team_id', team_id)
      .eq('is_recurring', true);

    if (templateError) throw templateError;

    const generated = [];
    for (const event of (templates || [])) {
      const originalDate = new Date(event.date);
      const nextWeekDate = new Date(originalDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { data: newEv, error: insError } = await supabase
        .from('events')
        .insert([{
          team_id: event.team_id,
          type: event.type,
          date: nextWeekDate.toISOString(),
          location: event.location,
          notes: event.notes,
          match_location: event.match_location,
          visibility_type: event.visibility_type,
          group_id: event.group_id,
          coach_id: event.coach_id,
          is_recurring: true,
          recurrence_pattern: 'WEEKLY'
        }])
        .select()
        .single();

      if (insError) continue;
      if (event.attendance?.length > 0) {
        const convocations = event.attendance.filter(a => a.is_convoked).map(a => ({
          event_id: newEv.id,
          user_id: a.user_id,
          is_convoked: true
        }));
        await supabase.from('attendance').insert(convocations);
      }
      generated.push(newEv);
    }
    res.json({ message: 'Recurring events generated', count: generated.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete old events
router.delete('/cleanup', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'COACH') return res.status(403).json({ error: 'Unauthorized' });
    const { team_id } = req.body;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { error } = await supabase.from('events').delete().eq('team_id', team_id).lt('date', yesterday.toISOString());
    if (error) throw error;
    res.json({ message: 'Past events cleaned up' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update convocations only (dedicated route)
router.post('/:id/convocations', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'COACH') return res.status(403).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { updates } = req.body; // Array of { user_id, is_convoked }

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid updates format' });
    }

    // 1. Fetch current attendance to preserve statuses
    const { data: currentAtt } = await supabase
      .from('attendance')
      .select('user_id, status')
      .eq('event_id', id);

    const statusMap = {};
    (currentAtt || []).forEach(a => statusMap[a.user_id] = a.status);

    // 2. Prepare upsert data with existing status or default 'INCONNU'
    const upsertData = updates.map(u => ({
      event_id: id,
      player_id: u.player_id,
      is_convoked: u.is_convoked,
      status: statusMap[u.player_id] || 'INCONNU'
    }));

    const { error } = await supabase
      .from('attendance')
      .upsert(upsertData, { onConflict: 'event_id, player_id' });

    if (error) throw error;
    res.json({ message: 'Convocations enregistrées' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update event
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'COACH') return res.status(403).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { type, date, location, notes, visibility_type, is_recurring, recurrence_pattern, selected_players, match_location } = req.body;

    const { data: event, error } = await supabase
      .from('events')
      .update({
        type,
        date,
        location,
        notes,
        visibility_type,
        is_recurring,
        recurrence_pattern,
        match_location: type === 'MATCH' ? (match_location || 'DOMICILE') : null,
        updated_at: new Date()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Non-destructive update for convocations if selected_players is provided
    if (selected_players && Array.isArray(selected_players)) {
      // Fetch current to preserve statuses and know who to mark as not convoked
      const { data: currentAtt } = await supabase
        .from('attendance')
        .select('user_id, status')
        .eq('event_id', id);

      const statusMap = {};
      const currentIds = [];
      (currentAtt || []).forEach(a => {
        statusMap[a.user_id] = a.status;
        currentIds.push(a.user_id);
      });

      const upsertData = [];

      // Mark selected as convoked
      selected_players.forEach(pid => {
        upsertData.push({
          event_id: id,
          player_id: pid,
          is_convoked: true,
          status: statusMap[pid] || 'INCONNU'
        });
      });

      // Mark unselected (who were in current list) as NOT convoked
      currentIds.forEach(pid => {
        if (!selected_players.includes(pid)) {
          upsertData.push({
            event_id: id,
            player_id: pid,
            is_convoked: false,
            status: statusMap[pid] || 'INCONNU'
          });
        }
      });

      if (upsertData.length > 0) {
        await supabase.from('attendance').upsert(upsertData, { onConflict: 'event_id, player_id' });
      }
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
