const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
// Game code plus the project's own Node tooling and tests (a broken script once slipped past a dist-only check).
const root=path.resolve(__dirname,'..'),targets=process.argv.slice(2);
const files=targets.length?targets.map(p=>path.resolve(p)):[...walk(path.join(root,'dist')).filter(p=>p.endsWith('.js')),...['scripts','tests'].flatMap(d=>walk(path.join(root,d)).filter(p=>p.endsWith('.cjs')))];
for(const file of files)new vm.Script(`(function(require,module,exports,__dirname,__filename){${fs.readFileSync(file,'utf8')}\n})`,{filename:file});
console.log(`Syntax checked ${files.length} JavaScript files.`);
