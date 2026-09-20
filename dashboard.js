const dashboardPage = document.body.dataset.dashboardPage;
let dashboardView = new URLSearchParams(location.search).get('view');
const dashboardNames = { capex: 'CAPEX status', opex: 'OPEX status', fuel: 'Fuel status' };

if (dashboardPage === 'status') {
  if (dashboardView === 'summary') {
    location.replace('cow-risk.html');
  } else {
    if (!Object.hasOwn(dashboardNames, dashboardView)) {
      dashboardView = 'capex';
      history.replaceState(null, '', 'status.html?view=capex');
    }
    document.querySelector('#view-title').textContent = dashboardNames[dashboardView];
    document.title = `${dashboardNames[dashboardView]} · stc COW Asset Management`;
    document.querySelector(`[data-view="${dashboardView}"]`)?.setAttribute('aria-current', 'page');
    const loadingState = document.querySelector(dashboardView === 'fuel' ? '#fuel-state' : '#em-state');
    if (loadingState) loadingState.hidden = false;
  }
}

const clean = value => String(value ?? '').trim();
const statusOf = value => clean(value).toUpperCase().replace(/[\s_]+/g, '-');
const onAir = value => ['ON-AIR', 'ONAIR'].includes(statusOf(value));
const inProgress = value => ['IN-PROGRESS', 'INPROGRESS'].includes(statusOf(value));
const regionOf = value => {
  const name = clean(value).toLowerCase();
  return ['central', 'east', 'south', 'west'].includes(name) ? name[0].toUpperCase()+name.slice(1) : 'Other';
};

async function loadDashboardAssets() {
  try {
    const cached = JSON.parse(sessionStorage.getItem('asset_dashboard_cache_v2') || 'null');
    if (cached && Date.now() - cached.savedAt < 2 * 60 * 1000 && Array.isArray(cached.assets)) return cached.assets;
  } catch (_) { sessionStorage.removeItem('asset_dashboard_cache_v2'); }
  const url = clean(window.ASSET_APP_CONFIG?.supabaseUrl).replace(/\/$/, '');
  const key = clean(window.ASSET_APP_CONFIG?.supabaseAnonKey);
  const token = sessionStorage.getItem('asset_access_token');
  if (!url || !key || !token) throw new Error('Asset details are temporarily unavailable.');
  const response = await fetch(`${url}/rest/v1/assets?select=id,lat,lon,status,region,district,city&order=id`, {
    cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer',
    headers:{Accept:'application/json',apikey:key,Authorization:`Bearer ${token}`}
  });
  if (!response.ok) throw new Error('Asset details are temporarily unavailable.');
  const records = await response.json();
  if (!Array.isArray(records)) throw new Error('Asset details are temporarily unavailable.');
  const valid = records.map(item=>({id:clean(item.id),status:clean(item.status),region:regionOf(item.region),lat:item.lat == null || item.lat === '' ? null : Number(item.lat),lon:item.lon == null || item.lon === '' ? null : Number(item.lon),City:item.city,District:item.district}))
    .filter(item=>item.id);
  try { sessionStorage.setItem('asset_dashboard_cache_v2',JSON.stringify({savedAt:Date.now(),assets:valid})); } catch (_) {}
  return valid;
}

