
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Team from './pages/Team';
import SkillsDashboard from './pages/SkillsDashboard';
import Events from './pages/Events';
import Chat from './pages/Chat';
import LandingPage from './pages/LandingPage';
import Profile from './pages/Profile';
import TestsDashboard from './pages/TestsDashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initialize OneSignal (Web Push)
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: "49f496fd-5137-4256-a3ad-26333b3fb56d",
          safari_web_id: "web.onesignal.auto.0860f031-816f-4b4e-9724-08fcd0b320db",
          notifyButton: { enable: false },
        });
      } catch (err) {
        console.error("OneSignal init error:", err);
      }
    });

    // Guard to prevent multiple adjacent login calls for the same user
    let lastLoggedInId = null;

    const handleOneSignalAuth = (userSession) => {
      const userId = userSession?.user?.id;

      if (userId) {
        if (lastLoggedInId === userId) return; // Already triggered for this user
        lastLoggedInId = userId;

        window.OneSignalDeferred.push(async (OneSignal) => {
          try {
            await OneSignal.login(userId);
            console.log("OneSignal login success:", userId);
          } catch (err) {
            console.error("OneSignal login error:", err);
          }
        });
      } else {
        if (lastLoggedInId === null) return; // Already logged out or never logged in
        lastLoggedInId = null;

        window.OneSignalDeferred.push(async (OneSignal) => {
          try {
            await OneSignal.logout();
            console.log("OneSignal logout success");
          } catch (err) {
            console.error("OneSignal logout error:", err);
          }
        });
      }
    };

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      handleOneSignalAuth(session);
      setLoading(false);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      handleOneSignalAuth(session);
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
          <Route path="skills" element={<SkillsDashboard />} />
          <Route path="events" element={<Events />} />
          <Route path="chat" element={<Chat />} />
          <Route path="profile" element={<Profile />} />
          <Route path="tests" element={<TestsDashboard />} />
        </Route>

        {/* Catch all - Redirect to home/dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
