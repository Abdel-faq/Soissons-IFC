import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trophy, Info, ArrowUpRight, ArrowDownRight, Loader2, Users, Search, Save, Edit2, X, Download } from 'lucide-react';

const TEST_DESCRIPTIONS = {
  vitesse: { label: 'Vitesse (20m)', desc: "Capacité d'accélération et vitesse de pointe.", better: 'lower' },
  broadJump: { label: 'Broad Jump', desc: 'Puissance explosive membres inférieurs.', better: 'higher' },
  conduiteBalle: { label: 'Conduite de balle', desc: 'Maîtrise technique et vitesse avec ballon.', better: 'lower' },
  coordination: { label: 'Coordination', desc: 'Vivacité et changements de direction.', better: 'lower' },
  jonglesSF: { label: 'Jongles (SF)', desc: 'Nombre de jongles pied fort.', better: 'higher' },
  jonglesWF: { label: 'Jongles (WF)', desc: 'Nombre de jongles pied faible.', better: 'higher' }
};

const ImprovementBadge = ({ val1, val2, type }) => {
  if (!val1 || !val2) return null;
  const improvement = type === 'lower' ? ((val1 - val2) / val1) * 100 : ((val2 - val1) / val1) * 100;
  const isPositive = improvement > 0;
  const absImp = Math.abs(improvement).toFixed(1);
  if (Math.abs(improvement) < 0.1) return null;
  return (
    <div className={`flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {absImp}%
    </div>
  );
};

export default function TestsDashboard() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [team, setTeam] = useState(null);
  const [isCoach, setIsCoach] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState({}); // { player_name: { test_type: { s1, s2, s3 } } }
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

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
        setIsCoach(teamData.coach_id === user?.id);
      }

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
    results.forEach(r => {
      if (!initial[r.player_name]) initial[r.player_name] = {};
      initial[r.player_name][r.test_type] = { s1: r.s1, s2: r.s2, s3: r.s3, id: r.id };
    });
    setEditedValues(initial);
    setIsEditing(true);
  };

  const handleValueChange = (playerName, testType, field, value) => {
    setEditedValues(prev => ({
      ...prev,
      [playerName]: {
        ...prev[playerName],
        [testType]: {
            ...prev[playerName][testType],
            [field]: value === '' ? null : parseFloat(value)
        }
      }
    }));
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      const rows = [];
      Object.entries(editedValues).forEach(([playerName, tests]) => {
        Object.entries(tests).forEach(([testType, vals]) => {
          rows.push({
            id: vals.id,
            team_id: team.id,
            player_name: playerName,
            test_type: testType,
            s1: vals.s1,
            s2: vals.s2,
            s3: vals.s3,
            player_id: results.find(r => r.player_name === playerName)?.player_id || null
          });
        });
      });

      const { error } = await supabase.from('test_results').upsert(rows);
      if (error) throw error;
      
      await fetchResults();
      setIsEditing(false);
    } catch (e) {
      alert("Erreur lors de la sauvegarde : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const migrateFromJson = async () => {
    if (!window.confirm("Voulez-vous importer les données initiales depuis le fichier JSON ?")) return;
    try {
      setSaving(true);
      const res = await fetch('/tests-data.json');
      const jsonData = await res.json();
      
      // Get category from team name
      const catKey = ['U9', 'U10', 'U12', 'U13'].find(c => team.name.includes(c));
      const playersData = jsonData[catKey];
      if (!playersData) {
        alert("Aucune donnée correspondante trouvée dans le JSON pour " + team.name);
        return;
      }

      // Fetch members for mapping
      const { data: members } = await supabase.from('team_members').select('player_id, players(id, first_name)').eq('team_id', team.id);
      const dbPlayers = (members || []).map(m => m.players).filter(Boolean);

      const rows = [];
      playersData.forEach(p => {
        const match = dbPlayers.find(dp => dp.first_name.toLowerCase() === p.firstName.toLowerCase());
        Object.keys(TEST_DESCRIPTIONS).forEach(testType => {
          rows.push({
            team_id: team.id,
            player_name: p.firstName,
            player_id: match ? match.id : null,
            test_type: testType,
            s1: p.s1[testType] || null,
            s2: p.s2 ? p.s2[testType] : null,
            s3: null
          });
        });
      });

      const { error } = await supabase.from('test_results').upsert(rows, { onConflict: 'team_id,player_name,test_type' });
      if (error) throw error;
      alert("Migration réussie !");
      fetchResults();
    } catch (e) {
      alert("Erreur migration : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Group results by player
  const playerGroups = useMemo(() => {
    const groups = {};
    results.forEach(r => {
      if (!groups[r.player_name]) groups[r.player_name] = {};
      groups[r.player_name][r.test_type] = r;
    });
    
    let list = Object.entries(groups).map(([name, tests]) => ({ name, tests }));
    if (searchTerm) {
      list = list.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [results, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
        <Loader2 className="animate-spin w-10 h-10 text-indigo-500" />
        <p className="font-bold text-sm uppercase tracking-widest text-indigo-900/40">Chargement des performances...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-indigo-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5 text-center md:text-left">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-4 rounded-2xl shadow-xl shadow-indigo-200">
            <Trophy size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-indigo-950 tracking-tight">Performances Athlétiques</h1>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">
              Tableau de bord - {team?.name || 'Équipe'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isCoach && !isEditing && (
            <>
              {results.length === 0 && (
                <button onClick={migrateFromJson} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl text-xs font-black shadow-sm hover:shadow-md transition-all">
                  <Download size={16} /> Importer JSON
                </button>
              )}
              <button 
                onClick={startEditing}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all hover:-translate-y-0.5"
              >
                <Edit2 size={16} /> Modifier les scores
              </button>
            </>
          )}

          {isEditing && (
            <>
              <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl text-xs font-black hover:bg-gray-200 transition-all">
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

      {/* Main Board */}
      <div className="bg-white rounded-[40px] shadow-sm border border-indigo-50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Users size={18} />
            </div>
            <h2 className="font-black text-indigo-900 text-sm uppercase tracking-widest">Tableau des Résultats</h2>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher un joueur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[700px] no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-white">
              <tr className="border-b border-gray-100 shadow-sm bg-white">
                <th className="p-6 font-black text-gray-400 uppercase text-[10px] tracking-widest sticky left-0 bg-white z-30 min-w-[200px]">Joueur</th>
                {Object.values(TEST_DESCRIPTIONS).map(test => (
                  <th key={test.label} className="p-4 text-center sticky top-0 bg-white z-20 min-w-[280px]">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-indigo-950 font-black text-[11px] uppercase tracking-tighter">{test.label}</span>
                      <div className="flex gap-4 font-bold text-[9px] text-gray-300 uppercase italic">
                        <span className="w-12">S1</span>
                        <span className="w-12">S2</span>
                        <span className="w-12">S3</span>
                        <span className="w-20 text-indigo-500 font-black not-italic tracking-widest">EVOL.</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {playerGroups.map(({ name, tests }) => (
                <tr key={name} className="hover:bg-indigo-50/20 transition-colors group">
                  <td className="p-6 font-black text-indigo-900 text-sm uppercase tracking-tight sticky left-0 bg-white group-hover:bg-indigo-50/40 z-10 transition-colors flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center text-[10px]">{name[0]}</div>
                    {name}
                  </td>
                  {Object.keys(TEST_DESCRIPTIONS).map(testType => {
                    const test = tests[testType] || {};
                    const s1 = isEditing ? editedValues[name]?.[testType]?.s1 : test.s1;
                    const s2 = isEditing ? editedValues[name]?.[testType]?.s2 : test.s2;
                    const s3 = isEditing ? editedValues[name]?.[testType]?.s3 : test.s3;
                    
                    // Evolution logic: compare last two non-null values (usually S2 vs S1)
                    const lastVal = s3 || s2;
                    const prevVal = s3 ? s2 : s1;

                    return (
                      <td key={testType} className="p-4">
                        <div className="flex justify-center items-center gap-4">
                          {[ 's1', 's2', 's3' ].map(field => (
                            <div key={field} className="w-12">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editedValues[name]?.[testType]?.[field] ?? ''}
                                  onChange={(e) => handleValueChange(name, testType, field, e.target.value)}
                                  className="w-full p-1 bg-gray-50 border border-gray-200 rounded text-center text-xs font-black text-indigo-600 outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              ) : (
                                <span className={`text-xs font-bold text-center block ${field === 's1' ? 'text-gray-400' : 'text-gray-800'}`}>
                                  {tests[testType]?.[field] ?? '-'}
                                </span>
                              )}
                            </div>
                          ))}
                          
                          <div className="w-20 flex justify-center">
                            {!isEditing && <ImprovementBadge val1={prevVal} val2={lastVal} type={TEST_DESCRIPTIONS[testType].better} />}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Intro & Help */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(TEST_DESCRIPTIONS).map(([key, info]) => (
          <div key={key} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-black text-indigo-900 text-xs uppercase tracking-wider">{info.label}</h3>
              <div className="p-1.5 bg-indigo-50 text-indigo-400 rounded-lg">
                <Info size={14} />
              </div>
            </div>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed uppercase">{info.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
