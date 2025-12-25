
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Determine Role Title
    const role = location.state?.role;
    let title = "Bienvenue 👋";
    if (role === 'COACH') title = "Espace Coach 🛡️";
    if (role === 'PLAYER') title = "Espace Joueur ⚽";
    if (role === 'ADMIN') title = "Espace Admin 🔑";

    const validateInputs = () => {
        if (!email || !password) {
            setError("Merci de remplir tous les champs et de mettre une adresse mail valide");
            return false;
        }
        return true;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!validateInputs()) return;

        setLoading(true);
        setError(null);

        const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({ email, password });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        // --- Role Verification ---
        if (session?.user) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            const targetRole = role; // The role from location.state.role

            if (profile && targetRole && profile.role !== targetRole) {
                await supabase.auth.signOut();
                setError(`Accès refusé : vous n'avez pas le rôle requis pour cet espace (${targetRole === 'COACH' ? 'Coach' : 'Joueur'}).`);
                setLoading(false);
                return;
            }
        }

        navigate('/dashboard'); // Direct to dashboard if all good
        setLoading(false);
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        if (!validateInputs()) return;

        setLoading(true);
        setError(null);
        // Default role based on entry point, fallback to Player if unknown
        const targetRole = role || 'PLAYER';

        const { data: { user }, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: email.split('@')[0] }
            }
        });

        if (error) {
            if (error.message.includes("Anonymous sign-ins are disabled")) {
                setError("Merci de remplir tous les champs et de mettre une adresse mail valide");
            } else {
                setError(error.message);
            }
        } else {
            if (user) {
                const { error: profileError } = await supabase.from('profiles').insert([
                    { id: user.id, email: user.email, full_name: email.split('@')[0], role: targetRole }
                ]);
                if (profileError) console.error('Error creating profile:', profileError);
            }
            setMessage('Vérifiez votre email pour confirmer !');
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center text-indigo-700">{title}</h1>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
                {message && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{message}</div>}

                <form className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50 p-2 border text-gray-900"
                            placeholder="coach@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50 p-2 border text-gray-900"
                            required
                        />
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button
                            onClick={handleLogin}
                            disabled={loading}
                            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 disabled:opacity-50 font-medium"
                        >
                            {loading ? '...' : 'Connexion'}
                        </button>
                        <button
                            onClick={handleSignUp}
                            disabled={loading}
                            className="flex-1 bg-white text-indigo-600 border border-indigo-600 py-2 px-4 rounded hover:bg-indigo-50 disabled:opacity-50 font-medium"
                        >
                            Inscription
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
