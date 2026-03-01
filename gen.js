const fs = require('fs');
const fp = 'd:/HobbyProjects/collm/apps/web/app/nodes/[id]/page.tsx';
let c = fs.readFileSync(fp, 'utf8');
c = c.replace(/\r\n/g, '\n');
const ok=[],fail=[];
function rep(n,s,r){if(c.includes(s)){c=c.replace(s,r);ok.push(n);}else{fail.push(n);console.log('FAIL:',n);}}

// STEP 1
const search1 = `// ---------------------------------------------------------------------------\n// Expandable contribution list item (4 lines at a time)\n// ---------------------------------------------------------------------------`;
