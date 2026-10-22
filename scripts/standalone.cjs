const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'../dist/2d');
let html=fs.readFileSync(path.join(base,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+fs.readFileSync(path.join(base,'style.css'),'utf8')+'</style>');
html=html.replace(/<script src="\.\/([^"/]+\.js)"><\/script>/g,(_,name)=>'<script>\n'+fs.readFileSync(path.join(base,name),'utf8').replace(/<\/script/gi,'<\\/script')+'\n</script>');
if(/src="\.\/|href="\.\//.test(html))throw Error('Unbundled dependency');
const output=path.resolve(process.argv[2]||path.join(__dirname,'../build/quiet-door.html'));
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);console.log(output);
