const fs=require("fs");
const fp="d:/HobbyProjects/collm/apps/web/app/nodes/[id]/page.tsx";
let c=fs.readFileSync(fp,"utf8");
c=c.replace(/\r\n/g,"\n");
console.log("len:",c.length);
fs.writeFileSync("d:/HobbyProjects/collm/transform.js",lines.join("\n"),"utf8");