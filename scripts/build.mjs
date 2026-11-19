import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const files={};
for(const name of readdirSync('public'))files['/'+name]=readFileSync(join('public',name)).toString('base64');
const game=readFileSync('worker/game.js','utf8').replaceAll('export ','');
const api=readFileSync('worker/api.js','utf8').replace(/^import .*\n/,'').replaceAll('export ','');
const mime={html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',css:'text/css; charset=utf-8',webp:'image/webp'};
mkdirSync('dist/server',{recursive:true});
writeFileSync('dist/server/index.js',game+'\n'+api+'\nconst assets='+JSON.stringify(files)+';\nconst mime='+JSON.stringify(mime)+`;
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return api(request,env);
 const name=url.pathname==='/'?'/index.html':url.pathname;
 const encoded=assets[name];
 if(!encoded)return new Response('页面不存在',{status:404});
 const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
 return new Response(bytes,{headers:{'content-type':mime[name.split('.').pop()]||'application/octet-stream','cache-control':'no-cache','x-content-type-options':'nosniff'}});
}};
`);
