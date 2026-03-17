const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'backend/data/competences');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

files.forEach(file => {
    try {
        const filePath = path.join(dataDir, file);
        const workbook = xlsx.readFile(filePath);
        console.log(`File: ${file}`);
        console.log(`  Sheets: ${workbook.SheetNames.join(', ')}`);
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
});
