import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Save, Phone, Mail, Camera, Bell, BellOff } from 'lucide-react';

export default function Profile() {
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [profile, setProfile] = useState({
        id: '',
        full_name: '',
        first_name: '',
        last_name: '',
        email: '',
        role: '',
        phone: '',
        position: '',
        avatar_url: '',
        birth_date: '',
        height: '',
        weight: '',
        strong_foot: 'DROIT',
        license_number: '',
        country: 'FR',
        stats_pac: 50,
        stats_sho: 50,
        stats_pas: 50,
        stats_dri: 50,
        stats_def: 50,
        stats_phy: 50,
        stats_overall: 50,
        push_supported: false,
        is_subscribed: false
    });

    useEffect(() => {
        getProfile();
        checkNotificationStatus();
    }, []);

    const checkNotificationStatus = () => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async (OneSignal) => {
            const supported = OneSignal.Notifications.isPushSupported();
            const subscribed = OneSignal.User.PushSubscription.optedIn;
            setProfile(prev => ({ ...prev, push_supported: supported, is_subscribed: subscribed }));
        });
    };

    const handleSubscription = async () => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async (OneSignal) => {
            try {
                if (!OneSignal.Notifications.isPushSupported()) {
                    alert("Les notifications ne sont pas supportées sur ce navigateur ou cet appareil. (iOS 16.4+ requis sur iPhone)");
                    return;
                }

                if (OneSignal.User.PushSubscription.optedIn) {
                    await OneSignal.User.PushSubscription.optOut();
                    alert("Vous avez désactivé les notifications.");
                } else {
                    await OneSignal.Notifications.requestPermission();
                    alert("Demande d'autorisation envoyée. Vérifiez les réglages de votre téléphone si rien ne s'affiche.");
                }
                checkNotificationStatus();
            } catch (err) {
                alert("Erreur: " + err.message);
            }
        });
    };

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
                            ...data,
                            full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                            email: user.email, // Child doesn't have email, show parent's
                            role: 'PLAYER',
                            push_supported: false, // Default placeholders will be updated by OneSignal
                            is_subscribed: false
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
                        let fName = data.first_name;
                        let lName = data.last_name;
                        // Fallback to splitting full_name if specific fields are empty
                        if (!fName && data.full_name) {
                            const parts = data.full_name.trim().split(' ');
                            fName = parts[0];
                            lName = parts.slice(1).join(' ') || '';
                        }
                        setProfile({
                            ...data,
                            first_name: fName,
                            last_name: lName,
                            email: user.email,
                            country: data.country || 'FR',
                            stats_pac: data.stats_pac || 50,
                            stats_sho: data.stats_sho || 50,
                            stats_pas: data.stats_pas || 50,
                            stats_dri: data.stats_dri || 50,
                            stats_def: data.stats_def || 50,
                            stats_phy: data.stats_phy || 50,
                            stats_overall: data.stats_overall || 50
                        });
                    }
                }
                if (context && context.role === 'COACH') {
                    setProfile(prev => ({ ...prev, is_coach: true, role: 'COACH' }));
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const isCoach = (profile.role === 'COACH' || profile.is_coach === true);

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

            const updates = {
                first_name: profile.first_name,
                last_name: profile.last_name,
                position: profile.position,
                avatar_url: profile.avatar_url,
                birth_date: profile.birth_date || null,
                weight: profile.weight ? parseInt(profile.weight) : null,
                strong_foot: profile.strong_foot,
                license_number: profile.license_number,
                country: profile.country,
                stats_pac: parseInt(profile.stats_pac) || 50,
                stats_sho: parseInt(profile.stats_sho) || 50,
                stats_pas: parseInt(profile.stats_pas) || 50,
                stats_dri: parseInt(profile.stats_dri) || 50,
                stats_def: parseInt(profile.stats_def) || 50,
                stats_phy: parseInt(profile.stats_phy) || 50,
                stats_overall: parseInt(profile.stats_overall) || 50
            };

            if (context && context.playerId) {
                // Update Player
                const { error } = await supabase
                    .from('players')
                    .update(updates)
                    .eq('id', context.playerId);

                if (error) throw error;
            } else {
                // Update Profile
                const profileUpdates = {
                    ...updates,
                    id: user.id,
                    email: user.email,
                    full_name: `${profile.first_name} ${profile.last_name}`.trim(),
                };

                const { error } = await supabase.from('profiles').upsert(profileUpdates);
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
        return <div className="p-10 text-center text-indigo-600 font-bold">Chargement...</div>;
    }

    return (
        <div className="max-w-xl mx-auto space-y-6 pb-20">
            <h1 className="text-2xl font-black flex items-center gap-2 text-indigo-900 tracking-tight">
                <User size={28} className="text-indigo-600" /> MON PROFIL
            </h1>

            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100">
                <form onSubmit={updateProfile} className="space-y-8">

                    {/* AVATAR SECTION */}
                    <div className="flex justify-center">
                        <div className="relative group">
                            <div className="w-32 h-32 bg-indigo-50 rounded-[40px] flex items-center justify-center text-4xl font-black text-indigo-700 overflow-hidden border-4 border-white shadow-2xl transform transition-all duration-300 group-hover:scale-105 group-hover:rotate-1">
                                {profile.avatar_url ? (
                                    <img
                                        src={profile.avatar_url}
                                        alt="Avatar"
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/150?text=Error"; }}
                                    />
                                ) : (
                                    profile.first_name ? profile.first_name[0].toUpperCase() : <User size={56} />
                                )}
                            </div>

                            {/* File Input Overlay */}
                            <label className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-3 rounded-2xl border-4 border-white cursor-pointer hover:bg-indigo-700 transition-all shadow-xl active:scale-90 z-10">
                                <Camera size={20} />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            if (file.size > 500000) {
                                                alert("Image trop lourde (max 500ko)");
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

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* PRÉNOM */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-indigo-900/40 uppercase tracking-[0.2em] ml-1">Prénom</label>
                                <input
                                    type="text"
                                    value={profile.first_name || ''}
                                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50/50 border-2 border-transparent rounded-2xl text-sm font-bold text-indigo-900 focus:bg-white focus:border-indigo-500/20 focus:outline-none transition-all placeholder:text-gray-300 shadow-inner"
                                    placeholder="Ex: Théo"
                                    required
                                />
                            </div>

                            {/* NOM */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-indigo-900/40 uppercase tracking-[0.2em] ml-1">Nom</label>
                                <input
                                    type="text"
                                    value={profile.last_name || ''}
                                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50/50 border-2 border-transparent rounded-2xl text-sm font-bold text-indigo-900 focus:bg-white focus:border-indigo-500/20 focus:outline-none transition-all placeholder:text-gray-300 shadow-inner"
                                    placeholder="Ex: Martin"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* DATE NAISSANCE */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-indigo-900/40 uppercase tracking-[0.2em] ml-1">Date de naissance</label>
                                <input
                                    type="date"
                                    value={profile.birth_date || ''}
                                    onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50/50 border-2 border-transparent rounded-2xl text-sm font-bold text-indigo-900 focus:bg-white focus:border-indigo-500/20 focus:outline-none transition-all shadow-inner"
                                />
                            </div>

                            {/* LICENCE */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-indigo-900/40 uppercase tracking-[0.2em] ml-1">N° Licence FFF</label>
                                <input
                                    type="text"
                                    value={profile.license_number || ''}
                                    onChange={(e) => setProfile({ ...profile, license_number: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50/50 border-2 border-transparent rounded-2xl text-sm font-bold text-indigo-900 focus:bg-white focus:border-indigo-500/20 focus:outline-none transition-all placeholder:text-gray-300 shadow-inner"
                                    placeholder="10 chiffres"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {/* TAILLE */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-indigo-900/40 uppercase tracking-[0.2em] ml-1">Taille (cm)</label>
                                <input
                                    type="number"
                                    value={profile.height || ''}
                                    onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                                    className="w-full px-4 py-4 bg-gray-50/50 border-2 border-transparent rounded-2xl text-sm font-bold text-indigo-900 text-center focus:bg-white focus:border-indigo-500/20 focus:outline-none transition-all shadow-inner"
                                    placeholder="170"
                                />
                            </div>
                            {/* POIDS */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-indigo-900/40 uppercase tracking-[0.2em] ml-1">Poids (kg)</label>
                                <input
                                    type="number"
                                    value={profile.weight || ''}
                                    onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                                    className="w-full px-4 py-4 bg-gray-50/50 border-2 border-transparent rounded-2xl text-sm font-bold text-indigo-900 text-center focus:bg-white focus:border-indigo-500/20 focus:outline-none transition-all shadow-inner"
                                    placeholder="65"
                                />
                            </div>
                            {/* PIED FORT */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-indigo-900/40 uppercase tracking-[0.2em] ml-1">Pied Fort</label>
                                <select
                                    value={profile.strong_foot || 'DROIT'}
                                    onChange={(e) => setProfile({ ...profile, strong_foot: e.target.value })}
                                    className="w-full px-2 py-4 bg-gray-50/50 border-2 border-transparent rounded-2xl text-[10px] font-black text-indigo-900 uppercase focus:bg-white focus:border-indigo-500/20 focus:outline-none transition-all shadow-inner"
                                >
                                    <option value="DROIT">Droitier 🤜</option>
                                    <option value="GAUCHE">Gaucher 🤛</option>
                                    <option value="AMBIDEXTRE">Ambi 👐</option>
                                </select>
                            </div>
                            {/* POSITION */}
                            <div className="space-y-1.5 pt-4">
                                <label className="text-[11px] font-black text-indigo-900/40 uppercase tracking-[0.2em] ml-1">Poste sur le terrain</label>
                                {profile.role === 'COACH' ? (
                                    <div className="w-full px-5 py-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-sm font-black text-indigo-600 shadow-sm flex items-center gap-2">
                                        🛡️ COACH PRINCIPAL
                                    </div>
                                ) : (
                                    <select
                                        value={profile.position || ''}
                                        onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50/50 border-2 border-transparent rounded-2xl text-sm font-bold text-indigo-900 focus:bg-white focus:border-indigo-500/20 focus:outline-none transition-all shadow-inner"
                                    >
                                        <option value="">Sélectionner un poste...</option>
                                        <option value="Gardien">🧤 Gardien</option>
                                        <option value="Défenseur">🛡️ Défenseur</option>
                                        <option value="Milieu">⚡ Milieu</option>
                                        <option value="Attaquant">🎯 Attaquant</option>
                                    </select>
                                )}
                            </div>
                        </div>

                        {/* SECTION STATS FIFA (COACH ONLY EDIT) */}
                        <div className="pt-6 border-t border-gray-100 pb-2">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                                    <span className="bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded text-[10px]">FIFA</span> Statistiques Techniques
                                </h3>
                                {!isCoach && <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-3 py-1.5 rounded-xl uppercase tracking-wider italic">Lecture seule (Coach uniquement)</span>}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-indigo-900/40 uppercase tracking-[0.2em] ml-1">Pays (Code ISO: FR, BE...)</label>
                                    <input
                                        type="text"
                                        value={profile.country || ''}
                                        onChange={(e) => setProfile({ ...profile, country: e.target.value.toUpperCase().substring(0, 2) })}
                                        disabled={!isCoach}
                                        className="w-full px-5 py-4 bg-gray-50/50 border-2 border-transparent rounded-2xl text-sm font-bold text-indigo-900 placeholder:text-gray-300 disabled:opacity-50 transition-all focus:bg-white focus:border-indigo-500/20 shadow-inner"
                                        placeholder="EX: FR"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-indigo-900/40 uppercase tracking-[0.2em] ml-1">Note Globale (OVR)</label>
                                    <input
                                        type="number"
                                        value={profile.stats_overall || ''}
                                        onChange={(e) => setProfile({ ...profile, stats_overall: e.target.value })}
                                        disabled={!isCoach}
                                        className="w-full px-5 py-4 bg-yellow-50/50 border-2 border-transparent rounded-2xl text-sm font-black text-yellow-700 disabled:opacity-50 transition-all focus:bg-white focus:border-yellow-400/20 shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[
                                    { key: 'stats_pac', label: 'Allure (PAC)' },
                                    { key: 'stats_sho', label: 'Tir (SHO)' },
                                    { key: 'stats_pas', label: 'Passe (PAS)' },
                                    { key: 'stats_dri', label: 'Dribble (DRI)' },
                                    { key: 'stats_def', label: 'Défense (DEF)' },
                                    { key: 'stats_phy', label: 'Physique (PHY)' }
                                ].map((stat) => (
                                    <div key={stat.key} className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{stat.label}</label>
                                        <input
                                            type="number"
                                            value={profile[stat.key] || ''}
                                            onChange={(e) => setProfile({ ...profile, [stat.key]: e.target.value })}
                                            disabled={!isCoach}
                                            className="w-full px-4 py-3 bg-gray-50/50 border-2 border-transparent rounded-xl text-sm font-bold text-indigo-900 focus:bg-white focus:border-indigo-500/20 transition-all disabled:opacity-50 shadow-inner"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={updating}
                        className="w-full py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-[24px] text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {updating ? (
                            "Synchronisation..."
                        ) : (
                            <>
                                <Save size={20} />
                                Enregistrer mon profil
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* NOTIFICATIONS */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 shadow-inner">
                        <Bell size={24} />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black text-indigo-900/40 uppercase tracking-widest mb-0.5">Push Notifications</h3>
                        <p className="text-sm font-bold text-indigo-900">
                            {profile.push_supported
                                ? (profile.is_subscribed ? "Statut : ACTIVÉ ✅" : "Statut : DÉSACTIVÉ ❌")
                                : "NON SUPPORTÉ 🛡️"}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSubscription}
                    className={`h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${profile.is_subscribed
                        ? "bg-red-50 text-red-600 hover:bg-red-100 shadow-sm"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20"
                        }`}
                >
                    {profile.is_subscribed ? "Couper" : "Activer"}
                </button>
            </div>

            <div className="p-5 bg-yellow-50 rounded-[32px] border-2 border-yellow-100 flex gap-4 items-center">
                <div className="w-10 h-10 bg-yellow-400 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-yellow-400/20">
                    💡
                </div>
                <p className="text-[11px] font-bold text-yellow-800 leading-relaxed uppercase tracking-tight">
                    Complétez votre <strong>taille</strong> et votre <strong>poids</strong> pour permettre au coach de suivre votre évolution physique !
                </p>
            </div>
        </div>
    );
}
