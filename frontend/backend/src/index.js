require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const eventsRouterFactory = require("./routes/events");
const authRouterFactory = require("./routes/auth");
const groupsRouter = require("./routes/groups");

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
app.use("/api/groups", groupsRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on ${port}`));
