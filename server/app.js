import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {api} from '../worker/api.js';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
export function app(pool,DB) {
 return async function handle(req,res) {
  const send=(status,body,type='application/json; charset=utf-8',extra={})=>{
   res.writeHead(status,{'content-type':type,'x-content-type-options':'nosniff','referrer-policy':'same-origin',...extra});
   res.end(req.method==='HEAD'?undefined:body);
  };
  try {
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/healthz') {
    await pool.query('SELECT 1');
    return send(200,'{"ok":true}',undefined,{'cache-control':'no-store'});
   }
   if(url.pathname.startsWith('/api/')) {
    if(req.method!=='GET'&&req.method!=='POST')return send(405,'{"error":"请求方式不正确"}');
    const origin=req.headers.origin;
    // Reject cross-site mutations; no cookies or public credential sharing.
    if(req.method==='POST'&&origin&&new URL(origin).host!==req.headers.host)return send(403,'{"error":"请在游戏网站内操作"}');
    let length=0;const chunks=[];
    for await (const chunk of req) {
     length+=chunk.length;
     if(length>48000)return send(413,'{"error":"请求过大"}');
     chunks.push(chunk);
    }
    const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
    const response=await api(request,{DB});
    return send(response.status,Buffer.from(await response.arrayBuffer()),response.headers.get('content-type'),{'cache-control':'no-store'});
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return send(405,'{"error":"请求方式不正确"}');
   const path=decodeURIComponent(url.pathname);
   // All public assets live directly in public/; never serve source or credentials.
   if(path.includes('\\')||path.includes('\0')||path.split('/').some(p=>p==='..'||p.startsWith('.')))return send(404,'Not found','text/plain');
   const file=resolve(root,'.'+(path==='/'?'/index.html':path));
   if(!file.startsWith(root))return send(404,'Not found','text/plain');
   const body=await readFile(file);
   return send(200,body,types[extname(file)]??'application/octet-stream',{'cache-control':extname(file)==='.webp'?'public, max-age=86400':'no-cache'});
  } catch(error) {
   if(error.code==='ENOENT'||error.code==='EISDIR'||error instanceof URIError)return send(404,'Not found','text/plain');
   // Avoid logging request bodies, player secrets, or database credentials.
   console.error('Request failed:',error.code??error.name);
   return send(503,'{"error":"服务暂时不可用，请稍后重试"}',undefined,{'cache-control':'no-store'});
  }
 };
}
