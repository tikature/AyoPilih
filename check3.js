const fs = require('fs');
const path = 'C:\\Users\\mutge\\AyoPilih\\AyoPilih\\app\\tenant\\[slug]\\[electionSlug]\\hasil\\results-client.tsx';
const content = fs.readFileSync(path, 'utf8');

let depth = 0;
let i = 0;
let openPositions = [];
while (i < content.length) {
  if (content.startsWith('<div', i) && (content[i+4] === ' ' || content[i+4] === '>')) {
    depth++;
    openPositions.push({pos: i, depth: depth, context: content.substring(Math.max(0,i-30), i+50)});
  } else if (content.startsWith('</div>', i)) {
    depth--;
    if (depth < 0) console.log('NEGATIVE at', i);
    if (openPositions.length > 0) {
      openPositions.pop();
    }
  }
  i++;
}
console.log('Final depth:', depth);
console.log('Unclosed divs:', openPositions);