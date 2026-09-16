const dashboardPage = document.body.dataset.dashboardPage;
const dashboardView = new URLSearchParams(location.search).get('view');
const dashboardNames = { summary: 'Asset summary', capex: 'CAPEX status', opex: 'OPEX status', fuel: 'Fuel status' };

if (dashboardPage === 'status') {
  const view = Object.hasOwn(dashboardNames, dashboardView) ? dashboardView : 'summary';
  document.querySelector('#view-title').textContent = dashboardNames[view];
  document.title = `${dashboardNames[view]} · stc COW Asset Management`;
  document.querySelector(`[data-view="${view}"]`).setAttribute('aria-current', 'page');
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
    const cached = JSON.parse(sessionStorage.getItem('asset_map_cache_v1') || 'null');
    if (cached && Date.now() - cached.savedAt < 2 * 60 * 1000 && Array.isArray(cached.assets)) return cached.assets;
  } catch (_) { sessionStorage.removeItem('asset_map_cache_v1'); }
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
  const valid = records.map(item=>({id:clean(item.id),status:clean(item.status),region:regionOf(item.region),lat:Number(item.lat),lon:Number(item.lon),City:item.city,District:item.district}))
    .filter(item=>item.id && Number.isFinite(item.lat) && Number.isFinite(item.lon));
  try { sessionStorage.setItem('asset_map_cache_v1',JSON.stringify({savedAt:Date.now(),assets:valid})); } catch (_) {}
  return valid;
}

function renderDashboard(records) {
  const counts = {total:records.length,'on-air':0,'off-air':0,'in-progress':0,central:0,east:0,south:0,west:0};
  for (const asset of records) {
    if (onAir(asset.status)) counts['on-air']++;
    else if (inProgress(asset.status)) counts['in-progress']++;
    else counts['off-air']++;
    const region = regionOf(asset.region).toLowerCase();
    if (Object.hasOwn(counts,region)) counts[region]++;
  }
  for (const [name,count] of Object.entries(counts)) document.querySelector(`#stat-${name}`).textContent = count.toLocaleString();
  const list = document.querySelector('#directory-results');
  const input = document.querySelector('#directory-search');
  const refresh = () => {
    const matching = records.filter(asset=>asset.id.toUpperCase().includes(input.value.trim().toUpperCase())).slice(0,100);
    list.replaceChildren(...matching.map(asset=>{
      const link=document.createElement('a');link.href=`site.html?site=${encodeURIComponent(asset.id)}`;link.textContent=asset.id;return link;
    }));
    if (!matching.length) { const empty=document.createElement('p');empty.textContent='No matching sites found.';list.append(empty); }
  };
  input.addEventListener('input',refresh);
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
