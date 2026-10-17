import {AsyncLocalStorage} from 'node:async_hooks';
import {getDatabase} from '@netlify/database';
import {Database,type PoolLike} from './database.server';
export type Bindings={DB:Database;CLIENT_IP?:string;OPERATIONS_KEY?:string;CRM_WEBHOOK_URL?:string;CRM_CALLBACK_KEY?:string;SCHEDULER_KEY?:string;LAUNCH_APPROVED?:string;WORKFLOWS_VERIFIED?:string;GA4_ID?:string;GOOGLE_ADS_ID?:string;COMMERCIAL_POLICY_JSON?:string;PRICING_MATRIX_JSON?:string};
const scope=new AsyncLocalStorage<Bindings>();
declare const Netlify:{env:{get:(key:string)=>string|undefined}};
const env=(key:string)=>typeof Netlify!=='undefined'?Netlify.env.get(key):process.env[key];
let database:Database|undefined;
export function bindings():Bindings{const current=scope.getStore();if(current)return current;return {get DB(){return database??=new Database(getDatabase().pool as unknown as PoolLike);},...Object.fromEntries(['OPERATIONS_KEY','CRM_WEBHOOK_URL','CRM_CALLBACK_KEY','SCHEDULER_KEY','LAUNCH_APPROVED','WORKFLOWS_VERIFIED','GA4_ID','GOOGLE_ADS_ID','COMMERCIAL_POLICY_JSON','PRICING_MATRIX_JSON'].map(k=>[k,env(k)]))};}
export function withBindings<T>(value:Bindings,fn:()=>T){return scope.run(value,fn);}
