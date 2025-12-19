const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("Supabase auth error:", error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch role from profiles
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr) {
      console.error("Profile fetch error:", profileErr);
      // Fallback or error? Let's error if we need role for routes
    }

    user.role = profile?.role;
    console.log(`User ${user.email} authenticated with role: ${user.role}`);

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware global error:", err);
    res.status(500).json({ error: 'Internal server error during auth' });
  }
};

module.exports = { requireAuth, supabase };
