// Plain-text templates only. Delivery is performed by the configured CRM workflow.
// Never expose internal costs, profit, acquisition allowances or private notes.
export function customerMessage(type:string, lead:Record<string,any>, payload:Record<string,any>={}) {
 const name=String(lead.name||'there').split(/\s+/)[0];
 const car=String(lead.registration||'your vehicle');
 const service=String(lead.service||'requested');
 const quote=JSON.parse(lead.quote_json||'{}');
 const booking=payload.booking||JSON.parse(lead.booking_json||'{}');
 const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);
 const when=booking.start?new Intl.DateTimeFormat('en-GB',{dateStyle:'full',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(booking.start)):'';
 const signature='Sidewayz Garage · 07466 098204';
 let subject='',body='',promotional=false;
 switch(type){
  case 'new_enquiry':subject='Your servicing enquiry';body=`Hi ${name}, we have received your ${service.toLowerCase()} service enquiry for ${car}. We will check your vehicle and location, then contact you using your preferred method. Your price and appointment are not confirmed. Reply with a suitable time if you would like a call, or continue by message.`;break;
  case 'quote_issued':subject=`Your service quotation for ${car}`;body=`Hi ${name}, your quotation for ${car} is ${money(quote.customerTotal)} in total${quote.vatTreatment==='vat_included'?', including VAT':'. VAT is not charged'} for the work below.\n\n${quote.specification}\n\nReply to approve this quotation or ask a question. Approval does not reserve an appointment; we will agree an available slot with you. Additional work or substitutions need your approval.`;break;
  case 'quote_followup_1':subject=`Any questions about your ${car} quotation?`;body=`Hi ${name}, do you have any questions about your ${service.toLowerCase()} service quotation for ${car}? We can explain the oil specification, parts and agreed work. Reply here if you would like to discuss it or arrange an available appointment.`;promotional=true;break;
  case 'quote_followup_2':subject=`Would you like to continue with your ${car} enquiry?`;body=`Hi ${name}, would you like to continue with the servicing quotation for ${car}? We can check current availability and confirm the quote is still valid. There is no obligation to book. Reply when convenient; this is our final quotation follow-up.`;promotional=true;break;
  case 'booking_confirmed':subject=`Service appointment confirmed for ${car}`;body=`Hi ${name}, your ${service.toLowerCase()} service for ${car} is confirmed for ${when} (UK time) at ${booking.address}. Please ensure safe access and permission to work at the location. To change or cancel, reply or call us; your agreed booking terms apply.`;break;
  case 'appointment_reminder':subject=`Your upcoming appointment for ${car}`;body=`Hi ${name}, a reminder of your service appointment for ${car}: ${when} (UK time), ${booking.address}. Please have your keys and service information available and keep the agreed working area accessible. If anything changes, reply or call us.`;break;
  case 'booking_cancelled':subject=`Appointment cancelled for ${car}`;body=`Hi ${name}, your service appointment for ${car}${when?' on '+when+' (UK time)':''} has been cancelled. This message does not determine any payment or refund due under your agreed terms. Contact us if you need help or believe this is incorrect.`;break;
  case 'service_completed':subject=`Service completed for ${car}`;body=`Hi ${name}, your service for ${car} is recorded as completed. Your job record and invoice are handled separately. If you have a concern or need help understanding an advisory, reply or call us with your registration.`;break;
  case 'service_reminder':subject=`Maintenance reminder for ${car}`;body=`Hi ${name}, our record indicates maintenance for ${car} may be due around ${payload.dueDate}, based on ${payload.basis}. Mileage, use and the manufacturer's schedule may change what is needed. Reply with your current mileage if you would like us to check and prepare a quotation.`;promotional=true;break;
  default:return null;
 }
 const phoneOnly=lead.contact==='Phone';
 return {channel:phoneOnly?'human_task':lead.contact,subject,body:body+'\n\n'+signature+(promotional?'\nTo stop optional messages, reply STOP or use the unsubscribe option provided.':''),promotional,requiresHumanContact:phoneOnly,whatsappTemplateApprovalRequired:lead.contact==='WhatsApp',emailUnsubscribeRequired:promotional&&lead.contact==='Email'};
}
