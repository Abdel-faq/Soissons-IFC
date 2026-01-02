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

            // Fetch Profile
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
            setProfile(profileData);

            // Fetch Teams (Coach)
            let { data: myTeams, error: teamError } = await supabase
                .from('teams')
                .select('*')
                .eq('coach_id', currentUser.id);

            if (teamError) throw teamError;

            // If no owned teams, check membership
            if (!myTeams || myTeams.length === 0) {
                const { data: membership } = await supabase
                    .from('team_members')
                    .select('team_id, teams(*)')
                    .eq('user_id', currentUser.id)
                    .maybeSingle();

                if (membership && membership.teams) {
                    myTeams = [membership.teams];
                }
            }

            setTeams(myTeams || []);
            if (myTeams && myTeams.length > 0) {
                setTeam(myTeams[0]); // Select first by default
                fetchMembers(myTeams[0].id);
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
            .select('user_id, profiles(full_name, role, position)')
            .eq('team_id', teamId);
        if (!error) setMembers(teamMembers || []);
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
        if (!joinCode.trim()) return;
        try {
            // Ensure Profile Exists
            const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
            if (!profile) {
                const { error: createProfileError } = await supabase.from('profiles').insert([
                    { id: user.id, email: user.email, full_name: user.email?.split('@')[0] || 'Joueur', role: 'PLAYER' }
                ]);
                if (createProfileError) throw new Error("Erreur création profil: " + createProfileError.message);
            }

            const { data: teamToJoin, error: searchError } = await supabase.from('teams').select('id, name').eq('invite_code', joinCode.trim().toUpperCase()).single();
            if (searchError || !teamToJoin) throw new Error("Équipe introuvable");

            const { error: joinError } = await supabase.from('team_members').insert([{ team_id: teamToJoin.id, user_id: user.id }]);
            if (joinError) throw joinError;

            alert(`Bienvenue dans ${teamToJoin.name} !`);
            window.location.reload();
        } catch (err) { alert(err.message); }
    };

    // RENDER LOGIC
    if (loading) return <div className="p-10 text-center text-gray-500">Chargement des données...</div>;

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
        const isCoach = profile?.role === 'COACH';
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
                        <input type="text" className="w-full border p-2 rounded mb-2 uppercase" placeholder="CODE INVITATION" value={joinCode} onChange={e => setJoinCode(e.target.value)} required />
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
                            onClick={() => { setTeam(t); fetchMembers(t.id); }}
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
                    <p className="text-gray-500 text-sm">Code d'invitation: <span className="font-mono bg-gray-100 px-2 py-1 rounded select-all">{team.invite_code}</span></p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(team.invite_code); alert('Copié !') }} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded"><Copy /></button>
            </div>

            <div className="bg-white rounded shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-gray-50 font-semibold flex gap-2 items-center"><Users size={18} /> Membres ({members.length})</div>
                <ul>
                    {members.length === 0 && <li className="p-4 text-gray-400 italic">Aucun membre (à part vous)</li>}
                    {members.map(m => (
                        <li key={m.user_id} className="p-4 border-b last:border-0 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
                                    {m.profiles?.full_name?.[0] || '?'}
                                </div>
                                <span>{m.profiles?.full_name || 'Utilisateur'} <span className="text-xs text-gray-400">({m.profiles?.role || 'Membre'}) {m.profiles?.position && `- ${m.profiles.position}`}</span></span>
                            </div>
                            {user?.id === team.coach_id && user?.id !== m.user_id && (
                                <button
                                    onClick={async () => {
                                        if (confirm('Supprimer ce joueur de l\'équipe ?')) {
                                            const { error } = await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', m.user_id);
                                            if (!error) fetchMembers(team.id);
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
        </div>
    );
}
