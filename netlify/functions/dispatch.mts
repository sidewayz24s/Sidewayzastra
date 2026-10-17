import type {Config} from '@netlify/functions';
import {dispatch} from '../../src/lib/servicing/api.server';
export default async()=>{const result=await dispatch();console.log(JSON.stringify({task:'servicing-dispatch',accepted:result.accepted,blocked:result.blocked||null}));};
// Runs every minute in UTC on published deployments only. No public endpoint.
export const config:Config={schedule:'* * * * *'};
