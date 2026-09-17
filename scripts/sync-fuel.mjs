import { SOURCE_CSV, normalizeFuelRows } from '../fuel-plan.mjs';
const base=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base||!key)throw Error('Supabase URL and service role key are required');
const csvUrl=process.env.FUEL_CSV_URL||SOURCE_CSV;
const source=await fetch(csvUrl,{headers:{Accept:'text/csv'},signal:AbortSignal.timeout(30000)});
if(!source.ok)throw Error('Fuel source could not be fetched: HTTP '+source.status);
const csv=await source.text();
if(/<!doctype html|<html/i.test(csv.slice(0,300)))throw Error('Fuel source returned HTML, expected CSV');
const rows=normalizeFuelRows(csv);
if(rows.length<10)throw Error('Fuel source produced fewer than 10 valid Central/East plans; import stopped');
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'};
const endpoint=base+'/rest/v1/fuel_plans';
for(let i=0;i<rows.length;i+=200){
  const response=await fetch(endpoint+'?on_conflict=site_id',{method:'POST',headers,body:JSON.stringify(rows.slice(i,i+200).map(row=>({...row,source_updated_at:new Date().toISOString()}))),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Fuel import failed: HTTP '+response.status+' '+(await response.text()).slice(0,300));
}
// A successful, complete snapshot replaces stale Central/East plans; other regions remain untouched.
let old=[];
for(let offset=0;;offset+=1000){
  const response=await fetch(endpoint+'?select=site_id&region=in.(Central,East)&order=site_id&limit=1000&offset='+offset,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Fuel cleanup read failed: HTTP '+response.status);
  const page=await response.json();old.push(...page);if(page.length<1000)break;
}
const imported=new Set(rows.map(row=>row.site_id));
const stale=old.map(row=>row.site_id).filter(id=>!imported.has(id));
for(let i=0;i<stale.length;i+=100){
  const ids=stale.slice(i,i+100).map(id=>'"'+id.replace(/"/g,'')+'"').join(',');
  const response=await fetch(endpoint+'?site_id=in.('+encodeURIComponent(ids)+')',{method:'DELETE',headers,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Fuel cleanup failed: HTTP '+response.status);
}
console.log('Fuel plan synchronized:',rows.length,'valid Central/East sites;',stale.length,'stale rows removed');
