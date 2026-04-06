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
        setMessage("VÃ©rifiez votre email pour confirmer l\\'inscription (si activÃ©).");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const accessToken = data.session?.access_token;
        if (accessToken) localStorage.setItem("sb_access_token", accessToken);
        setMessage("ConnectÃ©");
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
        {mode === "login" ? "CrÃ©er un compte" : "DÃ©jÃ  inscrit ?"}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
