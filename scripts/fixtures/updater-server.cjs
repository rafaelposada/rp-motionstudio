const http=require('node:http'),fs=require('node:fs');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
if(pkg.failStartup)process.exit(42);
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:pkg.version+'-local',instance:process.env.RP_MOTION_INSTANCE}));});
server.listen(Number(process.env.PORT),'127.0.0.1');
process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
