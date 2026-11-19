import {getDatabase} from '@netlify/database';
import {netlifyHandler} from '../../server/netlify.js';
let handle;
export default async request=>{
 try {
  handle??=netlifyHandler(getDatabase().pool);
  return await handle(request);
 } catch {
  return Response.json({error:'对局服务暂未就绪，请稍后重试'},{status:503,headers:{'cache-control':'no-store'}});
 }
};
export const config={path:'/api/*'};
