const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

const dataDir = path.join(__dirname, '../data/competences');

async function importData() {
    try {
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.xlsx'));
        
        for (const file of files) {
            console.log(`Processing file: ${file}`);
            
            // Extract category name
            let categoryName = file.replace('Référentiel de compétences ', '').replace('Modèle de compétences ', '').replace('.xlsx', '').trim();
            console.log(`Category: ${categoryName}`);
            
            // Upsert Category
            const { data: catData, error: catError } = await supabase
                .from('skill_categories')
                .select('id')
                .eq('name', categoryName)
                .single();
                
            let categoryId;
            if (catError && catError.code === 'PGRST116') { // not found
                const { data: newCat, error: insertCatError } = await supabase
                    .from('skill_categories')
                    .insert({ name: categoryName })
                    .select('id')
                    .single();
                if (insertCatError) throw insertCatError;
                categoryId = newCat.id;
            } else if (catError) {
                throw catError;
            } else {
                categoryId = catData.id;
            }

            const workbook = xlsx.readFile(path.join(dataDir, file));
            
            for (const sheetName of workbook.SheetNames) {
                console.log(`  Processing sheet/domain: ${sheetName}`);
                // Upsert Domain
                let domainName = sheetName.trim();
                
                const { data: domData, error: domError } = await supabase
                    .from('skill_domains')
                    .select('id')
                    .eq('name', domainName)
                    .single();
                    
                let domainId;
                if (domError && domError.code === 'PGRST116') {
                    const { data: newDom, error: insertDomError } = await supabase
                        .from('skill_domains')
                        .insert({ name: domainName })
                        .select('id')
                        .single();
                    if (insertDomError) throw insertDomError;
                    domainId = newDom.id;
                } else if (domError) {
                    throw domError;
                } else {
                    domainId = domData.id;
                }

                const worksheet = workbook.Sheets[sheetName];
                const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                
                let currentSubDomain = null;
                let currentSkills = []; // [{index: 2, name: 'Passes', id: uuid}]
                
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    if (!row || row.length === 0) continue;
                    
                    const firstCell = String(row[0] || '').trim().toLowerCase();
                    
                    // Header row detection: "Niveau d’acquisition" or "Niveaux d'acquisitions"
                    if (firstCell.includes('niveau') && firstCell.includes('acquisition')) {
                        currentSkills = [];
                        
                        // Check row below (Level 1) to see if col 1 is empty
                        const nextRow = data[i+1];
                        const col1IsEmpty = !nextRow || !nextRow[1] || String(nextRow[1]).trim() === '';
                        
                        let startCol = 1;
                        let subDomainTitle = domainName;
                        
                        if (col1IsEmpty && row[1]) {
                            subDomainTitle = String(row[1]).trim();
                            startCol = 2;
                        }
                        
                        // We iterate all columns from startCol to find skill names
                        for (let col = startCol; col < row.length; col++) {
                            const val = String(row[col] || '').trim();
                            if (val && val !== '') {
                                // Upsert Skill
                                const skillName = val;
                                
                                const { data: skillData, error: skillError } = await supabase
                                    .from('skills')
                                    .select('id')
                                    .match({ category_id: categoryId, domain_id: domainId, name: skillName })
                                    .single();
                                    
                                let skillId;
                                if (skillError && skillError.code === 'PGRST116') {
                                    const { data: newSkill, error: insertSkillError } = await supabase
                                        .from('skills')
                                        .insert({ 
                                            category_id: categoryId, 
                                            domain_id: domainId, 
                                            sub_domain: subDomainTitle, 
                                            name: skillName 
                                        })
                                        .select('id')
                                        .single();
                                    if (insertSkillError) throw insertSkillError;
                                    skillId = newSkill.id;
                                } else if (skillError) {
                                    throw skillError;
                                } else {
                                    skillId = skillData.id;
                                    // Update sub_domain if it changed
                                    await supabase.from('skills').update({ sub_domain: subDomainTitle }).eq('id', skillId);
                                }
                                
                                currentSkills.push({ colIndex: col, skillId: skillId, name: skillName });
                            }
                        }
                        console.log(`    Section: ${subDomainTitle} (${currentSkills.length} skills)`);
                    } 
                    // Level rows (1 to 5)
                    else if (/^[1-5]$/.test(firstCell)) {
                        const level = parseInt(firstCell);
                        
                        if (currentSkills.length > 0) {
                            for (const skill of currentSkills) {
                                const description = row[skill.colIndex] ? String(row[skill.colIndex]).trim() : '';
                                if (!description) continue;
                                
                                // Upsert Level
                                const { data: levelData, error: levelError } = await supabase
                                    .from('skill_levels')
                                    .select('id')
                                    .match({ skill_id: skill.skillId, level: level })
                                    .single();
                                    
                                if (levelError && levelError.code === 'PGRST116') {
                                    await supabase
                                        .from('skill_levels')
                                        .insert({
                                            skill_id: skill.skillId,
                                            level: level,
                                            description: description
                                        });
                                } else if (levelData) {
                                    await supabase
                                        .from('skill_levels')
                                        .update({ description: description })
                                        .match({ id: levelData.id });
                                }
                            }
                        }
                    }
                }
            }
        }
        console.log("Import completed successfully!");
    } catch (err) {
        console.error("Error during import:", err);
    }
}

importData();
