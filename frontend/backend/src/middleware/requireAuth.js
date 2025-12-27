module.exports = function (supabase) {
  return async function requireAuth(req, res, next) {
    try {
      const authHeader = req.get("authorization") || "";
      const token = (authHeader.startsWith("Bearer ") && authHeader.split(" ")[1]) || null;
      if (!token) return res.status(401).json({ error: "Missing token" });

      const { data: userData, error } = await supabase.auth.getUser(token);
      if (error || !userData?.user) return res.status(401).json({ error: error?.message || "Invalid token" });

      req.user = userData.user;

      // optional profile fetch
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userData.user.id).limit(1).single();
      req.profile = profile || null;

      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
};