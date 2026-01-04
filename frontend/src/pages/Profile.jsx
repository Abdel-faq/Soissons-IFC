import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Save, Phone, Mail, Camera } from 'lucide-react';

export default function Profile() {
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [profile, setProfile] = useState({
        id: '',
        full_name: '',
        email: '',
        role: '',
        phone: '', // We might need to add this column if it doesn't exist, checking schema... schema.sql didn't have phone, let's stick to standard fields first or add it.
        // Schema checks: profiles table has: id, email, full_name, role, avatar_url. 
        // Let's add phone naturally to the state, but if it fails to save, we know why. 
        // Actually, let's assume we stick to full_name and avatar_url for now, and maybe role display.
        avatar_url: ''
    });

    useEffect(() => {
        getProfile();
    }, []);

    const getProfile = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            // Context handling
            const savedCtx = localStorage.getItem('sb-active-context');
            let context = null;
            if (savedCtx) {
                try {
                    context = JSON.parse(savedCtx);
                } catch (e) { console.error("Stale context", e); }
            }

            if (user) {
                if (context && context.playerId) {
                    // Fetch Child Profile
                    const { data, error } = await supabase
                        .from('players')
                        .select('*')
                        .eq('id', context.playerId)
                        .single();

                    if (error) throw error;
                    if (data) {
                        setProfile({
                            id: data.id,
                            full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                            first_name: data.first_name,
                            last_name: data.last_name,
                            email: user.email, // Child doesn't have email, show parent's
                            role: 'PLAYER',
                            position: data.position,
                            avatar_url: data.avatar_url || ''
                        });
                    }
                } else {
                    // Fetch Parent/Coach Profile
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();

                    if (error && error.code !== 'PGRST116') throw error;
                    if (data) {
                        setProfile({ ...data, email: user.email });
                    }
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async (e) => {
        e.preventDefault();

        try {
            setUpdating(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            const savedCtx = localStorage.getItem('sb-active-context');
            let context = null;
            if (savedCtx) {
                try {
                    context = JSON.parse(savedCtx);
                } catch (e) { }
            }

            if (context && context.playerId) {
                // Update Player
                let fName = profile.first_name;
                let lName = profile.last_name;

                // If user edited the full_name field, try to split it
                if (profile.full_name && (!fName || !lName)) {
                    const parts = profile.full_name.split(' ');
                    fName = parts[0];
                    lName = parts.slice(1).join(' ');
                }

                const { error } = await supabase
                    .from('players')
                    .update({
                        first_name: fName,
                        last_name: lName,
                        position: profile.position,
                        avatar_url: profile.avatar_url
                    })
                    .eq('id', context.playerId);

                if (error) throw error;
            } else {
                // Update Profile
                const updates = {
                    id: user.id,
                    email: user.email,
                    full_name: profile.full_name,
                    avatar_url: profile.avatar_url,
                };

                const { error } = await supabase.from('profiles').upsert(updates);
                if (error) throw error;
            }

            alert('Profil mis à jour !');
        } catch (error) {
            alert('Erreur lors de la mise à jour : ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return <div className="p-10 text-center">Chargement...</div>;
    }

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <User className="text-indigo-600" /> Mon Profil
            </h1>

            <div className="bg-white p-8 rounded-lg shadow-md border">
                <form onSubmit={updateProfile} className="space-y-6">

                    {/* AVATAR SECTION */}
                    <div className="flex justify-center">
                        <div className="relative group">
                            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-3xl font-bold text-indigo-700 overflow-hidden border-4 border-white shadow-sm">
                                {profile.avatar_url ? (
                                    <img
                                        src={profile.avatar_url}
                                        alt="Avatar"
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/150?text=Error"; }}
                                    />
                                ) : (
                                    profile.full_name ? profile.full_name[0].toUpperCase() : <User size={40} />
                                )}
                            </div>

                            {/* File Input Overlay */}
                            <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full border-2 border-white cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm">
                                <Camera size={14} />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            if (file.size > 500000) { // Limit 500kb
                                                alert("L'image est trop volumineuse (max 500ko). Utilisez un lien ou une image plus petite.");
                                                return;
                                            }
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setProfile({ ...profile, avatar_url: reader.result });
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="grid gap-6">
                        {/* EMAIL (Read only) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                <Mail size={16} /> Email
                            </label>
                            <input
                                type="text"
                                value={profile.email}
                                disabled
                                className="block w-full rounded-md border-gray-200 bg-gray-50 p-2 text-gray-500 shadow-sm"
                            />
                        </div>

                        {/* FULL NAME */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nom complet
                            </label>
                            <input
                                type="text"
                                value={profile.full_name || ''}
                                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                placeholder="Ex: Zinedine Zidane"
                            />
                        </div>

                        {/* POSITION */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Poste
                            </label>
                            {profile.role === 'COACH' ? (
                                <div className="flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-100 rounded text-indigo-700 font-medium">
                                    🛡️ Coach
                                    <input type="hidden" value="Coach" />
                                </div>
                            ) : (
                                <select
                                    value={profile.position || ''}
                                    onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                >
                                    <option value="">Choisir un poste...</option>
                                    <option value="Gardien">Gardien</option>
                                    <option value="Défenseur">Défenseur</option>
                                    <option value="Milieu">Milieu</option>
                                    <option value="Attaquant">Attaquant</option>
                                </select>
                            )}
                        </div>

                        {/* AVATAR URL */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                URL Avatar (ou mettre un lien d'image)
                            </label>
                            <input
                                type="url"
                                value={profile.avatar_url || ''}
                                onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={updating}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            {updating ? 'Enregistrement...' : <span className="flex items-center gap-2"><Save size={18} /> Enregistrer</span>}
                        </button>
                    </div>
                </form>
            </div>

            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200 text-sm">
                <p>💡 <strong>Astuce :</strong> Mettez un vrai nom pour que vos coéquipiers vous reconnaissent facilement sur le terrain et pour le covoiturage !</p>
            </div>
        </div>
    );
}
