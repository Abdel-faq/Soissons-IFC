import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Stats from '../components/Stats';

export default function Dashboard() {
    const [newTeamName, setNewTeamName] = useState('');
    const [loadingTeam, setLoadingTeam] = useState(false);
    const [nextEvent, setNextEvent] = useState(null);
    const [team, setTeam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isCoach, setIsCoach] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [newCoach, setNewCoach] = useState({ email: '', password: '', full_name: '' });

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

                // Fetch Team based on role
                let myTeam = null;
                if (userRole === 'COACH') {
                    const { data } = await supabase.from('teams').select('*').eq('coach_id', user.id).maybeSingle();
                    myTeam = data;
                } else if (userRole === 'PLAYER') {
                    const { data: memberShip } = await supabase.from('team_members').select('team_id, teams(*)').eq('user_id', user.id).maybeSingle();
                    if (memberShip) myTeam = memberShip.teams;
                }
                setTeam(myTeam);

                // Fetch Next Event
                if (myTeam) {
                    const { data: event } = await supabase
                        .from('events')
                        .select('*')
                        .eq('team_id', myTeam.id)
                        .gte('date', new Date().toISOString())
                        .order('date', { ascending: true })
                        .limit(1)
                        .maybeSingle();
                    setNextEvent(event);
                }
            }
        } catch (error) {
            console.error("Dashboard error:", error);
        } finally {
            setLoading(false);
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
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/users/coach`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionData.session?.access_token}`
                },
                body: JSON.stringify(newCoach)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Erreur lors de la création");
            }

            alert("Coach créé avec succès !");
            setNewCoach({ email: '', password: '', full_name: '' });
        } catch (err) {
            alert(err.message);
        }
    };

    const joinTeam = async (e) => {
        e.preventDefault();
        const code = prompt("Entrez le code d'invitation de l'équipe :");
        if (!code) return;

        try {
            const { data: teamToJoin, error: fetchErr } = await supabase.from('teams').select('id').eq('invite_code', code).single();
            if (fetchErr) throw new Error("Code invalide ou équipe introuvable");

            const { error: joinErr } = await supabase.from('team_members').insert([
                { team_id: teamToJoin.id, user_id: user.id }
            ]);
            if (joinErr) throw joinErr;

            alert("Vous avez rejoint l'équipe !");
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
                                    className="w-full p-2.5 rounded-lg border-0 ring-1 ring-white/20"
                                    value={newCoach.full_name} onChange={e => setNewCoach({ ...newCoach, full_name: e.target.value })}
                                />
                                <input
                                    type="email" placeholder="Email" required
                                    className="w-full p-2.5 rounded-lg border-0 ring-1 ring-white/20"
                                    value={newCoach.email} onChange={e => setNewCoach({ ...newCoach, email: e.target.value })}
                                />
                                <input
                                    type="password" placeholder="Mot de passe temporaire" required
                                    className="w-full p-2.5 rounded-lg border-0 ring-1 ring-white/20"
                                    value={newCoach.password} onChange={e => setNewCoach({ ...newCoach, password: e.target.value })}
                                />
                                <button className="w-full bg-yellow-400 text-black font-bold py-3 rounded-lg hover:bg-yellow-500 transition-colors">
                                    Enregistrer le Coach
                                </button>
                            </form>
                        </div>
                        <div className="flex flex-col justify-center text-center p-6 border-l border-white/10">
                            <p className="text-indigo-200 mb-4 font-medium italic">"En tant qu'administrateur, vous créez les comptes pour les éducateurs du club. Ils pourront ensuite créer leurs équipes respectives."</p>
                        </div>
                    </div>
                </div>
            )}

            {/* View: COACH (Sans équipe) */}
            {isCoach && !team && (
                <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 p-10 rounded-2xl text-center">
                    <h2 className="text-2xl font-bold text-indigo-900 mb-4">Initialisez votre équipe éducateur</h2>
                    <p className="text-indigo-700/70 mb-8 max-w-lg mx-auto font-medium">Vous êtes enregistré comme coach. Créez votre équipe pour commencer à organiser vos matches et convocations.</p>
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
                <div className="bg-emerald-50 border-2 border-dashed border-emerald-200 p-10 rounded-2xl text-center">
                    <h2 className="text-2xl font-bold text-emerald-900 mb-4">Rejoignez votre équipe</h2>
                    <p className="text-emerald-700/70 mb-8 max-w-lg mx-auto font-medium">Demandez le code d'invitation à votre coach pour rejoindre l'équipe et recevoir vos convocations.</p>
                    <button onClick={joinTeam} className="bg-emerald-600 text-white px-10 py-4 rounded-xl font-black hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all active:scale-95">
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
        </div>
    );
}
