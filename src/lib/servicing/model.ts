export const stages = ['New enquiry','Contact initiated','Vehicle details verified','Quote being prepared','Quote sent','Awaiting customer response','Booking confirmed','Service completed','Follow-up / repeat servicing','Lost / declined'] as const;
export const packages = [
 {name:'Interim',tag:'The oil service',description:'For an oil and filter change when your vehicle schedule calls for it.',items:['Engine oil replacement','Oil filter replacement']},
 {name:'Full',tag:'Oil and air filtration',description:'For scheduled oil servicing with an engine air filter replacement.',items:['Engine oil replacement','Oil filter replacement','Engine air filter replacement']},
 {name:'Major',tag:'A more complete refresh',description:'For the wider scheduled replacement of filters and, where due, petrol spark plugs.',items:['Engine oil replacement','Oil filter replacement','Engine air filter replacement','Cabin / pollen filter replacement','Spark plugs for applicable petrol vehicles, when due']}
];
export const areas=['Acton','Ealing','Chiswick','Brentford','Hanwell','Greenford','Perivale','Wembley','Alperton','Hanger Hill'];
export const districtList=['W3','W4','W5','W7','W13','NW10','HA0','HA9','UB6','TW8'];
export function normalisePostcode(v:string){const s=v.toUpperCase().replace(/\s/g,'');return s.length>3?s.slice(0,-3)+' '+s.slice(-3):s;}
export function coverage(v:string){const p=normalisePostcode(v);if(!/^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/.test(p))return 'invalid';return districtList.includes(p.split(' ')[0])?'target':'review';}
export function londonDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export type LeadInput={registration:string;postcode:string;service:string;name:string;phone:string;email:string;date:string;contact:string;parts:string;brands:string;callback:string;mileage:string;marketingEmail:boolean;marketingSms:boolean;marketingWhatsapp:boolean;analytics:boolean;attribution:Record<string,string>;requestId:string;website:string;test:boolean};
export function validateLead(v:unknown):{data?:LeadInput;errors:Record<string,string>}{
 const b=(v&&typeof v==='object'?v:{}) as Record<string,unknown>;const e:Record<string,string>={};
 const s=(k:string,max=160)=>typeof b[k]==='string'?(b[k] as string).trim().slice(0,max):'';
 const d:LeadInput={registration:s('registration',12).toUpperCase().replace(/\s/g,''),postcode:normalisePostcode(s('postcode',12)),service:s('service'),name:s('name',100),phone:s('phone',30).replace(/[\s()-]/g,''),email:s('email',254).toLowerCase(),date:s('date',10),contact:s('contact'),parts:s('parts'),brands:s('brands',300),callback:s('callback',200),mileage:s('mileage',7),marketingEmail:b.marketingEmail===true,marketingSms:b.marketingSms===true,marketingWhatsapp:b.marketingWhatsapp===true,analytics:b.analytics===true,attribution:{},requestId:s('requestId',80),website:s('website'),test:b.test===true};
 if(!/^(?=.*[A-Z])(?=.*\d)[A-Z\d]{2,7}$/.test(d.registration))e.registration='Enter a UK registration, including letters and numbers.';
 if(coverage(d.postcode)==='invalid')e.postcode='Enter a complete UK postcode.';
 if(!['Interim','Full','Major'].includes(d.service))e.service='Choose a service.';
 if(d.name.length<2)e.name='Enter your name.';
 if(!/^(?:0|\+44)[1-9]\d{8,9}$/.test(d.phone))e.phone='Enter a UK telephone number.';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))e.email='Enter a valid email address.';
 if(d.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||Number.isNaN(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date||d.date<londonDate()))e.date='Choose today or a future date.';
 if(!['Phone','Email','SMS','WhatsApp'].includes(d.contact))e.contact='Choose how we should contact you.';
 if(!['Manufacturer-specification / OEM-equivalent','Premium / performance','Recommend the best option'].includes(d.parts))e.parts='Choose a parts preference.';
 if(d.mileage&&!/^\d{1,7}$/.test(d.mileage))e.mileage='Enter mileage as a number.';
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(d.requestId))e.requestId='Refresh the page and try again.';
 if(d.analytics&&b.attribution&&typeof b.attribution==='object')for(const key of ['gclid','gbraid','wbraid','utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=(b.attribution as Record<string,unknown>)[key];if(typeof value==='string')d.attribution[key]=value.replace(/[<>\r\n]/g,'').slice(0,200);}
 return Object.keys(e).length?{errors:e}:{data:d,errors:e};
}
export const testFixture={registration:'TEST123',postcode:'W5 1AA',service:'Full',name:'TEST ENQUIRY',phone:'07700900000',email:'test@example.com',date:'',contact:'Email',parts:'Recommend the best option',brands:'TEST ONLY - DO NOT CONTACT',callback:'',mileage:'',marketingEmail:false,marketingSms:false,marketingWhatsapp:false,analytics:false,attribution:{},website:'',test:true};
