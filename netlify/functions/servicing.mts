import type {Config,Context} from '@netlify/functions';
import {bindings,withBindings} from '../../src/lib/runtime.server';
import {handleGet,handlePost,dispatch} from '../../src/lib/servicing/api.server';
import {validateLead} from '../../src/lib/servicing/model';
function secure(r:Response){r.headers.set('Cache-Control','no-store');r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('Referrer-Policy','strict-origin-when-cross-origin');return r;}
export default async (request:Request,context:Context)=>{
 try{
  const env=bindings();
  // Status never connects to the DB; missing setup fails closed.
  if(request.method==='GET'&&new URL(request.url).pathname.endsWith('/status'))return secure(await handleGet(request));
  if(request.method==='GET')return secure(await handleGet(request));
  if(request.method!=='POST')return secure(new Response('Method not allowed',{status:405}));
  const text=await request.clone().text();if(text.length>16000)return secure(Response.json({error:'Request too large'},{status:413}));
  let body:any;try{body=JSON.parse(text);}catch{return secure(Response.json({error:'Invalid JSON'},{status:400}));}
  const action=new URL(request.url).pathname.split('/').pop();
  if(action==='dispatch'||action==='process')return secure(await withBindings({...env,CLIENT_IP:context.ip},()=>handlePost(request)));
  const input=action==='enquiry'?validateLead(body).data:null;
  const lock=input?'enquiry:'+input.email+':'+input.phone+':'+input.registration+':'+input.service+':'+input.test:body.id?'lead:'+String(body.id):body.lead_id?'lead:'+String(body.lead_id):undefined;
  let response:Response;
  try{response=await env.DB.transaction(async db=>{const r=await withBindings({...env,DB:db,CLIENT_IP:context.ip},()=>handlePost(request));if(r.status>=500)throw r;return r;},lock);}catch(e){if(e instanceof Response)return secure(e);throw e;}
  if(response.ok&&['enquiry','quote','book','complete','stage'].includes(action||''))context.waitUntil(withBindings(env,()=>dispatch()));
  return secure(response);
 }catch{return secure(Response.json({error:'The service is temporarily unavailable. Please call 07466 098204. No appointment has been confirmed.'},{status:503}));}
};
export const config:Config={path:'/api/servicing/*',method:['GET','POST']};
