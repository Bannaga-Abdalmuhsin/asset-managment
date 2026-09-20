import {fuelStatus,todayInRiyadh} from './fuel-plan.mjs';
const clean=v=>String(v??'').trim();
function config(){
  const base=clean(window.ASSET_APP_CONFIG?.supabaseUrl).replace(/\/$/,'');
  const key=clean(window.ASSET_APP_CONFIG?.supabaseAnonKey);
  const token=sessionStorage.getItem('asset_access_token');
  if(!base||!key||!token)throw Error('Please sign in to view fuel plans.');
  return {base,headers:{Accept:'application/json',apikey:key,Authorization:'Bearer '+token}};
}
async function request(query){
  const {base,headers}=config();
  const response=await fetch(base+'/rest/v1/fuel_plans?'+query,{headers,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(16000)});
  if(!response.ok)throw Error(response.status===404?'Fuel plan data is not ready yet.':'Fuel status is temporarily unavailable.');
  return response.json();
}
const fmt=date=>date?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')):'No data';
function badge(date){
  const status=fuelStatus(date);
  const span=document.createElement('span');span.className='fuel-badge '+status.key;span.textContent=status.label;return span;
}
function node(tag,cls,value){const element=document.createElement(tag);element.className=cls;element.textContent=value;return element;}
function detail(label,value){const block=node('div','fuel-detail','');block.append(node('small','',label),node('strong','',value||'No data'));return block;}
async function siteFuel(){
  const panel=document.querySelector('#site-fuel');
  if(!panel)return;
  const id=new URLSearchParams(location.search).get('site')?.trim().toUpperCase();
  if(!/^[A-Z0-9_-]{2,24}$/.test(id))return;
  try{
    const rows=await request('select=site_id,region,cow_status,next_fueling_date,last_fueling_date,last_fueling_qty,district,city&site_id=eq.'+encodeURIComponent(id)+'&limit=1');
    panel.replaceChildren();
    const header=node('div','fuel-site-head','');header.append(node('h2','','Fuel status'));
    if(!rows.length){header.append(node('span','fuel-badge unknown','No plan recorded'));panel.append(header,node('p','fuel-no-plan','No dated fuel plan is recorded for this site. SEC sites do not have a fueling date; West and South plans will be added later.'));return;}
    const row=rows[0];header.append(badge(row.next_fueling_date));
    const grid=node('div','fuel-site-grid','');grid.append(
      detail('Next fueling',fmt(row.next_fueling_date)),detail('Last fueling',fmt(row.last_fueling_date)),
      detail('Last quantity',row.last_fueling_qty==null?'No data':Number(row.last_fueling_qty).toLocaleString()+' L'),detail('Region',row.region)
    );panel.append(header,grid);
  }catch(_){panel.replaceChildren(node('h2','','Fuel status'),node('p','fuel-no-plan','Fuel status is temporarily unavailable.'));}
}
async function summaryFuel(){
  const panel=document.querySelector('#fuel-summary');
  if(!panel || new URLSearchParams(location.search).get('view')!=='fuel')return;
  document.querySelector('#fuel-state').hidden=false;
  try{
    let rows=[];
    for(let offset=0;;offset+=1000){
      const page=await request('select=site_id,region,cow_status,next_fueling_date,last_fueling_date,last_fueling_qty,city,district&order=site_id&limit=1000&offset='+offset);
      rows.push(...page);if(page.length<1000)break;
    }
    if(!rows.length){document.querySelector('#fuel-state').textContent='No valid Central or East fuel plans are available yet.';return;}
    document.querySelector('#fuel-asof').textContent='As of '+fmt(todayInRiyadh())+' · Central and East';
    const counts={total:rows.length,due:0,today:0,coming3:0,next15:0,Central:0,East:0};
    rows.forEach(row=>{counts[fuelStatus(row.next_fueling_date).key]++;if(row.region in counts)counts[row.region]++;});
    for(const [key,value] of Object.entries(counts)){const target=document.querySelector('#fuel-'+key);if(target)target.textContent=value.toLocaleString();}
    const body=document.querySelector('#fuel-rows'),search=document.querySelector('#fuel-search'),filter=document.querySelector('#fuel-filter'),region=document.querySelector('#fuel-region'),count=document.querySelector('#fuel-match-count');
    function render(){
      const query=search.value.trim().toUpperCase(),filtered=rows.filter(row=>
        (!query||row.site_id.toUpperCase().includes(query)||clean(row.city).toUpperCase().includes(query)) &&
        (filter.value==='all'||fuelStatus(row.next_fueling_date).key===filter.value) &&
        (region.value==='all'||row.region===region.value));
      filtered.sort((a,b)=>a.next_fueling_date.localeCompare(b.next_fueling_date)||a.site_id.localeCompare(b.site_id));
      body.replaceChildren();
      for(const row of filtered.slice(0,200)){
        const tr=document.createElement('tr'),site=document.createElement('td'),link=document.createElement('a');
        link.href='site.html?site='+encodeURIComponent(row.site_id);link.textContent=row.site_id;site.append(link);
        const status=document.createElement('td');status.append(badge(row.next_fueling_date));
        tr.append(site,node('td','',row.region),node('td','',fmt(row.next_fueling_date)),status,node('td','',fmt(row.last_fueling_date)),node('td','',row.last_fueling_qty==null?'—':Number(row.last_fueling_qty).toLocaleString()+' L'));
        body.append(tr);
      }
      if(!filtered.length){const tr=document.createElement('tr');const td=node('td','fuel-empty','No matching fuel plans.');td.colSpan=6;tr.append(td);body.append(tr);}
      count.textContent='Showing '+Math.min(filtered.length,200)+' of '+filtered.length+' sites';
    }
    [search,filter,region].forEach(el=>el.addEventListener(el===search?'input':'change',render));
    document.querySelector('#fuel-state').hidden=true;panel.hidden=false;render();
  }catch(_){document.querySelector('#fuel-state').textContent='Fuel status is temporarily unavailable. Please try again later.';}
}
window.assetAuthReady().then(()=>{if(document.querySelector('#fuel-summary'))return summaryFuel();return siteFuel();}).catch(()=>{const state=document.querySelector('#fuel-state');if(state){state.hidden=false;state.textContent='Fuel status is temporarily unavailable.';}});
