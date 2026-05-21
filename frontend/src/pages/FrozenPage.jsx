import React from 'react';
import { ShieldAlert, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FrozenPage({ title }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl shadow-lg border border-yellow-100 text-center animate-in fade-in zoom-in-95 duration-200">
      <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-amber-200">
        <ShieldAlert className="text-amber-500 w-8 h-8" />
      </div>
      
      <h2 className="text-xl font-bold text-gray-800 mb-2">
        Page {title ? `"${title}"` : ''} temporairement suspendue
      </h2>
      
      <p className="text-gray-600 text-sm mb-6 leading-relaxed">
        Afin de ne pas dépasser le quota mensuel de données de notre base de données (72% consommés) et d'éviter un blocage total, cette page est gelée jusqu'au <strong>5 du mois prochain</strong>.
      </p>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-6">
        <p className="text-indigo-900 text-xs font-semibold mb-2">
          Seule la page des Événements reste active pour vous permettre de voir vos convocations et matchs.
        </p>
        <button
          onClick={() => navigate('/dashboard/events')}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
        >
          <Calendar size={14} />
          Accéder aux Événements
        </button>
      </div>

      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
        Soissons IFC • Optimisation de bande passante
      </p>
    </div>
  );
}
