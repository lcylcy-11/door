const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk(path.resolve(__dirname,'../dist')).filter(p=>p.endsWith('.js'));
for(const file of files)new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
console.log(`Syntax checked ${files.length} JavaScript files.`);
