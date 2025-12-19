import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LogOut, Home, Users, Calendar, MessageSquare, User, Layers } from 'lucide-react';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const navItems = [
        { path: '/dashboard', label: 'Accueil', icon: Home },
        { path: '/dashboard/team', label: 'Équipe', icon: Users },
        { path: '/dashboard/groups', label: 'Groupes', icon: Layers },
        { path: '/dashboard/events', label: 'Events', icon: Calendar },
        { path: '/dashboard/chat', label: 'Chat', icon: MessageSquare },
        { path: '/dashboard/profile', label: 'Profil', icon: User },
    ];

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans pb-16 md:pb-0">
            {/* Desktop Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10 hidden md:block">
                <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                    <Link to="/" className="text-xl font-bold text-indigo-600 flex items-center gap-2">
                        <img src="/logo_soissons.jpg" alt="Soissons-IFC" className="h-8 w-auto" />
                        <span>Soissons-IFC</span>
                    </Link>
                    <nav className="flex items-center gap-4">
                        {navItems.map(item => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`text-sm font-medium hover:text-indigo-600 ${location.pathname === item.path ? 'text-indigo-600' : 'text-gray-600'}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 ml-2" title="Logout">
                            <LogOut size={20} />
                        </button>
                    </nav>
                </div>
            </header>

            {/* Mobile Header (Simplified) */}
            <header className="bg-white shadow-sm sticky top-0 z-10 md:hidden flex justify-between items-center px-4 py-3">
                <div className="flex items-center gap-2">
                    <img src="/logo_soissons.jpg" alt="Soissons-IFC" className="h-6 w-auto" />
                    <span className="font-bold text-indigo-600 text-lg">Soissons-IFC</span>
                </div>
                <button onClick={handleLogout} className="text-gray-400">
                    <LogOut size={18} />
                </button>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4">
                <Outlet />
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around py-2 z-50 md:hidden safe-area-pb">
                {navItems.map(item => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center gap-1 min-w-[64px] ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
