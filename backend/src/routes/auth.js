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
