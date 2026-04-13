require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const TEST_MAP = {
  // U9 / Original style
  'Vitesse 20 m': 'vitesse',
  'Broad jump': 'broadJump',
  'Conduite': 'conduiteBalle',
  'Agilité': 'coordination',
  'Bon pied': 'jonglesSF',
  'Jongles mauvais pied': 'jonglesWF',
  // U10, U12, U13 style
  '20 m': 'vitesse',
  'BJ': 'broadJump',
  'Cazorla': 'coordination',
  'Jongles SF': 'jonglesSF',
  'Jongles WF': 'jonglesWF'
};

const CATEGORIES = [
  { name: 'U9', file: '../Tests/Testing 1 U9.xlsx' },
  { name: 'U10', file: '../Tests/Testing 1 U10.xlsx' },
  { name: 'U12', file: '../Tests/Testing 1 U12.xlsx' },
  { name: 'U13', file: '../Tests/Testing 1 U13.xlsx' }
];

async function run() {
  console.log("Starting Excel import...");

  for (const cat of CATEGORIES) {
    if (!fs.existsSync(cat.file)) {
      console.log(`Skipping ${cat.name}, file not found: ${cat.file}`);
      continue;
    }

    console.log(`\n--- Processing ${cat.name} ---`);
    // Find the team
    const { data: teams } = await supabase.from('teams').select('id, name').ilike('name', `%${cat.name}%`);
    if (!teams || teams.length === 0) {
      console.log(`No team found for ${cat.name}`);
      continue;
    }
    const team = teams[0];
    console.log(`Found team: ${team.name} (${team.id})`);

    // Get members
    const { data: membersData } = await supabase
      .from('team_members')
      .select('player_id, user_id, players(id, first_name, full_name), profiles(id, first_name, full_name)')
      .eq('team_id', team.id);

    const members = (membersData || []).map(m => {
      return {
        id: m.player_id || m.user_id,
        isPlayer: !!m.player_id,
        firstName: (m.players?.first_name || m.players?.full_name?.split(' ')[0] || m.profiles?.first_name || m.profiles?.full_name?.split(' ')[0] || '').toLowerCase()
      };
    }).filter(m => m.firstName);

    console.log(`Found ${members.length} members with first names.`);

    // Read Excel
    const wb = xlsx.readFile(cat.file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Get unique dates to determine S1 vs S2
    const dates = Array.from(new Set(data.map(r => r.Date).filter(d => d))).sort((a, b) => a - b);
    const dateToSection = {};
    if (dates.length > 0) dateToSection[dates[0]] = 's1';
    if (dates.length > 1) dateToSection[dates[1]] = 's2';
    if (dates.length > 2) dateToSection[dates[2]] = 's3';

    // Group by player then test
    const extracted = {};
    for (const row of data) {
      const prenom = (row['Prénom'] || '').toString().toLowerCase().trim();
      const rawTest = row['Test'] ? row['Test'].trim() : null;
      const perf = row['Perf'] !== undefined && row['Perf'] !== null && row['Perf'] !== '' ? parseFloat(row['Perf']) : null;
      const date = row['Date'];

      if (!prenom || !rawTest || perf === null || isNaN(perf) || !dateToSection[date]) continue;

      const testType = TEST_MAP[rawTest];
      if (!testType) {
        console.log(`Unmapped test: ${rawTest}`);
        continue;
      }

      const section = dateToSection[date];

      if (!extracted[prenom]) extracted[prenom] = {};
      if (!extracted[prenom][testType]) extracted[prenom][testType] = {};
      extracted[prenom][testType][section] = perf;
    }

    // Now match with members and prepare rows
    const rowsToUpsert = [];
    let matchCount = 0;

    for (const [prenom, tests] of Object.entries(extracted)) {
      // Find matching member by first name
      const match = members.find(m => m.firstName.includes(prenom) || prenom.includes(m.firstName));
      if (!match) {
        console.log(`❌ No member match found for Excel name: "${prenom}". Skipping.`);
        continue;
      }

      matchCount++;

      for (const [testType, vals] of Object.entries(tests)) {
        rowsToUpsert.push({
          team_id: team.id,
          player_name: match.firstName, // fallback
          player_id: match.isPlayer ? match.id : null,
          test_type: testType,
          s1: vals.s1 !== undefined ? vals.s1 : null,
          s2: vals.s2 !== undefined ? vals.s2 : null,
          s3: vals.s3 !== undefined ? vals.s3 : null
        });
      }
    }

    console.log(`Matched ${matchCount} players from Excel to DB.`);

    if (rowsToUpsert.length > 0) {
      // To properly upsert, delete existing ones for these players and team, or use upsert.
      // Since test_results might not have unique constraint reliably handling player_id vs player_name everywhere, 
      // let's do a fast delete then insert for matched players.
      const playerIds = Array.from(new Set(rowsToUpsert.map(r => r.player_id).filter(Boolean)));

      if (playerIds.length > 0) {
        await supabase.from('test_results')
          .delete()
          .eq('team_id', team.id)
          .in('player_id', playerIds);
      }

      const { data: upsertData, error } = await supabase.from('test_results').insert(rowsToUpsert);
      if (error) {
        console.error("Error inserting:", error);
      } else {
        console.log(`✅ Successfully inserted ${rowsToUpsert.length} test records for ${cat.name}.`);
      }
    }
  }

  console.log("\nDone!");
}

run();
