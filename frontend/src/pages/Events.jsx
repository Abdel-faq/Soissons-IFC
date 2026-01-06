
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, MapPin, Clock, Plus, Trash2, Edit2, Users, X } from 'lucide-react';
import EventCarpooling from '../components/EventCarpooling';

export default function Events() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [userName, setUserName] = useState('');
    const [team, setTeam] = useState(null);
    const [isCoach, setIsCoach] = useState(false);
    const [children, setChildren] = useState([]);
    const [activePlayer, setActivePlayer] = useState(null); // { id, name }
    const [myAttendance, setMyAttendance] = useState({}); // player_id -> { event_id -> status }

    // New Event Form
    const [showForm, setShowForm] = useState(false);
    const [newEvent, setNewEvent] = useState({
        type: 'MATCH',
        date: '',
        time: '',
        location: '',
        notes: '',
        visibility_type: 'PUBLIC',
        is_recurring: false,
        selected_players: [], // Array of IDs
        match_location: 'DOMICILE'
    });

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) {
                const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
                if (prof?.full_name) setUserName(prof.full_name);
            }

            if (!user) return;

            // Fetch All Children for this parent
            const { data: allChildren } = await supabase.from('players').select('*').eq('parent_id', user.id);

            // Read Context
            const savedCtx = localStorage.getItem('sb-active-context');
            let context = null;
            if (savedCtx) {
                try {
                    context = JSON.parse(savedCtx);
                } catch (e) { console.error("Stale context", e); }
            }

            if (!context) {
                setChildren(allChildren || []);
                setLoading(false);
                return;
            }

            setTeam(context.teamId);
            setIsCoach(context.role === 'COACH');
            if (context.playerId) {
                const childObj = (allChildren || []).find(c => c.id === context.playerId);
                setActivePlayer({
                    id: context.playerId,
                    name: childObj?.full_name || childObj?.first_name || context.playerName
                });
            } else {
                setActivePlayer(null);
            }

            // Filter children to only those in the current team
            let filteredChildren = allChildren || [];
            if (context.teamId) {
                const { data: teamMemberships } = await supabase
                    .from('team_members')
                    .select('player_id')
                    .eq('team_id', context.teamId);

                const teamPlayerIds = (teamMemberships || []).map(m => m.player_id).filter(Boolean);
                filteredChildren = (allChildren || []).filter(c => teamPlayerIds.includes(c.id));
                setChildren(filteredChildren);
            } else {
                setChildren(allChildren || []);
            }

            if (context.teamId) {
                const apiUrl = `${import.meta.env.VITE_API_URL || '/api'}/events?team_id=${context.teamId}`;
                const { data: sessionData } = await supabase.auth.getSession();
                const session = sessionData?.session;

                const response = await fetch(apiUrl, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });

                if (response.ok) {
                    const eventsData = await response.json();
                    console.log("DEBUG: Events API response:", eventsData);
                    const activeEvents = (eventsData || []).filter(e => !e.is_deleted);
                    console.log("DEBUG: Active events after is_deleted filter:", activeEvents.length);
                    setEvents(activeEvents);

                    // Fetch Attendance for context child (or all children if coach/missing)
                    const relevantPlayerIds = (context.playerId && context.role !== 'COACH')
                        ? [context.playerId]
                        : filteredChildren.map(c => c.id);

                    // If Coach, we also want to fetch THEIR OWN attendance (user_id based)
                    let attData = [];

                    // 1. Fetch Players Attendance
                    if (relevantPlayerIds.length > 0) {
                        const { data } = await supabase
                            .from('attendance')
                            .select('event_id, player_id, status, is_locked')
                            .in('player_id', relevantPlayerIds)
                            .in('event_id', activeEvents.map(e => e.id));
                        if (data) attData = [...attData, ...data];
                    }

                    // 2. Fetch Coach Attendance (if Coach)
                    if (context.role === 'COACH') {
                        const { data } = await supabase
                            .from('attendance')
                            .select('event_id, user_id, status, is_locked')
                            .eq('user_id', user.id)
                            .in('event_id', activeEvents.map(e => e.id));

                        // Map user_id to a 'coach_self' key or use user.id directly
                        if (data) attData = [...attData, ...data];
                    }

                    const attMap = {};
                    attData?.forEach(a => {
                        // Key by player_id OR user_id (if coach)
                        const key = a.player_id || a.user_id;
                        if (!attMap[key]) attMap[key] = {};
                        attMap[key][a.event_id] = { status: a.status, is_locked: a.is_locked };
                    });
                    setMyAttendance(attMap);
                }
            }
        } catch (error) {
            console.error("Error fetching events:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateAttendance = async (eventId, entityId, status, isCoachSelf = false) => {
        // Optimistic UI Update
        setMyAttendance(prev => ({
            ...prev,
            [entityId]: {
                ...(prev[entityId] || {}),
                [eventId]: { ...(prev[entityId]?.[eventId] || {}), status }
            }
        }));

        try {
            if (isCoachSelf) {
                // Coach Update (User ID based) - Manual Upsert Logic due to missing constraint
                const { data: existing } = await supabase
                    .from('attendance')
                    .select('event_id')
                    .eq('event_id', eventId)
                    .eq('user_id', entityId)
                    .maybeSingle();

                if (existing) {
                    const { error } = await supabase.from('attendance').update({
                        status: status,
                        updated_at: new Date()
                    }).eq('event_id', eventId).eq('user_id', entityId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('attendance').insert({
                        event_id: eventId,
                        user_id: entityId,
                        player_id: null,
                        status: status,
                        is_locked: false
                    });
                    if (error) throw error;
                }

                if (['ABSENT', 'MALADE', 'BLESSE'].includes(status)) {
                    await supabase.from('rides').delete().eq('event_id', eventId).eq('driver_id', entityId);
                }
            } else {
                // Player Update (Player ID based)
                const { error } = await supabase.from('attendance').upsert({
                    event_id: eventId,
                    player_id: entityId,
                    status: status,
                    updated_at: new Date(),
                    is_locked: false
                }, { onConflict: 'event_id, player_id' });
                if (error) throw error;

                if (['ABSENT', 'MALADE', 'BLESSE'].includes(status)) {
                    const otherChildren = children.filter(c => c.id !== entityId);
                    const anyOtherPresent = otherChildren.some(c => {
                        const s = myAttendance[c.id]?.[eventId]?.status;
                        return s === 'PRESENT' || s === 'RETARD';
                    });
                    if (!anyOtherPresent) {
                        await supabase.from('rides').delete().eq('event_id', eventId).eq('driver_id', user.id);
                    }
                }
            }
        } catch (err) {
            fetchEvents();
            alert("Erreur : " + err.message);
        }
    };

    const createEvent = async (e) => {
        e.preventDefault();
        try {
            const fullDate = new Date(`${newEvent.date}T${newEvent.time}`);
            const isEdit = !!newEvent.id;
            const url = isEdit
                ? `${import.meta.env.VITE_API_URL || '/api'}/events/${newEvent.id}`
                : `${import.meta.env.VITE_API_URL || '/api'}/events`;

            if (!team) {
                throw new Error("ID de l'équipe manquant. Assurez-vous d'être bien propriétaire d'une équipe.");
            }
            console.log("Calling API URL:", url);

            console.log("Payload sent to API:", {
                team_id: team,
                type: newEvent.type,
                date: fullDate.toISOString(),
                visibility_type: newEvent.visibility_type
            });

            const { data: sessionData } = await supabase.auth.getSession();
            const session = sessionData?.session;

            if (!session) {
                throw new Error("Session expirée. Veuillez vous reconnecter.");
            }

            const response = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    team_id: team,
                    type: newEvent.type,
                    date: fullDate.toISOString(),
                    location: newEvent.location,
                    notes: newEvent.notes,
                    visibility_type: newEvent.visibility_type,
                    is_recurring: newEvent.is_recurring,
                    selected_players: newEvent.selected_players,
                    match_location: newEvent.type === 'MATCH' ? newEvent.match_location : null
                })
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("text/html")) {
                    throw new Error("Le serveur a renvoyé une erreur réseau (Vercel 404/500). Vérifiez que les routes API sont bien déployées.");
                }

                let errorMsg = "Erreur inconnue";
                const responseClone = response.clone();
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorData.message || JSON.stringify(errorData);
                } catch (e) {
                    errorMsg = await responseClone.text() || response.statusText;
                }
                throw new Error(errorMsg);
            }

            setShowForm(false);
            setNewEvent({ type: 'MATCH', date: '', time: '', location: '', notes: '', visibility_type: 'PUBLIC', is_recurring: false, selected_players: [], match_location: 'DOMICILE' });
            fetchEvents();
        } catch (err) {
            console.error("Debug Event error:", err);
            alert("Problème lors de l'enregistrement : " + err.message);
        }
    };

    const togglePlayerSelection = (uid) => {
        setNewEvent(prev => ({
            ...prev,
            selected_players: prev.selected_players.includes(uid)
                ? prev.selected_players.filter(id => id !== uid)
                : [...prev.selected_players, uid]
        }));
    };

    const selectAllPlayers = () => {
        setNewEvent(prev => ({
            ...prev,
            selected_players: members.map(m => m.id)
        }));
    };

    const deleteEvent = async (id) => {
        if (!confirm('Voulez-vous supprimer cet événement ? (L\'historique sera conservé)')) return;
        // Soft Deletion: update is_deleted = true
        const { error } = await supabase.from('events').update({ is_deleted: true }).eq('id', id);
        if (!error) fetchEvents();
    };





    // --- COnvocations (Coach) ---
    const [memberAvailability, setMemberAvailability] = useState({}); // event_id -> { user_id -> status }
    const [convocations, setConvocations] = useState({}); // event_id -> { user_id -> boolean }
    const [members, setMembers] = useState([]); // All team members

    useEffect(() => {
        if (team) {
            fetchMembers();
        }
    }, [team]);

    // Fetch Base Members
    const fetchMembers = async () => {
        const { data, error } = await supabase
            .from('team_members')
            .select('player_id, players(id, full_name, first_name, position, avatar_url, parent_id)')
            .eq('team_id', team);

        if (data) setMembers(data.map(d => d.players).filter(Boolean));
    };

    // Fetch Availability for specific Event (Lazy load when opening accordion?)
    // Or simpler: fetch all attendance for displayed events.
    // Let's do it in fetchEvents to keep it synced.
    // MODIFIED fetchEvents above to populate a broad attendance map?
    // Actually, fetchEvents only gets MY attendance.
    // Let's add a specialized fetch for Coach View.

    useEffect(() => {
        if (isCoach && team && events.length > 0) {
            fetchTeamAttendance();
        }
    }, [isCoach, team, events]);

    const fetchTeamAttendance = async () => {
        const eventIds = events.map(e => e.id);
        if (eventIds.length === 0) return;

        // Fetch user_id AND player_id to handle both types of members
        const { data: attendanceData, error: attError } = await supabase
            .from('attendance')
            .select('event_id, user_id, player_id, status, is_convoked')
            .in('event_id', eventIds);

        if (attError) {
            console.error(attError);
            return;
        }

        // --- FETCH RIDE DATA ---
        // 1. Get rides for these events
        const { data: eventRides } = await supabase
            .from('rides')
            .select('id, event_id')
            .in('event_id', eventIds);

        const rideIds = eventRides?.map(r => r.id) || [];

        // 2. Get passengers for these rides
        let playersWithRides = new Set();
        if (rideIds.length > 0) {
            const { data: passengers } = await supabase
                .from('ride_passengers')
                .select('player_id')
                .in('ride_id', rideIds);

            passengers?.forEach(p => playersWithRides.add(p.player_id));
        }
        // -----------------------

        const availabilityMap = {}; // event_id -> { member_id -> status }
        const convocationsMap = {}; // event_id -> { member_id -> boolean }

        // Start with empty maps for all events
        events.forEach(ev => {
            availabilityMap[ev.id] = {};
            convocationsMap[ev.id] = {};
        });

        // Loop attendance to build basic maps
        attendanceData?.forEach(row => {
            const entityId = row.player_id || row.user_id;
            if (!entityId) return;

            if (!availabilityMap[row.event_id]) availabilityMap[row.event_id] = {};
            availabilityMap[row.event_id][entityId] = row.status;

            if (!convocationsMap[row.event_id]) convocationsMap[row.event_id] = {};
            if (row.is_convoked) convocationsMap[row.event_id][entityId] = true;
        });

        setMemberAvailability(availabilityMap);
        setConvocations(convocationsMap);

        // Update the main events state to include the 'attendance' enriched with 'has_ride'
        // We need to mutate the events state so the UI (Cards) can see who has a ride.
        // The UI uses `ev.attendance` array.
        setEvents(prev => prev.map(ev => {
            // Get attendance records for this event (from the recently fetched data OR existing state?)
            // existing `ev.attendance` might be stale or incomplete if we only use `attData`.
            // But `attData` is the source of truth for status.
            // Let's rely on `attData` to REBUILD `ev.attendance` or just update the flag.

            // Simplest: Just inject has_ride into the existing attendance list if it matches
            const updatedAttendance = ev.attendance?.map(att => ({
                ...att,
                has_ride: playersWithRides.has(att.player_id)
            }));

            return {
                ...ev,
                attendance: updatedAttendance
            };
        }));
    };

    // Fetch Convocations status for events
    // Ideally this should be part of event fetch or separate. 
    // Simplified: We will fetch "presences" for the event when expanded or always.
    // Let's rely on individual component or simple fetch for now.
    // Actually, let's keep it simple: Show "Convoked" badge if myAttendance says so.

    // Update: fetchEvents already gets events. We need presence info for ME.
    // For Coach, we need presence info for ALL.

    // Let's modify fetchEvents to get my convocation status too.
    // myAttendance is currently just status string. Let's make it object? { status, is_convoked }
    // Or just separate state.

    const handleConvocationToggle = (eventId, userId) => {
        setConvocations(prev => {
            const eventConvs = prev[eventId] || {};
            return {
                ...prev,
                [eventId]: {
                    ...eventConvs,
                    [userId]: !eventConvs[userId]
                }
            };
        });
    };

    const saveConvocations = async (eventId) => {
        const eventConvs = { ...(convocations[eventId] || {}) };

        // Prepare updates for the API
        const updates = members.map(m => ({
            player_id: m.id, // Use player_id (m.id is player id from fetchMembers)
            is_convoked: !!eventConvs[m.id],
            is_locked: true
        }));

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            // ... (keep middle lines same, just skip them in replacement if possible, but safer to replace block)
            const session = sessionData?.session;

            if (!session) {
                throw new Error("Session expirée. Veuillez vous reconnecter.");
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/events/${eventId}/convocations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ updates })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Erreur lors de la sauvegarde");
            }

            alert("Convocations enregistrées !");
            fetchEvents();
        } catch (e) {
            console.error(e);
            alert("Erreur: " + e.message);
        }
    };

    if (loading) return <div className="p-4 text-center">Chargement...</div>;

    if (!team) return (
        <div className="p-10 text-center text-gray-500">
            <p className="mb-4">Vous devez rejoindre ou créer une équipe.</p>
            <a href="/" className="text-indigo-600 hover:underline">Retourner à l'accueil</a>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-indigo-900"><Calendar className="text-indigo-600" /> Vos Événements</h1>
                    <p className="text-xs text-gray-500 font-medium">Gérez vos matches et entraînements</p>
                </div>
                {isCoach && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition-all shadow-md active:scale-95"
                    >
                        <Plus size={18} /> <span className="hidden sm:inline">Créer</span>
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-indigo-100 animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-6 border-b pb-2">
                        <h2 className="font-bold text-xl text-gray-800 tracking-tight">
                            {newEvent.id ? '✏️ Modifier l\'événement' : '📂 Nouvel Événement'}
                        </h2>
                        <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                    </div>
                    <form onSubmit={createEvent} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type d'événement</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['MATCH', 'TRAINING'].map(t => (
                                            <button
                                                key={t} type="button"
                                                onClick={() => setNewEvent({ ...newEvent, type: t, visibility_type: t === 'MATCH' ? 'PRIVATE' : 'PUBLIC' })}
                                                className={`py-2 rounded-lg border-2 font-bold text-sm transition-all ${newEvent.type === t ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-100 bg-white text-gray-400'
                                                    }`}
                                            >
                                                {t === 'MATCH' ? '🏈 Match' : '🏃 Entraînement'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {newEvent.type === 'MATCH' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lieu du match</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'DOMICILE', label: '🏠 Domicile' },
                                                { id: 'EXTERIEUR', label: '🚌 Extérieur' }
                                            ].map(loc => (
                                                <button
                                                    key={loc.id} type="button"
                                                    onClick={() => setNewEvent({ ...newEvent, match_location: loc.id })}
                                                    className={`py-2 rounded-lg border-2 font-bold text-sm transition-all ${newEvent.match_location === loc.id ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-100 bg-white text-gray-400'
                                                        }`}
                                                >
                                                    {loc.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                        <input
                                            type="date" required
                                            className="w-full border-2 border-gray-100 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none bg-gray-50 font-medium"
                                            value={newEvent.date}
                                            onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Heure</label>
                                        <input
                                            type="time" required
                                            className="w-full border-2 border-gray-100 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none bg-gray-50 font-medium"
                                            value={newEvent.time}
                                            onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lieu</label>
                                    <input
                                        type="text" required
                                        className="w-full border-2 border-gray-100 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none bg-gray-50 font-medium"
                                        placeholder="Nom du stade ou de la salle"
                                        value={newEvent.location}
                                        onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-4 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border group">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-indigo-600 rounded"
                                            checked={newEvent.is_recurring}
                                            onChange={e => setNewEvent({ ...newEvent, is_recurring: e.target.checked })}
                                        />
                                        <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600">Récurrent (Toutes les semaines)</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border group">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-indigo-600 rounded"
                                            checked={newEvent.visibility_type === 'PRIVATE'}
                                            onChange={e => setNewEvent({ ...newEvent, visibility_type: e.target.checked ? 'PRIVATE' : 'PUBLIC' })}
                                        />
                                        <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600">Privé (Visibles seulement par convoqués)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-2 border-l pl-6">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Joueurs convoqués</label>
                                    <button type="button" onClick={selectAllPlayers} className="text-[10px] text-indigo-600 font-bold hover:underline">Tout sélectionner</button>
                                </div>
                                <div className="h-48 overflow-y-auto border-2 border-gray-50 rounded-lg p-2 grid grid-cols-2 gap-2 bg-gray-50/50">
                                    {members.map(m => (
                                        <button
                                            key={m.id} type="button"
                                            onClick={() => togglePlayerSelection(m.id)}
                                            className={`p-2 rounded-lg text-left text-xs transition-all flex items-center gap-2 border ${newEvent.selected_players.includes(m.id)
                                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                                                : 'bg-white text-gray-600 border-gray-100 hover:border-indigo-200'
                                                }`}
                                        >
                                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-[8px]">{m.full_name?.[0]}</div>
                                            <span className="truncate">{m.full_name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes complémentaires</label>
                            <textarea
                                className="w-full border-2 border-gray-100 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none bg-gray-50 font-medium"
                                rows="2"
                                placeholder="..."
                                value={newEvent.notes}
                                onChange={e => setNewEvent({ ...newEvent, notes: e.target.value })}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button type="button" onClick={() => {
                                setShowForm(false);
                                setNewEvent({ type: 'MATCH', date: '', time: '', location: '', notes: '', visibility_type: 'PUBLIC', is_recurring: false, selected_players: [], match_location: 'DOMICILE' });
                            }} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
                            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all">
                                {newEvent.id ? 'Sauvegarder les modifications' : 'Publier l\'événement'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-6">
                {events.length === 0 && <p className="text-center text-gray-500 py-10">Aucun événement prévu.</p>}
                {events.map(ev => {
                    const status = myAttendance[ev.id];
                    const isConvoked = ev.attendance?.some(a => a.user_id === user.id && a.is_convoked);

                    // Statistics (Coach only)
                    let stats = null;
                    if (isCoach) {
                        // Use aggregated convocations map if available AND has content (more reliable for Coach view)
                        // otherwise fallback to event.attendance (ensure to filter only valid player IDs)
                        let convokedIds = [];

                        const mapConvocations = convocations[ev.id]
                            ? Object.keys(convocations[ev.id]).filter(uid => convocations[ev.id][uid])
                            : [];

                        if (mapConvocations.length > 0) {
                            convokedIds = mapConvocations;
                        } else {
                            // Fallback to ev.attendance if map is empty/initialized but not populated
                            convokedIds = ev.attendance
                                ?.filter(a => a.is_convoked && a.player_id)
                                .map(a => a.player_id) || [];
                        }

                        const totalConvoked = convokedIds.length;

                        if (totalConvoked > 0) {
                            const respondedCount = convokedIds.filter(uid => {
                                const s = memberAvailability[ev.id]?.[uid];
                                return s && s !== 'UNKNOWN' && s !== 'INCONNU';
                            }).length;

                            const validCount = convokedIds.filter(uid => {
                                const s = memberAvailability[ev.id]?.[uid];
                                return s === 'PRESENT' || s === 'RETARD';
                            }).length;

                            stats = { total: totalConvoked, responded: respondedCount, valid: validCount };
                        }
                    }

                    // Dynamic styling based on event type and response
                    const isMatch = ev.type === 'MATCH';
                    const hasResponded = status?.status && status.status !== 'UNKNOWN' && status.status !== 'INCONNU';

                    // New: Team Riders Stats
                    const ridersCount = ev.attendance?.filter(a => a.player_id && a.has_ride).length || 0;
                    const convokedCount = ev.attendance?.filter(a => a.player_id && a.is_convoked).length || 0;

                    const getFrameColor = () => {
                        if (isCoach && stats && stats.total > 0 && stats.responded === stats.total) {
                            return 'border-blue-400 bg-blue-50/20 shadow-blue-100';
                        }

                        // Check if ANY child hasn't responded
                        const anyNotResponded = children.some(c => {
                            const s = myAttendance[c.id]?.[ev.id]?.status;
                            return !s || s === 'UNKNOWN' || s === 'INCONNU';
                        });

                        if (anyNotResponded && children.length > 0) return 'border-orange-300 bg-orange-50/30';
                        if (isMatch) return 'border-red-200 bg-white';
                        return 'border-green-200 bg-white';
                    };

                    const getHeaderColor = () => {
                        if (isMatch) return 'bg-red-600 text-white';
                        return 'bg-green-600 text-white';
                    };

                    return (
                        <div key={ev.id} className={`rounded-xl border-2 shadow-sm overflow-hidden transition-all ${getFrameColor()}`}>
                            {/* Combined Header/Event Info */}
                            <div className="p-4 flex flex-col md:flex-row justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${getHeaderColor()}`}>
                                            {isMatch ? 'Match' : 'Entraînement'}
                                        </span>
                                        <span className="text-gray-900 font-bold">
                                            {new Date(ev.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </span>
                                        <span className="text-indigo-600 font-semibold flex items-center gap-1">
                                            <Clock size={14} /> {new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>

                                        {/* Team Ride Stats */}
                                        {isMatch && convokedCount > 0 && (
                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1" title="Joueurs ayant un trajet">
                                                🚗 {ridersCount} / {convokedCount} ont une voiture
                                            </span>
                                        )}

                                        {/* Coach Stats Badge */}
                                        {isCoach && stats && (
                                            <div className="flex items-center gap-2 ml-2">
                                                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200" title="Taux de réponse">
                                                    📊 {stats.responded} / {stats.total} réponses
                                                </span>
                                                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200" title="Joueurs valides (Présents/Retard)">
                                                    ✅ {stats.valid} / {stats.total} valides ({stats.total - stats.valid} abs/blessés)
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-1 text-gray-600">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <MapPin size={16} className="text-gray-400" />
                                            {ev.location}
                                            {isMatch && (
                                                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${ev.match_location === 'EXTERIEUR' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {ev.match_location === 'EXTERIEUR' ? 'EXTÉRIEUR' : 'DOMICILE'}
                                                </span>
                                            )}
                                        </span>
                                        {ev.notes && <p className="text-sm text-gray-500 italic bg-gray-50 p-2 rounded border border-dashed mt-1">{ev.notes}</p>}
                                    </div>
                                </div>

                                {/* Attendance Controls per Child/Member */}
                                <div className="flex flex-col items-center md:items-end gap-4">
                                    {(isCoach
                                        ? [{ id: user.id, first_name: 'Moi (Coach)', isCoachSelf: true }]
                                        : children
                                    ).filter(Boolean).map(child => {
                                        const cStatus = myAttendance[child.id]?.[ev.id];
                                        const isCConvoked = ev.attendance?.some(a => a.player_id === child.id && a.is_convoked);
                                        const hasCResponded = cStatus?.status && cStatus.status !== 'UNKNOWN' && cStatus.status !== 'INCONNU';

                                        return (
                                            <div key={child.id} className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {isCConvoked && <span className="text-[10px] bg-red-600 text-white px-1.5 rounded font-black">CONVOQUÉ</span>}
                                                    <span className="text-xs font-bold text-gray-700">{child.first_name}</span>
                                                    {!hasCResponded && (
                                                        <div className="text-[9px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded animate-pulse">
                                                            RÉPONSE ?
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 p-1 bg-gray-100 rounded-full border shadow-inner">
                                                    {[
                                                        { id: 'PRESENT', label: 'P', color: 'bg-green-600', title: 'Présent' },
                                                        { id: 'ABSENT', label: 'A', color: 'bg-red-600', title: 'Absent' },
                                                        { id: 'MALADE', label: '🤒', color: 'bg-purple-600', title: 'Malade' },
                                                        { id: 'BLESSE', label: '🤕', color: 'bg-orange-600', title: 'Blessé' },
                                                        { id: 'RETARD', label: '⏱️', color: 'bg-yellow-500', title: 'En retard' }
                                                    ].map(btn => (
                                                        <button
                                                            key={btn.id}
                                                            onClick={() => updateAttendance(ev.id, child.id, btn.id, child.isCoachSelf)}
                                                            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all transform active:scale-90 ${cStatus?.status === btn.id
                                                                ? `${btn.color} text-white shadow-md ring-2 ring-offset-1 ring-gray-200`
                                                                : 'bg-white text-gray-400 hover:bg-gray-50'
                                                                }`}
                                                            title={btn.title}
                                                        >
                                                            <span className={btn.label.length > 2 ? 'text-base' : 'text-xs font-bold'}>{btn.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {isCoach && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setNewEvent({
                                                        id: ev.id,
                                                        type: ev.type,
                                                        date: ev.date.split('T')[0],
                                                        time: new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                                        location: ev.location,
                                                        notes: ev.notes,
                                                        visibility_type: ev.visibility_type,
                                                        is_recurring: ev.is_recurring,
                                                        selected_players: ev.attendance?.filter(a => a.is_convoked).map(a => a.user_id) || [],
                                                        match_location: ev.match_location || 'DOMICILE'
                                                    });
                                                    setShowForm(true);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="text-gray-300 hover:text-indigo-600 transition-colors"
                                                title="Modifier"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => deleteEvent(ev.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Supprimer">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Coach Convocations Section (collapsible) */}
                            {isCoach && (
                                <div className="px-4 pb-2 border-t border-gray-100 bg-gray-50/50">
                                    <details className="text-sm group">
                                        <summary className="py-2 text-indigo-600 font-semibold cursor-pointer hover:underline flex items-center gap-2">
                                            <Users size={14} /> Gérer la convocation ({Object.values(convocations[ev.id] || {}).filter(Boolean).length} convoqués)
                                        </summary>
                                        <div className="py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {members.map(m => {
                                                const mStatus = memberAvailability[ev.id]?.[m.id] || 'UNKNOWN';
                                                const isSelected = convocations[ev.id]?.[m.id];
                                                return (
                                                    <div
                                                        key={m.id}
                                                        onClick={() => handleConvocationToggle(ev.id, m.id)}
                                                        className={`flex items-center justify-between p-2 rounded-lg border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-100 bg-white opacity-60 grayscale'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-[10px] font-bold">
                                                                {m.full_name?.[0]}
                                                            </div>
                                                            <span className="text-xs font-semibold">{m.full_name}</span>
                                                        </div>
                                                        <div className="text-[10px]">
                                                            {mStatus === 'PRESENT' && <span className="text-green-600 font-bold">✅</span>}
                                                            {mStatus === 'ABSENT' && <span className="text-red-600 font-bold">❌</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div className="sm:col-span-2 lg:col-span-3">
                                                <button
                                                    onClick={() => saveConvocations(ev.id)}
                                                    className="w-full mt-2 bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-indigo-700"
                                                >
                                                    Mettre à jour la convocation
                                                </button>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            )}

                            {/* Integrated Carpooling Section */}
                            {
                                isMatch && ev.match_location === 'EXTERIEUR' && (
                                    <div className="bg-gray-50/30 px-4 pb-4">
                                        <EventCarpooling
                                            eventId={ev.id}
                                            currentUser={user}
                                            teamId={team}
                                            myAttendance={myAttendance}
                                            isCoach={isCoach}
                                            activePlayer={activePlayer}
                                            evAttendance={ev.attendance || []}
                                            members={members}
                                            userName={userName}
                                        />
                                    </div>
                                )
                            }
                        </div >
                    );
                })}
            </div >
        </div >
    );
}

