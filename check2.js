const fs = require('fs');
const path = 'C:\\Users\\mutge\\AyoPilih\\AyoPilih\\app\\tenant\\[slug]\\[electionSlug]\\hasil\\results-client.tsx';
const content = fs.readFileSync(path, 'utf8');

let depth = 0;
let i = 0;
while (i < content.length) {
  if (content.startsWith('<div', i) && (content[i+4] === ' ' || content[i+4] === '>')) {
    depth++;
    console.log('Open div at', i, 'depth', depth);
  } else if (content.startsWith('</div>', i)) {
    depth--;
    console.log('Close div at', i, 'depth', depth);
    if (depth < 0) console.log('NEGATIVE DEPTH!');
  }
  i++;
}