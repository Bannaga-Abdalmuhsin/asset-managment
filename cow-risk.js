const normalizeRiskId = value => String(value ?? '').trim().toUpperCase();
async function loadRiskSites() {
  const response = await fetch('risk-sites.json?v=1', { cache:'no-store' });
  if (!response.ok) throw new Error('Risk assessment data is unavailable.');
  const rows = await response.json();
  return new Map(rows.map(row => [normalizeRiskId(row.cowId), window.CowRisk.analyze(row)]));
}
async function loadRiskAssets() {
  const url=String(window.ASSET_APP_CONFIG?.supabaseUrl ?? '').trim().replace(/\/$/, '');
  const key=String(window.ASSET_APP_CONFIG?.supabaseAnonKey ?? '').trim();
  const token=sessionStorage.getItem('asset_access_token');
  if (!url || !key || !token) throw new Error('CMDB access is unavailable.');
  const response=await fetch(`${url}/rest/v1/assets?select=id,region,status&order=id`,{
    cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
    headers:{Accept:'application/json',apikey:key,Authorization:`Bearer ${token}`}
  });
  if (!response.ok) throw new Error('CMDB sites could not be loaded.');
  const rows=await response.json();
  if (!Array.isArray(rows)) throw new Error('CMDB sites could not be loaded.');
  return rows.filter(row=>row.id).map(row=>({id:normalizeRiskId(row.id),region:row.region,status:row.status}));
}
function renderRiskDirectory(assets, assessments) {
  const joined=assets.map(asset=>({...asset,assessment:assessments.get(asset.id)}));
  const assessed=joined.filter(site=>site.assessment);
  document.querySelector('#risk-total').textContent=joined.length.toLocaleString();
  document.querySelector('#risk-assessed').textContent=assessed.length.toLocaleString();
  document.querySelector('#risk-count').textContent=assessed.filter(site=>site.assessment.overallRisk).length.toLocaleString();
  document.querySelector('#risk-pending').textContent=(joined.length-assessed.length).toLocaleString();
  const input=document.querySelector('#risk-search'),list=document.querySelector('#risk-list');
  let filter='all';
  function refresh(){
    const query=normalizeRiskId(input.value);
    const results=joined.filter(site=>site.id.includes(query)&&(
      filter==='all'||filter==='pending'&&!site.assessment||
      filter==='risk'&&site.assessment?.overallRisk||
      filter==='safe'&&site.assessment&&!site.assessment.overallRisk
    )).slice(0,150);
    list.replaceChildren(...results.map(site=>{
      const link=document.createElement('a');link.className='risk-site';link.href=`site.html?site=${encodeURIComponent(site.id)}#site-risk`;
      const head=document.createElement('span');head.className='risk-site-head';
      const id=document.createElement('strong');id.textContent=site.id;
      const badge=document.createElement('span');badge.className='risk-pill '+(site.assessment?(site.assessment.overallRisk?'risk':'safe'):'');
      badge.textContent=site.assessment?(site.assessment.overallRisk?'At risk':'Assessed safe'):'Awaiting inputs';
      head.append(id,badge);
      const detail=document.createElement('small');detail.textContent=site.assessment?.overallRisk
        ? `${site.assessment.riskScenarios.length} flagged scenarios${site.assessment.override?' · field verified':''}`
        : [site.region,site.status].filter(Boolean).join(' · ')||'CMDB site';
      link.append(head,detail);return link;
    }));
    if(!results.length){const empty=document.createElement('p');empty.className='risk-empty';empty.textContent='No matching sites.';list.append(empty);}
  }
  input.addEventListener('input',refresh);
  document.querySelectorAll('[data-risk-filter]').forEach(button=>button.addEventListener('click',()=>{
    filter=button.dataset.riskFilter;
    document.querySelectorAll('[data-risk-filter]').forEach(item=>item.classList.toggle('active',item===button));
    refresh();
  }));
  refresh();document.querySelector('#risk-state').hidden=true;document.querySelector('#risk-data').hidden=false;
}
window.assetAuthReady().then(async()=>{
  const [assets,assessments]=await Promise.all([loadRiskAssets(),loadRiskSites()]);
  renderRiskDirectory(assets,assessments);
}).catch(error=>{
  const state=document.querySelector('#risk-state');state.classList.add('error');state.textContent=error.message;
});
