import React from 'react';
import { X } from 'lucide-react';

export default function PlayerCard({ player, onClose }) {
    if (!player) return null;

    // Default stats if missing
    const stats = {
        PAC: player.stats_pac || 50,
        SHO: player.stats_sho || 50,
        PAS: player.stats_pas || 50,
        DRI: player.stats_dri || 50,
        DEF: player.stats_def || 50,
        PHY: player.stats_phy || 50,
        OVR: player.stats_overall || 50
    };

    const countryCode = player.country?.toLowerCase() || 'fr';
    const flagUrl = `https://flagcdn.com/w80/${countryCode}.png`;
    const clubLogo = '/logo_soissons.jpg';
    const playerPhoto = player.avatar_url || 'https://via.placeholder.com/300?text=Joueur';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in">
            <div className="relative transform transition-all animate-in zoom-in-95 duration-300">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 text-white hover:rotate-90 transition-all p-2 bg-white/10 rounded-full border border-white/20"
                >
                    <X size={24} />
                </button>

                {/* FIFA CARD CONTAINER */}
                <div className="relative w-[320px] h-[480px] select-none shadow-2xl shadow-yellow-500/20 rounded-[40px] overflow-hidden group">

                    {/* Background SVG / Gold Gradient */}
                    <div className="absolute inset-0 bg-[#F5D76E] bg-gradient-to-br from-[#FFD700] via-[#FDB931] to-[#D4AF37] border-[3px] border-[#C5A028] rounded-[40px]">
                        {/* Subtle Pattern overlay */}
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-black" />
                    </div>

                    {/* TOP CONTENT: Stats, Flag, Club */}
                    <div className="absolute top-10 left-6 flex flex-col items-center gap-1 z-10">
                        <div className="text-5xl font-black text-[#4E3621] leading-tight tracking-tighter">
                            {stats.OVR}
                        </div>
                        <div className="text-xl font-bold text-[#4E3621] uppercase tracking-widest opacity-80">
                            {player.position?.substring(0, 3).toUpperCase() || 'ST'}
                        </div>

                        <div className="w-10 h-6 overflow-hidden rounded-sm shadow-sm border border-black/10 mt-2">
                            <img src={flagUrl} alt="Flag" className="w-full h-full object-cover" />
                        </div>

                        <div className="w-10 h-10 mt-1 drop-shadow-md">
                            <img src={clubLogo} alt="Club" className="w-full h-full object-contain" />
                        </div>
                    </div>

                    {/* PLAYER IMAGE */}
                    <div className="absolute top-[40px] right-2 w-[220px] h-[260px] z-0 pointer-events-none">
                        <img
                            src={playerPhoto}
                            alt={player.full_name}
                            className="w-full h-full object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.4)] transition-transform group-hover:scale-105 duration-700"
                        />
                    </div>

                    {/* NAME PLATE */}
                    <div className="absolute top-[280px] left-0 right-0 z-20 flex flex-col items-center">
                        <div className="w-3/4 h-[1px] bg-[#4E3621]/20 my-2" />
                        <h2 className="text-2xl font-black text-[#4E3621] uppercase tracking-[0.1em] drop-shadow-sm">
                            {(player.last_name || player.full_name?.split(' ').pop() || 'JOUEUR')}
                        </h2>
                        <div className="w-3/4 h-[1px] bg-[#4E3621]/20 my-2" />
                    </div>

                    {/* BOTTOM STATS GRID */}
                    <div className="absolute bottom-10 left-0 right-0 px-8 z-20">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                            {/* Left Col */}
                            <div className="space-y-1 border-r border-[#4E3621]/20 pr-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-black text-[#4E3621] drop-shadow-sm">{stats.PAC}</span>
                                    <span className="text-sm font-bold text-[#4E3621]/80 uppercase">PAC</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-black text-[#4E3621] drop-shadow-sm">{stats.SHO}</span>
                                    <span className="text-sm font-bold text-[#4E3621]/80 uppercase">SHO</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-black text-[#4E3621] drop-shadow-sm">{stats.PAS}</span>
                                    <span className="text-sm font-bold text-[#4E3621]/80 uppercase">PAS</span>
                                </div>
                            </div>

                            {/* Right Col */}
                            <div className="space-y-1 pl-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-black text-[#4E3621] drop-shadow-sm">{stats.DRI}</span>
                                    <span className="text-sm font-bold text-[#4E3621]/80 uppercase">DRI</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-black text-[#4E3621] drop-shadow-sm">{stats.DEF}</span>
                                    <span className="text-sm font-bold text-[#4E3621]/80 uppercase">DEF</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-black text-[#4E3621] drop-shadow-sm">{stats.PHY}</span>
                                    <span className="text-sm font-bold text-[#4E3621]/80 uppercase">PHY</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Glossy Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none" />
                </div>
            </div>
        </div>
    );
}
