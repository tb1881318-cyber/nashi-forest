import {api} from '../worker/api.js';
import {database} from './database.js';
export function netlifyHandler(pool) {
 const DB=database(pool);
 return async request=>{
  const url=new URL(request.url);
  if(request.method==='POST') {
   const origin=request.headers.get('origin');
   if(origin&&new URL(origin).host!==url.host)return Response.json({error:'请在游戏网站内操作'},{status:403});
  }
  return api(request,{DB});
 };
}
