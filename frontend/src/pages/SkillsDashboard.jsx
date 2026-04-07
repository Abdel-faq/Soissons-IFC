import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import SkillsMenu from '../components/Skills/SkillsMenu';
import { X, Loader2, Target, Users } from 'lucide-react';

const DOMAINS = ['Perceptivo-cognitif', 'Mental', 'Physique', 'Technique', 'Tactique'];

const DOMAIN_COLORS = {
    'Perceptivo-cognitif': { base: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
    'Mental':              { base: 'bg-yellow-500', light: 'bg-yellow-100', text: 'text-yellow-700' },
    'Physique':            { base: 'bg-red-500',    light: 'bg-red-100',    text: 'text-red-700' },
    'Technique':           { base: 'bg-blue-500',   light: 'bg-blue-100',   text: 'text-blue-700' },
    'Tactique':            { base: 'bg-green-500',  light: 'bg-green-100',  text: 'text-green-700' },
};

/**
 * Compute global domain status for a player.
 * - 'none'      (white)  : No evaluations at all in this domain.
 * - 'red'       (red)    : Has evaluations but not all skills have a green level 5.
 * - 'green'     (green)  : ALL skills in the domain have at least one level validated as green.
 * - 'blue'      (blue)   : Player has all level 5 validated AND has evaluations in next-level category (dépassé).
 */
function getDomainStatus(domain, skillsInDomain, playerEvals, nextCategoryEvals) {
    if (!skillsInDomain || skillsInDomain.length === 0) return 'none';

    const domainSkillIds = skillsInDomain.map(s => s.id);
    const domainEvals = playerEvals.filter(e => domainSkillIds.includes(e.skill_id));

    if (domainEvals.length === 0) return 'none';

    const allLevel5Green = skillsInDomain.every(skill => {
        const level5Eval = playerEvals.find(e => e.skill_id === skill.id && e.level === 5 && e.status === 'green');
        return !!level5Eval;
    });

    if (allLevel5Green) {
        // Check if the player has any evals in the next category for this domain
        if (nextCategoryEvals && nextCategoryEvals.length > 0) return 'blue';
        return 'green';
    }

    return 'red';
}

function DomainStatusBadge({ status, domain, onClick }) {
    const domainColor = DOMAIN_COLORS[domain] || DOMAIN_COLORS['Technique'];

    const statusConfig = {
        none:  { bg: 'bg-white border border-gray-200', text: 'text-gray-400', label: domain },
        red:   { bg: 'bg-red-100 border border-red-200', text: 'text-red-600', label: domain },
        green: { bg: 'bg-green-100 border border-green-200', text: 'text-green-700', label: domain },
        blue:  { bg: 'bg-blue-100 border border-blue-200', text: 'text-blue-700', label: domain },
    };

    const cfg = statusConfig[status] || statusConfig.none;

    return (
        <button
            onClick={onClick}
            className={`w-full py-2 px-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all hover:scale-105 hover:shadow-md active:scale-95 ${cfg.bg} ${cfg.text}`}
        >
            {domain.length > 8 ? domain.substring(0, 8) + '…' : domain}
        </button>
    );
}

export default function SkillsDashboard() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [team, setTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [referential, setReferential] = useState([]);
    const [allPlayerEvals, setAllPlayerEvals] = useState({});       // { [player_id]: [...evals] }
    const [nextCatEvals, setNextCatEvals]   = useState({});         // { [player_id]: [...evals] }
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal state
    const [modalPlayer, setModalPlayer]   = useState(null);
    const [modalDomain, setModalDomain]   = useState(null);

    // ----------------------------------------------------------------
    // Bootstrap: session + profile + team
    // ----------------------------------------------------------------
    useEffect(() => {
        async function bootstrap() {
            try {
                setLoading(true);

                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { setError('Non connecté.'); return; }
                setUser(session.user);

                const token = session.access_token;
                const apiUrl = import.meta.env.VITE_API_URL || '';

                // Profile
                const { data: prof } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                setProfile(prof);

                // Active team
                const activeTeamId = localStorage.getItem('active_team_id');
                if (!activeTeamId) { setError('Aucune équipe sélectionnée.'); setLoading(false); return; }

                const { data: teamData } = await supabase
                    .from('teams')
                    .select('*')
                    .eq('id', activeTeamId)
                    .single();
                setTeam(teamData);

                // Members
                const { data: membersData } = await supabase
                    .from('team_members')
                    .select('*, players(*)')
                    .eq('team_id', activeTeamId);

                const validMembers = (membersData || []).filter(m => m.players);
                setMembers(validMembers);

                // Determine category
                const getCategoryName = (name) => {
                    if (!name) return 'U10-U11';
                    const n = name.toUpperCase();
                    if (n.includes('U6'))  return 'U6';
                    if (n.includes('U7'))  return 'U7';
                    if (n.includes('U8'))  return 'U8';
                    if (n.includes('U9'))  return 'U9';
                    if (n.includes('U10') || n.includes('U11')) return 'U10-U11';
                    if (n.includes('U12') || n.includes('U13')) return 'U12-U13';
                    return 'U10-U11';
                };

                const NEXT_CATEGORY_MAP = {
                    'U6': 'U7', 'U7': 'U8', 'U8': 'U9',
                    'U9': 'U10-U11', 'U10-U11': 'U12-U13'
                };

                const categoryName = getCategoryName(teamData?.name);
                const nextCategory  = NEXT_CATEGORY_MAP[categoryName];

                // Referential (current category)
                const refRes = await fetch(`${apiUrl}/api/skills/${categoryName}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (refRes.ok) {
                    const refData = await refRes.json();
                    setReferential(refData);
                }

                // Fetch all player evals in parallel
                const playerIds = validMembers.map(m => m.player_id).filter(Boolean);

                const [evalsResults, nextEvalsResults] = await Promise.all([
                    // Current category evals
                    Promise.all(playerIds.map(async pid => {
                        const r = await fetch(`${apiUrl}/api/skills/player/${pid}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!r.ok) return { pid, data: [] };
                        return { pid, data: await r.json() };
                    })),
                    // Next category referential to know which skill IDs belong to next level
                    nextCategory
                        ? fetch(`${apiUrl}/api/skills/${nextCategory}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          }).then(r => r.ok ? r.json() : [])
                        : Promise.resolve([])
                ]);

                const evalsMap = {};
                evalsResults.forEach(({ pid, data }) => { evalsMap[pid] = data; });
                setAllPlayerEvals(evalsMap);

                // Build set of next-category skill IDs
                const nextSkillIds = new Set((nextEvalsResults || []).map(s => s.id));

                // For each player, check if any of their evals hit a next-category skill
                const nextCatMap = {};
                evalsResults.forEach(({ pid, data }) => {
                    nextCatMap[pid] = data.filter(e => nextSkillIds.has(e.skill_id));
                });
                setNextCatEvals(nextCatMap);

            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        bootstrap();
    }, []);

    // Group referential by domain
    const refByDomain = useMemo(() => {
        const map = {};
        DOMAINS.forEach(d => { map[d] = []; });
        referential.forEach(skill => {
            const domainName = skill.skill_domains?.name;
            if (domainName && map[domainName]) map[domainName].push(skill);
        });
        return map;
    }, [referential]);

    // ----------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
                <Loader2 className="animate-spin w-10 h-10 text-indigo-500" />
                <p className="font-bold text-sm uppercase tracking-widest">Chargement des compétences…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500 bg-red-50 rounded-2xl border border-dashed border-red-200">
                {error}
            </div>
        );
    }

    const isCoach = profile?.role === 'COACH' || profile?.role === 'ADMIN' ||
                    team?.coach_id === user?.id ||
                    user?.email?.toLowerCase().trim() === 'sajid.wadi@hotmail.com';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4">
                <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-md">
                    <Target size={22} />
                </div>
                <div>
                    <h1 className="text-xl font-black text-indigo-900">Compétences</h1>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                        {team?.name} — Vue globale par domaine
                    </p>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400 inline-block"/> Validé (tous niveaux 5 verts)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block"/> Dépassé (niveau supérieur)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block"/> En cours</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-200 border inline-block"/> Non évalué</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="p-4 text-left font-black text-gray-500 uppercase text-xs tracking-wider w-1/4">
                                <div className="flex items-center gap-2"><Users size={14}/> Joueur</div>
                            </th>
                            {DOMAINS.map(d => (
                                <th key={d} className="p-2 text-center font-black text-gray-500 uppercase text-[10px] tracking-wider">
                                    {d}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {members.map(m => {
                            const player = m.players;
                            const pid = m.player_id;
                            const playerEvals = allPlayerEvals[pid] || [];
                            const playerNextEvals = nextCatEvals[pid] || [];

                            const playerForMenu = {
                                ...player,
                                id: pid,
                                category: team?.name,
                                team_category: team?.name,
                            };

                            return (
                                <tr key={pid} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="p-4 font-bold text-gray-800 text-sm">
                                        {player.first_name} {player.last_name}
                                    </td>
                                    {DOMAINS.map(domain => {
                                        const status = getDomainStatus(
                                            domain,
                                            refByDomain[domain],
                                            playerEvals,
                                            playerNextEvals
                                        );
                                        return (
                                            <td key={domain} className="p-2">
                                                <DomainStatusBadge
                                                    status={status}
                                                    domain={domain}
                                                    onClick={() => {
                                                        setModalPlayer(playerForMenu);
                                                        setModalDomain(domain);
                                                    }}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {members.length === 0 && (
                    <div className="p-10 text-center text-gray-400 italic">
                        Aucun joueur dans cette équipe.
                    </div>
                )}
            </div>

            {/* MODAL */}
            {modalPlayer && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                    onClick={() => { setModalPlayer(null); setModalDomain(null); }}
                >
                    <div
                        className="bg-white w-full sm:max-w-4xl sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between p-5 border-b">
                            <div>
                                <h2 className="font-black text-lg text-indigo-900">
                                    {modalPlayer.first_name} {modalPlayer.last_name}
                                </h2>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                                    Compétences — {modalDomain}
                                </p>
                            </div>
                            <button
                                onClick={() => { setModalPlayer(null); setModalDomain(null); }}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="overflow-y-auto flex-1 p-5">
                            <SkillsMenu
                                player={modalPlayer}
                                isCoach={isCoach}
                                initialDomain={modalDomain}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
