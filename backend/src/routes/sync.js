const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// For now, we use a placeholder or environment variable for the Apps Script URL
// Coach Yassine will need to provide this URL after deploying the script
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SHEETS_SYNC_URL;

router.post('/google-sheets', async (req, res) => {
    try {
        const { teamName, data } = req.body;

        console.log(`[SYNC] Received sync request for ${teamName} (${data.length} players)`);

        if (!GOOGLE_SCRIPT_URL) {
            console.warn("[SYNC] GOOGLE_SHEETS_SYNC_URL not set. Logging data to console instead.");
            console.log(JSON.stringify({ teamName, data }, null, 2));
            return res.json({
                success: true,
                message: "Sync simulée (URL non configurée). Les données ont été logguées sur le serveur."
            });
        }

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamName, data })
        });

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error("[SYNC] Error:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
