
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Team from './pages/Team';
import Events from './pages/Events';
import Chat from './pages/Chat';
import LandingPage from './pages/LandingPage';
import Profile from './pages/Profile';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initialize OneSignal (Web Push)
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      await OneSignal.init({
        appId: "49f496fd-5137-4256-a3ad-26333b3fb56d",
        safari_web_id: "web.onesignal.auto.0860f031-816f-4b4e-9724-08fcd0b320db",
        notifyButton: {
          enable: false,
        },
      });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        window.OneSignalDeferred.push(async (OneSignal) => {
          await OneSignal.login(session.user.id);
          console.log("OneSignal logged in for:", session.user.id);
        });
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        window.OneSignalDeferred.push(async (OneSignal) => {
          await OneSignal.login(session.user.id);
          console.log("OneSignal auth change login:", session.user.id);
        });
      } else {
        window.OneSignalDeferred.push(async (OneSignal) => {
          await OneSignal.logout();
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // Protected Route Wrapper
  const ProtectedRoute = ({ children }) => {
    if (!session) return <Navigate to="/" replace />;
    return children;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" replace />} />

        {/* Landing Page is Public */}
        <Route path="/" element={!session ? <LandingPage /> : <Navigate to="/dashboard" replace />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="team" element={<Team />} />
          <Route path="events" element={<Events />} />
          <Route path="chat" element={<Chat />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Catch all - Redirect to home/dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
