import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Stats from '../components/Stats';
import { Plus, X, Users } from 'lucide-react';

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

    const [children, setChildren] = useState([]);
    const [showChildForm, setShowChildForm] = useState(false);
    const [newChild, setNewChild] = useState({ first_name: '', last_name: '', position: 'Attaquant' });
    const [joiningTeam, setJoiningTeam] = useState(null); // { childId, inviteCode }
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinData, setJoinData] = useState({ childId: '', code: '' });

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
                if (ownedTeams) allMyTeams = [...ownedTeams];

                // 2. Fetch teams for each child
                if (childrenData && childrenData.length > 0) {
                    const childIds = childrenData.map(c => c.id);
                    const { data: memberships } = await supabase
                        .from('team_members')
                        .select('team_id, teams(*)')
                        .in('player_id', childIds);

                    if (memberships) {
                        const joinedTeams = memberships.map(m => m.teams).filter(Boolean);
                        joinedTeams.forEach(jt => {
                            if (!allMyTeams.find(t => t.id === jt.id)) allMyTeams.push(jt);
                        });
                    }
                }

                setTeams(allMyTeams);

                // Determine Active Team
                if (allMyTeams.length > 0) {
                    const savedTeamId = localStorage.getItem('active_team_id');
                    const activeTeam = allMyTeams.find(t => t.id === savedTeamId) || allMyTeams[0];
                    if (activeTeam) {
                        localStorage.setItem('active_team_id', activeTeam.id);
                        setTeam(activeTeam);
                    }
                }

                // Fetch Next Event (Dependent on Active Team)
                if (allMyTeams.length > 0) {
                    const currentActive = allMyTeams.find(t => t.id === localStorage.getItem('active_team_id')) || allMyTeams[0];
                    if (currentActive) {
                        const { data: event } = await supabase
                            .from('events')
                            .select('*')
                            .eq('team_id', currentActive.id)
                            .gte('date', new Date().toISOString())
                            .order('date', { ascending: true })
                            .limit(1)
                            .maybeSingle();
                        setNextEvent(event);
                    }
                }
            }
        } catch (error) {
            console.error("Dashboard error:", error);
        } finally {
            setLoading(false);
        }
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

    const handleTeamSwitch = (teamId) => {
        const selected = teams.find(t => t.id === teamId);
        if (selected) {
            setTeam(selected);
            localStorage.setItem('active_team_id', selected.id);
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
            const { data, error } = await supabase.from('teams').insert([
                { name: newTeamName, coach_id: user.id }
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
            const { data: teamToJoin, error: fetchErr } = await supabase.from('teams').select('id').eq('invite_code', joinData.code.trim()).single();
            if (fetchErr) throw new Error("Code invalide ou équipe introuvable");

            const { error: joinErr } = await supabase.from('team_members').insert([
                { team_id: teamToJoin.id, player_id: joinData.childId }
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

    if (loading) return <div className="p-10 text-center">Chargement...</div>;

    const isAdmin = profile?.role === 'ADMIN';

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
                        Bonjour, {profile?.full_name || user?.email?.split('@')[0]} 👋
                        <span className="ml-3 text-xs font-black px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full uppercase">
                            {profile?.role || 'Joueur'}
                        </span>
                    </h1>
                    <p className="text-gray-500 font-medium">SOISSONS IFC — Espace {isAdmin ? 'Administration' : 'Sportif'}</p>
                </div>

                {!isAdmin && (
                    <div className="flex items-center gap-2">
                        {teams.length > 1 && (
                            <>
                                <label className="text-xs font-bold text-gray-500 uppercase">Équipe :</label>
                                <select
                                    value={team?.id || ''}
                                    onChange={(e) => handleTeamSwitch(e.target.value)}
                                    className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold py-2 px-4 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {teams.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} {t.category ? `(${t.category})` : ''}</option>
                                    ))}
                                </select>
                            </>
                        )}

                        <div className="flex gap-1">
                            {isCoach && (
                                <button
                                    onClick={() => setShowForm(!showForm)}
                                    className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
                                    title="Créer une nouvelle équipe"
                                >
                                    <Plus size={20} />
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (children.length === 0) {
                                        alert("Veuillez d'abord ajouter un enfant.");
                                        setShowChildForm(true);
                                    } else {
                                        setShowJoinModal(true);
                                        setJoinData({ ...joinData, childId: children[0].id });
                                    }
                                }}
                                className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 transition-colors"
                                title="Rejoindre une équipe (Code)"
                            >
                                <Users size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* View: ADMIN */}
            {isAdmin && (
                <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">🛡️ Panneau d'Administration</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                        <div className="flex flex-col justify-center text-center p-6 border-l border-white/10">
                            <p className="text-indigo-200 mb-4 font-medium italic">"En tant qu'administrateur, vous créez les comptes pour les éducateurs du club. Ils pourront ensuite créer leurs équipes respectives."</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Mes Enfants Section */}
            {!isAdmin && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            👨‍👩‍👧‍👦 Mes Enfants
                        </h2>
                        <button
                            onClick={() => setShowChildForm(!showChildForm)}
                            className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                            <Plus size={14} /> Ajouter un enfant
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
                                        <p className="text-sm font-bold text-gray-800">{child.full_name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">{child.position || 'Joueur'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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
                    {isCoach && <Stats teamId={team.id} />}

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
                                <p className="text-2xl font-bold text-indigo-900">{team.name}</p>
                                <p className="text-xs font-bold text-gray-500 mt-2 bg-gray-100 inline-block px-2 py-1 rounded">Code: {team.invite_code}</p>
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
                            <button onClick={() => window.location.href = '/dashboard/chat'} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-center font-bold text-sm hover:bg-indigo-600 hover:text-white transition-all mt-6">
                                Ouvrir le Vestiaire 🏟️
                            </button>
                        </div>
                    </div>
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
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Choisir l'enfant</label>
                                <select
                                    className="w-full border-2 border-gray-100 rounded-lg p-3 focus:border-emerald-500 focus:outline-none bg-gray-50 font-bold"
                                    value={joinData.childId}
                                    onChange={e => setJoinData({ ...joinData, childId: e.target.value })}
                                    required
                                >
                                    {children.map(c => (
                                        <option key={c.id} value={c.id}>{c.full_name} ({c.position})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Code d'invitation</label>
                                <input
                                    type="text" required
                                    className="w-full border-2 border-gray-100 rounded-lg p-3 focus:border-emerald-500 focus:outline-none bg-gray-50 font-mono font-bold text-lg text-emerald-700"
                                    placeholder="Ex: AB1234"
                                    value={joinData.code}
                                    onChange={e => setJoinData({ ...joinData, code: e.target.value.toUpperCase() })}
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
        </div>
    );
}
