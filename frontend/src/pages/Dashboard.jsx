import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Stats from '../components/Stats';
import { Plus, X, Users, Edit2, Trash2, Image, Send, Layout, ChevronLeft, ChevronRight, MessageSquare, Info } from 'lucide-react';

export default function Dashboard() {
    const [newTeamName, setNewTeamName] = useState('');
    const [showForm, setShowForm] = useState(false); // New state for toggling form
    const [loadingTeam, setLoadingTeam] = useState(false);
    const [nextEvent, setNextEvent] = useState(null);
    const [team, setTeam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isCoach, setIsCoach] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [newCoach, setNewCoach] = useState({ email: '', full_name: '' });
    const [generatedPassword, setGeneratedPassword] = useState('');
    const [lastCreatedCoach, setLastCreatedCoach] = useState(null);

    const [teams, setTeams] = useState([]); // Add teams state
    const [unreadCount, setUnreadCount] = useState(0);


    const [children, setChildren] = useState([]);
    const [showChildForm, setShowChildForm] = useState(false);
    const [newChild, setNewChild] = useState({ first_name: '', last_name: '', position: 'Attaquant' });
    const [joiningTeam, setJoiningTeam] = useState(null); // { childId, inviteCode }
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinData, setJoinData] = useState({ childId: '', code: '' });
    const [adminTeams, setAdminTeams] = useState([]); // All teams for admin management
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [editingName, setEditingName] = useState('');

    // Team Posts (Infos Equipe)
    const [posts, setPosts] = useState([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [showPostModal, setShowPostModal] = useState(false);
    const [newPost, setNewPost] = useState({ content: '', images: [], visibility_type: 'PUBLIC', recipient_ids: [] });
    const [uploadingImage, setUploadingImage] = useState(false);
    const [teamMembers, setTeamMembers] = useState([]); // For targeted visibility

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (user) {
                // Fetch Profile and Role
                const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
                setProfile(profileData);

                const userRole = profileData?.role || 'PLAYER';
                setIsCoach(userRole === 'COACH');

                // Fetch Children (Players managed by this account)
                const { data: childrenData } = await supabase.from('players').select('*').eq('parent_id', user.id);
                setChildren(childrenData || []);

                // Fetch Team(s) for all children (and self if coach)
                let allMyTeams = [];

                // 1. Fetch teams where I am the coach
                const { data: ownedTeams } = await supabase.from('teams').select('*').eq('coach_id', user.id);

                // 2. Fetch teams where I am a member (can be as a coach or through children)
                const { data: userMemberships } = await supabase
                    .from('team_members')
                    .select('team_id, teams(*)')
                    .eq('user_id', user.id);

                const membershipTeams = (userMemberships || []).map(m => m.teams).filter(Boolean);

                // 3. Fetch memberships for each child
                let childrenMemberships = [];
                if (childrenData && childrenData.length > 0) {
                    const childIds = childrenData.map(c => c.id);
                    const { data: mData } = await supabase
                        .from('team_members')
                        .select('team_id, player_id, teams(*)')
                        .in('player_id', childIds);
                    childrenMemberships = mData || [];
                }

                // 4. Build Contexts
                const availableContexts = [];

                // Combine owned teams and membership teams (avoiding duplicates)
                const teamMap = new Map();
                (ownedTeams || []).forEach(t => teamMap.set(t.id, { ...t, role: 'COACH' }));

                // If I'm a member and my profile role is COACH, I'm a coach in that team too
                if (userRole === 'COACH') {
                    membershipTeams.forEach(t => {
                        if (!teamMap.has(t.id)) {
                            teamMap.set(t.id, { ...t, role: 'COACH' });
                        }
                    });
                }

                // Convert map to contexts
                teamMap.forEach(t => {
                    availableContexts.push({
                        id: `coach-${t.id}`,
                        teamId: t.id,
                        teamName: t.name,
                        category: t.category,
                        role: 'COACH',
                        inviteCode: t.invite_code,
                        label: `👨‍🏫 Coach - ${t.name} (${t.category || ''})`
                    });
                });

                // Player Contexts (Children)
                if (childrenData) {
                    childrenData.forEach(child => {
                        const childMembershipsList = childrenMemberships.filter(m => m.player_id === child.id);

                        if (childMembershipsList.length > 0) {
                            childMembershipsList.forEach(m => {
                                if (m.teams) {
                                    availableContexts.push({
                                        id: `player-${child.id}-${m.team_id}`,
                                        teamId: m.team_id,
                                        teamName: m.teams.name,
                                        category: m.teams.category,
                                        playerId: child.id,
                                        playerName: child.first_name,
                                        role: 'PLAYER',
                                        label: `🧒 ${child.first_name} - ${m.teams.name}`
                                    });
                                }
                            });
                        } else {
                            // Child with no team context
                            availableContexts.push({
                                id: `player-${child.id}-none`,
                                teamId: null,
                                teamName: 'Pas d\'équipe',
                                playerId: child.id,
                                playerName: child.first_name,
                                role: 'PLAYER',
                                label: `🧒 ${child.first_name} (En attente d'équipe)`
                            });
                        }
                    });
                }

                setTeams(availableContexts);

                // Determine Active Context
                const savedCtx = localStorage.getItem('sb-active-context');
                let activeContext = null;
                if (savedCtx) {
                    try {
                        const parsed = JSON.parse(savedCtx);
                        activeContext = availableContexts.find(c => c.id === parsed.id);
                    } catch (e) { console.error("Stale context", e); }
                }

                if (!activeContext && availableContexts.length > 0) {
                    activeContext = availableContexts[0];
                }

                if (activeContext) {
                    localStorage.setItem('sb-active-context', JSON.stringify(activeContext));
                    if (activeContext.teamId) localStorage.setItem('active_team_id', activeContext.teamId);
                    setTeam(activeContext);
                    setIsCoach(activeContext.role === 'COACH');

                    // Fetch Next Event if has team
                    if (activeContext.teamId) {
                        const { data: event } = await supabase
                            .from('events')
                            .select('*')
                            .eq('team_id', activeContext.teamId)
                            .eq('is_deleted', false)
                            .gte('date', new Date().toISOString())
                            .order('date', { ascending: true })
                            .limit(1)
                            .maybeSingle();
                        setNextEvent(event);

                        // Fetch Unread Count
                        try {
                            const { data: session } = await supabase.auth.getSession();
                            const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/messages/unread-count/${activeContext.teamId}`, {
                                headers: { 'Authorization': `Bearer ${session.session?.access_token}` }
                            });
                            const counts = await res.json();
                            setUnreadCount(counts.total || 0);
                        } catch (e) {
                            console.error("Error fetching unread count", e);
                        }
                    } else {
                        setNextEvent(null);
                        setUnreadCount(0);
                    }
                }

                if (userRole === 'ADMIN') {
                    const { data: allTeamsData } = await supabase
                        .from('teams')
                        .select('*, coach:coach_id(full_name)')
                        .order('name');
                    setAdminTeams(allTeamsData || []);
                }

                // Fetch Posts if team is active
                if (activeContext?.teamId) {
                    fetchPosts(activeContext.teamId);
                    if (activeContext.role === 'COACH') {
                        fetchTeamMembers(activeContext.teamId);
                    }
                }
            }
        } catch (error) {
            console.error("Dashboard error:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPosts = async (teamId) => {
        try {
            setLoadingPosts(true);
            const { data: session } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/posts/${teamId}`, {
                headers: { 'Authorization': `Bearer ${session.session?.access_token}` }
            });
            const data = await res.json();
            setPosts(data || []);
        } catch (e) {
            console.error("Error fetching posts", e);
        } finally {
            setLoadingPosts(false);
        }
    };

    const fetchTeamMembers = async (teamId) => {
        const { data } = await supabase
            .from('team_members')
            .select(`
                player_id, 
                players(id, full_name, position)
            `)
            .eq('team_id', teamId)
            .not('player_id', 'is', null);

        setTeamMembers(data?.map(m => m.players).filter(Boolean) || []);
    };

    const handleAddChild = async (e) => {
        e.preventDefault();
        if (!newChild.first_name || !newChild.last_name) return;

        try {
            const { data, error } = await supabase.from('players').insert([
                { ...newChild, parent_id: user.id }
            ]).select().single();

            if (error) throw error;

            setChildren([...children, data]);
            setNewChild({ first_name: '', last_name: '', position: 'Attaquant' });
            setShowChildForm(false);
            alert("Enfant ajouté !");
        } catch (err) {
            alert("Erreur: " + err.message);
        }
    };

    const handleTeamSwitch = (contextId) => {
        const selected = teams.find(c => c.id === contextId);
        if (selected) {
            localStorage.setItem('sb-active-context', JSON.stringify(selected));
            if (selected.teamId) localStorage.setItem('active_team_id', selected.teamId);
            window.location.reload();
        }
    };

    const createTeam = async (e) => {
        e.preventDefault();
        if (!newTeamName.trim() || !user) return;
        if (profile?.role !== 'COACH') {
            alert("Seuls les coachs peuvent créer une équipe.");
            return;
        }
        setLoadingTeam(true);

        try {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            const { data, error } = await supabase.from('teams').insert([
                { name: newTeamName, coach_id: user.id, invite_code: code }
            ]).select().single();

            if (error) throw error;

            alert("Équipe créée !");
            setTeam(data);
        } catch (err) {
            alert("Erreur création équipe: " + err.message);
        } finally {
            setLoadingTeam(false);
        }
    };

    const handleCreateCoach = async (e) => {
        e.preventDefault();
        const autoPassword = Math.random().toString(36).slice(-10) + "!";

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/users/coach`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionData.session?.access_token}`
                },
                body: JSON.stringify({ ...newCoach, password: autoPassword })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Erreur lors de la création");
            }

            const result = await response.json();
            setLastCreatedCoach({ ...newCoach, password: autoPassword });
            alert("Coach créé avec succès !");
            setNewCoach({ email: '', full_name: '' });
        } catch (err) {
            alert(err.message);
        }
    };

    const handleJoinTeam = async (e) => {
        e.preventDefault();
        if (!joinData.childId || !joinData.code) return;

        try {
            const sanitizedCode = joinData.code.replace(/\s/g, '');
            console.log("[DEBUG] Joining team with code:", sanitizedCode);

            let query = supabase.from('teams').select('id');
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedCode);

            if (isUUID) {
                query = query.or(`invite_code.ilike.${sanitizedCode},id.eq.${sanitizedCode}`);
            } else {
                query = query.ilike('invite_code', sanitizedCode);
            }

            const { data: teamToJoin, error: fetchErr } = await query.maybeSingle();
            if (fetchErr || !teamToJoin) throw new Error("Équipe introuvable avec ce code");

            const { error: joinErr } = await supabase.from('team_members').insert([
                { team_id: teamToJoin.id, player_id: joinData.childId || null, user_id: user.id }
            ]);
            if (joinErr) throw joinErr;

            alert("L'enfant a rejoint l'équipe !");
            setShowJoinModal(false);
            setJoinData({ childId: '', code: '' });
            fetchDashboardData();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleUpdateTeamName = async (teamId) => {
        if (!editingName.trim()) return;
        try {
            const { error } = await supabase
                .from('teams')
                .update({ name: editingName })
                .eq('id', teamId);

            if (error) throw error;

            setAdminTeams(adminTeams.map(t => t.id === teamId ? { ...t, name: editingName } : t));
            setEditingTeamId(null);
        } catch (err) {
            alert("Erreur lors de la modification : " + err.message);
        }
    };

    const handleDeleteTeam = async (teamId) => {
        if (!confirm("VOULEZ-VOUS VRAIMENT SUPPRIMER CETTE ÉQUIPE ?\nCette action est irréversible et supprimera également tous les membres et événements associés.")) return;

        try {
            const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', teamId);

            if (error) throw error;

            setAdminTeams(adminTeams.filter(t => t.id !== teamId));
            alert("Équipe supprimée avec succès.");
        } catch (err) {
            alert("Erreur lors de la suppression : " + err.message);
        }
    };

    if (loading) return <div className="p-10 text-center">Chargement...</div>;

    const isAdmin = profile?.role === 'ADMIN';

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="w-full">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight flex flex-wrap items-center gap-2">
                        <span>Bonjour {team?.playerName || profile?.full_name || user?.email?.split('@')[0]},</span>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full uppercase">
                            {team?.role || profile?.role || 'Joueur'}
                        </span>
                    </h1>
                    <p className="text-gray-500 font-bold mt-1">
                        {team?.teamName ? `Equipe : ${team.teamName}` : 'SOISSONS IFC'}
                    </p>
                </div>

                {!isAdmin && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                        {teams.length > 0 && (
                            <div className="flex flex-col gap-1 flex-1 sm:flex-none">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Changer d'équipe :</label>
                                <select
                                    value={team?.id || ''}
                                    onChange={(e) => handleTeamSwitch(e.target.value)}
                                    className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold py-2 px-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                >
                                    {teams.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex gap-2">
                            {isCoach && (
                                <button
                                    onClick={() => setShowForm(!showForm)}
                                    className="flex-1 bg-indigo-600 text-white p-3 md:p-2 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                    title="Créer une nouvelle équipe"
                                >
                                    <Plus size={20} />
                                    <span className="md:hidden font-bold text-sm">Créer</span>
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (isCoach) {
                                        setShowJoinModal(true);
                                        setJoinData({ ...joinData, childId: null, code: '' });
                                    } else if (children.length === 0) {
                                        alert("Veuillez d'abord ajouter un enfant.");
                                        setShowChildForm(true);
                                    } else {
                                        setShowJoinModal(true);
                                        setJoinData({ ...joinData, childId: children[0].id, code: '' });
                                    }
                                }}
                                className="flex-1 bg-emerald-600 text-white p-3 md:p-2 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                title="Rejoindre une équipe (Code)"
                            >
                                <Users size={20} />
                                <span className="md:hidden font-bold text-sm">Rejoindre</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* View: ADMIN */}
            {isAdmin && (
                <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl space-y-8">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">🛡️ Panneau d'Administration</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Team Management */}
                        <div className="bg-white/10 p-6 rounded-xl border border-white/10">
                            <h3 className="font-bold mb-4 flex items-center gap-2"><Users size={18} /> Gérer les Équipes</h3>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {adminTeams.length === 0 && <p className="text-gray-400 italic text-sm">Aucune équipe créée.</p>}
                                {adminTeams.map(t => (
                                    <div key={t.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex-1 mr-4">
                                            <div className="flex items-center gap-2">
                                                {editingTeamId === t.id ? (
                                                    <input
                                                        type="text"
                                                        className="bg-slate-800 text-white px-2 py-1 rounded border border-indigo-500 outline-none text-sm w-full"
                                                        value={editingName}
                                                        onChange={e => setEditingName(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleUpdateTeamName(t.id)}
                                                        onBlur={() => setEditingTeamId(null)}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <>
                                                        <span className="font-bold text-sm">{t.name}</span>
                                                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono uppercase">
                                                            {t.invite_code}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                Coach: <span className="text-indigo-300">{t.coach?.full_name || 'Non assigné'}</span>
                                            </p>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <button
                                                onClick={() => { setEditingTeamId(t.id); setEditingName(t.name); }}
                                                className="p-1.5 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
                                                title="Modifier le nom"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTeam(t.id)}
                                                className="p-1.5 hover:bg-red-500/20 rounded transition-colors text-gray-400 hover:text-red-400"
                                                title="Supprimer l'équipe"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Coach Creation */}
                        <div className="bg-white/10 p-6 rounded-xl border border-white/10">
                            <h3 className="font-bold mb-4">Créer un nouveau compte Coach</h3>
                            <form onSubmit={handleCreateCoach} className="space-y-4 text-gray-900">
                                <input
                                    type="text" placeholder="Nom complet" required
                                    className="w-full p-2.5 rounded-lg border-0 ring-1 ring-indigo-200 bg-white text-gray-900 focus:ring-2 focus:ring-yellow-400 outline-none"
                                    value={newCoach.full_name} onChange={e => setNewCoach({ ...newCoach, full_name: e.target.value })}
                                />
                                <input
                                    type="email" placeholder="Email du futur coach" required
                                    className="w-full p-2.5 rounded-lg border-0 ring-1 ring-indigo-200 bg-white text-gray-900 focus:ring-2 focus:ring-yellow-400 outline-none"
                                    value={newCoach.email} onChange={e => setNewCoach({ ...newCoach, email: e.target.value })}
                                />
                                <button className="w-full bg-yellow-400 text-black font-bold py-3 rounded-lg hover:bg-yellow-500 transition-colors">
                                    Générer & Créer le compte
                                </button>
                            </form>

                            {lastCreatedCoach && (
                                <div className="mt-6 p-4 bg-emerald-900/50 border border-emerald-500/30 rounded-lg animate-in fade-in zoom-in">
                                    <p className="text-emerald-400 font-bold text-xs uppercase mb-2">Compte créé !</p>
                                    <p className="text-sm">Envoyez ces accès au coach :</p>
                                    <div className="mt-2 bg-black/40 p-3 rounded font-mono text-xs break-all">
                                        Email: {lastCreatedCoach.email}<br />
                                        Pass: {lastCreatedCoach.password}
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2">Le coach peut maintenant se connecter.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-center pt-4 border-t border-white/10">
                        <p className="text-indigo-200 text-sm font-medium italic">
                            "En tant qu'administrateur, vous gérez les coachs et l'ensemble des équipes du club."
                        </p>
                    </div>
                </div>
            )}

            {/* Mes Enfants Section */}
            {/* View: Infos Equipe (Feed) */}
            {team && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <div className="bg-indigo-600 text-white p-2 rounded-lg">
                                <Info size={18} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Infos Équipe</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Actualités du vestiaire</p>
                            </div>
                        </div>
                        {isCoach && (
                            <button
                                onClick={() => setShowPostModal(true)}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                            >
                                <Plus size={14} /> PUBLIER UNE INFO
                            </button>
                        )}
                    </div>

                    <div className="space-y-6">
                        {loadingPosts ? (
                            <div className="py-10 text-center text-gray-400 italic text-sm">Chargement des actus...</div>
                        ) : posts.length === 0 ? (
                            <div className="py-10 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100 italic text-gray-400 text-sm">
                                Aucune info publiée pour le moment.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {posts.map(post => (
                                    <div key={post.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                                        <div className="p-4 flex items-center justify-between border-b border-gray-50 bg-gray-50/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                                    {post.author?.full_name?.[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">{post.author?.full_name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </div>
                                            {post.visibility_type === 'PRIVATE' && (
                                                <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase">Privé 🔒</span>
                                            )}
                                        </div>

                                        <div className="p-5">
                                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                                        </div>

                                        {post.images && post.images.length > 0 && (
                                            <div className={`grid gap-1 px-4 pb-4 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                                                {post.images.map((img, idx) => (
                                                    <div key={idx} className={`relative rounded-xl overflow-hidden bg-gray-100 aspect-video ${post.images.length === 3 && idx === 0 ? 'col-span-2' : ''}`}>
                                                        <img src={img.url} alt={img.caption || ''} className="w-full h-full object-cover" />
                                                        {img.caption && (
                                                            <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-2 text-white text-[10px] font-medium">
                                                                {img.caption}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {isCoach && (
                                            <div className="px-4 py-3 bg-gray-50 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={async () => {
                                                        if (confirm('Supprimer cette publication ?')) {
                                                            const session = await supabase.auth.getSession();
                                                            await fetch(`${import.meta.env.VITE_API_URL || '/api'}/posts/${post.id}`, {
                                                                method: 'DELETE',
                                                                headers: { 'Authorization': `Bearer ${session.data.session?.access_token}` }
                                                            });
                                                            fetchPosts(team.teamId);
                                                        }
                                                    }}
                                                    className="text-gray-400 hover:text-red-500 p-1"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-[9px] text-gray-400 text-center font-bold uppercase tracking-widest opacity-60 italic">
                            Les publications sont automatiquement supprimées après 15 jours.
                        </p>
                    </div>
                </div>
            )}

            {/* View: COACH (Création d'équipe) */}
            {isCoach && (!team || showForm) && (
                <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 p-10 rounded-2xl text-center relative mb-6">
                    {team && (
                        <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <X size={24} />
                        </button>
                    )}
                    <h2 className="text-2xl font-bold text-indigo-900 mb-4">
                        {team ? "Ajouter une nouvelle équipe" : "Initialisez votre équipe éducateur"}
                    </h2>
                    <p className="text-indigo-700/70 mb-8 max-w-lg mx-auto font-medium">
                        Créez une équipe pour une catégorie spécifique (U10, U12, Seniors, etc.).
                    </p>
                    <form onSubmit={createTeam} className="max-w-md mx-auto flex gap-3">
                        <input
                            type="text"
                            className="flex-1 p-3 border-2 border-indigo-100 rounded-xl shadow-sm focus:border-indigo-500 outline-none"
                            placeholder="Nom de l'équipe (ex: U15 Promotion)"
                            value={newTeamName}
                            onChange={e => setNewTeamName(e.target.value)}
                        />
                        <button disabled={loadingTeam} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                            {loadingTeam ? '...' : 'Créer'}
                        </button>
                    </form>
                </div>
            )}

            {/* View: PLAYER (Sans équipe) */}
            {!isAdmin && !isCoach && !team && (
                <div className="bg-emerald-50 border-2 border-dashed border-emerald-200 p-10 rounded-2xl text-center mb-6">
                    <h2 className="text-2xl font-bold text-emerald-900 mb-4">Rejoignez votre équipe</h2>
                    <p className="text-emerald-700/70 mb-8 max-w-lg mx-auto font-medium">Demandez le code d'invitation à votre coach pour rejoindre l'équipe et recevoir vos convocations.</p>
                    <button
                        onClick={() => {
                            if (children.length === 0) {
                                alert("Veuillez d'abord ajouter un enfant.");
                                setShowChildForm(true);
                            } else {
                                setShowJoinModal(true);
                                setJoinData({ ...joinData, childId: children[0].id, code: '' });
                            }
                        }}
                        className="bg-emerald-600 text-white px-10 py-4 rounded-xl font-black hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all active:scale-95"
                    >
                        ENTRER LE CODE ÉQUIPE
                    </button>
                </div>
            )}

            {/* Stats & Next Match (Coach & Players with team) */}
            {team && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {isCoach && <Stats teamId={team.teamId} />}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-24 md:pb-0">
                        {/* Next Match Card */}
                        <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">⚽</div>
                            <h2 className="font-bold text-lg mb-4 opacity-80 uppercase tracking-widest text-xs">Prochain Rendez-vous</h2>
                            {nextEvent ? (
                                <div className="space-y-1">
                                    <p className="text-3xl font-black">{new Date(nextEvent.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
                                    <p className="text-lg font-medium opacity-90">{new Date(nextEvent.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="bg-white/20 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-tighter">
                                            {nextEvent.type === 'MATCH' ? 'Match' : 'Entraînement'}
                                        </span>
                                        {nextEvent.location && <span className="bg-indigo-400 px-2.5 py-1 rounded-lg text-xs font-bold truncate max-w-[150px]">📍 {nextEvent.location}</span>}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xl font-bold opacity-60 italic py-4">Aucun événement à venir...</p>
                            )}
                        </div>

                        {/* Team Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                                <h2 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-4">Équipe Active</h2>
                                <p className="text-2xl font-bold text-indigo-900">{team.teamName}</p>
                                {team.playerName && <p className="text-sm font-bold text-emerald-600 mt-1">Profil: {team.playerName}</p>}
                                {team.inviteCode && <p className="text-xs font-bold text-gray-500 mt-2 bg-gray-100 inline-block px-2 py-1 rounded">Code: {team.inviteCode}</p>}
                            </div>
                            <button onClick={() => window.location.href = '/dashboard/team'} className="text-indigo-600 font-bold text-sm hover:underline mt-6 flex items-center gap-1">
                                {isCoach ? 'Gérer l\'effectif' : 'Voir les coéquipiers'} &rarr;
                            </button>
                        </div>

                        {/* Team Chat / News Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                                <h2 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-4">Communication</h2>
                                <p className="text-gray-700 font-medium">Venez discuter avec l'équipe et organiser les covoiturages directement sur le chat.</p>
                            </div>
                            <button onClick={() => window.location.href = '/dashboard/chat'} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-center font-bold text-sm hover:bg-indigo-600 hover:text-white transition-all mt-6 relative group/chat">
                                Ouvrir le Vestiaire 🏟️
                                {unreadCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mes Enfants Section (MOVED TO BOTTOM) */}
            {!isAdmin && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-20 overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg">
                                <Users size={16} />
                            </div>
                            <h2 className="text-lg font-bold text-gray-800">Mes Enfants</h2>
                        </div>
                        <button
                            onClick={() => setShowChildForm(!showChildForm)}
                            className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                        >
                            <Plus size={12} /> Ajouter un enfant
                        </button>
                    </div>

                    {showChildForm && (
                        <form onSubmit={handleAddChild} className="bg-indigo-50 p-4 rounded-xl mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input
                                placeholder="Prénom" className="p-2 rounded border" required
                                value={newChild.first_name} onChange={e => setNewChild({ ...newChild, first_name: e.target.value })}
                            />
                            <input
                                placeholder="Nom" className="p-2 rounded border" required
                                value={newChild.last_name} onChange={e => setNewChild({ ...newChild, last_name: e.target.value })}
                            />
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 p-2 rounded border font-medium"
                                    value={newChild.position}
                                    onChange={e => setNewChild({ ...newChild, position: e.target.value })}
                                >
                                    <option value="Gardien">Gardien</option>
                                    <option value="Défenseur">Défenseur</option>
                                    <option value="Milieu">Milieu</option>
                                    <option value="Attaquant">Attaquant</option>
                                    <option value="Remplaçant">Remplaçant</option>
                                </select>
                                <button className="bg-indigo-600 text-white px-4 rounded font-bold">OK</button>
                            </div>
                        </form>
                    )}

                    {children.length === 0 ? (
                        <p className="text-gray-400 italic text-sm">Aucun profil d'enfant configuré.</p>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {children.map(child => (
                                <div key={child.id} className="bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
                                        {child.first_name?.[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{child.first_name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">{child.position || 'Joueur'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Rejoindre une équipe */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
                            <h2 className="font-bold flex items-center gap-2 underline underline-offset-4 decoration-emerald-200"><Users size={18} /> Rejoindre une Équipe</h2>
                            <button onClick={() => setShowJoinModal(false)} className="hover:bg-white/10 p-1 rounded-lg"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleJoinTeam} className="p-6 space-y-4">
                            {!isCoach && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Choisir l'enfant</label>
                                    <select
                                        className="w-full border-2 border-gray-100 rounded-lg p-3 focus:border-emerald-500 focus:outline-none bg-gray-50 font-bold"
                                        value={joinData.childId}
                                        onChange={e => setJoinData({ ...joinData, childId: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Sélectionner un profil --</option>
                                        {children.map(c => (
                                            <option key={c.id} value={c.id}>{c.full_name} ({c.position})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Code d'invitation</label>
                                <input
                                    type="text" required
                                    className="w-full border-2 border-gray-100 rounded-lg p-3 focus:border-emerald-500 focus:outline-none bg-gray-50 font-mono font-bold text-lg text-emerald-700"
                                    placeholder="Ex: AB1234"
                                    value={joinData.code}
                                    onChange={e => setJoinData({ ...joinData, code: e.target.value.replace(/\s/g, '') })}
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 active:scale-95 transition-all mt-4"
                            >
                                Valider l'inscription
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Publish Post */}
            {showPostModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">Publier une Info</h3>
                                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest">Flux d'actualité de l'équipe</p>
                            </div>
                            <button onClick={() => setShowPostModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                            {/* Content */}
                            <textarea
                                className="w-full h-32 p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 focus:outline-none font-medium text-gray-700 resize-none transition-all"
                                placeholder="De quoi voulez-vous informer l'équipe ?"
                                value={newPost.content}
                                onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                            ></textarea>

                            {/* Images */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black uppercase text-gray-400 tracking-widest">Photos (Max 3)</label>
                                    {newPost.images.length < 3 && (
                                        <label className="cursor-pointer bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black hover:bg-indigo-100 transition-colors flex items-center gap-1">
                                            <Plus size={12} /> AJOUTER
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    try {
                                                        setUploadingImage(true);
                                                        const fileExt = file.name.split('.').pop();
                                                        const fileName = `${Math.random()}.${fileExt}`;
                                                        const filePath = `posts/${team.teamId}/${fileName}`;
                                                        await supabase.storage.from('chat_attachments').upload(filePath, file);
                                                        const { data: { publicUrl } } = supabase.storage.from('chat_attachments').getPublicUrl(filePath);
                                                        setNewPost(prev => ({
                                                            ...prev,
                                                            images: [...prev.images, { url: publicUrl, caption: '' }]
                                                        }));
                                                    } finally {
                                                        setUploadingImage(false);
                                                    }
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {newPost.images.map((img, idx) => (
                                        <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square shadow-sm bg-gray-100">
                                            <img src={img.url} className="w-full h-full object-cover" />
                                            <input
                                                className="absolute bottom-0 inset-x-0 bg-black/50 p-1 text-[8px] text-white focus:outline-none"
                                                placeholder="Légende..."
                                                value={img.caption}
                                                onChange={e => {
                                                    const imgs = [...newPost.images];
                                                    imgs[idx].caption = e.target.value;
                                                    setNewPost({ ...newPost, images: imgs });
                                                }}
                                            />
                                            <button
                                                onClick={() => setNewPost(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {uploadingImage && (
                                        <div className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center animate-pulse">
                                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Visibility */}
                            <div className="space-y-3">
                                <label className="text-xs font-black uppercase text-gray-400 tracking-widest">Visibilité</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setNewPost({ ...newPost, visibility_type: 'PUBLIC' })}
                                        className={`p-3 rounded-2xl border-2 font-bold text-sm transition-all ${newPost.visibility_type === 'PUBLIC' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md' : 'border-gray-100 text-gray-400'}`}
                                    >
                                        🌍 Toute l'équipe
                                    </button>
                                    <button
                                        onClick={() => setNewPost({ ...newPost, visibility_type: 'PRIVATE' })}
                                        className={`p-3 rounded-2xl border-2 font-bold text-sm transition-all ${newPost.visibility_type === 'PRIVATE' ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md' : 'border-gray-100 text-gray-400'}`}
                                    >
                                        🔒 Joueurs spécifiques
                                    </button>
                                </div>
                            </div>

                            {/* Targeted Players */}
                            {newPost.visibility_type === 'PRIVATE' && (
                                <div className="space-y-2 animate-in slide-in-from-top-2">
                                    <label className="text-xs font-black uppercase text-gray-400 tracking-widest">Sélectionnez les joueurs</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {teamMembers.map(player => (
                                            <label
                                                key={player.id}
                                                className={`flex items-center gap-2 p-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all ${newPost.recipient_ids.includes(player.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-100'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={newPost.recipient_ids.includes(player.id)}
                                                    onChange={e => {
                                                        const ids = e.target.checked
                                                            ? [...newPost.recipient_ids, player.id]
                                                            : newPost.recipient_ids.filter(id => id !== player.id);
                                                        setNewPost({ ...newPost, recipient_ids: ids });
                                                    }}
                                                />
                                                {player.full_name}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
                            <button
                                onClick={async () => {
                                    if (!newPost.content && newPost.images.length === 0) return;
                                    try {
                                        const session = await supabase.auth.getSession();
                                        const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/posts`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${session.data.session?.access_token}`
                                            },
                                            body: JSON.stringify({
                                                ...newPost,
                                                team_id: team.teamId
                                            })
                                        });
                                        if (!res.ok) throw new Error('Erreur publication');

                                        setShowPostModal(false);
                                        setNewPost({ content: '', images: [], visibility_type: 'PUBLIC', recipient_ids: [] });
                                        fetchPosts(team.teamId);
                                    } catch (err) { alert(err.message); }
                                }}
                                className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                            >
                                <Send size={20} /> PUBLIER L'INFORMATION
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
