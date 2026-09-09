const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
// Serve only the fixture and its production script dependencies, never user data.
http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const relative=pathname.replace(/^\/+/, '');
  if (!/^(?:tests\/browser\/(?:structural-smoke|repeat-flow-smoke|record-selection-smoke)\.(?:html|js)|shared\/[a-z-]+\.js|content\.js)$/.test(relative)) {res.writeHead(404).end();return;}
  const file=path.resolve(root,relative);
  if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');res.end(data);});
}).listen(8765,'127.0.0.1',()=>console.log('http://127.0.0.1:8765/tests/browser/structural-smoke.html\nhttp://127.0.0.1:8765/tests/browser/repeat-flow-smoke.html'));
