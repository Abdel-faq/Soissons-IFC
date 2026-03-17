import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Copy, UserPlus, AlertCircle, Share, Calendar, Sparkles, Brain } from 'lucide-react';
import PlayerCard from '../components/PlayerCard';
import SkillsMenu from '../components/Skills/SkillsMenu';

export default function Team() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const [teams, setTeams] = useState([]); // List of teams for coach
    const [team, setTeam] = useState(null); // Currently selected team
    const [members, setMembers] = useState([]);

    const [profile, setProfile] = useState(null);
    const [view, setView] = useState('members'); // 'members' or 'attendance'
    const [historyEvents, setHistoryEvents] = useState([]);
    const [attendanceMatrix, setAttendanceMatrix] = useState({}); // { user_id: { event_id: status } }
    const [isCoach, setIsCoach] = useState(false);

    // Form states
    const [newTeamName, setNewTeamName] = useState('');
    const [joinCode, setJoinCode] = useState('');

    // Pagination/Filtering
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [showCard, setShowCard] = useState(false);



    const FFF_MAPPING = {
        'Senior A': [
            { label: 'Senior 1', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_SEM_1' }
        ],
        'Senior B': [
            { label: 'Senior 2', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_SEM_2' }
        ],
        'Senior C': [
            { label: 'Senior 3', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_SEM_8' }
        ],
        'Coupe SENIOR A': [
            { label: 'Senior 85', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_SEM_18' }
        ],
        'U19 Soissons IFC': [
            { label: 'U19 - U18 21', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U19_7' }
        ],
        'U17 Soissons IFC': [
            { label: 'U17 - U16 1', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U17_3' }
        ],
        'U16 Soissons IFC': [
            { label: 'U17 - U16 21', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U17_4' },
            { label: 'U17 - U16 22', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U17_12' }
        ],
        'U15 Soissons IFC': [
            { label: 'U17 - U16 22', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U17_12' },
            { label: 'U15 - U14 1', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U15_5' },
            { label: 'U15 - U14 2', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U15_11' },
            { label: 'U15 - U14 22', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U15_24' }
        ],
        'U14 Soissons IFC': [
            { label: 'U15 - U14 21', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U15_6' },
            { label: 'U15 - U14 2', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U15_11' }
        ],
        'U13 Soissons IFC': [
            { label: 'U13 - U12 1', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U13_13' }
        ],
        'U12 Soissons IFC': [
            { label: 'U13 - U12 21', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_U13_19' }
        ],
        'U11 Soissons IFC': [
            { label: 'Football d\'animation 1', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_FA_20' }
        ],
        'Vétérans Soissons IFC': [
            { label: 'Foot Loisir 1', url: 'https://epreuves.fff.fr/competition/club/560424-soissons-inter-football-club/equipe/2025_196931_FL_10' }
        ]
    };

    const fffTabs = team ? (FFF_MAPPING[team.name] || []) : [];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) throw new Error("No user found");
            setUser(currentUser);

            // Fetch Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle();
            setProfile(profileData);

            // Read Context
            const savedCtx = localStorage.getItem('sb-active-context');
            let context = null;
            if (savedCtx) {
                try {
                    context = JSON.parse(savedCtx);
                } catch (e) { console.error("Stale context", e); }
            }

            if (context) {
                const activeRole = context.role || 'PLAYER';
                setIsCoach(activeRole === 'COACH');

                // 1. Fetch ALL teams where user has coach rights (owner OR member coach)
                if (activeRole === 'COACH') {
                    // Fetch owned teams
                    const { data: ownedTeams } = await supabase
                        .from('teams')
                        .select('*')
                        .eq('coach_id', currentUser.id);

                    // Fetch membership teams
                    const { data: userMemberships } = await supabase
                        .from('team_members')
                        .select('team_id, teams(*)')
                        .eq('user_id', currentUser.id);

                    const membershipTeams = (userMemberships || []).map(m => m.teams).filter(Boolean);

                    // Merge and unique
                    const teamMap = new Map();
                    (ownedTeams || []).forEach(t => teamMap.set(t.id, t));
                    membershipTeams.forEach(t => {
                        if (!teamMap.has(t.id)) teamMap.set(t.id, t);
                    });

                    const allCoachTeams = Array.from(teamMap.values());
                    setTeams(allCoachTeams);

                    // Use context team if present, else first team
                    const targetTeamId = context.teamId || allCoachTeams?.[0]?.id;
                    if (targetTeamId) {
                        const current = allCoachTeams.find(t => t.id === targetTeamId);
                        if (current) {
                            setTeam(current);
                            fetchMembers(current.id);
                        }
                    }
                } else {
                    // 2. PLAYER case
                    if (context.teamId) {
                        const { data: teamData } = await supabase
                            .from('teams')
                            .select('*')
                            .eq('id', context.teamId)
                            .single();
                        if (teamData) {
                            setTeam(teamData);
                            setTeams([teamData]);
                            fetchMembers(teamData.id);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("TeamPage: Error", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async (teamId) => {
        try {
            // Tentative de récupération complète (avec stats FIFA)
            const { data: teamMembers, error } = await supabase
                .from('team_members')
                .select(`
                    player_id, 
                    user_id,
                    players(id, first_name, last_name, full_name, position, avatar_url, parent_id, birth_date, strong_foot, license_number, country, stats_pac, stats_sho, stats_pas, stats_dri, stats_def, stats_phy, stats_overall),
                    profiles:user_id(id, full_name, first_name, last_name, role, avatar_url)
                `)
                .eq('team_id', teamId);

            if (error) {
                // Si erreur 400 (colonnes manquantes), on tente un fallback sans les stats
                if (error.code === '42703' || error.status === 400) {
                    console.warn("⚠️ FIFA stats columns missing. Falling back to basic query.");
                    const { data: basicMembers, error: basicError } = await supabase
                        .from('team_members')
                        .select(`
                            player_id, 
                            user_id,
                            players(id, first_name, last_name, full_name, position, avatar_url, parent_id, birth_date, strong_foot, license_number),
                            profiles:user_id(id, full_name, first_name, last_name, role, avatar_url)
                        `)
                        .eq('team_id', teamId);

                    if (basicError) throw basicError;
                    setMembers(basicMembers || []);
                    setError("⚠️ Base de données non à jour : Les statistiques FIFA ne sont pas disponibles. Exécutez le script SQL de migration.");
                    return;
                }
                throw error;
            }
            setMembers(teamMembers || []);
            setError(null); // Clear previous errors if successful
        } catch (err) {
            console.error("Failed to fetch members:", err.message);
            setError("Erreur de chargement des membres : " + err.message);
        }

        fetchAttendanceHistory(teamId);
    };

    const fetchAttendanceHistory = async (teamId) => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const session = sessionData?.session;
            if (!session) return;

            const apiUrl = `${import.meta.env.VITE_API_URL || '/api'}/events?team_id=${teamId}&range=season`;
            const response = await fetch(apiUrl, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) throw new Error("Erreur lors de la récupération des événements");

            const eventsData = await response.json();
            const activeEvents = (eventsData || []).filter(e => !e.is_deleted);

            console.log(`[DEBUG] Team Attendance: Received ${activeEvents.length} events from API`);
            setHistoryEvents(activeEvents);

            if (activeEvents.length > 0) {
                const { data: att } = await supabase
                    .from('attendance')
                    .select('*')
                    .in('event_id', activeEvents.map(e => e.id));

                const matrix = {};
                att?.forEach(row => {
                    const entityId = row.player_id || row.user_id;
                    if (!entityId) return;
                    if (!matrix[entityId]) matrix[entityId] = {};
                    matrix[entityId][row.event_id] = { status: row.status, rpe: row.rpe };
                });
                setAttendanceMatrix(matrix);
            } else {
                setAttendanceMatrix({});
            }
        } catch (err) {
            console.error("Error fetching attendance history:", err);
        }
    };

    const handleAttendanceUpdate = async (playerId, eventId, status, memberUserId) => {
        const isUserCoach = profile?.role === 'COACH' || profile?.role === 'ADMIN' || team?.coach_id === user?.id;
        const targetEvent = historyEvents.find(e => e.id === eventId);
        const isFuture = targetEvent && new Date(targetEvent.date) > new Date();

        // Check if I am the parent of this player
        const isParent = members.find(m => m.player_id === playerId)?.players?.parent_id === user?.id;

        if (!isUserCoach && (!isParent || !isFuture)) return;

        try {
            const upsertData = {
                event_id: eventId,
                status: status,
                is_locked: isUserCoach,
                updated_at: new Date()
            };

            let onConflictStr = 'event_id, player_id';

            if (playerId) {
                upsertData.player_id = playerId;
            } else {
                upsertData.user_id = memberUserId || user.id;
                onConflictStr = 'event_id, user_id';
            }

            const { error } = await supabase.from('attendance').upsert(upsertData, { onConflict: onConflictStr });
            if (error) throw error;
            fetchAttendanceHistory(team.id);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleRPEUpdate = async (playerId, eventId, rpeValue) => {
        if (!isCoach) return;
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Non authentifié");

            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/events/${eventId}/rpe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rpe: parseInt(rpeValue),
                    player_id: playerId
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Erreur lors de l'enregistrement du RPE");
            }

            fetchAttendanceHistory(team.id); // Refresh
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSyncToGoogleSheets = async () => {
        try {
            setLoading(true);
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Non authentifié");

            // Prepare data: filter historical events to avoid huge sheets if needed, 
            // but the request was "update his sheet", so we'll send everything in attendanceMatrix
            const sheetData = members.map(m => {
                const playerAtt = attendanceMatrix[m.player_id] || {};
                const row = {
                    "Joueur": m.players?.full_name || m.profiles?.full_name || 'Membre'
                };

                // Add attendance for each event
                historyEvents.forEach(ev => {
                    const dateStr = new Date(ev.date).toLocaleDateString('fr-FR');
                    const status = playerAtt[ev.id]?.status || '-';
                    row[dateStr] = status;
                });

                return row;
            });

            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/sync/google-sheets`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    teamName: team.name,
                    data: sheetData
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Erreur sync");
            }

            const result = await response.json();
            alert(result.message || "Synchronisation réussie !");
        } catch (err) {
            console.error(err);
            alert("Erreur: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const createTeam = async (e) => {
        e.preventDefault();
        if (!newTeamName.trim()) return;

        try {
            // Ensure Profile Exists
            const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
            if (!profile) {
                await supabase.from('profiles').insert([
                    { id: user.id, email: user.email, full_name: user.email?.split('@')[0] || 'Coach', role: 'COACH' }
                ]);
            }

            const code = Math.random().toString(36).substring(2, 8).toUpperCase() || 'ABCDEF';

            const { data, error } = await supabase.from('teams').insert([{
                name: newTeamName,
                invite_code: code,
                coach_id: user.id
            }]).select().single();

            if (error) throw error;

            // Add coach as member
            await supabase.from('team_members').insert([{ team_id: data.id, user_id: user.id }]);

            // Refresh
            fetchData();
            setNewTeamName('');
            alert('Équipe créée !');
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    };

    const joinTeam = async (e) => {
        e.preventDefault();
        const sanitizedCode = joinCode.replace(/\s/g, '');
        if (!sanitizedCode) return;
        console.log("[DEBUG] Joining team with code:", sanitizedCode);
        try {
            // Ensure Profile Exists
            const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
            if (!profile) {
                const { error: createProfileError } = await supabase.from('profiles').insert([
                    { id: user.id, email: user.email, full_name: user.email?.split('@')[0] || 'Joueur', role: 'PLAYER' }
                ]);
                if (createProfileError) throw new Error("Erreur création profil: " + createProfileError.message);
            }

            let query = supabase.from('teams').select('id, name');
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedCode);

            if (isUUID) {
                query = query.or(`invite_code.ilike.${sanitizedCode},id.eq.${sanitizedCode}`);
            } else {
                query = query.ilike('invite_code', sanitizedCode);
            }

            const { data: teamToJoin, error: searchError } = await query.maybeSingle();
            if (searchError || !teamToJoin) throw new Error("Équipe introuvable avec ce code");

            // Fetch context again for join
            const savedCtx = localStorage.getItem('sb-active-context');
            const context = savedCtx ? JSON.parse(savedCtx) : null;

            const { error: joinError } = await supabase.from('team_members').insert([{
                team_id: teamToJoin.id,
                user_id: user.id,
                player_id: context?.playerId || null
            }]);
            if (joinError) throw joinError;

            alert(`Bienvenue dans ${teamToJoin.name} !`);
            window.location.reload();
        } catch (err) { alert(err.message); }
    };

    // RENDER LOGIC
    const [selectedEvent, setSelectedEvent] = useState(null); // For delete modal

    const handleDeleteEvent = async (eventId, mode = 'single') => {
        if (!confirm(mode === 'series' ? 'Êtes-vous sûr de vouloir supprimer cette séance ET toutes les suivantes ?' : 'Supprimer cette séance uniquement ?')) return;

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Non authentifié");

            const apiUrl = `${import.meta.env.VITE_API_URL || '/api'}/events/${eventId}${mode === 'series' ? '?mode=series' : ''}`;
            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Erreur lors de la suppression");
            }

            alert(mode === 'series' ? 'Série supprimée' : 'Séance supprimée');
            setSelectedEvent(null);
            fetchAttendanceHistory(team.id); // Refresh
        } catch (err) {
            alert(err.message);
        }
    };

    const toggleChatLock = async () => {
        if (!team) return;
        try {
            const newStatus = !team.is_chat_locked;
            const { error } = await supabase.from('teams').update({ is_chat_locked: newStatus }).eq('id', team.id);
            if (error) throw error;
            setTeam({ ...team, is_chat_locked: newStatus });
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <div className="p-10 text-center">Chargement...</div>;

    if (error) return (
        <div className="p-10 text-center text-red-600 bg-red-50 border border-red-200 m-4 rounded">
            <AlertCircle className="mx-auto mb-2" />
            <h3 className="font-bold">Erreur</h3>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 underline">Réessayer</button>
        </div>
    );


    // VIEW: NO TEAMS
    if (!teams || teams.length === 0) {
        return (
            <div className="max-w-2xl mx-auto mt-10 space-y-8">
                {isCoach ? (
                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users /> Créer mon équipe</h2>
                        <p className="text-gray-500 mb-4 text-sm">Sélectionnez la catégorie que vous allez gérer. Une équipe sera automatiquement créée.</p>
                        <form onSubmit={createTeam}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full border p-2 rounded bg-indigo-50 border-indigo-200 text-indigo-800 font-bold"
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            {/* Optional Name Input - Hidden by default or just labeled as "Suffixe (Optionnel)" */}

                            <button className="w-full bg-indigo-600 text-white p-3 rounded font-bold hover:bg-indigo-700 transition">
                                Valider et Gérer {category}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
                        <h2 className="text-2xl font-bold mb-4 text-gray-800">Vous n'avez pas encore d'équipe</h2>
                        <p className="text-gray-500 mb-6">Demandez le code d'invitation à votre coach pour rejoindre votre équipe et accéder aux matches.</p>
                        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">⚽</div>
                    </div>
                )}

                <div className="text-center font-bold text-gray-400">OU</div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><UserPlus /> Rejoindre une équipe</h2>
                    <form onSubmit={joinTeam}>
                        <input type="text" className="w-full border p-2 rounded mb-2 uppercase" placeholder="CODE INVITATION" value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\s/g, ''))} required />
                        <button className="w-full bg-white border border-indigo-600 text-indigo-600 p-2 rounded">Rejoindre</button>
                    </form>
                </div>
            </div>
        );
    }

    // VIEW: TEAM DASHBOARD
    if (!team && teams.length > 0) return <div className="p-10 text-center">Chargement de l'équipe...</div>;

    return (
        <div className="space-y-6">

            {teams.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {teams.map(t => (
                        <button
                            key={t.id}
                            onClick={() => {
                                setTeam(t);
                                fetchMembers(t.id);
                                localStorage.setItem('active_team_id', t.id);
                            }}
                            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold ${team.id === t.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border'}`}
                        >
                            {t.category ? `${t.category} - ${t.name}` : t.name}
                        </button>
                    ))}
                    <button
                        onClick={() => { setTeams([]); }}
                        className="px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold bg-gray-100 text-gray-600 border border-dashed border-gray-400"
                    >
                        + Créer
                    </button>
                </div>
            )}

            {error && (
                <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                    <AlertCircle className="text-orange-600 shrink-0" />
                    <div>
                        <p className="text-sm font-black text-orange-900 uppercase tracking-tight">Attention : Base de données non synchronisée</p>
                        <p className="text-[10px] font-bold text-orange-700/70 uppercase tracking-widest leading-tight">
                            Veuillez exécuter le script SQL de migration (v8) dans Supabase pour activer les cartes FIFA.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded shadow-sm border flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1">

                        <h1 className="text-2xl font-bold leading-none">{team.name}</h1>
                    </div>
                    {isCoach && (
                        <p className="text-gray-500 text-sm">Code d'invitation: <span className="font-mono bg-gray-100 px-2 py-1 rounded select-all">{team.invite_code}</span></p>
                    )}
                </div>
                {isCoach && (
                    <button onClick={() => { navigator.clipboard.writeText(team.invite_code); alert('Copié !') }} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded"><Copy /></button>
                )}
            </div>

            {/* Chat Lock Toggle (Coach Only) */}
            {isCoach && (
                <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            {team.is_chat_locked ? '🔒 Chat Verrouillé' : '💬 Chat Ouvert'}
                        </h3>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">
                            {team.is_chat_locked ? "Seuls les coachs peuvent écrire" : 'Tout le monde peut écrire'}
                        </p>
                    </div>
                    <button
                        onClick={toggleChatLock}
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${team.is_chat_locked ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                        {team.is_chat_locked ? 'DÉVERROUILLER' : 'VERROUILLER'}
                    </button>
                </div>
            )}

            {/* Tabs Switcher */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setView('members')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${view === 'members' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
                >
                    Effectif
                </button>
                <button
                    onClick={() => setView('attendance')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${view === 'attendance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
                >
                    Assiduité
                </button>
                <button
                    onClick={() => setView('skills')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${view === 'skills' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
                >
                    <Brain size={16} /> Compétences
                </button>
                <button
                    onClick={() => setView('rpe')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${view === 'rpe' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
                >
                    Note RPE
                </button>
                {fffTabs.map(tab => (
                    <button
                        key={tab.label}
                        onClick={() => setView(`fff-${tab.label}`)}
                        className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${view === `fff-${tab.label}` ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Month Selector for Stats Views */}
            {(view === 'attendance' || view === 'rpe') && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-indigo-50 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-md">
                            <Calendar size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-800 uppercase text-xs tracking-wider">Période d'affichage</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Filtrer par mois</p>
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {(() => {
                            // Extract unique months from history
                            const monthSet = new Set();
                            historyEvents.forEach(e => monthSet.add(new Date(e.date).toISOString().substring(0, 7)));
                            // Always include current month
                            monthSet.add(new Date().toISOString().substring(0, 7));

                            return Array.from(monthSet).sort().reverse().map(m => {
                                const [year, month] = m.split('-');
                                const date = new Date(year, month - 1);
                                const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                                const isActive = selectedMonth === m;

                                return (
                                    <button
                                        key={m}
                                        onClick={() => setSelectedMonth(m)}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 whitespace-nowrap uppercase tracking-tighter ${isActive
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105'
                                            : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200 hover:text-indigo-600'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}

            {view === 'members' ? (
                /* Members List view - REVAMPED TABLE */
                <div className="bg-white rounded-[24px] shadow-xl shadow-indigo-900/5 border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-600/20">
                                <Users size={18} />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Effectif de l'équipe</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">{members.length} Membres enregistrés</p>
                            </div>
                        </div>
                        <div className="md:hidden text-[10px] font-black text-indigo-500 animate-pulse bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest">
                            Défilé horizontal →
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-gray-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">Joueur</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">N° Licence</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">Naissance</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Poste</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center whitespace-nowrap">Pied</th>
                                    {isCoach && <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {members.length === 0 && (
                                    <tr>
                                        <td colSpan={isCoach ? 6 : 5} className="p-10 text-center text-gray-400 italic text-sm">
                                            Aucun membre dans cette équipe pour le moment.
                                        </td>
                                    </tr>
                                )}
                                {members.map(m => {
                                    const isAmical = !m.player_id; // Coach or Admin usually
                                    const p = m.players || {};
                                    const prof = m.profiles || {};
                                    const fullName = p.full_name || prof.full_name || (prof.first_name ? `${prof.first_name} ${prof.last_name}`.trim() : 'Membre');
                                    const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                                    return (
                                        <tr key={m.player_id || m.user_id} className="group hover:bg-indigo-50/30 transition-colors">
                                            {/* NOM COMPLET */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3 whitespace-nowrap">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-sm border-2 border-white ${isAmical ? 'bg-gray-100 text-gray-600' : 'bg-indigo-100 text-indigo-700'}`}>
                                                        {initials}
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            if (!isAmical) {
                                                                setSelectedPlayer({
                                                                    ...p,
                                                                    full_name: fullName,
                                                                    avatar_url: p.avatar_url || prof.avatar_url
                                                                });
                                                                setShowCard(true);
                                                            }
                                                        }}
                                                        className={`cursor-pointer group/name`}
                                                    >
                                                        <div className="text-sm font-bold text-indigo-900 group-hover:text-indigo-600 transition-colors uppercase flex items-center gap-1.5">
                                                            {fullName}
                                                            {!isAmical && <Sparkles size={12} className="text-yellow-500 opacity-0 group-hover/name:opacity-100 transition-opacity" />}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                            {isAmical ? (prof.role || 'Membre') : 'Joueur'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* POSTE */}
                                            <td className="px-4 py-4">
                                                <div className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${isAmical ? 'bg-gray-100 text-gray-500' : 'bg-indigo-50 text-indigo-700'}`}>
                                                    {isAmical ? (m.profiles?.role === 'COACH' ? '🛡️ Coach' : 'Admin') : (p.position || 'Poste non défini')}
                                                </div>
                                            </td>

                                            {/* PIED */}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1 text-xs font-bold text-gray-600 font-mono tracking-tighter uppercase whitespace-nowrap">
                                                    {p.strong_foot ? (
                                                        <>
                                                            {p.strong_foot.includes('D') && <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">D</span>}
                                                            {p.strong_foot.includes('G') && <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">G</span>}
                                                            {p.strong_foot.includes('A') && <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">A</span>}
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-200">-</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* NAISSANCE */}
                                            <td className="px-4 py-4">
                                                <div className="text-xs font-bold text-gray-600 whitespace-nowrap">
                                                    {p.birth_date ? new Date(p.birth_date).toLocaleDateString('fr-FR') : <span className="text-gray-200">-</span>}
                                                </div>
                                            </td>

                                            {/* LICENCE */}
                                            <td className="px-4 py-4">
                                                <div className="text-xs font-bold text-gray-600 font-mono tracking-tighter whitespace-nowrap">
                                                    {p.license_number || <span className="text-gray-200">Non renseigné</span>}
                                                </div>
                                            </td>

                                            {/* ACTIONS (Coach Logged In) */}
                                            {isCoach && (
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                if (!isAmical) {
                                                                    setSelectedPlayer({ ...p, full_name: fullName, avatar_url: p.avatar_url || prof.avatar_url, team_category: team.category || team.name });
                                                                    setShowCard(true);
                                                                }
                                                            }}
                                                            className="px-3 py-1 bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors scale-90 whitespace-nowrap"
                                                        >
                                                            Notes
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`Supprimer ${fullName} de l'équipe ?`)) {
                                                                    const { error: deleteError } = await supabase
                                                                        .from('team_members')
                                                                        .delete()
                                                                        .eq('team_id', team.id)
                                                                        .eq(m.player_id ? 'player_id' : 'user_id', m.player_id || m.user_id);

                                                                    if (deleteError) {
                                                                        alert("Erreur: " + deleteError.message);
                                                                    } else {
                                                                        fetchMembers(team.id);
                                                                    }
                                                                }
                                                            }}
                                                            className="h-10 w-10 flex border-2 border-transparent items-center justify-center bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-500/20 transition-all active:scale-90"
                                                            title="Supprimer du club"
                                                        >
                                                            <AlertCircle size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : view === 'attendance' ? (
                /* Attendance matrix view */
                <div className="bg-white rounded shadow-sm border overflow-x-auto">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <span className="font-bold text-gray-700">Tableau d'assiduité</span>
                        {user?.email === 'Yassine.bekka0202@gmail.com' && (
                            <button
                                onClick={handleSyncToGoogleSheets}
                                className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 transition flex items-center gap-2"
                                title="Mettre à jour le Google Sheet"
                            >
                                <Share size={14} /> Synchroniser Google Sheet
                            </button>
                        )}
                    </div>
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 uppercase font-black text-gray-500 border-b">
                            <tr>
                                <th className="p-4 bg-white sticky left-0 z-10 border-r">Joueur</th>
                                {historyEvents.filter(ev => ev.date?.startsWith(selectedMonth)).map(ev => (
                                    <th
                                        key={ev.id}
                                        onClick={() => isCoach && setSelectedEvent(ev)}
                                        className={`p-2 min-w-[60px] text-center border-r select-none ${ev.is_deleted ? 'bg-red-50 text-red-400 line-through' : ''} ${isCoach ? 'cursor-pointer hover:bg-gray-100 text-indigo-600' : ''}`}
                                        title={isCoach ? "Cliquez pour gérer" : `${ev.type} - ${ev.location}`}
                                    >
                                        {new Date(ev.date).toLocaleDateString('fr-FR', { day: '2-digit' })}
                                        <div className="text-[8px] opacity-70">{ev.type === 'MATCH' ? 'Match' : 'Entr.'}</div>
                                    </th>
                                ))}
                                <th className="p-4 text-center bg-indigo-50 text-indigo-700">Total Saison</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.filter(m => isCoach || m.players?.parent_id === user?.id).map(m => {
                                const playerAtt = attendanceMatrix[m.player_id] || {};

                                // [MODIFIED] STATS CALCULATION
                                // Only count events where the player is actually concerned.
                                // If event is PRIVATE and player NOT convoked -> Skip from total.
                                const relevantEvents = historyEvents.filter(ev => {
                                    if (ev.visibility_type === 'PRIVATE') {
                                        // Check convocation in event.attendance list (source of truth for convocation)
                                        const isConvoked = ev.attendance?.some(a => a.player_id === m.player_id && a.is_convoked);
                                        return isConvoked;
                                    }
                                    return true; // Public events always count
                                });

                                const presentCount = relevantEvents.filter(ev => playerAtt[ev.id]?.status === 'PRESENT' || playerAtt[ev.id]?.status === 'RETARD').length;
                                const ratio = relevantEvents.length > 0 ? Math.round((presentCount / relevantEvents.length) * 100) : 0;

                                return (
                                    <tr key={m.player_id || m.user_id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 font-bold bg-white sticky left-0 z-10 border-r">{m.players?.full_name || m.profiles?.full_name || 'Membre'}</td>
                                        {historyEvents.filter(ev => ev.date?.startsWith(selectedMonth)).map(ev => {
                                            const attData = playerAtt[ev.id];
                                            const status = attData?.status;
                                            const rpe = attData?.rpe;

                                            let color = "text-gray-300";
                                            let label = "-";

                                            if (status === 'PRESENT') { color = "text-green-600 font-black"; label = "P"; }
                                            if (status === 'ABSENT') { color = "text-red-500 font-black"; label = "A"; }
                                            if (status === 'MALADE') { color = "text-purple-500"; label = "M"; }
                                            if (status === 'BLESSE') { color = "text-orange-500"; label = "B"; }
                                            if (status === 'RETARD') { color = "text-yellow-600 font-bold"; label = "R"; }

                                            // [MODIFIED] Check if irrelevant for this player (Gray Cell)
                                            const isConvoked = ev.attendance?.some(a => a.player_id === m.player_id && a.is_convoked);
                                            const isIrrelevant = ev.visibility_type === 'PRIVATE' && !isConvoked;

                                            if (isIrrelevant) {
                                                return <td key={ev.id} className="p-2 border-r bg-gray-100"></td>;
                                            }

                                            return (
                                                <td key={ev.id} className="p-2 border-r text-center">
                                                    {(isCoach || (m.players?.parent_id === user?.id && new Date(ev.date) > new Date())) ? (
                                                        <select
                                                            className={`bg-transparent outline-none ${color}`}
                                                            value={status || ''}
                                                            onChange={(e) => handleAttendanceUpdate(m.player_id, ev.id, e.target.value, m.user_id)}
                                                        >
                                                            <option value="">-</option>
                                                            <option value="PRESENT">P</option>
                                                            <option value="ABSENT">A</option>
                                                            <option value="MALADE">M</option>
                                                            <option value="BLESSE">B</option>
                                                            <option value="RETARD">R</option>
                                                        </select>
                                                    ) : (
                                                        <span className={color}>{label}</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="p-4 text-center font-black bg-indigo-50/50">
                                            <div className={`
                                                px-2 py-1 rounded text-[10px]
                                                ${ratio >= 80 ? 'bg-green-100 text-green-700' : ratio >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}
                                            `} title={`${presentCount} / ${relevantEvents.length}`}>
                                                {ratio}%
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : view === 'rpe' ? (
                /* RPE matrix view */
                <div className="bg-white rounded shadow-sm border overflow-x-auto">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <span className="font-bold text-gray-700">Notes d'intensité (RPE)</span>
                    </div>
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 uppercase font-black text-gray-500 border-b">
                            <tr>
                                <th className="p-4 bg-white sticky left-0 z-10 border-r">Joueur</th>
                                {historyEvents.filter(ev => ev.date?.startsWith(selectedMonth)).map(ev => (
                                    <th
                                        key={ev.id}
                                        className="p-2 min-w-[60px] text-center border-r"
                                    >
                                        {new Date(ev.date).toLocaleDateString('fr-FR', { day: '2-digit' })}
                                        <div className="text-[8px] opacity-70">{ev.type === 'MATCH' ? 'Match' : 'Entr.'}</div>
                                    </th>
                                ))}
                                <th className="p-4 text-center bg-indigo-50 text-indigo-700">Moyenne Saison</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.filter(m => isCoach || m.players?.parent_id === user?.id).map(m => {
                                const playerAtt = attendanceMatrix[m.player_id] || {};

                                const relevantEvents = historyEvents.filter(ev => {
                                    if (ev.visibility_type === 'PRIVATE') {
                                        const isConvoked = ev.attendance?.some(a => a.player_id === m.player_id && a.is_convoked);
                                        return isConvoked;
                                    }
                                    return true;
                                });

                                const rpeValues = relevantEvents.map(ev => playerAtt[ev.id]?.rpe).filter(Boolean);
                                const avgRpe = rpeValues.length > 0 ? (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1) : '-';

                                return (
                                    <tr key={m.player_id || m.user_id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 font-bold bg-white sticky left-0 z-10 border-r">{m.players?.full_name || m.profiles?.full_name || 'Membre'}</td>
                                        {historyEvents.filter(ev => ev.date?.startsWith(selectedMonth)).map(ev => {
                                            const attData = playerAtt[ev.id];
                                            const rpe = attData?.rpe;

                                            // Check if irrelevant
                                            const isConvoked = ev.attendance?.some(a => a.player_id === m.player_id && a.is_convoked);
                                            const isIrrelevant = ev.visibility_type === 'PRIVATE' && !isConvoked;

                                            if (isIrrelevant) {
                                                return <td key={ev.id} className="p-2 border-r bg-gray-100"></td>;
                                            }

                                            const getRpeColor = (val) => {
                                                if (!val) return 'text-gray-300';
                                                if (val <= 3) return 'bg-green-100 text-green-700';
                                                if (val <= 7) return 'bg-yellow-100 text-yellow-700';
                                                return 'bg-red-100 text-red-700';
                                            };

                                            return (
                                                <td key={ev.id} className="p-2 border-r text-center">
                                                    {(isCoach || (m.players?.parent_id === user?.id && new Date(ev.date) > new Date())) ? (
                                                        <select
                                                            className={`bg-transparent outline-none font-black text-[14px] ${getRpeColor(rpe)}`}
                                                            value={rpe || ''}
                                                            onChange={(e) => handleRPEUpdate(m.player_id, ev.id, e.target.value)}
                                                        >
                                                            <option value="">-</option>
                                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                                                                <option key={val} value={val}>{val}</option>
                                                            ))}
                                                        </select>
                                                    ) : rpe ? (
                                                        <div className={`w-8 h-8 flex items-center justify-center mx-auto rounded-lg font-black text-[14px] ${getRpeColor(rpe)}`}>
                                                            {rpe}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="p-4 text-center font-black bg-indigo-50/50">
                                            {avgRpe}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : view.startsWith('fff-') ? (
                <FffResults url={fffTabs.find(t => `fff-${t.label}` === view)?.url} />
            ) : view === 'skills' ? (
                /* Skills Dashboard - Show team dropdown or pick a player */
                <div className="bg-white rounded-[24px] shadow-xl shadow-indigo-900/5 border border-gray-100 overflow-hidden p-6 text-center">
                   <h2 className="text-xl font-bold mb-4">Suivi des compétences</h2>
                   <p className="text-gray-500 mb-6">Pour évaluer un joueur, retournez dans l'onglet <strong>Effectif</strong> et cliquez sur "Notes" ou sur son nom pour ouvrir sa carte joueur, puis accédez à ses compétences.</p>
                   {/* We can develop a team-wide view here later, but for now we follow the user request: "ajouté un menu 'Compétences' sur le profil d'un joueur" */}
                   <button onClick={() => setView('members')} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">Retour à l'effectif</button>
                </div>
            ) : (
                /* Original view logic fallback (should not happen with the dynamic tabs) */
                null
            )}

            {/* Event Options Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                            📅 Gestion de la séance
                        </h3>
                        <p className="text-gray-600 mb-1">Date : {new Date(selectedEvent.date).toLocaleString('fr-FR')}</p>
                        <p className="text-gray-600 mb-4">Lieu : {selectedEvent.location}</p>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleDeleteEvent(selectedEvent.id, 'single')}
                                className="w-full bg-red-50 text-red-600 border border-red-200 p-3 rounded font-bold hover:bg-red-100 flex items-center justify-center gap-2"
                            >
                                🗑️ Supprimer uniquement cette séance
                            </button>

                            <button
                                onClick={() => handleDeleteEvent(selectedEvent.id, 'series')}
                                className="w-full bg-red-600 text-white p-3 rounded font-bold hover:bg-red-700 flex items-center justify-center gap-2"
                            >
                                💥 Supprimer TOUTE LA SÉRIE
                            </button>
                            <p className="text-[10px] text-gray-400 text-center">
                                "Toute la série" supprimera cette séance ET toutes les futures séances identiques.
                            </p>
                        </div>

                        <div className="mt-6 pt-4 border-t flex justify-end">
                            <button onClick={() => setSelectedEvent(null)} className="text-gray-500 font-bold hover:text-gray-700">Annuler</button>
                        </div>
                    </div>
                </div>
            )}
            {/* PLAYER CARD MODAL */}
            {showCard && selectedPlayer && (
                <PlayerCard
                    player={selectedPlayer}
                    isCoach={isCoach}
                    onClose={() => {
                        setShowCard(false);
                        setSelectedPlayer(null);
                        fetchMembers(team.id); // Refresh stats on close
                    }}
                />
            )}
        </div>
    );
}

function FffResults({ url }) {
    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow-sm border border-indigo-200 p-8">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800">Résultats et Classement FFF</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                        Consultez les résultats officiels, le calendrier complet et le classement de votre équipe sur le site de la FFF.
                    </p>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-4 rounded-lg transition-all transform hover:scale-105 shadow-lg"
                    >
                        <span>Voir sur le site FFF</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                    <p className="text-xs text-gray-500 mt-4">
                        🔗 S'ouvre dans un nouvel onglet
                    </p>
                </div>
            </div>
        </div>
    );
}

