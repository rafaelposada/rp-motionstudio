// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module');
require('sucrase/register');const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...args){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,...args);};
const {createMcpServer,TOOLS,readMedia}=require('../desktop/mcp.cjs');
const {normalizeCode,codeErrorLine,CODE_EXAMPLE}=require('../lib/codeLayer');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rp-mcp-')),configPath=path.join(dir,'mcp.json'),port=47000+Math.floor(Math.random()*900);
  const calls=[];
  const mcp=createMcpServer({version:'test',configPath,port,request:async(action,timeout,payload)=>{calls.push({action,timeout,payload});if(payload.command==='snapshot')return {image:'data:image/png;base64,AAAA',time:1,width:2,height:2};if(payload.command==='boom')throw Error('x');return {ok:payload.command};}});
  try{
    assert.equal((await mcp.start()).listening,true);
    const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
    assert.equal(config.token.length,64);assert.equal(config.enabled,true);
    if(process.platform!=='win32')assert.equal(fs.statSync(configPath).mode&0o777,0o600,'The token file is private to the user');
    const post=(body,headers={})=>fetch(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.token}`,...headers},body:JSON.stringify(body)});
    assert.equal((await post({jsonrpc:'2.0',id:1,method:'ping'},{Authorization:'Bearer errado'})).status,401,'A wrong token is refused');
    assert.equal((await post({jsonrpc:'2.0',id:1,method:'ping'},{Origin:'https://example.com'})).status,403,'Browser pages cannot reach the server');
    const init=await (await post({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}})).json();
    assert.equal(init.result.protocolVersion,'2025-06-18');assert.equal(init.result.serverInfo.name,'rp-motionstudio');assert.match(init.result.instructions,/list_templates/);
    assert.equal((await post({jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
    const list=await (await post({jsonrpc:'2.0',id:2,method:'tools/list'})).json();
    assert.deepEqual(list.result.tools.map(t=>t.name),TOOLS.map(t=>t.name));
    for(const tool of list.result.tools)assert.equal(tool.inputSchema.type,'object');
    const state=await (await post({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'get_state',arguments:{}}})).json();
    assert.equal(JSON.parse(state.result.content[0].text).ok,'get_state');assert.equal(calls.at(-1).action,'claude');
    const snap=await (await post({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'snapshot',arguments:{time:1}}})).json();
    assert.equal(snap.result.content[0].type,'image');assert.equal(snap.result.content[0].data,'AAAA');
    const png=path.join(dir,'foto.png');fs.writeFileSync(png,Buffer.from('89504e470d0a1a0a','hex'));
    await post({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'add_media',arguments:{paths:[png]}}});
    assert.equal(calls.at(-1).payload.files[0].name,'foto.png');assert.equal(calls.at(-1).payload.files[0].mime,'image/png');
    const relative=await (await post({jsonrpc:'2.0',id:6,method:'tools/call',params:{name:'add_media',arguments:{paths:['foto.png']}}})).json();
    assert.equal(relative.result.isError,true,'Relative paths are refused');
    const unknown=await (await post({jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'apagar_tudo',arguments:{}}})).json();
    assert.equal(unknown.result.isError,true);
    assert.equal(calls.filter(c=>c.payload.command==='apagar_tudo').length,0,'Unknown tools never reach the editor');
    await mcp.setEnabled(false);
    assert.equal((await post({jsonrpc:'2.0',id:8,method:'ping'})).status,503,'Switching off stops every call');
    await mcp.setEnabled(true);
    await assert.rejects(readMedia([path.join(dir,'nota.txt')]),/Formato não aceito/);
  }finally{mcp.stop();fs.rmSync(dir,{recursive:true,force:true});}
  // A port held at launch is retried until it frees up.
  {
    const blocker=require('node:http').createServer();await new Promise(r=>blocker.listen(port,'127.0.0.1',r));
    const dir2=fs.mkdtempSync(path.join(os.tmpdir(),'rp-mcp-')),late=createMcpServer({version:'test',configPath:path.join(dir2,'mcp.json'),port,request:async()=>({})});
    assert.equal((await late.start()).listening,false);
    await new Promise(r=>blocker.close(r));
    await new Promise(r=>setTimeout(r,6000));
    assert.equal(late.status().listening,true,'The connector comes up once the port is free');
    late.stop();fs.rmSync(dir2,{recursive:true,force:true});
  }
  // Code layers: sizes and source are bounded, errors point at the user's line.
  const code=normalizeCode({engine:'webgl',width:99999,height:-4,source:'x'.repeat(300000),params:{a:1,b:{}}});
  assert.equal(code.engine,'webgl');assert.equal(code.width,4096);assert.equal(code.height,16);assert.equal(code.source.length,200000);assert.deepEqual(code.params,{a:1});
  assert.equal(normalizeCode({}).source,CODE_EXAMPLE);
  assert.equal(codeErrorLine('Error\n    at draw (blob:x:1:1)'),undefined,'Lines inside the guard are not the user\'s');
  console.log('MCP checks passed: private token file, wrong token and browser origins refused, initialize/tools/list/tools/call, snapshot as image, media read from absolute paths only, unknown tools blocked, off switch, bounded code layers.');
})().catch(error=>{console.error(error);process.exit(1);});
