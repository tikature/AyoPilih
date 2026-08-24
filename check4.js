const fs = require('fs');
const path = 'C:\\Users\\mutge\\AyoPilih\\AyoPilih\\app\\tenant\\[slug]\\[electionSlug]\\hasil\\results-client.tsx';
const content = fs.readFileSync(path, 'utf8');

let depth = 0;
let i = 0;
while (i < content.length) {
  if (content.startsWith('<div', i) && (content[i+4] === ' ' || content[i+4] === '>')) {
    depth++;
    const end = content.indexOf('>', i);
    const tag = content.substring(i, end + 1);
    console.log('Open:', depth, 'at', i, ':', tag);
  } else if (content.startsWith('</div>', i)) {
    console.log('Close:', depth, 'at', i);
    depth--;
  }
  i++;
}
console.log('Final depth:', depth);