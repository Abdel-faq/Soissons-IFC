# create_scaffold.ps1
# Usage: from mon-projet root: .\create_scaffold.ps1
# This script will create folders and files for the scaffold.

# Helper to write file with parent dir creation
function Write-File ($path, $content) {
  $dir = Split-Path $path
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $content | Out-File -FilePath $path -Encoding utf8 -Force
  Write-Host "Wrote $path"
}

# .env.example
$envExample = @'
# Example environment variables (do NOT commit real secrets)
SUPABASE_URL=
SUPABASE_KEY=
PORT=3000

# For frontend (Vite) prefix with VITE_
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=
'@
Write-File -path ".\env.example" -content $envExample

# README.md
$readme = @'
# Mon-Projet — Scaffold minimal

Prérequis:
- Node.js 18+
- Git
- Une instance Supabase (URL + KEY) — ne commitez pas la clé secrète.

Démarrage local (PowerShell)

# Backend
cd .\backend\
npm install
# créer .env avec les valeurs (voir .env.example)
$env:SUPABASE_URL="https://...supabase.co"
$env:SUPABASE_KEY="your_service_key"
npm run dev

# Frontend (dans un autre terminal)
cd .\frontend\
npm install
# Créer .env.local ou définir VITE_SUPABASE_* env vars
npm run dev

Sécurité
- Ne pas committer de clé secrète. Si la clé a été exposée, révoquez/regénérez-la dans Supabase.
'@
Write-File -path ".\README.md" -content $readme

# backend/package.json
$backendPkg = @'
{
  "name": "mon-projet-backend",
  "version": "0.1.0",
  "main": "src/index.js",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.23.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
'@
Write-File -path ".\backend\package.json" -content $backendPkg

# backend/src/index.js
$backendIndex = @'
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const eventsRouterFactory = require("./routes/events");
const authRouterFactory = require("./routes/auth");

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("Supabase env vars not set. See .env.example");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "");

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/events", eventsRouterFactory(supabase));
app.use("/api/auth", authRouterFactory(supabase));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on ${port}`));
'@
Write-File -path ".\backend\src\index.js" -content $backendIndex

# backend/src/routes/events.js
$eventsJs = @'
const express = require("express");

module.exports = function (supabase) {
  const router = express.Router();

  // Get events (simple)
  router.get("/", async (req, res) => {
    try {
      const { data, error } = await supabase.from("events").select("*").limit(100);
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create event (basic)
  router.post("/", async (req, res) => {
    try {
      const payload = req.body;
      const { data, error } = await supabase.from("events").insert([payload]).select();
      if (error) return res.status(500).json({ error: error.message });
      res.status(201).json(data[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
'@
Write-File -path ".\backend\src\routes\events.js" -content $eventsJs

# backend/src/routes/auth.js
$authJs = @'
const express = require("express");

module.exports = function (supabase) {
  const router = express.Router();

  // Validate token and return supabase auth user + profile (profiles table)
  router.post("/validate", async (req, res) => {
    try {
      const authHeader = req.get("authorization") || "";
      const token = (authHeader.startsWith("Bearer ") && authHeader.split(" ")[1]) || req.body?.access_token;
      if (!token) return res.status(401).json({ error: "No token" });

      // Validate token with Supabase
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData?.user) return res.status(401).json({ error: userErr?.message || "Invalid token" });

      // Try to fetch profile from 'profiles' table
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .limit(1)
        .single();

      return res.json({ user: userData.user, profile: profile || null });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};
'@
Write-File -path ".\backend\src\routes\auth.js" -content $authJs

# frontend/package.json
$frontendPkg = @'
{
  "name": "mon-projet-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.23.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
'@
Write-File -path ".\frontend\package.json" -content $frontendPkg

# frontend/index.html
$indexHtml = @'
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mon Projet - Frontend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
'@
Write-File -path ".\frontend\index.html" -content $indexHtml

# frontend/src/main.jsx
$mainJsx = @'
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")).render(<App />);
'@
Write-File -path ".\frontend\src\main.jsx" -content $mainJsx

# frontend/src/App.jsx
$appJsx = @'
import React, { useEffect, useState } from "react";

export default function App() {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    fetch("/api/events")
      .then(r => r.json())
      .then(setEvents)
      .catch(console.error);
  }, []);
  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>Mon-Projet — Dashboard (démo)</h1>
      <p>Liste des événements (GET /api/events)</p>
      <ul>
        {events.length === 0 && <li>Aucun événement trouvé</li>}
        {events.map(ev => (
          <li key={ev.id}>{ev.type} — {ev.date} — {ev.place || ""}</li>
        ))}
      </ul>
      <p>Voir <code>backend/src/routes/events.js</code> pour l'API.</p>
    </div>
  );
}
'@
Write-File -path ".\frontend\src\App.jsx" -content $appJsx

# frontend/src/lib/supabaseClient.js
$supaclient = @'
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
'@
Write-File -path ".\frontend\src\lib\supabaseClient.js" -content $supaclient

# frontend/src/pages/Auth.jsx
$authPage = @'
import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // or "signup"
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Vérifiez votre email pour confirmer l\\'inscription (si activé).");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const accessToken = data.session?.access_token;
        if (accessToken) localStorage.setItem("sb_access_token", accessToken);
        setMessage("Connecté");
      }
    } catch (err) {
      setMessage(err.message || "Erreur");
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>{mode === "signup" ? "Inscription" : "Connexion"}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email</label><br/>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <label>Mot de passe</label><br/>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" required />
        </div>
        <button type="submit">{mode === "signup" ? "S\\'inscrire" : "Se connecter"}</button>
      </form>
      <button onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "Créer un compte" : "Déjà inscrit ?"}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
'@
Write-File -path ".\frontend\src\pages\Auth.jsx" -content $authPage

Write-Host "Scaffold creation complete. Run 'cd backend; npm install' and 'cd frontend; npm install' then start servers as described in README."