const WAREHOUSES = [
  {name:'STC WH Jeddah',lat:21.460750,lon:39.210957},
  {name:'ACES Makkah WH',lat:21.319220,lon:39.903300},
  {name:'STC WH Al Ula',lat:26.613083,lon:37.924500},
  {name:'ACES WH Muzahmiya',lat:24.517040,lon:46.267630},
  {name:'ACES WH Dammam',lat:26.201199,lon:49.947940},
  {name:'STC Sharma WH',lat:28.065900,lon:35.172800},
  {name:'Madinah STC WH',lat:24.419135,lon:39.527377},
  {name:'STC WH Abha',lat:18.218462,lon:42.500132},
  {name:'Tabuk WH',lat:21.602135,lon:39.206369}
];
const WAREHOUSE_RADIUS_KM = 1;
const isOffAir = value => !onAir(value) && !inProgress(value);
function distanceKm(a,b) {
  const radians = n => n * Math.PI / 180;
  const dLat = radians(b.lat-a.lat), dLon = radians(b.lon-a.lon);
  const h = Math.sin(dLat/2)**2 + Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function warehouseMatch(asset) {
  if (!Number.isFinite(asset.lat) || !Number.isFinite(asset.lon) || !asset.lat || !asset.lon) return null;
  const nearest = WAREHOUSES.map(warehouse=>({warehouse,distance:distanceKm(asset,warehouse)}))
    .sort((a,b)=>a.distance-b.distance)[0];
  return nearest.distance <= WAREHOUSE_RADIUS_KM ? nearest.warehouse : null;
}
function siteLink(asset) {
  const link=document.createElement('a');
  link.href=`site.html?site=${encodeURIComponent(asset.id)}`;
  link.textContent=asset.id;
  return link;
}
const siteStatus = asset => onAir(asset.status) ? 'on-air' : inProgress(asset.status) ? 'in-progress' : 'off-air';
function warehouseGroups(records) {
  const groups=new Map(WAREHOUSES.map(warehouse=>[warehouse.name,[]]));
  const outside=[];
  for(const asset of records) {
    asset.warehouse=isOffAir(asset.status) ? warehouseMatch(asset) : null;
    if(!isOffAir(asset.status))continue;
    if(asset.warehouse)groups.get(asset.warehouse.name).push(asset);
    else outside.push(asset);
  }
  return {groups,outside};
}
function renderWarehouses(records) {
  const {groups,outside}=warehouseGroups(records);
  const warehouseCount=[...groups.values()].reduce((sum,sites)=>sum+sites.length,0);
  const offAirCount=warehouseCount+outside.length;
  document.querySelector('#warehouse-total').textContent=warehouseCount.toLocaleString();
  document.querySelector('#outside-total').textContent=outside.length.toLocaleString();
  document.querySelector('#outside-count').textContent=outside.length.toLocaleString();
  document.querySelector('#inventory-total').firstChild.textContent=offAirCount.toLocaleString()+' ';
  document.querySelector('#inventory-warehouse-bar').style.width=offAirCount ? `${warehouseCount/offAirCount*100}%` : '0%';
  document.querySelector('#inventory-outside-bar').style.width=offAirCount ? `${outside.length/offAirCount*100}%` : '0%';
  document.querySelector('.inventory-bar').setAttribute('aria-label',`${warehouseCount} off-air COWs near warehouses; ${outside.length} still on sites`);
  const grid=document.querySelector('#warehouse-grid');
  grid.replaceChildren(...WAREHOUSES.map(warehouse=>{
    const sites=groups.get(warehouse.name).sort((a,b)=>a.id.localeCompare(b.id));
    const card=document.createElement('article');card.className='warehouse-card'+(sites.length?'':' empty');
    const head=document.createElement('div');head.className='warehouse-card-head';
    const name=document.createElement('h3');name.textContent=warehouse.name;
    const count=document.createElement('strong');count.textContent=sites.length.toLocaleString();
    head.append(name,count);
    const coords=document.createElement('a');coords.className='warehouse-coordinates';
    coords.href=`https://www.google.com/maps?q=${warehouse.lat},${warehouse.lon}`;
    coords.target='_blank';coords.rel='noopener noreferrer';coords.textContent='View location ↗';
    card.append(head,coords);
    if(sites.length){
      const details=document.createElement('details');details.className='warehouse-details';
      const summary=document.createElement('summary');summary.textContent=`View ${sites.length} COW${sites.length===1?'':'s'}`;
      const list=document.createElement('div');list.className='warehouse-site-list';list.append(...sites.map(siteLink));
      details.append(summary,list);card.append(details);
    }else{
      const empty=document.createElement('span');empty.className='warehouse-empty';empty.textContent='No off-air COWs nearby';card.append(empty);
    }
    return card;
  }));
  const outsideList=document.querySelector('#outside-sites');
  outsideList.replaceChildren(...outside.sort((a,b)=>a.id.localeCompare(b.id)).map(siteLink));
  if(!outside.length){
    const empty=document.createElement('span');empty.className='warehouse-empty';
    empty.textContent='No off-air COWs outside listed warehouses';outsideList.append(empty);
  }
}
function makeDirectoryRow(asset) {
  const row=document.createElement('tr');
  const id=document.createElement('td');id.append(siteLink(asset));
  const status=document.createElement('td');
  const pill=document.createElement('span');pill.className=`directory-status ${siteStatus(asset)}`;
  pill.textContent=asset.status||'Not recorded';status.append(pill);
  const region=document.createElement('td');region.textContent=asset.region;
  const location=document.createElement('td');
  const area=[clean(asset.City),clean(asset.District)].filter((value,index,all)=>value && all.indexOf(value)===index);
  location.textContent=area.join(' · ')||'—';
  const storage=document.createElement('td');
  if(siteStatus(asset)==='off-air'){
    const tag=document.createElement('span');tag.className='directory-location '+(asset.warehouse?'warehouse':'onsite');
    tag.textContent=asset.warehouse?asset.warehouse.name:'Still on sites';storage.append(tag);
  }else storage.textContent='—';
  const mapCell=document.createElement('td');
  if(Number.isFinite(asset.lat)&&Number.isFinite(asset.lon)&&asset.lat&&asset.lon){
    const map=document.createElement('a');map.href=`https://www.google.com/maps?q=${asset.lat},${asset.lon}`;
    map.target='_blank';map.rel='noopener noreferrer';map.className='directory-map';map.textContent='Open map ↗';
    mapCell.append(map);
  }else mapCell.textContent='—';
  row.append(id,status,region,location,storage,mapCell);
  return row;
}
function renderDashboard(records) {
  const counts={total:records.length,'on-air':0,'off-air':0,'in-progress':0,central:0,east:0,south:0,west:0};
  for(const asset of records){
    counts[siteStatus(asset)]++;
    const region=regionOf(asset.region).toLowerCase();
    if(Object.hasOwn(counts,region))counts[region]++;
  }
  for(const [name,count] of Object.entries(counts))
    document.querySelector(`#stat-${name}`).textContent=count.toLocaleString();
  renderWarehouses(records);
  const input=document.querySelector('#directory-search');
  const region=document.querySelector('#directory-region');
  const tbody=document.querySelector('#directory-results');
  const more=document.querySelector('#directory-more');
  const clear=document.querySelector('#directory-clear');
  const count=document.querySelector('#directory-count');
  const buttons=[...document.querySelectorAll('[data-asset-filter]')];
  let selected='all',shown=50;
  const refresh=()=>{
    const query=input.value.trim().toUpperCase();
    const matching=records.filter(asset=>
      (selected==='all'||siteStatus(asset)===selected) &&
      (region.value==='all'||asset.region===region.value) &&
      asset.id.toUpperCase().includes(query));
    const visible=matching.slice(0,shown);
    tbody.replaceChildren(...visible.map(makeDirectoryRow));
    if(!matching.length){
      const tr=document.createElement('tr'),td=document.createElement('td');
      td.colSpan=6;td.className='directory-empty';td.textContent='No matching COWs found.';
      tr.append(td);tbody.append(tr);
    }
    count.textContent=`Showing ${visible.length.toLocaleString()} of ${matching.length.toLocaleString()} sites`;
    more.hidden=shown>=matching.length;
    clear.hidden=selected==='all'&&region.value==='all'&&!query;
  };
  buttons.forEach(button=>button.addEventListener('click',()=>{
    selected=button.dataset.assetFilter;shown=50;
    buttons.forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});
    refresh();
    document.querySelector('#site-directory').scrollIntoView({behavior:'smooth',block:'start'});
  }));
  input.addEventListener('input',()=>{shown=50;refresh();});
  region.addEventListener('change',()=>{shown=50;refresh();});
  more.addEventListener('click',()=>{shown+=50;refresh();});
  clear.addEventListener('click',()=>{
    input.value='';region.value='all';selected='all';shown=50;
    buttons.forEach(button=>{const active=button.dataset.assetFilter==='all';button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    refresh();
  });
  refresh();
  document.querySelector('#dashboard-state').hidden=true;
  document.querySelector('#dashboard-data').hidden=false;
}

window.assetAuthReady().then(async()=>{
  if (dashboardPage === 'details') renderDashboard(await loadDashboardAssets());
}).catch(()=>{
  const state=document.querySelector('#dashboard-state');
  if (state) { state.classList.add('error');state.textContent='Asset details could not be loaded. Please try again later.'; }
});
