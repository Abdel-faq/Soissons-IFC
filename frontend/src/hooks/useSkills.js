import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function usePlayerSkills(playerId) {
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSkills = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error("No active session");

            const apiUrl = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiUrl}/api/skills/player/${playerId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                throw new Error("Failed to fetch player skills");
            }
            const data = await res.json();
            setSkills(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (playerId) {
            fetchSkills();
        }
    }, [playerId]);

    return { skills, loading, error, refreshSkills: fetchSkills };
}

export function useSkillsReferential(categoryName) {
    const [referential, setReferential] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReferential = async () => {
             if (!categoryName) {
                 setLoading(false);
                 return;
             }
             setLoading(true);
             try {
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const apiUrl = import.meta.env.VITE_API_URL || '';
                const res = await fetch(`${apiUrl}/api/skills/${categoryName}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
    
                if (!res.ok) {
                    if (res.status === 404) {
                        setReferential(null);
                        return; // Handle gracefully
                    }
                    throw new Error("Failed to fetch skills referential");
                }
                const data = await res.json();
                setReferential(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchReferential();
    }, [categoryName]);

    return { referential, loading, error };
}

export async function updatePlayerSkill(playerId, skillId, level, status) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/skills/player/${playerId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ skill_id: skillId, level, status })
    });

    if (!res.ok) {
        throw new Error("Failed to update skill");
    }
    return res.json();
}

export function useNextLevelSkill(targetCategory, skillName) {
    const [skill, setSkill] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchNextLevel = async () => {
            if (!targetCategory || !skillName) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const apiUrl = import.meta.env.VITE_API_URL || '';
                const res = await fetch(`${apiUrl}/api/skills/next-level/${targetCategory}/${encodeURIComponent(skillName)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!res.ok) {
                    if (res.status === 404) {
                        setSkill(null);
                        return;
                    }
                    throw new Error("Failed to fetch next level skill");
                }
                const data = await res.json();
                setSkill(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchNextLevel();
    }, [targetCategory, skillName]);

    return { skill, loading, error };
}
