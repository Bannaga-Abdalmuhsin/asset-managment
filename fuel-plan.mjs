// Ported from cer-fuelplan's normalizeSiteRow, regional filter, date and classify rules.
// Shared by the scheduled importer and both Asset Management views.
export const SOURCE_CSV = 'https://docs.google.com/spreadsheets/d/1uWbVwsJ6mgUl9WxJz-zbxMaiCW-dG3DI_9gvKkEca18/export?format=csv&gid=1149576218';
const aliases = {
  site_id: ['sitename','site name','siteid','site id','site'],
  region: ['regionname','region name','region','regioncode','area'],
  cow_status: ['cowstatus','cow status','sitestatus','site status','status'],
  next_fueling_date: ['nextfuelingplan','next fueling plan','nextfuelingdate','next fueling date'],
  last_fueling_date: ['lastfuelingdate','last fueling date','previousfuelingdate'],
  last_fueling_qty: ['lastfuelingqty','last fueling qty','lastfuelingquantity','last fueling quantity'],
  district: ['districtname','district name','district'],
  city: ['cityname','city name','city'],
  site_label: ['sitelabel','site label','label']
};
const headerKey = value => String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
const cell = (row, names) => names.map(name => row[headerKey(name)]).find(value => String(value ?? '').trim())?.trim() || '';

export function parseCsv(csv) {
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<csv.length;i++){
    const char=csv[i];
    if(quoted){if(char==='"' && csv[i+1]==='"'){field+='"';i++;}else if(char==='"')quoted=false;else field+=char;}
    else if(char==='"')quoted=true;
    else if(char===','){row.push(field);field='';}
    else if(char==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
    else field+=char;
  }
  if(field || row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  if(rows.length<2)return [];
  const headers=rows.shift().map(headerKey);
  return rows.filter(values=>values.some(value=>value.trim())).map(values=>Object.fromEntries(headers.map((key,index)=>[key,String(values[index]??'').trim()])));
}

export function dateIso(value) {
  const text=String(value??'').trim();
  if(!text || text.includes('#'))return null;
  let match=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  let y,m,d;
  if(match){d=Number(match[1]);m=Number(match[2]);y=Number(match[3]);}
  else {match=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!match)return null; y=Number(match[1]);m=Number(match[2]);d=Number(match[3]);}
  const utc=new Date(Date.UTC(y,m-1,d));
  if(utc.getUTCFullYear()!==y || utc.getUTCMonth()!==m-1 || utc.getUTCDate()!==d)return null;
  return [y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
}

export function normalizeFuelRows(csv) {
  const sites=new Map();
  for(const row of parseCsv(csv)){
    const site_id=cell(row,aliases.site_id).toUpperCase();
    const rawRegion=cell(row,aliases.region).toLowerCase();
    const region=rawRegion==='cr'||rawRegion.includes('central')?'Central':rawRegion==='er'||rawRegion.includes('east')?'East':null;
    const cow_status=cell(row,aliases.cow_status);
    const statusKey=cow_status.toUpperCase().replace(/[\s_-]/g,'');
    const next_fueling_date=dateIso(cell(row,aliases.next_fueling_date));
    if(!/^[A-Z0-9_-]{2,24}$/.test(site_id)||!region||!['ONAIR','INPROGRESS','ACTIVE','OPERATIONAL'].includes(statusKey)||!next_fueling_date)continue;
    const quantity=Number(cell(row,aliases.last_fueling_qty).replace(/,/g,''));
    sites.set(site_id,{
      site_id,region,cow_status,next_fueling_date,
      last_fueling_date:dateIso(cell(row,aliases.last_fueling_date)),
      last_fueling_qty:Number.isFinite(quantity)&&quantity>=0?quantity:null,
      district:cell(row,aliases.district),city:cell(row,aliases.city),site_label:cell(row,aliases.site_label)
    });
  }
  return [...sites.values()];
}

export function todayInRiyadh(now=new Date()){
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function fuelStatus(date,today=todayInRiyadh()){
  if(!dateIso(date))return {key:'unknown',label:'No plan'};
  const days=Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
  if(days<0)return {key:'due',label:'Overdue',days};
  if(days===0)return {key:'today',label:'Today',days};
  if(days<=3)return {key:'coming3',label:'Coming Soon',days};
  return {key:'next15',label:'Healthy',days};
}
