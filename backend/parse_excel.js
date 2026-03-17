const xlsx = require('xlsx');
const fs = require('fs');

const filePaths = [
    './data/competences/Référentiel de compétences U6.xlsx',
    './data/competences/Référentiel de compétences U7.xlsx',
    './data/competences/Référentiel de compétences U8.xlsx',
    './data/competences/Référentiel de compétences U9.xlsx',
    './data/competences/Modèle de compétences U10-U11.xlsx',
    './data/competences/Modèle de compétences U12-U13.xlsx'
];

filePaths.forEach((filePath) => {
    try {
        console.log(`\n--- File: ${filePath} ---`);
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        console.log(`Sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        
        // Print the first 20 rows of column A, B, C, D, E, F to understand the structure
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        console.log("First 20 rows:");
        for (let i = 0; i < Math.min(20, data.length); i++) {
            console.log(`Row ${i + 1}:`, data[i].slice(0, 6));
        }
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e.message);
    }
});
