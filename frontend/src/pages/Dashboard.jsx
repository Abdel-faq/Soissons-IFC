
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

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
                setProfile(profile);

                // Fetch Team
                let { data: myTeam } = await supabase.from('teams').select('*').eq('coach_id', user.id).maybeSingle();
                if (myTeam) {
                    setIsCoach(true);
                } else {
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
        setLoadingTeam(true);

        try {
            const { data, error } = await supabase.from('teams').insert([
                { name: newTeamName, coach_id: user.id }
            ]).select().single();

            if (error) throw error;

            alert("Équipe créée !");
            setTeam(data); // Update local state directly
            setIsCoach(true); // User is now a coach of this new team
        } catch (err) {
            alert("Erreur création équipe: " + err.message);
        } finally {
            setLoadingTeam(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Chargement...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Bonjour, {profile?.full_name || user?.email?.split('@')[0] || 'Coach'} 👋</h1>
                    <p className="text-gray-600">Prêt pour le prochain match ?</p>
                </div>
            </div>

            {/* Render Stats component if user is a coach and has a team */}
            {isCoach && team && <Stats teamId={team.id} />}

            {!team && (
                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-lg text-center">
                    <h2 className="text-xl font-bold text-indigo-900 mb-2">Bienvenue ! Pour commencer, créez votre équipe.</h2>
                    <form onSubmit={createTeam} className="max-w-md mx-auto flex gap-2 mt-4">
                        <input
                            type="text"
                            className="flex-1 p-2 border rounded shadow-sm"
                            placeholder="Nom de l'équipe (ex: FC React)"
                            value={newTeamName}
                            onChange={e => setNewTeamName(e.target.value)}
                        />
                        <button disabled={loadingTeam} className="bg-indigo-600 text-white px-4 py-2 rounded font-medium hover:bg-indigo-700">
                            {loadingTeam ? '...' : 'Créer'}
                        </button>
                    </form>
                </div>
            )}

            {team && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-20 md:pb-0">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-5 rounded-lg shadow-sm">
                        <h2 className="font-semibold text-lg mb-1 opacity-90">Prochain Match</h2>
                        {nextEvent ? (
                            <>
                                <p className="text-2xl font-bold">
                                    {new Date(nextEvent.date).toLocaleDateString()}
                                </p>
                                <p className="text-sm opacity-90 mt-1">
                                    {new Date(nextEvent.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="text-sm font-medium mt-2 bg-white/20 inline-block px-2 py-1 rounded">
                                    {nextEvent.type === 'MATCH' ? 'Match' : 'Entraînement'}
                                </p>
                                {nextEvent.location && <p className="text-xs mt-2 opacity-75 truncate">{nextEvent.location}</p>}
                            </>
                        ) : (
                            <>
                                <p className="text-2xl font-bold">-- / --</p>
                                <p className="text-sm opacity-75 mt-2">Aucun événement prévu</p>
                            </>
                        )}
                    </div>

                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div>
                            <h2 className="font-semibold text-lg mb-2 text-gray-700">Mon Équipe</h2>
                            <p className="text-gray-500 text-sm">Gérez votre effectif</p>
                        </div>
                        <button onClick={() => window.location.href = '/dashboard/team'} className="text-indigo-600 font-medium text-sm hover:underline mt-4 text-left">
                            Voir l'effectif &rarr;
                        </button>
                    </div>

                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div>
                            <h2 className="font-semibold text-lg mb-2 text-gray-700">Covoiturage</h2>
                            <p className="text-gray-500 text-sm">Organisez les trajets</p>
                        </div>
                        <div className="mt-4 text-indigo-600 font-medium text-xs">
                            Équipe: {team.name}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
