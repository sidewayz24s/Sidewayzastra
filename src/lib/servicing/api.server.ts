
import {bindings} from '../runtime.server';
import {coverage,validateLead,testFixture,stages} from './model';
import {financials,policy,pricingMatrix} from './commercial.server';
import {customerMessage} from './messages';
type Lead=Record<string,any>;
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
async function equal(a:string,b:string){return await hash(a)===await hash(b);}
function db(){const d=bindings().DB;if(!d)throw new Error('Database unavailable');return d;}
function webhook(){const s=bindings().CRM_WEBHOOK_URL;if(!s)return null;try{const u=new URL(s);return u.protocol==='https:'&&u.hostname==='services.leadconnectorhq.com'&&u.pathname.startsWith('/hooks/')?u.href:null;}catch{return null;}}
function live(){return bindings().LAUNCH_APPROVED==='yes'&&(bindings().OPERATIONS_KEY?.length||0)>=24&&(bindings().CRM_CALLBACK_KEY?.length||0)>=24&&(bindings().SCHEDULER_KEY?.length||0)>=24&&!!webhook()&&bindings().WORKFLOWS_VERIFIED==='yes'&&!!policy();}
async function sign(value:string,key:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
async function authorised(request:Request,key=bindings().OPERATIONS_KEY){if(!key||key.length<24)return false;const bearer=request.headers.get('Authorization');if(bearer)return equal(bearer.replace(/^Bearer /,''),key);if(key!==bindings().OPERATIONS_KEY)return false;const value=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sw_ops='))?.slice(7);if(!value)return false;const [expiry,nonce,sig]=value.split('.');if(!expiry||!nonce||!sig||Number(expiry)<Date.now())return false;return equal(await sign(expiry+'.'+nonce,key),sig);}
async function limited(request:Request,scope:string,max=15){const h=await hash((bindings().CLIENT_IP||'unknown')+':'+scope+':'+Math.floor(Date.now()/600000));const d=db();await d.prepare('INSERT INTO rate_limits(key,n,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET n=rate_limits.n+1').bind(h,Date.now()+660000).run();const r=await d.prepare('SELECT n FROM rate_limits WHERE key=?').bind(h).first<{n:number}>();return (r?.n||0)>max;}
async function body(request:Request){if(Number(request.headers.get('content-length')||0)>16000)throw new Error('Request too large');const t=await request.text();if(t.length>16000)throw new Error('Request too large');return JSON.parse(t);}
async function event(lead:Lead,type:string,payload:unknown={},key?:string){await db().prepare('INSERT OR IGNORE INTO events(id,lead_id,event_type,occurred_at,is_test,payload_json) VALUES(?,?,?,?,?,?)').bind(key||id(),lead.id,type,now(),lead.is_test,JSON.stringify(payload)).run();}
async function queue(lead:Lead,type:string,at=now(),payload:unknown={}){const key=lead.id+':'+type+':'+at;await db().prepare('INSERT OR IGNORE INTO outbox(id,lead_id,event_type,due_at,status,payload_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(key,lead.id,type,at,lead.is_test?'test_suppressed':'pending',JSON.stringify(payload),now()).run();}
async function getLead(leadId:string){return await db().prepare('SELECT * FROM leads WHERE id=?').bind(leadId).first<Lead>();}
function selectedMarketing(lead:Lead){const c=JSON.parse(lead.consent_json);return lead.contact==='Email'?c.marketingEmail:lead.contact==='SMS'?c.marketingSms:lead.contact==='WhatsApp'?c.marketingWhatsapp:false;}
export async function dispatch(){
 const d=db(),url=webhook();if(!url)return {accepted:0,blocked:'HighLevel webhook not configured'};
 const rows=(await d.prepare("SELECT * FROM outbox WHERE status='pending' AND due_at<=? ORDER BY due_at LIMIT 2").bind(now()).all<Lead>()).results;let accepted=0;
 for(const row of rows){
 const lead=await getLead(row.lead_id);if(!lead)continue;
 const promotional=['quote_followup_1','quote_followup_2','service_reminder'].includes(row.event_type);
 const quoteFollowup=row.event_type.startsWith('quote_followup');
 const staleQuote=quoteFollowup&&JSON.parse(row.payload_json).quoteVersion!==JSON.parse(lead.quote_json||'{}').version;
 if(lead.is_test||((lead.stopped||lead.followup_paused||!selectedMarketing(lead)||(quoteFollowup&&['Booking confirmed','Service completed','Lost / declined'].includes(lead.stage))||staleQuote)&&promotional)){await d.prepare("UPDATE outbox SET status='suppressed' WHERE id=?").bind(row.id).run();continue;}
 const claimed=await d.prepare("UPDATE outbox SET status='sending',locked_at=?,attempts=attempts+1 WHERE id=? AND status='pending'").bind(now(),row.id).run();if(!claimed.meta.changes)continue;
 try{
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_id:row.id,event_type:row.event_type,lead_id:lead.id,is_test:false,occurred_at:row.created_at,contact:{name:lead.name,email:lead.email,phone:lead.phone,postalCode:lead.postcode},vehicle:{registration:lead.registration,service:lead.service,mileage:lead.mileage,parts:lead.parts_preference,brands:lead.brands},preferred_contact:lead.contact,preferred_date:lead.preferred_date,callback:lead.callback,stage:lead.stage,consent:JSON.parse(lead.consent_json),attribution:JSON.parse(lead.attribution_json),payload:JSON.parse(row.payload_json),message:customerMessage(row.event_type,lead,JSON.parse(row.payload_json)),internal_notification:{subject:'Sidewayz: '+row.event_type,lead_id:lead.id,requires_attention:row.event_type==='new_enquiry'||lead.contact==='Phone'}}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('provider_'+response.status);
 await d.prepare("UPDATE outbox SET status='provider_accepted',provider_ref=? WHERE id=?").bind(response.headers.get('x-request-id')||'',row.id).run();accepted++;
 }catch{await d.prepare("UPDATE outbox SET status='needs_review',error_code='DELIVERY_UNCERTAIN' WHERE id=?").bind(row.id).run();}
 }
 await d.prepare('DELETE FROM rate_limits WHERE expires<?').bind(Date.now()).run();return {accepted};
}
export async function handleGet(request:Request){
 const action=new URL(request.url).pathname.split('/').pop();
 if(action==='status')return json({live:live(),analytics:live()?{ga4:bindings().GA4_ID||'',ads:bindings().GOOGLE_ADS_ID||''}:{ga4:'',ads:''}});
 if(!await authorised(request))return json({error:'Operations access is not configured or the access key is invalid.'},401);
 if(action==='dashboard'){
 const d=db();const leads=(await d.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 300').all()).results;
 const events=(await d.prepare('SELECT * FROM events ORDER BY occurred_at DESC LIMIT 300').all()).results;
 const outbox=(await d.prepare('SELECT id,lead_id,event_type,due_at,status,error_code,provider_ref FROM outbox ORDER BY created_at DESC LIMIT 200').all()).results;
 const spend=(await d.prepare('SELECT * FROM ad_spend ORDER BY day DESC LIMIT 365').all()).results;
 const all=(await d.prepare('SELECT is_test,stage,qualified,quote_json,booking_json,attribution_json FROM leads WHERE is_test=0').all<Lead>()).results;
 const groups:Record<string,any>={};const group=(name:string)=>groups[name]||(groups[name]={campaign:name,spend:0,enquiries:0,qualified:0,quotes:0,bookings:0,revenue:0,grossProfit:0});
 for(const l of all){const campaign=JSON.parse(l.attribution_json).utm_campaign||'Unattributed';const g=group(campaign);g.enquiries++;g.qualified+=Number(l.qualified);g.quotes+=l.quote_json?1:0;if(l.booking_json&&l.stage!=='Lost / declined')g.bookings++;if(['Service completed','Follow-up / repeat servicing'].includes(l.stage)&&l.quote_json){const q=JSON.parse(l.quote_json);g.revenue+=q.revenue;g.grossProfit+=q.financials.grossProfit;}}
 const allSpend=(await d.prepare('SELECT campaign,SUM(amount) total FROM ad_spend GROUP BY campaign').all<{campaign:string,total:number}>()).results;for(const s of allSpend)group(s.campaign).spend=s.total;
 return json({report:Object.values(groups),leads,events,outbox,spend,stages,pricingMatrix:pricingMatrix(),commercialPolicy:policy(),live:live(),configured:{webhook:!!webhook(),callback:!!bindings().CRM_CALLBACK_KEY,scheduler:!!bindings().SCHEDULER_KEY,launch:bindings().LAUNCH_APPROVED==='yes',ga4:!!bindings().GA4_ID,ads:!!bindings().GOOGLE_ADS_ID}});
 }
 return json({error:'Unknown endpoint'},404);
}
export async function handlePost(request:Request){
 const action=new URL(request.url).pathname.split('/').pop();const origin=request.headers.get('origin');
 const external=['dispatch','callback'].includes(action||'');
 if(!external&&origin!==new URL(request.url).origin)return json({error:'Origin rejected'},403);
 try{
 const b=await body(request);
 if(action==='login'){
 if(await limited(request,'login',6))return json({error:'Too many attempts. Try again later.'},429);
 const key=bindings().OPERATIONS_KEY;if(!key||key.length<24||typeof b.key!=='string'||!await equal(b.key,key))return json({error:'Access is not configured or the key is invalid.'},401);
 const value=String(Date.now()+3600000)+'.'+id();return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':'sw_ops='+value+'.'+await sign(value,key)+'; Path=/api/servicing; HttpOnly; Secure; SameSite=Strict; Max-Age=3600'}});
 }
 if(action==='logout')return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':'sw_ops=; Path=/api/servicing; HttpOnly; Secure; SameSite=Strict; Max-Age=0'}});
 if(action==='enquiry'){
 if(await limited(request,'enquiry'))return json({error:'Too many attempts. Please call 07466 098204.'},429);
 const checked=validateLead(b);if(!checked.data)return json({errors:checked.errors},400);
 const input=checked.data;if(input.website)return json({error:'Submission rejected'},400);
 if(!input.test&&!live())return json({error:'Online quote requests are not open yet. Please call 07466 098204.'},503);
 if(input.test){for(const key of ['name','phone','email','registration'] as const)if(input[key]!==testFixture[key])return json({error:'Test mode accepts the labelled test details only.'},400);}
 const d=db(),stamp=now();const dedupe=await hash(input.email+':'+input.phone+':'+input.registration+':'+input.service+':'+input.test);
 const old=await d.prepare('SELECT id FROM leads WHERE request_id=? OR (dedupe_key=? AND created_at>?) ORDER BY created_at DESC LIMIT 1').bind(input.requestId,dedupe,new Date(Date.now()-86400000).toISOString()).first<{id:string}>();
 // A generic acknowledgement avoids disclosing someone else's record or contact details.
 if(old)return json({ok:true,duplicate:true,test:input.test,message:input.test?'TEST already recorded. No messages sent.':'Your request has been received. No appointment is confirmed.'});
 const leadId=id();const consent={marketingEmail:input.marketingEmail,marketingSms:input.marketingSms,marketingWhatsapp:input.marketingWhatsapp,analytics:input.analytics,captured_at:stamp,version:'2026-10-13-v1',source:'quote_form'};
 const insert=d.prepare('INSERT INTO leads(id,request_id,dedupe_key,created_at,updated_at,is_test,registration,postcode,service,name,phone,email,contact,preferred_date,parts_preference,brands,callback,mileage,consent_json,attribution_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(leadId,input.requestId,dedupe,stamp,stamp,input.test?1:0,input.registration,input.postcode,input.service,input.name,input.phone,input.email,input.contact,input.date,input.parts,input.brands,input.callback,input.mileage,JSON.stringify(consent),JSON.stringify(input.attribution));
 const lead={id:leadId,is_test:input.test?1:0};
 const message={acknowledgement:'Hi '+input.name+', we have received your '+input.service+' service enquiry for '+input.registration+'. We will verify your vehicle and location, then contact you by '+input.contact+'. Your price and appointment are not confirmed. Reply with a suitable time if you would like a call. Sidewayz Garage, 07466 098204.'};
 const ev=d.prepare('INSERT INTO events(id,lead_id,event_type,occurred_at,is_test,payload_json) VALUES(?,?,?,?,?,?)').bind(leadId+':submitted',leadId,'quote_form_submitted',stamp,lead.is_test,JSON.stringify({coverage:coverage(input.postcode)}));
 const ob=d.prepare('INSERT INTO outbox(id,lead_id,event_type,due_at,status,payload_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(leadId+':new_enquiry:'+stamp,leadId,'new_enquiry',stamp,input.test?'test_suppressed':'pending',JSON.stringify(message),stamp);
 await d.prepare('DELETE FROM enquiry_deduplication WHERE expires<?').bind(Date.now()).run();
 const claim=d.prepare('INSERT INTO enquiry_deduplication(key,lead_id,expires) VALUES(?,?,?)').bind(dedupe,leadId,Date.now()+86400000);
 try{await d.batch([claim,insert,ev,ob]);}catch{const exists=await d.prepare('SELECT id FROM leads WHERE request_id=? OR (dedupe_key=? AND created_at>?)').bind(input.requestId,dedupe,new Date(Date.now()-86400000).toISOString()).first();if(exists)return json({ok:true,duplicate:true,test:input.test,message:'Request already received. No appointment is confirmed.'});throw new Error('Intake transaction failed');}
 // Await dispatch to attempt the immediate acknowledgement. Receipt is not proof of delivery.
 // Dispatch runs after the transaction commits in the Netlify handler.
 return json({ok:true,reference:leadId,test:input.test,message:input.test?'TEST recorded. No customer messages or advertising conversions sent.':'Enquiry received. We will check your vehicle and location before confirming a price and appointment.'});
 }
 if(action==='dispatch'){if(!await authorised(request,bindings().SCHEDULER_KEY))return json({error:'Unauthorised'},401);return json(await dispatch());}
 if(action==='callback'){
 if(!await authorised(request,bindings().CRM_CALLBACK_KEY))return json({error:'Unauthorised'},401);
 const lead=await getLead(String(b.lead_id||''));if(!lead)return json({error:'Not found'},404);
 if(!['crm_record_created','message_delivered','message_failed','customer_replied','customer_opted_out'].includes(b.event_type))return json({error:'Invalid callback'},400);
 if(typeof b.event_id!=='string'||b.event_id.length>100)return json({error:'Event ID required'},400);
 await event(lead,b.event_type,{provider_ref:String(b.provider_ref||'').slice(0,150)},'callback:'+b.event_id);
 if(b.event_type==='customer_opted_out'||b.event_type==='customer_replied'){await db().prepare('UPDATE leads SET followup_paused=1,stopped=?,updated_at=? WHERE id=?').bind(b.event_type==='customer_opted_out'?1:lead.stopped,now(),lead.id).run();await db().prepare("UPDATE outbox SET status='suppressed' WHERE lead_id=? AND status='pending' AND event_type IN ('quote_followup_1','quote_followup_2','service_reminder')").bind(lead.id).run();}
 if(b.event_type==='crm_record_created')await db().prepare('UPDATE leads SET crm_contact_id=?,crm_opportunity_id=? WHERE id=?').bind(String(b.contact_id||'').slice(0,100),String(b.opportunity_id||'').slice(0,100),lead.id).run();
 return json({ok:true});
 }
 if(!await authorised(request))return json({error:'Unauthorised'},401);
 if(action==='process')return json(await dispatch());
 if(action==='spend'){if(!/^\d{4}-\d{2}-\d{2}$/.test(b.day)||typeof b.campaign!=='string'||b.campaign.length>120||!Number.isFinite(b.amount)||b.amount<0)return json({error:'Invalid spend'},400);await db().prepare('INSERT INTO ad_spend(day,campaign,amount) VALUES(?,?,?) ON CONFLICT(day,campaign) DO UPDATE SET amount=excluded.amount').bind(b.day,b.campaign,b.amount).run();return json({ok:true});}
 const lead=await getLead(String(b.id||''));if(!lead)return json({error:'Enquiry not found'},404);
 if(action==='verify'){
 if(['Booking confirmed','Service completed','Follow-up / repeat servicing','Lost / declined'].includes(lead.stage))return json({error:'Verification cannot reopen a booked, completed or closed job.'},409);
 if(typeof b.vehicle!=='boolean'||typeof b.location!=='boolean')return json({error:'Verification required'},400);
 await db().prepare('UPDATE leads SET vehicle_verified=?,location_verified=?,updated_at=? WHERE id=?').bind(+b.vehicle,+b.location,now(),lead.id).run();
 if(b.vehicle&&b.location){await db().prepare("UPDATE leads SET qualified=1,stage='Vehicle details verified' WHERE id=?").bind(lead.id).run();await event(lead,b.phone===true?'qualified_phone_enquiry':'qualified_enquiry_submitted',{},lead.id+':qualified');await queue(lead,'qualified_enquiry');}return json({ok:true});
 }

 if(action==='quote'){
 if(['Booking confirmed','Service completed','Follow-up / repeat servicing'].includes(lead.stage))return json({error:'A booked or completed job cannot be requoted here. Resolve the existing booking first.'},409);
 if(!lead.vehicle_verified||!lead.location_verified)return json({error:'Verify vehicle and service location first.'},409);
 const q=b.quote;const keys=['revenue','parts','hours','travel','consumables','fees','adCost','customerTotal'];
 if(!q||keys.some(k=>!Number.isFinite(q[k])||q[k]<0)||typeof q.specification!=='string'||q.specification.trim().length<20||q.specification.length>4000||!['not_registered','vat_included'].includes(q.vatTreatment)||!Number.isFinite(q.vat)||q.vat<0||Math.abs(q.customerTotal-q.revenue-q.vat)>0.01||q.vatTreatment==='not_registered'&&q.vat!==0)return json({error:'Enter complete, consistent costs, tax treatment and vehicle-specific work.'},400);
 if(!policy())return json({error:'Commercial policy must be configured before quoting.'},503);const f=financials(q);if(!f.passes)return json({error:'This quotation fails the approved commercial margin policy.',financials:f},409);
 const quote={...q,financials:f,issuedAt:now(),version:id()};await db().prepare("UPDATE leads SET quote_json=?,stage='Quote sent',acceptance_evidence=NULL,updated_at=? WHERE id=?").bind(JSON.stringify(quote),now(),lead.id).run();
 await event(lead,'quote_issued',{customerTotal:q.customerTotal,version:quote.version});await queue(lead,'quote_issued',now(),{quote});
 if(selectedMarketing(lead)&&!lead.stopped){for(const [type,days] of [['quote_followup_1',2],['quote_followup_2',5]] as const)await queue(lead,type,new Date(Date.now()+days*86400000).toISOString(),{quoteVersion:quote.version});}
 return json({ok:true,financials:f});
 }
 if(action==='accept'){
 if(!lead.quote_json||typeof b.evidence!=='string'||b.evidence.trim().length<10||b.evidence.length>2000)return json({error:'Record the customer approval and channel/date.'},400);
 await db().prepare('UPDATE leads SET acceptance_evidence=?,updated_at=? WHERE id=?').bind(b.evidence,now(),lead.id).run();await event(lead,'quote_accepted',{},lead.id+':accepted:'+JSON.parse(lead.quote_json).version);return json({ok:true});
 }
 if(action==='book'){
 if(!lead.acceptance_evidence||!lead.vehicle_verified||!lead.location_verified||!lead.quote_json)return json({error:'Verify vehicle/location, issue quote and record customer approval first.'},409);
 const start=Date.parse(b.start),hours=Number(b.hours),resource=String(b.resource||'mechanic-1');
 if(!Number.isFinite(start)||start<Date.now()||start%900000!==0||!Number.isFinite(hours)||hours<0.5||hours>12||hours*4%1!==0||!/^[a-z0-9-]{1,50}$/.test(resource)||typeof b.address!=='string'||b.address.length<10||b.address.length>300||b.termsConfirmed!==true||b.capacityConfirmed!==true)return json({error:'Provide future 15-minute-aligned slot, duration, address, accepted terms and checked capacity.'},400);
 const end=start+hours*3600000;const booking={start:new Date(start).toISOString(),end:new Date(end).toISOString(),hours,resource,address:b.address,termsConfirmed:true,capacityConfirmed:true,travelBufferMinutes:30};
 if(lead.booking_json===JSON.stringify(booking)&&lead.stage==='Booking confirmed')return json({ok:true,unchanged:true});
 const d=db(),stmts=[d.prepare('DELETE FROM slots WHERE lead_id=?').bind(lead.id)];
 for(let t=start-1800000;t<end+1800000;t+=900000)stmts.push(d.prepare('INSERT INTO slots(resource,slot,lead_id) VALUES(?,?,?)').bind(resource,new Date(t).toISOString(),lead.id));
 stmts.push(d.prepare("UPDATE leads SET booking_json=?,stage='Booking confirmed',updated_at=? WHERE id=?").bind(JSON.stringify(booking),now(),lead.id));
 try{await d.batch(stmts);}catch{return json({error:'That slot overlaps another booking, including travel buffer. Choose another time.'},409);}
 await event(lead,'confirmed_booking',{value:JSON.parse(lead.quote_json).customerTotal,currency:'GBP'},lead.id+':booking');
 await d.prepare("UPDATE outbox SET status='suppressed' WHERE lead_id=? AND status='pending' AND event_type IN ('quote_followup_1','quote_followup_2','appointment_reminder','booking_confirmed')").bind(lead.id).run();
 await queue(lead,'booking_confirmed',now(),{booking});if(start-Date.now()>86400000)await queue(lead,'appointment_reminder',new Date(start-86400000).toISOString(),{booking});return json({ok:true});
 }
 if(action==='stage'){
 if(b.stage==='Follow-up / repeat servicing'&&lead.stage!=='Service completed')return json({error:'Complete the service first.'},409);
 if(lead.stage==='Booking confirmed'&&b.stage!=='Lost / declined')return json({error:'Use reschedule, complete or cancel for a confirmed booking.'},409);
 if(!stages.includes(b.stage)||['Booking confirmed','Quote sent','Vehicle details verified','Service completed'].includes(b.stage))return json({error:'Use the verified action for this stage.'},400);
 await db().prepare('UPDATE leads SET stage=?,updated_at=? WHERE id=?').bind(b.stage,now(),lead.id).run();
 if(b.stage==='Lost / declined'){await db().prepare('DELETE FROM slots WHERE lead_id=?').bind(lead.id).run();await db().prepare("UPDATE outbox SET status='suppressed' WHERE lead_id=? AND status='pending'").bind(lead.id).run();await event(lead,'booking_cancelled');if(lead.booking_json)await queue(lead,'booking_cancelled',now(),{booking:JSON.parse(lead.booking_json)});}
 return json({ok:true});
 }
 if(action==='complete'){
 if(lead.stage!=='Booking confirmed')return json({error:'A confirmed booking is required.'},409);
 if(typeof b.notes!=='string'||b.notes.length<10||b.notes.length>2000)return json({error:'Record work completed and any advisories.'},400);
 await db().prepare("UPDATE leads SET stage='Service completed',updated_at=?,next_service_json=? WHERE id=?").bind(now(),JSON.stringify({notes:b.notes,dueDate:b.dueDate||'',mileage:b.mileage||'',basis:b.basis||''}),lead.id).run();
 await db().prepare("UPDATE outbox SET status='suppressed' WHERE lead_id=? AND status='pending' AND event_type='appointment_reminder'").bind(lead.id).run();
 await event(lead,'service_completed',{quote:JSON.parse(lead.quote_json)},lead.id+':completed');await queue(lead,'service_completed',now(),{notes:b.notes});
 if(b.dueDate&&/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)&&Date.parse(b.dueDate)>Date.now()&&b.basis&&selectedMarketing(lead))await queue(lead,'service_reminder',new Date(Math.max(Date.now(),Date.parse(b.dueDate)-30*86400000)).toISOString(),{dueDate:b.dueDate,basis:String(b.basis).slice(0,500)});
 return json({ok:true});
 }
 if(action==='stop'){
 await db().prepare('UPDATE leads SET stopped=1,followup_paused=1,updated_at=? WHERE id=?').bind(now(),lead.id).run();await db().prepare("UPDATE outbox SET status='suppressed' WHERE lead_id=? AND status='pending' AND event_type IN ('quote_followup_1','quote_followup_2','service_reminder')").bind(lead.id).run();await event(lead,'customer_opted_out');return json({ok:true});
 }
 return json({error:'Unknown endpoint'},404);
 }catch{return json({error:'The request could not be processed. Your booking has not been confirmed. Try again or call 07466 098204.'},500);}
}

