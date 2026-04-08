import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trophy, Info, ArrowUpRight, ArrowDownRight, Loader2, Users, Search } from 'lucide-react';

const TEST_DESCRIPTIONS = {
  vitesse: {
    label: 'Vitesse (20m)',
    desc: "Capacité d'accélération et vitesse de pointe sur une courte distance.",
    better: 'lower'
  },
  broadJump: {
    label: 'Broad Jump',
    desc: 'Saut en longueur sans élan pour mesurer la puissance explosive des membres inférieurs.',
    better: 'higher'
  },
  conduiteBalle: {
    label: 'Conduite de balle',
    desc: 'Test de maîtrise technique et de vitesse avec le ballon sur un parcours chronométré.',
    better: 'lower'
  },
  coordination: {
    label: 'Coordination',
    desc: 'Test Agilité / Coordination (Cazorla) mesurant la vivacité et les changements de direction.',
    better: 'lower'
  },
  jonglesSF: {
    label: 'Jongles (SF)',
    desc: 'Nombre de jongles consécutifs avec le pied fort.',
    better: 'higher'
  },
  jonglesWF: {
    label: 'Jongles (WF)',
    desc: 'Nombre de jongles consécutifs avec le pied faible.',
    better: 'higher'
  }
};

const CATEGORIES = ['U9', 'U10', 'U12', 'U13'];

const ImprovementBadge = ({ val1, val2, type }) => {
  if (val1 === null || val2 === null) return null;
  
  let improvement;
  if (type === 'lower') {
    // Time based: lower is better
    improvement = ((val1 - val2) / val1) * 100;
  } else {
    // Distance/Count based: higher is better
    improvement = ((val2 - val1) / val1) * 100;
  }

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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamCategory, setTeamCategory] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        // Load JSON data
        const res = await fetch('/tests-data.json');
        const jsonData = await res.json();
        setData(jsonData);

        // Try to detect category from active team
        const activeTeamId = localStorage.getItem('active_team_id');
        if (activeTeamId) {
          const { data: team } = await supabase
            .from('teams')
            .select('name')
            .eq('id', activeTeamId)
            .single();
          
          if (team) {
            const cat = CATEGORIES.find(c => team.name.toUpperCase().includes(c));
            if (cat) {
              setTeamCategory(cat);
              setSelectedCategory(cat);
            } else {
              setSelectedCategory(CATEGORIES[0]);
            }
          }
        } else {
          setSelectedCategory(CATEGORIES[0]);
        }
      } catch (e) {
        console.error("Failed to load test data", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const players = useMemo(() => {
    if (!data || !selectedCategory) return [];
    let list = data[selectedCategory] || [];
    if (searchTerm) {
      list = list.filter(p => p.firstName.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return list;
  }, [data, selectedCategory, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
        <Loader2 className="animate-spin w-10 h-10 text-indigo-500" />
        <p className="font-bold text-sm uppercase tracking-widest">Chargement des tests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-indigo-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-4 rounded-2xl shadow-xl shadow-indigo-200">
            <Trophy size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-indigo-950 tracking-tight">Tests Techniques & Athlétiques</h1>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">Bilans de performance saison 2023-2024</p>
          </div>
        </div>

        {/* Category Selector */}
        <div className="flex items-center p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${selectedCategory === cat ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Intro & Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(TEST_DESCRIPTIONS).map(([key, info]) => (
          <div key={key} className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-black text-indigo-900 text-sm uppercase tracking-wider">{info.label}</h3>
              <div className="p-1.5 bg-indigo-50 text-indigo-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Info size={14} />
              </div>
            </div>
            <p className="text-xs text-gray-500 font-medium leading-relaxed">{info.desc}</p>
          </div>
        ))}
      </div>

      {/* Main Results Board */}
      <div className="bg-white rounded-[32px] shadow-sm border border-indigo-50 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Users size={18} />
            </div>
            <h2 className="font-black text-indigo-900 text-sm uppercase tracking-widest">Résultats Individuels ({selectedCategory})</h2>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher un joueur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[600px] no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-white">
              <tr className="border-b border-gray-100 shadow-sm bg-white">
                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest sticky left-0 bg-white z-30 min-w-[150px]">Joueur</th>
                {Object.values(TEST_DESCRIPTIONS).map(test => (
                  <th key={test.label} className="p-4 text-center font-black text-gray-400 uppercase text-[10px] tracking-widest min-w-[280px]">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-indigo-900 text-xs">{test.label}</span>
                      <div className="flex gap-4 font-bold text-[9px] text-gray-400">
                        <span className="w-12">S1</span>
                        <span className="w-12">S2</span>
                        <span className="w-20 text-indigo-500">% Evolution</span>
                        <span className="w-12 text-gray-300 italic">S3</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {players.map((p, idx) => (
                <tr key={`${p.firstName}-${idx}`} className="hover:bg-indigo-50/20 transition-colors group">
                  <td className="p-4 font-black text-indigo-900 text-sm uppercase tracking-tight sticky left-0 bg-white group-hover:bg-indigo-50/40 z-10 transition-colors">
                    {p.firstName}
                  </td>
                  {Object.entries(TEST_DESCRIPTIONS).map(([key, info]) => {
                    const s1Val = p.s1[key];
                    const s2Val = p.s2 ? p.s2[key] : null;
                    return (
                      <td key={key} className="p-4">
                        <div className="flex justify-center items-center gap-4">
                          <span className="w-12 text-center text-xs font-bold text-gray-400">{s1Val || '-'}</span>
                          <span className="w-12 text-center text-xs font-black text-gray-800">{s2Val || '-'}</span>
                          <div className="w-20 flex justify-center">
                            <ImprovementBadge val1={s1Val} val2={s2Val} type={info.better} />
                          </div>
                          <span className="w-12 text-center text-[10px] font-bold text-gray-200 italic">-</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {players.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <Search className="text-gray-200" size={48} />
              <p className="text-gray-400 font-bold italic">Aucun joueur trouvé pour cette recherche...</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center gap-2 p-4 bg-indigo-50 rounded-2xl text-indigo-700">
        <Info size={18} />
        <p className="text-[11px] font-bold uppercase tracking-wider">
          La session 3 est prévue en fin de saison. Le calcul d'évolution compare la Session 2 par rapport à la Session 1.
        </p>
      </div>
    </div>
  );
}
