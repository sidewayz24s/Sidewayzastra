
type Win=Window&{dataLayer?:unknown[];gtag?:(...args:any[])=>void};
export function attribution(){if(localStorage.getItem('sidewayz-consent')!=='accepted')return {};try{return JSON.parse(sessionStorage.getItem('sidewayz-attribution')||'{}');}catch{return {};}}
export function track(name:string,params:Record<string,unknown>={}){if(new URLSearchParams(location.search).get('test')==='1'||localStorage.getItem('sidewayz-consent')!=='accepted')return;(window as Win).gtag?.('event',name,{...params,send_to:(window as any).__sidewayzGa4});}
export function activateTracking(ids:{ga4:string;ads:string}){
 const w=window as Win;if(!/^G-[A-Z0-9]+$/.test(ids.ga4)||localStorage.getItem('sidewayz-consent')!=='accepted'||location.search.includes('test=1'))return;
 w.dataLayer=w.dataLayer||[];w.gtag=w.gtag||function(){w.dataLayer!.push(arguments);};w.gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 w.gtag('consent','update',{ad_storage:'granted',analytics_storage:'granted',ad_user_data:'denied',ad_personalization:'denied'});w.gtag('js',new Date());w.gtag('config',ids.ga4,{send_page_view:false});(window as any).__sidewayzGa4=ids.ga4;
 if(/^AW-\d+$/.test(ids.ads))w.gtag('config',ids.ads);
 if(!document.getElementById('sidewayz-gtag')){const s=document.createElement('script');s.id='sidewayz-gtag';s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+ids.ga4;document.head.append(s);}
 const a:Record<string,string>={};const query=new URLSearchParams(location.search);for(const key of ['gclid','gbraid','wbraid','utm_source','utm_medium','utm_campaign','utm_term','utm_content']){const v=query.get(key);if(v)a[key]=v.slice(0,200);}if(Object.keys(a).length)sessionStorage.setItem('sidewayz-attribution',JSON.stringify(a));
 w.gtag('event','page_view',{page_location:location.origin+location.pathname,page_title:document.title,send_to:ids.ga4});
}
export function rejectTracking(){(window as Win).gtag?.('consent','update',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});sessionStorage.removeItem('sidewayz-attribution');document.cookie.split(';').forEach(v=>{const name=v.split('=')[0].trim();if(name.startsWith('_ga')||name.startsWith('_gcl')){for(const domain of [location.hostname,'.'+location.hostname])document.cookie=name+'=; Max-Age=0; path=/; domain='+domain;document.cookie=name+'=; Max-Age=0; path=/;';}});}

