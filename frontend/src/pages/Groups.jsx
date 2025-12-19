import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Layers, Plus, Users, Trash2, UserPlus, X, ShieldCheck } from 'lucide-react';

export default function Groups() {
    const [groups, setGroups] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [team, setTeam] = useState(null);
    const [isCoach, setIsCoach] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [addingMembers, setAddingMembers] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            setUser(currentUser);

            let myTeamId = null;
            let coachStatus = false;

            const { data: ownedTeam } = await supabase.from('teams').select('id').eq('coach_id', currentUser.id).maybeSingle();
            if (ownedTeam) {
                myTeamId = ownedTeam.id;
                coachStatus = true;
            } else {
                const { data: membership } = await supabase.from('team_members').select('team_id').eq('user_id', currentUser.id).maybeSingle();
                if (membership) myTeamId = membership.team_id;

                const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
                coachStatus = profile?.role === 'COACH';
            }

            setTeam(myTeamId);
            setIsCoach(coachStatus);

            if (myTeamId) {
                await fetchGroups(myTeamId);
                await fetchTeamMembers(myTeamId);
            }
        } catch (error) {
            console.error("Error fetching groups data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async (teamId) => {
        const { data, error } = await supabase
            .from('custom_groups')
            .select(`
                *,
                group_members (
                    user_id,
                    profiles ( id, full_name, role, avatar_url )
                )
            `)
            .eq('team_id', teamId);

        if (error) console.error("Groups Error:", error);
        else setGroups(data || []);
    };

    const fetchTeamMembers = async (teamId) => {
        const { data } = await supabase
            .from('team_members')
            .select('user_id, profiles(id, full_name, role)')
            .eq('team_id', teamId);

        if (data) setMembers(data.map(d => d.profiles).filter(Boolean));
    };

    const createGroup = async () => {
        if (!newGroupName.trim() || !team) return;
        try {
            const { data, error } = await supabase
                .from('custom_groups')
                .insert({ team_id: team, name: newGroupName.trim() })
                .select()
                .single();

            if (error) throw error;
            setNewGroupName('');
            setShowCreateModal(false);
            fetchGroups(team);
        } catch (error) {
            alert("Erreur: " + error.message);
        }
    };

    const deleteGroup = async (id) => {
        if (!confirm("Supprimer ce groupe ?")) return;
        try {
            const { error } = await supabase.from('custom_groups').delete().eq('id', id);
            if (error) throw error;
            fetchGroups(team);
        } catch (error) {
            alert("Erreur: " + error.message);
        }
    };

    const toggleMember = async (groupId, userId, isIncluded) => {
        try {
            if (isIncluded) {
                await supabase.from('group_members').delete().match({ group_id: groupId, user_id: userId });
            } else {
                await supabase.from('group_members').insert({ group_id: groupId, user_id: userId });
            }
            fetchGroups(team);
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="p-10 text-center">Chargement...</div>;
    if (!isCoach) return <div className="p-10 text-center text-gray-500">Seuls les coachs peuvent gérer les groupes.</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-indigo-50">
                <div>
                    <h1 className="text-2xl font-black text-indigo-900 flex items-center gap-2">
                        <Layers className="text-indigo-600" /> Groupes Personnalisés
                    </h1>
                    <p className="text-gray-500 text-sm font-medium">Créez des groupes pour les entraînements spécifiques ou convocations</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                >
                    <Plus size={20} /> Nouveau Groupe
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {groups.length === 0 && (
                    <div className="md:col-span-2 text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-100">
                        <Layers className="mx-auto text-gray-200 mb-4" size={48} />
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Aucun groupe créé</p>
                    </div>
                )}
                {groups.map(group => (
                    <div key={group.id} className="bg-white rounded-2xl border-2 border-gray-50 shadow-sm overflow-hidden flex flex-col hover:border-indigo-100 transition-all group">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="font-black text-lg text-gray-800">{group.name}</h3>
                                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                                    <Users size={12} /> {group.group_members?.length || 0} membres
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setSelectedGroupId(group.id); setAddingMembers(true); }}
                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Gérer les membres"
                                >
                                    <UserPlus size={18} />
                                </button>
                                <button
                                    onClick={() => deleteGroup(group.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="p-5 flex-1 max-h-48 overflow-y-auto bg-white grid grid-cols-1 gap-2">
                            {group.group_members?.length === 0 ? (
                                <p className="text-center text-xs text-gray-400 italic py-4">Groupe vide</p>
                            ) : (
                                group.group_members.map(m => (
                                    <div key={m.user_id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-transparent hover:border-indigo-100 group/item">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-indigo-100 text-indigo-700 flex items-center justify-center rounded-full text-[10px] font-black">
                                                {m.profiles?.full_name?.[0]}
                                            </div>
                                            <span className="text-xs font-bold text-gray-700">{m.profiles?.full_name}</span>
                                            {m.profiles?.role === 'COACH' && <ShieldCheck size={12} className="text-indigo-600" />}
                                        </div>
                                        <button
                                            onClick={() => toggleMember(group.id, m.user_id, true)}
                                            className="opacity-0 group-hover/item:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de création */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 fade-in duration-200">
                        <h2 className="text-2xl font-black text-gray-900 mb-2">✨ Créer un groupe</h2>
                        <p className="text-gray-500 text-sm mb-6">Donnez un nom clair à votre groupe (ex: Les Attaquants, Spécifique Gardiens...)</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Nom du groupe</label>
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-indigo-600 focus:outline-none bg-gray-50 font-bold"
                                    placeholder="Ex: Groupe Elite U18"
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={createGroup}
                                    className="flex-2 px-10 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                                >
                                    Créer le groupe
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal d'ajout de membres */}
            {addingMembers && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-8 max-h-[90vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">👥 Gérer les membres</h2>
                                <p className="text-gray-500 text-sm">Sélectionnez les joueurs à inclure dans le groupe</p>
                            </div>
                            <button onClick={() => setAddingMembers(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {members.map(member => {
                                const currentGroup = groups.find(g => g.id === selectedGroupId);
                                const isIncluded = currentGroup?.group_members?.some(m => m.user_id === member.id);
                                return (
                                    <button
                                        key={member.id}
                                        onClick={() => toggleMember(selectedGroupId, member.id, isIncluded)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${isIncluded
                                                ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-100'
                                                : 'border-gray-50 bg-white hover:border-indigo-200'
                                            }`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                                            {member.full_name?.[0]}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-gray-800">{member.full_name}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{member.role}</p>
                                        </div>
                                        {isIncluded && <ShieldCheck size={16} className="text-indigo-600" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-8 pt-6 border-t flex justify-end">
                            <button
                                onClick={() => setAddingMembers(false)}
                                className="px-10 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                            >
                                Terminer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
