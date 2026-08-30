import fs from 'fs';
const content = fs.readFileSync('e:/FYP/CProject/Working1/frontend/src/LandingPage.tsx', 'utf8');
const openDivs = (content.match(/<div/g) || []).length;
const closeDivs = (content.match(/<\/div/g) || []).length;
const openSections = (content.match(/<section/g) || []).length;
const closeSections = (content.match(/<\/section/g) || []).length;
console.log(`Divs: ${openDivs} open, ${closeDivs} close`);
console.log(`Sections: ${openSections} open, ${closeSections} close`);
