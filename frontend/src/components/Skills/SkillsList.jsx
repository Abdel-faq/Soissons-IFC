import React, { useMemo } from 'react';
import SkillLevelCell from './SkillLevelCell';
import { Target, ArrowRightCircle, Loader2 } from 'lucide-react';
import { useNextLevelSkill } from '../../hooks/useSkills';

const NEXT_CATEGORY_MAP = {
    'U6': 'U7',
    'U7': 'U8',
    'U8': 'U9',
    'U9': 'U10-U11',
    'U10-U11': 'U12-U13'
};

function SkillRow({ skill, playerEvaluations, playerId, isCoach, categoryName }) {
    const [hoveredLevel, setHoveredLevel] = React.useState(null);

    // Sort levels 1 to 5
    const sortedLevels = React.useMemo(() => [...(skill.skill_levels || [])].sort((a, b) => a.level - b.level), [skill.skill_levels]);

    // Check if level 5 is validated (green)
    const level5Eval = playerEvaluations.find(e => e.skill_id === skill.id && e.level === 5);
    const isLevel5Validated = level5Eval?.status === 'green';

    // Determine next category
    const nextCategory = NEXT_CATEGORY_MAP[categoryName];

    // Load next level skill if validated
    const { skill: nextSkill, loading: nextLoading } = useNextLevelSkill(isLevel5Validated ? nextCategory : null, skill.name);

    // Get active description
    const activeLevelObj = hoveredLevel ? sortedLevels.find(l => l.level === hoveredLevel) : null;

    return (
        <>
            <tr className="group border-b-0">
                <td className="p-3">
                    <div className="font-bold text-gray-800 text-sm">{skill.name}</div>
                </td>

                {[1, 2, 3, 4, 5].map(levelNum => {
                    const evalObj = playerEvaluations.find(e => e.skill_id === skill.id && e.level === levelNum);

                    return (
                        <td
                            key={levelNum}
                            className="p-2 align-top"
                            onMouseEnter={() => setHoveredLevel(levelNum)}
                            onMouseLeave={() => setHoveredLevel(null)}
                        >
                            <div className="flex flex-col items-center gap-2">
                                <SkillLevelCell
                                    skill={skill}
                                    playerLevel={evalObj}
                                    playerId={playerId}
                                    isCoach={isCoach}
                                    categoryName={categoryName}
                                    levelNumber={levelNum}
                                />
                            </div>
                        </td>
                    );
                })}
            </tr>

            {/* DESCRIPTION ROW */}
            <tr>
                <td></td>
                <td colSpan={5} className="px-2 pb-4">
                    <div className={`min-h-[60px] p-3 rounded-xl transition-all duration-300 border border-transparent ${activeLevelObj ? 'bg-indigo-50/50 border-indigo-100 shadow-sm' : ''}`}>
                        {activeLevelObj ? (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="text-[10px] font-black text-indigo-500 uppercase mb-1 tracking-widest">Niveau {activeLevelObj.level}</div>
                                <div className="text-sm text-gray-700 leading-relaxed font-medium">
                                    {activeLevelObj.description}
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-300 italic font-medium">
                                Survolez un niveau pour voir sa description...
                            </div>
                        )}
                    </div>
                </td>
            </tr>

            {/* ILLUSTRATION IMAGE ROW */}
            <tr>
                <td colSpan={6} className="px-4 pb-8">
                    <div className="h-32 w-full rounded-2xl overflow-hidden relative shadow-inner bg-gray-50 border border-gray-100">
                        <img
                            src={`https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1000&auto=format&fit=crop&sig=${skill.id}`}
                            alt="football training"
                            className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent flex items-end p-4">
                            <span className="text-[10px] font-black text-indigo-900/40 uppercase tracking-[0.2em]">{skill.name}</span>
                        </div>
                    </div>
                </td>
            </tr>

            {/* NEXT LEVEL ROW (IF VALIDATED) */}
            {isLevel5Validated && nextCategory && (
                <tr className="bg-indigo-50/30 border-b border-indigo-100 animate-in slide-in-from-left-2 duration-300">
                    <td className="p-3">
                        <div className="flex items-center gap-2">
                            <ArrowRightCircle size={14} className="text-indigo-500" />
                            <div className="font-black text-indigo-900 text-[11px] uppercase tracking-tighter">Niveau Supérieur ({nextCategory})</div>
                        </div>
                        <div className="text-[9px] text-gray-400 font-bold uppercase mt-1">
                            Compétence débloquée car le niveau 5 est validé
                        </div>
                    </td>

                    {nextLoading ? (
                        <td colSpan={5} className="p-3 text-center">
                            <Loader2 className="animate-spin text-indigo-400 inline" size={16} />
                        </td>
                    ) : nextSkill ? (
                        [1, 2, 3, 4, 5].map(levelNum => {
                            const nextSortedLevels = [...(nextSkill.skill_levels || [])].sort((a, b) => a.level - b.level);
                            const nextLevelObj = nextSortedLevels.find(l => l.level === levelNum);
                            const nextEvalObj = playerEvaluations.find(e => e.skill_id === nextSkill.id && e.level === levelNum);

                            return (
                                <td key={`next-${levelNum}`} className="p-2 align-top">
                                    <div className="flex flex-col items-center gap-2">
                                        <SkillLevelCell
                                            skill={nextSkill}
                                            playerLevel={nextEvalObj}
                                            playerId={playerId}
                                            isCoach={isCoach}
                                            categoryName={nextCategory}
                                            levelNumber={levelNum}
                                        />
                                        {nextLevelObj?.description && (
                                            <div className="text-[8px] text-center text-indigo-400/70 font-bold leading-[1.1] uppercase">
                                                {nextLevelObj.description.substring(0, 30)}...
                                            </div>
                                        )}
                                    </div>
                                </td>
                            );
                        })
                    ) : (
                        <td colSpan={5} className="p-3 text-[10px] text-gray-400 italic text-center">
                            Référentiel {nextCategory} non disponible pour cette compétence.
                        </td>
                    )}
                </tr>
            )}
        </>
    );
}

