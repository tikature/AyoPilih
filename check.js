const fs = require('fs');
const path = 'C:\\Users\\mutge\\AyoPilih\\AyoPilih\\app\\tenant\\[slug]\\[electionSlug]\\hasil\\results-client.tsx';
const content = fs.readFileSync(path, 'utf8');

let opens = 0;
let closes = 0;
const re = /<\/?div[\s>]/g;
let m;
while ((m = re.exec(content)) !== null) {
  if (m[0].startsWith('</')) closes++;
  else opens++;
}
console.log('Opens:', opens, 'Closes:', closes);

const opens2 = (content.match(/<div[\s>]/g) || []).length;
const closes2 = (content.match(/<\/div>/g) || []).length;
console.log('Opens2:', opens2, 'Closes2:', closes2);