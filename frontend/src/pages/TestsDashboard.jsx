import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trophy, Info, ArrowUpRight, ArrowDownRight, Loader2, Users, Search, Save, Edit2, X, Download, Timer } from 'lucide-react';

const TEST_DESCRIPTIONS = {
  vitesse: { label: 'Vitesse (20m)', desc: "Capacité d'accélération et vitesse de pointe.", better: 'lower', icon: '⏱️' },
  broadJump: { label: 'Broad Jump', desc: 'Puissance explosive membres inférieurs.', better: 'higher', icon: '🦘' },
  conduiteBalle: { label: 'Conduite de balle', desc: 'Maîtrise technique et vitesse avec ballon.', better: 'lower', icon: '⚽' },
  coordination: { label: 'Coordination', desc: 'Vivacité et changements de direction.', better: 'lower', icon: '🏃' },
  jonglesSF: { label: 'Jongles (SF)', desc: 'Nombre de jongles pied fort.', better: 'higher', icon: '👑' },
  jonglesWF: { label: 'Jongles (WF)', desc: 'Nombre de jongles pied faible.', better: 'higher', icon: '👟' }
};

const ImprovementBadge = ({ val1, val2, type }) => {
  if (val1 === null || val2 === null || val1 === undefined || val2 === undefined || val1 === '' || val2 === '') {
    return <span className="text-gray-300">-</span>;
  }

  const num1 = parseFloat(val1);
  const num2 = parseFloat(val2);

  if (isNaN(num1) || isNaN(num2) || num1 === 0) return <span className="text-gray-300">-</span>;

  let improvement = type === 'lower' ? ((num1 - num2) / num1) * 100 : ((num2 - num1) / Math.abs(num1)) * 100;

  if (Math.abs(improvement) < 0.1) return <span className="text-gray-400 text-xs font-bold">= 0%</span>;

  const isPositive = improvement > 0;
  const absImp = Math.abs(improvement).toFixed(1);

  return (
    <div className={`flex items-center justify-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg shadow-sm border ${isPositive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
      {isPositive ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
      {absImp}%
    </div>
  );
};

export default function TestsDashboard() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [members, setMembers] = useState([]);
  const [team, setTeam] = useState(null);
  const [isCoach, setIsCoach] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState({}); // { player_id: { test_type: { s1, s2, s3, id } } }
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('vitesse');

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const activeTeamId = localStorage.getItem('active_team_id');
      if (!activeTeamId) return;

      const { data: { user } } = await supabase.auth.getUser();
      const { data: teamData } = await supabase.from('teams').select('*').eq('id', activeTeamId).single();
      if (teamData) {
        setTeam(teamData);
        setIsCoach(teamData.coach_id === user?.id || user?.email?.toLowerCase() === 'sajid.wadi@hotmail.com');
      }

      // 1. Fetch team members to list ALL players (even those without tests)
      const { data: membersData } = await supabase
        .from('team_members')
        .select('player_id, user_id, players(id, first_name, last_name, full_name, avatar_url, position), profiles(id, full_name)')
        .eq('team_id', activeTeamId);

      const mList = (membersData || []).map(m => {
        let p = m.players || {};
        let prof = m.profiles || {};
        return {
          id: m.player_id || m.user_id,
          isPlayer: !!m.player_id,
          name: p.full_name || prof.full_name || (prof.first_name ? `${prof.first_name} ${prof.last_name}`.trim() : 'Membre'),
          position: p.position || 'N/A'
        };
      }).filter(m => m.isPlayer);

      setMembers(mList.sort((a, b) => a.name.localeCompare(b.name)));

      // 2. Fetch test results
      const { data: testData } = await supabase
        .from('test_results')
        .select('*')
        .eq('team_id', activeTeamId);

      setResults(testData || []);
    } catch (e) {
      console.error("Failed to load test results", e);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    const initial = {};
    // Pre-fill editedValues with current DB results
    results.forEach(r => {
      const pid = r.player_id || r.player_name; // fallback to name for older records
      if (!initial[pid]) initial[pid] = {};
      initial[pid][r.test_type] = { s1: r.s1, s2: r.s2, s3: r.s3, id: r.id };
    });
    setEditedValues(initial);
    setIsEditing(true);
  };

  const handleValueChange = (playerId, field, value) => {
    setEditedValues(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [activeTab]: {
          ...prev[playerId]?.[activeTab],
          [field]: value === '' ? null : parseFloat(value)
        }
      }
    }));
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      const rows = [];

      Object.entries(editedValues).forEach(([pid, tests]) => {
        Object.entries(tests).forEach(([testType, vals]) => {
          // If no values are entered and no ID exists, skip it
          if (!vals.id && vals.s1 === null && vals.s2 === null && vals.s3 === null) return;

          let member = members.find(m => m.id === pid || m.name === pid);

          const row = {
            id: vals.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)),
            team_id: team.id,
            player_name: member ? member.name : pid,
            player_id: member?.isPlayer ? pid : null,
            test_type: testType,
            s1: vals.s1,
            s2: vals.s2,
            s3: vals.s3,
          };

          rows.push(row);
        });
      });

      if (rows.length > 0) {
        // Upsert based on id if present, otherwise it inserts.
        // If your test_results table has a unique constraint on (team_id, player_id, test_type), we could use onConflict.
        // For safety, let's upsert everything and rely on primary keys.
        const { error } = await supabase.from('test_results').upsert(rows);
        if (error) throw error;
      }

      await fetchResults();
      setIsEditing(false);
    } catch (e) {
      alert("Erreur lors de la sauvegarde : " + e.message);
    } finally {
      setSaving(false);
    }
  };



  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members;
    return members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [members, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
        <Loader2 className="animate-spin w-10 h-10 text-indigo-500" />
        <p className="font-bold text-sm uppercase tracking-widest text-indigo-900/40">Chargement des performances...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-indigo-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5 text-center md:text-left">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-4 rounded-2xl shadow-xl shadow-indigo-200">
            <Trophy size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-indigo-950 tracking-tight">Performances Athlétiques</h1>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">
              {team?.name || 'Équipe'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isCoach && !isEditing && (
            <>

              <button
                onClick={startEditing}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all hover:-translate-y-0.5"
              >
                <Edit2 size={16} /> Éditer la base
              </button>
            </>
          )}

          {isEditing && (
            <>
              <button onClick={() => { setIsEditing(false); fetchResults(); }} className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl text-xs font-black hover:bg-gray-200 transition-all">
                <X size={16} /> Annuler
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-green-200 hover:shadow-green-300 transition-all"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Sauvegarder
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2 border-b border-gray-200">
        {Object.entries(TEST_DESCRIPTIONS).map(([key, info]) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap shrink-0 rounded-t-2xl border-b-4 ${isActive
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-gray-500 hover:text-indigo-600 hover:bg-gray-50'
                }`}
            >
              <span>{info.icon}</span> {info.label}
            </button>
          );
        })}
      </div>

      {/* Main Board */}
      <div className="bg-white rounded-[24px] shadow-xl shadow-indigo-900/5 border border-indigo-50 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200/50">
              {TEST_DESCRIPTIONS[activeTab].icon}
            </div>
            <div>
              <h2 className="font-black text-indigo-900 text-sm uppercase tracking-widest">{TEST_DESCRIPTIONS[activeTab].label}</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-tight mt-0.5">{TEST_DESCRIPTIONS[activeTab].desc}</p>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher un joueur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-white border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] sticky left-0 bg-white z-10 border-r border-gray-50">Joueur</th>
                <th className="px-6 py-4 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] text-center border-r border-gray-50 bg-indigo-50/30">Section 1 (S1)</th>
                <th className="px-6 py-4 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] text-center border-r border-gray-50 bg-indigo-50/30">Section 2 (S2)</th>
                <th className="px-6 py-4 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] text-center border-r border-gray-50 bg-indigo-50/30">Section 3 (S3)</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">% Progression</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-400 font-bold text-sm">
                    Aucun joueur trouvé.
                  </td>
                </tr>
              )}
              {filteredMembers.map((m) => {
                const pid = m.id;
                // Find existing results for this test
                const dbResult = results.find(r => (r.player_id === m.id || r.player_name === m.name) && r.test_type === activeTab) || {};

                const initials = m.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                const s1 = isEditing ? editedValues[pid]?.[activeTab]?.s1 : dbResult.s1;
                const s2 = isEditing ? editedValues[pid]?.[activeTab]?.s2 : dbResult.s2;
                const s3 = isEditing ? editedValues[pid]?.[activeTab]?.s3 : dbResult.s3;

                // Evolution logic: Compare S3 to S2, or S2 to S1
                let lastVal = null;
                let prevVal = null;
                if (s3 !== null && s3 !== undefined && s3 !== '') {
                  lastVal = s3;
                  if (s2 !== null && s2 !== undefined && s2 !== '') prevVal = s2;
                  else prevVal = s1; // Fallback if S2 is missing
                } else if (s2 !== null && s2 !== undefined && s2 !== '') {
                  lastVal = s2;
                  prevVal = s1;
                }

                return (
                  <tr key={pid} className="group hover:bg-indigo-50/20 transition-colors">
                    {/* JOUEUR */}
                    <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-indigo-50/10 border-r border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[10px] shadow-sm">
                          {initials}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-indigo-950 uppercase">{m.name}</div>
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{m.position}</div>
                        </div>
                      </div>
                    </td>

                    {/* S1 */}
                    <td className="px-6 py-4 text-center border-r border-gray-50 bg-indigo-50/10">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={s1 ?? ''}
                          onChange={(e) => handleValueChange(pid, 's1', e.target.value)}
                          className="w-20 p-2 text-center text-sm font-black text-indigo-900 border-2 border-indigo-100 rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                          placeholder="-"
                        />
                      ) : (
                        <span className="text-sm font-black text-gray-400">{s1 ?? '-'}</span>
                      )}
                    </td>

                    {/* S2 */}
                    <td className="px-6 py-4 text-center border-r border-gray-50 bg-indigo-50/10">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={s2 ?? ''}
                          onChange={(e) => handleValueChange(pid, 's2', e.target.value)}
                          className="w-20 p-2 text-center text-sm font-black text-indigo-900 border-2 border-indigo-100 rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                          placeholder="-"
                        />
                      ) : (
                        <span className="text-sm font-black text-indigo-900">{s2 ?? '-'}</span>
                      )}
                    </td>

                    {/* S3 */}
                    <td className="px-6 py-4 text-center border-r border-gray-50 bg-indigo-50/10">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={s3 ?? ''}
                          onChange={(e) => handleValueChange(pid, 's3', e.target.value)}
                          className="w-20 p-2 text-center text-sm font-black text-indigo-900 border-2 border-indigo-100 rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                          placeholder="-"
                        />
                      ) : (
                        <span className="text-sm font-black text-indigo-900">{s3 ?? '-'}</span>
                      )}
                    </td>

                    {/* % PROGRESSION */}
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {!isEditing ? (
                          <ImprovementBadge val1={prevVal} val2={lastVal} type={TEST_DESCRIPTIONS[activeTab].better} />
                        ) : (
                          <span className="text-[10px] text-gray-300 font-bold uppercase">--</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