export default function SkillsList({ skillsData, playerEvaluations, playerId, isCoach, categoryName, activeDomain }) {
    if (!skillsData || skillsData.length === 0) {
        return <div className="p-8 text-center text-gray-400 italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            Aucune compétence trouvée pour ce domaine dans la catégorie {categoryName}.
        </div>;
    }

    // Group skills by sub_domain
    const groupedSkills = useMemo(() => skillsData.reduce((acc, skill) => {
        const sd = skill.sub_domain || 'Général';
        if (!acc[sd]) acc[sd] = [];
        acc[sd].push(skill);
        return acc;
    }, {}), [skillsData]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {Object.entries(groupedSkills).map(([subDomain, skills]) => (
                <div key={subDomain} className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-50 to-white p-4 border-b border-gray-100 flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <Target size={18} />
                        </div>
                        <h3 className="font-black text-indigo-900 uppercase tracking-widest text-sm">
                            {(() => {
                                // If subDomain starts with domain name (case insensitive), strip it
                                const domainLower = (activeDomain || "").toLowerCase();
                                const subLower = subDomain.toLowerCase();
                                if (subLower.startsWith(domainLower) && subLower.length > domainLower.length) {
                                    const stripped = subDomain.substring(domainLower.length).trim();
                                    // Remove leading dash or space if present
                                    return stripped.replace(/^[-–—:]\s*/, '').replace(/^\w/, (c) => c.toUpperCase());
                                }
                                return subDomain;
                            })()}
                        </h3>
                    </div>

                    <div className="p-0 sm:p-4 overflow-x-auto">
                        <table className="w-full text-left min-w-[600px]">
                            <thead>
                                <tr>
                                    <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-1/3">Compétence</th>
                                    {[1, 2, 3, 4, 5].map(level => (
                                        <th key={level} className="p-3 text-center text-xs font-black text-gray-500 uppercase">
                                            Niveau {level}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {skills.map(skill => (
                                    <SkillRow
                                        key={skill.id}
                                        skill={skill}
                                        playerEvaluations={playerEvaluations}
                                        playerId={playerId}
                                        isCoach={isCoach}
                                        categoryName={categoryName}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}
