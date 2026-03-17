import React, { useState } from 'react';
import { updatePlayerSkill } from '../../hooks/useSkills';
import { Loader2, Check, AlertCircle } from 'lucide-react';

export default function SkillLevelCell({ skill, playerLevel, playerId, isCoach, categoryName, levelNumber, onLevelClick }) {
    const [updating, setUpdating] = useState(false);
    const [status, setStatus] = useState(playerLevel?.status || null); // null, 'red', 'orange', 'green'

    const handleUpdate = async (e) => {
        if (onLevelClick) onLevelClick();
        if (!isCoach) return; // Read-only for players
        
        let newStatus = 'red';
        if (!status || status === 'red') newStatus = 'orange';
        else if (status === 'orange') newStatus = 'green';
        else if (status === 'green') newStatus = 'red';

        if (skill.name.toLowerCase().includes('vitesse de réaction') && levelNumber === 5 && newStatus === 'green') {
            // "la compétance (vitesse de réaction est considérée comme validée quand le joueur valide le plus haut niveau (niveau 5)."
            // No extra local logic needed beyond setting it to green, but we could auto-validate levels 1-4 here if requested.
            // For now, setting level 5 to green is the validation.
        }

        try {
            setUpdating(true);
            await updatePlayerSkill(playerId, skill.id, levelNumber, newStatus);
            setStatus(newStatus);
        } catch (error) {
            console.error(error);
            alert("Erreur lors de la mise à jour");
        } finally {
            setUpdating(false);
        }
    };

    let bgClass = "bg-gray-100/50 hover:bg-gray-200";
    if (status === 'red') bgClass = "bg-red-500 text-white shadow-red-500/50";
    if (status === 'orange') bgClass = "bg-orange-500 text-white shadow-orange-500/50";
    if (status === 'green') bgClass = "bg-green-500 text-white shadow-green-500/50";

    const interactiveClass = isCoach ? "cursor-pointer active:scale-95 hover:shadow-lg transition-all" : "cursor-default";

    return (
        <div 
            onClick={handleUpdate}
            title={status === 'green' ? 'Validé' : status === 'orange' ? 'En cours' : status === 'red' ? 'Non acquis' : 'Non évalué'}
            className={`w-full min-h-[40px] flex items-center justify-center rounded-lg border border-black/5 shadow-sm p-2 ${bgClass} ${interactiveClass}`}
        >
            {updating ? (
                <Loader2 className="animate-spin" size={16} />
            ) : status === 'green' ? (
                <Check size={18} strokeWidth={3} />
            ) : status === 'orange' ? (
                <div className="w-2.5 h-2.5 rounded-full bg-white/80 animate-pulse" />
            ) : status === 'red' ? (
                <AlertCircle size={16} strokeWidth={2.5} />
            ) : (
                <span className="text-gray-400 font-bold text-xs">-</span>
            )}
        </div>
    );
}
