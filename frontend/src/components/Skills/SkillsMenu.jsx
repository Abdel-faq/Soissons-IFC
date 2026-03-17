import React, { useState, useMemo } from 'react';
import { useSkillsReferential, usePlayerSkills } from '../../hooks/useSkills';
import SkillsList from './SkillsList';
import { Activity, Brain, Eye, Settings, HeartPulse, Loader2 } from 'lucide-react';

export default function SkillsMenu({ player, isCoach }) {
    // 1. Determine player category based on team name (e.g. "U10 Soissons IFC" -> "U10-U11")
    const getCategoryName = (categoryStr) => {
        if (!categoryStr) return 'U10-U11'; // Default Fallback
        
        const cat = categoryStr.toUpperCase();
        if (cat.includes('U6')) return 'U6';
        if (cat.includes('U7')) return 'U7';
        if (cat.includes('U8')) return 'U8';
        if (cat.includes('U9')) return 'U9';
        if (cat.includes('U10') || cat.includes('U11')) return 'U10-U11';
        if (cat.includes('U12') || cat.includes('U13')) return 'U12-U13';
        
        return 'U10-U11'; // Default Fallback
    };

    const categoryName = getCategoryName(player.category || player.team_category);

    const { referential, loading: refLoading, error: refError } = useSkillsReferential(categoryName);
    const { skills: playerEvaluations, loading: evalLoading, error: evalError } = usePlayerSkills(player.id || player.player_id);

    const [activeDomain, setActiveDomain] = useState('Technique');

    const DOMAIN_ICONS = {
        'Technique': <Settings size={18} />,
        'Tactique': <Brain size={18} />,
        'Physique': <Activity size={18} />,
        'Mental': <HeartPulse size={18} />,
        'Perceptivo-cognitif': <Eye size={18} />
    };

    // Derived states
    const availableDomains = useMemo(() => {
        if (!referential) return [];
        const domains = new Set(referential.map(s => s.skill_domains.name));
        // Ensure standard order and presence of all expected domains if desired, 
        // but here we just take what's in the data.
        return Array.from(domains); 
    }, [referential]);

    const filteredSkills = useMemo(() => {
        if (!referential) return [];
        return referential.filter(s => s.skill_domains.name === activeDomain);
    }, [referential, activeDomain]);


    // Next Level Category check for "Vitesse de réaction" logic
    // If player is U6 and validates a skill level 5, load U7 skills
    // We can do this in future iterations with a separate API call or modifying referential

    // Auto-select first domain if activeDomain doesn't exist in current referential
    if (availableDomains.length > 0 && !availableDomains.includes(activeDomain)) {
        setActiveDomain(availableDomains[0]);
    }

    if (refLoading || evalLoading) {
        return <div className="p-10 flex flex-col items-center justify-center text-gray-400 gap-4">
            <Loader2 className="animate-spin w-8 h-8 text-indigo-500" />
            <p className="font-bold text-sm uppercase tracking-widest">Chargement des compétences...</p>
        </div>;
    }

    if (refError) {
        return <div className="p-10 text-center text-red-500 bg-red-50 rounded-2xl border border-dashed border-red-200">
            Erreur de référentiel: {refError}
        </div>;
    }

    if (!referential || referential.length === 0) {
        return <div className="p-10 text-center text-gray-400 italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            Aucun référentiel de compétences défini pour la catégorie {categoryName}.
        </div>;
    }

    return (
        <div className="w-full h-full flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
            
            <div className="flex flex-col gap-1 text-center sm:text-left">
                <h2 className="text-xl font-black text-indigo-900 uppercase tracking-tight flex items-center justify-center sm:justify-start gap-2">
                    <Brain className="text-indigo-500" /> Bilan de Compétences
                </h2>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">
                    Référentiel {categoryName}
                </p>
                {evalError && <p className="text-red-500 text-xs mt-2">{evalError}</p>}
            </div>

            {/* DOMAINS TABS */}
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {availableDomains.map(domain => {
                    const isActive = activeDomain === domain;
                    return (
                        <button
                            key={domain}
                            onClick={() => setActiveDomain(domain)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black transition-all border-2 uppercase tracking-wide cursor-pointer
                                ${isActive 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20 scale-105 z-10' 
                                    : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200 hover:text-indigo-600'
                                }`}
                        >
                            {DOMAIN_ICONS[domain] || <Activity size={18} />}
                            {domain}
                        </button>
                    );
                })}
            </div>

            {/* SKILLS LISTING */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <SkillsList 
                    skillsData={filteredSkills} 
                    playerEvaluations={playerEvaluations || []} 
                    playerId={player.id || player.player_id}
                    isCoach={isCoach}
                    categoryName={categoryName}
                    activeDomain={activeDomain}
                />
            </div>
        </div>
    );
}
