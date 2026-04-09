import React, { useState, useEffect } from 'react';
// Version: 1.2 - Aesthetic Refinement
import { X, Edit2, Save, RotateCcw, Brain, Shield, Camera } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import SkillsMenu from './Skills/SkillsMenu';

export default function PlayerCard({ player, isCoach, onClose }) {
    const [viewMode, setViewMode] = useState('card'); // 'card' or 'skills'
    const [isEditing, setIsEditing] = useState(false);
    const [updating, setUpdating] = useState(false);

    // Local state for stats
    const [localStats, setLocalStats] = useState({
        PAC: player.stats_pac || 50,
        SHO: player.stats_sho || 50,
        PAS: player.stats_pas || 50,
        DRI: player.stats_dri || 50,
        DEF: player.stats_def || 50,
        PHY: player.stats_phy || 50
    });

    const [licenseNumber, setLicenseNumber] = useState(player.license_number || '');
    const [avatarUrl, setAvatarUrl] = useState(player.avatar_url || '');

    // Auto-calculate OVR
    const OVR = Math.round(Object.values(localStats).reduce((a, b) => a + b, 0) / 6);

    if (!player) return null;

    const handleSave = async () => {
        try {
            setUpdating(true);
            const { data, error } = await supabase
                .from('players')
                .update({
                    stats_pac: localStats.PAC,
                    stats_sho: localStats.SHO,
                    stats_pas: localStats.PAS,
                    stats_dri: localStats.DRI,
                    stats_def: localStats.DEF,
                    stats_phy: localStats.PHY,
                    stats_overall: OVR,
                    license_number: licenseNumber,
                    avatar_url: avatarUrl
                })
                .eq('id', player.id || player.player_id)
                .select()
                .single();

            if (error) throw error;

            setIsEditing(false);
            alert('Carte mise à jour !');
            if (onClose) onClose(); // Fermer la carte après succès pour forcer le refresh
        } catch (err) {
            console.error("Save error:", err);
            // Si l'erreur est liée aux permissions (RLS), on donne un message clair
            const msg = err.code === 'PGRST116' ? "Erreur de permissions : Vous n'êtes pas autorisé à modifier ce joueur ou la base de données n'est pas à jour." : err.message;
            alert('Erreur lors de la sauvegarde : ' + msg);
        } finally {
            setUpdating(false);
        }
    };

    const countryCode = player.country?.toLowerCase() || 'fr';
    const flagUrl = `https://flagcdn.com/w80/${countryCode}.png`;
    const clubLogo = '/logo_soissons.png'; // Changé en .png pour supporter la transparence
    const playerPhoto = avatarUrl || '/Accueil.JPG'; // Utiliser l'image d'accueil par défaut ou placeholder si vide

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in">
            <div className="relative transform transition-all animate-in zoom-in-95 duration-300 flex flex-col items-center">

                {/* TOOLBAR FOR COACH */}
                {isCoach && (
                    <div className="mb-4 flex gap-2 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all"
                            >
                                <Edit2 size={14} /> MODIFIER LES NOTES
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={updating}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 transition-all disabled:opacity-50"
                                >
                                    <Save size={14} /> {updating ? 'SAUVEGARDE...' : 'ENREGISTRER'}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false); setLocalStats({
                                            PAC: player.stats_pac || 50,
                                            SHO: player.stats_sho || 50,
                                            PAS: player.stats_pas || 50,
                                            DRI: player.stats_dri || 50,
                                            DEF: player.stats_def || 50,
                                            PHY: player.stats_phy || 50
                                        });
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl font-bold text-xs hover:bg-white/30 transition-all"
                                >
                                    <RotateCcw size={14} /> ANNULER
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 -right-12 text-white hover:rotate-90 transition-all p-2 bg-white/10 rounded-full border border-white/20"
                >
                    <X size={24} />
                </button>

                {/* VIEW TOGGLE */}
                <div className="absolute -top-12 left-0 flex gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20">
                    <button
                        onClick={() => setViewMode('card')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'card' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                    >
                        <Shield size={14} /> Carte Stats
                    </button>
                    <button
                        onClick={() => setViewMode('skills')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'skills' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                    >
                        <Brain size={14} /> Compétences
                    </button>
                </div>

                {viewMode === 'card' ? (
                    /* FIFA CARD CONTAINER */
                    <div className="relative w-[320px] h-[480px] select-none shadow-2xl shadow-yellow-500/30 rounded-[40px] overflow-hidden group">

                        {/* Background SVG / Gold Gradient */}
                        <div className="absolute inset-0 bg-[#F5D76E] bg-gradient-to-br from-[#FFD700] via-[#FDB931] to-[#D4AF37] border-[3px] border-[#C5A028] rounded-[40px]">
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-black" />
                        </div>

                        {/* TOP CONTENT: Stats, Flag, Club */}
                        <div className="absolute top-10 left-6 flex flex-col items-center gap-1 z-10">
                            <div className="text-5xl font-black text-[#4E3621] leading-tight tracking-tighter">
                                {OVR}
                            </div>
                            <div className="text-xl font-bold text-[#4E3621] uppercase tracking-widest opacity-80">
                                {player.position?.substring(0, 3).toUpperCase() || 'ST'}
                            </div>

                            <div className="w-10 h-6 overflow-hidden rounded-sm shadow-sm border border-black/10 mt-2">
                                <img src={flagUrl} alt="Flag" className="w-full h-full object-cover" />
                            </div>

                            {/* Club Logo Container (Sans fond blanc) */}
                            <div className="w-10 h-10 mt-1 flex items-center justify-center">
                                <img
                                    src={clubLogo}
                                    alt="Club"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        </div>

                        {/* PLAYER IMAGE (Transparence PNG supportée ici) */}
                        <div className="absolute top-[35px] left-[70px] right-4 h-[270px] z-0 flex justify-center items-end bg-transparent">
                            <img
                                src={playerPhoto}
                                alt={player.full_name}
                                className="h-full w-auto object-contain transition-transform group-hover:scale-110 duration-700 bg-transparent"
                            />

                            {isEditing && (
                                <label className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity rounded-[40px] z-30">
                                    <div className="flex flex-col items-center gap-2">
                                        <Camera size={40} className="text-white" />
                                        <span className="text-[10px] text-white font-black uppercase tracking-widest">Changer photo</span>
                                    </div>
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
                                                    setAvatarUrl(reader.result);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                            )}
                        </div>

                        {/* NAME PLATE & LICENSE */}
                        <div className="absolute top-[280px] left-0 right-0 z-20 flex flex-col items-center">
                            <div className="w-2/3 h-[1px] bg-[#4E3621]/20 my-1" />
                            <h2 className="text-2xl font-black text-[#4E3621] uppercase tracking-[0.1em] drop-shadow-sm">
                                {(player.last_name || player.full_name?.split(' ').pop() || 'JOUEUR')}
                            </h2>

                            {isEditing ? (
                                <input
                                    type="text"
                                    value={licenseNumber}
                                    onChange={(e) => setLicenseNumber(e.target.value)}
                                    placeholder="N° Licence"
                                    className="mt-1 bg-white/20 border border-[#4E3621]/20 rounded px-2 py-0.5 text-[10px] font-bold text-[#4E3621] placeholder-[#4E3621]/40 focus:outline-none w-32 text-center"
                                />
                            ) : (
                                <div className="text-[9px] font-bold text-[#4E3621]/60 uppercase tracking-[0.2em] mt-0.5">
                                    {licenseNumber || 'PAS DE LICENCE'}
                                </div>
                            )}

                            <div className="w-2/3 h-[1px] bg-[#4E3621]/20 my-1" />
                        </div>

                        {/* BOTTOM STATS GRID */}
                        <div className="absolute bottom-10 left-0 right-0 px-8 z-20">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                {/* Left Col */}
                                <div className="space-y-1 border-r border-[#4E3621]/20 pr-4">
                                    {['PAC', 'SHO', 'PAS'].map(s => (
                                        <div key={s} className="flex justify-between items-center group/stat">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={localStats[s]}
                                                    onChange={(e) => setLocalStats({ ...localStats, [s]: Math.min(99, Math.max(0, parseInt(e.target.value) || 0)) })}
                                                    className="w-8 bg-white/20 border border-[#4E3621]/20 rounded text-center text-xs font-black text-[#4E3621] focus:outline-none"
                                                />
                                            ) : (
                                                <span className="text-lg font-black text-[#4E3621] drop-shadow-sm">{localStats[s]}</span>
                                            )}
                                            <span className="text-[10px] font-bold text-[#4E3621]/80 uppercase">{s}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Right Col */}
                                <div className="space-y-1 pl-4">
                                    {['DRI', 'DEF', 'PHY'].map(s => (
                                        <div key={s} className="flex justify-between items-center group/stat">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={localStats[s]}
                                                    onChange={(e) => setLocalStats({ ...localStats, [s]: Math.min(99, Math.max(0, parseInt(e.target.value) || 0)) })}
                                                    className="w-8 bg-white/20 border border-[#4E3621]/20 rounded text-center text-xs font-black text-[#4E3621] focus:outline-none"
                                                />
                                            ) : (
                                                <span className="text-lg font-black text-[#4E3621] drop-shadow-sm">{localStats[s]}</span>
                                            )}
                                            <span className="text-[10px] font-bold text-[#4E3621]/80 uppercase">{s}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Glossy Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none" />
                    </div>
                ) : (
                    /* SKILLS CONTAINER */
                    <div className="relative w-[800px] max-w-[95vw] h-[80vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-300">
                        <SkillsMenu player={player} isCoach={isCoach} />
                    </div>
                )}
            </div>
        </div>
    );
}
