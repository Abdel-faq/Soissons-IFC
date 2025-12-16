import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, Users } from 'lucide-react';

export default function LandingPage() {
    const navigate = useNavigate();
    const [showRoles, setShowRoles] = useState(false);

    // Image URL - Using the generated artifact path logic or a placeholder if local file access is tricky in browser
    // For now I will use a placeholder or relative path if I can move the file. 
    // Since I cannot easily move files to "public" in this environment without knowing public structure, 
    // I will use a high quality Unsplash equivalent or the "imported" asset approach if I could.
    // Let's use a nice Unsplash football image for reliability in "preview".
    const bgImage = "https://images.unsplash.com/photo-1517466787929-bc90951d0974?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80";

    const handleRoleSelect = (role) => {
        // In a real app, we might pass state or just redirect to Login.
        // For simple flow, all roles go to Login, but we could preset the "mode".
        navigate('/login', { state: { role } });
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Hero Section */}
            <div className="relative h-[80vh] w-full overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${bgImage})` }}
                >
                    <div className="absolute inset-0 bg-black/40" />
                </div>

                <div className="relative z-10 h-full flex flex-col items-center justify-center text-white px-4 text-center">
                    <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight drop-shadow-lg">
                        BIENVENUE AU SOISSONS IFC
                    </h1>
                    <p className="text-xl md:text-3xl max-w-2xl mb-8 font-light drop-shadow-md">
                        Le football pour tous, la passion pour chacun.
                        <br />
                        <span className="text-yellow-400 font-bold mt-2 block text-lg">Rejoignez nos futures pépites de U6 à Senior !</span>
                    </p>

                    {!showRoles ? (
                        <button
                            onClick={() => setShowRoles(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl font-bold py-4 px-10 rounded-full transition-all transform hover:scale-105 shadow-xl"
                        >
                            CONNEXION / INSCRIPTION
                        </button>
                    ) : (
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 animate-fade-in-up">
                            <h3 className="text-xl font-bold mb-4">Je suis...</h3>
                            <div className="flex flex-col md:flex-row gap-4">
                                <button onClick={() => handleRoleSelect('PLAYER')} className="flex flex-col items-center gap-2 bg-white/90 hover:bg-white text-indigo-900 p-4 rounded-xl w-32 transition-all hover:-translate-y-1">
                                    <User size={32} />
                                    <span className="font-bold">JOUEUR</span>
                                </button>
                                <button onClick={() => handleRoleSelect('COACH')} className="flex flex-col items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-xl w-32 transition-all hover:-translate-y-1">
                                    <Shield size={32} />
                                    <span className="font-bold">COACH</span>
                                </button>
                                <button onClick={() => handleRoleSelect('ADMIN')} className="flex flex-col items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white p-4 rounded-xl w-32 transition-all hover:-translate-y-1">
                                    <Users size={32} />
                                    <span className="font-bold">ADMIN</span>
                                </button>
                            </div>
                            <button onClick={() => setShowRoles(false)} className="mt-4 text-sm text-gray-300 hover:text-white underline">Retour</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Section */}
            <div className="py-16 px-4 bg-white text-center">
                <h2 className="text-3xl font-bold text-gray-800 mb-8">Pourquoi nous rejoindre ?</h2>
                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    <div className="p-6">
                        <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚽</div>
                        <h3 className="text-xl font-bold mb-2">Formation de Qualité</h3>
                        <p className="text-gray-600">Des coachs passionnés pour accompagner chaque enfant, du Baby Foot aux équipes Seniors.</p>
                    </div>
                    <div className="p-6">
                        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🤝</div>
                        <h3 className="text-xl font-bold mb-2">Esprit d'Équipe</h3>
                        <p className="text-gray-600">Plus qu'un club, une famille. Apprendre le respect, la solidarité et le dépassement de soi.</p>
                    </div>
                    <div className="p-6">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🏆</div>
                        <h3 className="text-xl font-bold mb-2">Compétition & Loisir</h3>
                        <p className="text-gray-600">Des tournois, des championnats, mais surtout du plaisir à chaque match.</p>
                    </div>
                </div>
            </div>

            <footer className="bg-gray-900 text-white py-8 text-center">
                <p>&copy; 2024 Soissons IFC. Tous droits réservés.</p>
            </footer>
        </div>
    );
}
