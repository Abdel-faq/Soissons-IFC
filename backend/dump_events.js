require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
    try {
        console.log("Fetching events for 18th April 2026...");
        const { data, error } = await supabase
            .from('events')
            .select('id, team_id, type, date, is_deleted')
            .gte('date', '2026-04-18T00:00:00Z')
            .lte('date', '2026-04-18T23:59:59Z');

        if (error) throw error;

        // Also fetch attendance for these
        const ids = data.map(d => d.id);
        const { data: att } = await supabase
            .from('attendance')
            .select('event_id, player_id, is_convoked, status')
            .in('event_id', ids);

        const result = {
            events: data,
            attendance: att
        };

        fs.writeFileSync('C:\\Users\\geii\\Desktop\\mon-projet\\mon-projet\\backend\\dump_apr18.json', JSON.stringify(result, null, 2));
        console.log("Done. Saved 18th April to dump_apr18.json");
    } catch (e) {
        console.error("Script error:", e);
    }
    process.exit(0);
})();
