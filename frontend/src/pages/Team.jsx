import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Copy, UserPlus, AlertCircle } from 'lucide-react';

export default function Team() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const [teams, setTeams] = useState([]); // List of teams for coach
    const [team, setTeam] = useState(null); // Currently selected team
    const [members, setMembers] = useState([]);
    const [category, setCategory] = useState('U10'); // Default category
    const [profile, setProfile] = useState(null);
    const [view, setView] = useState('members'); // 'members' or 'attendance'
    const [historyEvents, setHistoryEvents] = useState([]);
    const [attendanceMatrix, setAttendanceMatrix] = useState({}); // { user_id: { event_id: status } }

    // Form states
    const [newTeamName, setNewTeamName] = useState('');
    const [joinCode, setJoinCode] = useState('');

    const CATEGORIES = [
        'Baby Foot', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14',
        'U15', 'U16', 'U17', 'U18', 'Senior A', 'Senior B', 'Senior C', 'Féminine', 'Vétéran'
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) throw new Error("No user found");
            setUser(currentUser);

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

                // Set dummy team object for initial view if we have context
                const teamObj = context.teamId ? {
                    id: context.teamId,
                    name: context.teamName,
                    category: context.category,
                    coach_id: activeRole === 'COACH' ? currentUser.id : null
                } : null;

                if (teamObj) {
                    setTeam(teamObj);
                    setTeams([teamObj]); // Crucial to avoid "No Team" view
                    fetchMembers(context.teamId);
                } else {
                    setTeam(null);
                    setTeams([]);
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
        const { data: teamMembers, error } = await supabase
            .from('team_members')
            .select('player_id, players(id, full_name, position, parent_id)')
            .eq('team_id', teamId);

        if (!error) setMembers(teamMembers || []);

        fetchAttendanceHistory(teamId);
    };

    const fetchAttendanceHistory = async (teamId) => {
        const { data: evs } = await supabase
            .from('events')
            .select('*')
            .eq('team_id', teamId)
            .order('date', { ascending: false });
        setHistoryEvents(evs || []);

        if (evs && evs.length > 0) {
            const { data: att } = await supabase
                .from('attendance')
                .select('*')
                .in('event_id', evs.map(e => e.id));

            const matrix = {};
            att?.forEach(row => {
                if (!matrix[row.player_id]) matrix[row.player_id] = {};
                matrix[row.player_id][row.event_id] = row.status;
            });
            setAttendanceMatrix(matrix);
        }
    };

    const handleAttendanceUpdate = async (playerId, eventId, status) => {
        const isUserCoach = profile?.role === 'COACH' || profile?.role === 'ADMIN' || team?.coach_id === user?.id;
        const targetEvent = historyEvents.find(e => e.id === eventId);
        const isFuture = targetEvent && new Date(targetEvent.date) > new Date();

        // Check if I am the parent of this player
        const isParent = members.find(m => m.player_id === playerId)?.players?.parent_id === user?.id;

        if (!isUserCoach && (!isParent || !isFuture)) return;

        try {
            const { error } = await supabase.from('attendance').upsert({
                event_id: eventId,
                player_id: playerId,
                status: status,
                is_locked: isUserCoach,
                updated_at: new Date()
            }, { onConflict: 'event_id, player_id' });
            if (error) throw error;
            fetchAttendanceHistory(team.id);
        } catch (err) {
            alert(err.message);
        }
    };

    const createTeam = async (e) => {
        e.preventDefault();
        // if (!newTeamName.trim()) return; // Name is now auto-derived

        try {
            // Ensure Profile Exists
            const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
            if (!profile) {
                await supabase.from('profiles').insert([
                    { id: user.id, email: user.email, full_name: user.email?.split('@')[0] || 'Coach', role: 'COACH' }
                ]);
            }

            const code = Math.random().toString(36).substring(2, 8).toUpperCase() || 'ABCDEF'; // Fallback
            const finalName = `Soissons-IFC ${category}`;

            const { data, error } = await supabase.from('teams').insert([{
                name: finalName,
                invite_code: code,
                coach_id: user.id,
                category: category
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
        try {
            // Ensure Profile Exists
            const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
            if (!profile) {
                const { error: createProfileError } = await supabase.from('profiles').insert([
                    { id: user.id, email: user.email, full_name: user.email?.split('@')[0] || 'Joueur', role: 'PLAYER' }
                ]);
                if (createProfileError) throw new Error("Erreur création profil: " + createProfileError.message);
            }

            const { data: teamToJoin, error: searchError } = await supabase.from('teams').select('id, name').ilike('invite_code', sanitizedCode).single();
            if (searchError || !teamToJoin) throw new Error("Équipe introuvable");

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

    const isCoach = profile?.role === 'COACH' || profile?.role === 'ADMIN' || team?.coach_id === user?.id;

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

            <div className="bg-white p-6 rounded shadow-sm border flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded uppercase">{team.category || 'Général'}</span>
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
            </div>

            {view === 'members' ? (
                /* Members List view */
                <div className="bg-white rounded shadow-sm border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 font-semibold flex gap-2 items-center"><Users size={18} /> Membres ({members.length})</div>
                    <ul>
                        {members.length === 0 && <li className="p-4 text-gray-400 italic">Aucun membre</li>}
                        {members.map(m => (
                            <li key={m.player_id} className="p-4 border-b last:border-0 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
                                        {m.players?.full_name?.[0] || '?'}
                                    </div>
                                    <span>{m.players?.full_name || 'Joueur'} <span className="text-xs text-gray-400">({m.players?.position || 'Joueur'})</span></span>
                                </div>
                                {isCoach && (
                                    <button
                                        onClick={async () => {
                                            if (confirm('Supprimer ce joueur de l\'équipe ?')) {
                                                const { error: deleteError } = await supabase.from('team_members').delete().eq('team_id', team.id).eq('player_id', m.player_id);
                                                if (deleteError) {
                                                    alert("Erreur lors de la suppression : " + deleteError.message);
                                                } else {
                                                    fetchMembers(team.id);
                                                }
                                            }
                                        }}
                                        className="text-gray-400 hover:text-red-600 p-2"
                                        title="Supprimer du club"
                                    >
                                        <AlertCircle size={16} />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                /* Attendance matrix view */
                <div className="bg-white rounded shadow-sm border overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 uppercase font-black text-gray-500 border-b">
                            <tr>
                                <th className="p-4 bg-white sticky left-0 z-10 border-r">Joueur</th>
                                {historyEvents.map(ev => (
                                    <th key={ev.id} className={`p-2 min-w-[60px] text-center border-r ${ev.is_deleted ? 'bg-red-50 text-red-400 line-through' : ''}`} title={`${ev.type} - ${ev.location}`}>
                                        {new Date(ev.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                        <div className="text-[8px] opacity-70">{ev.type === 'MATCH' ? 'Match' : 'Entr.'}</div>
                                    </th>
                                ))}
                                <th className="p-4 text-center bg-indigo-50 text-indigo-700">Assiduité</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.filter(m => isCoach || m.players?.parent_id === user?.id).map(m => {
                                const playerAtt = attendanceMatrix[m.player_id] || {};
                                const presentCount = historyEvents.filter(ev => playerAtt[ev.id] === 'PRESENT' || playerAtt[ev.id] === 'RETARD').length;
                                const ratio = historyEvents.length > 0 ? Math.round((presentCount / historyEvents.length) * 100) : 0;

                                return (
                                    <tr key={m.player_id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 font-bold bg-white sticky left-0 z-10 border-r">{m.players?.full_name || 'Joueur'}</td>
                                        {historyEvents.map(ev => {
                                            const status = playerAtt[ev.id];
                                            let color = "text-gray-300";
                                            let label = "-";

                                            if (status === 'PRESENT') { color = "text-green-600 font-black"; label = "P"; }
                                            if (status === 'ABSENT') { color = "text-red-500 font-black"; label = "A"; }
                                            if (status === 'MALADE') { color = "text-purple-500"; label = "M"; }
                                            if (status === 'BLESSE') { color = "text-orange-500"; label = "B"; }
                                            if (status === 'RETARD') { color = "text-yellow-600 font-bold"; label = "R"; }

                                            return (
                                                <td key={ev.id} className="p-2 border-r text-center">
                                                    {(isCoach || (m.players?.parent_id === user?.id && new Date(ev.date) > new Date())) ? (
                                                        <select
                                                            className={`bg-transparent outline-none ${color}`}
                                                            value={status || ''}
                                                            onChange={(e) => handleAttendanceUpdate(m.player_id, ev.id, e.target.value)}
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
                                            `}>
                                                {ratio}%
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
