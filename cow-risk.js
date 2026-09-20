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
const riskRegion = value => {
  const name=String(value ?? '').trim().toLowerCase();
  return ['central','east','south','west'].includes(name) ? name[0].toUpperCase()+name.slice(1) : 'Other';
};
const assessmentKind = site => !site.assessment ? 'pending' : site.assessment.overallRisk ? 'risk' : 'safe';
function riskRow(site) {
  const row=document.createElement('tr');
  const id=document.createElement('td'),link=document.createElement('a');
  link.href=`site.html?site=${encodeURIComponent(site.id)}#site-risk`;link.textContent=site.id;id.append(link);
  const assessment=document.createElement('td'),pill=document.createElement('span');
  const kind=assessmentKind(site);pill.className='risk-pill '+kind;
  pill.textContent=kind==='risk'?'At risk':kind==='safe'?'Assessed safe':'Awaiting inputs';assessment.append(pill);
  const region=document.createElement('td');region.textContent=riskRegion(site.region);
  const status=document.createElement('td');status.textContent=site.status||'—';
  const scenarios=document.createElement('td');
  scenarios.textContent=site.assessment ? `${site.assessment.flaggedScenarioCount} / ${site.assessment.scenarioCount}` : '—';
  const record=document.createElement('td'),open=document.createElement('a');
  open.href=link.href;open.className='risk-open';open.textContent='View site ↗';record.append(open);
  row.append(id,assessment,region,status,scenarios,record);
  return row;
}
function renderRiskDirectory(assets, assessments) {
  const joined=assets.map(asset=>({...asset,assessment:assessments.get(asset.id)}));
  const assessed=joined.filter(site=>site.assessment);
  const atRisk=assessed.filter(site=>site.assessment.overallRisk);
  const safe=assessed.length-atRisk.length;
  const waiting=joined.length-assessed.length;
  document.querySelector('#risk-total').textContent=joined.length.toLocaleString();
  document.querySelector('#risk-assessed').textContent=assessed.length.toLocaleString();
  document.querySelector('#risk-count').textContent=atRisk.length.toLocaleString();
  document.querySelector('#risk-pending').textContent=waiting.toLocaleString();
  document.querySelector('#risk-reviewed-count').textContent=assessed.length.toLocaleString();
  document.querySelector('#risk-waiting-count').textContent=waiting.toLocaleString();
  document.querySelector('#risk-safe-count').textContent=safe.toLocaleString();
  const coverage=joined.length ? Math.round(assessed.length/joined.length*100) : 0;
  document.querySelector('#risk-coverage').textContent=coverage+'% reviewed';
  document.querySelector('#risk-coverage-fill').style.width=coverage+'%';
  document.querySelector('.risk-coverage-bar').setAttribute('aria-label',`${assessed.length} of ${joined.length} COWs assessed`);
  // Count each surveyed site once per risk area, across S1–S4.
  for(const area of ['power','cooling','rectifier']) {
    const count=assessed.filter(site=>site.assessment.scenarios.some(scenario=>scenario.flags[area])).length;
    document.querySelector(`#risk-${area}`).textContent=count.toLocaleString();
  }
  const source=[...joined];
  const assessmentRank={risk:0,safe:1,pending:2};
  const input=document.querySelector('#risk-search');
  const select=document.querySelector('#risk-filter');
  const region=document.querySelector('#risk-region');
  const list=document.querySelector('#risk-list');
  const more=document.querySelector('#risk-more');
  const count=document.querySelector('#risk-directory-count');
  const clear=document.querySelector('#risk-clear');
  const cards=[...document.querySelectorAll('[data-risk-filter]')];
  const sortButtons=[...document.querySelectorAll('#risk-directory [data-sort]')];
  const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
  let shown=50,sortKey='assessment',sortDirection=1;
  const sortValue=(site,key)=>{
    if(key==='assessment')return assessmentRank[assessmentKind(site)];
    if(key==='region')return riskRegion(site.region);
    if(key==='status')return site.status||'';
    if(key==='scenarios')return site.assessment?.flaggedScenarioCount??-1;
    return site.id;
  };
  const compare=(a,b)=>{
    const left=sortValue(a,sortKey),right=sortValue(b,sortKey);
    return sortDirection*(typeof left==='number'&&typeof right==='number'?left-right:collator.compare(left,right));
  };
  const updateSortHeaders=()=>sortButtons.forEach(button=>{
    const header=button.closest('th'),active=button.dataset.sort===sortKey;
    if(active)header.setAttribute('aria-sort',sortDirection===1?'ascending':'descending');
    else header.removeAttribute('aria-sort');
  });
  const refresh=()=>{
    const query=normalizeRiskId(input.value);
    const filter=select.value;
    const matching=source.filter(site=>site.id.includes(query) &&
      (filter==='all'||filter==='assessed'&&site.assessment||filter===assessmentKind(site)) &&
      (region.value==='all'||riskRegion(site.region)===region.value))
      .sort(compare);
    const visible=matching.slice(0,shown);
    list.replaceChildren(...visible.map(riskRow));
    if(!matching.length){
      const row=document.createElement('tr'),cell=document.createElement('td');
      cell.colSpan=6;cell.className='directory-empty';cell.textContent='No matching COWs found.';
      row.append(cell);list.append(row);
    }
    count.textContent=`Showing ${visible.length.toLocaleString()} of ${matching.length.toLocaleString()} sites`;
    more.hidden=shown>=matching.length;
    clear.hidden=filter==='all'&&region.value==='all'&&!query;
    cards.forEach(card=>{
      const active=card.dataset.riskFilter===filter;
      card.classList.toggle('active',active);card.setAttribute('aria-pressed',String(active));
    });
  };
  cards.forEach(card=>card.addEventListener('click',()=>{
    select.value=card.dataset.riskFilter;shown=50;refresh();
    document.querySelector('#risk-directory').scrollIntoView({behavior:'smooth',block:'start'});
  }));
  sortButtons.forEach(button=>button.addEventListener('click',()=>{
    const key=button.dataset.sort;
    if(sortKey===key)sortDirection*=-1;else{sortKey=key;sortDirection=1;}
    shown=50;updateSortHeaders();refresh();
  }));
  updateSortHeaders();
  input.addEventListener('input',()=>{shown=50;refresh();});
  select.addEventListener('change',()=>{shown=50;refresh();});
  region.addEventListener('change',()=>{shown=50;refresh();});
  more.addEventListener('click',()=>{shown+=50;refresh();});
  clear.addEventListener('click',()=>{input.value='';select.value='all';region.value='all';shown=50;refresh();});
  refresh();document.querySelector('#risk-state').hidden=true;document.querySelector('#risk-data').hidden=false;
}
window.assetAuthReady().then(async()=>{
  const [assets,assessments]=await Promise.all([loadRiskAssets(),loadRiskSites()]);
  renderRiskDirectory(assets,assessments);
}).catch(error=>{
  const state=document.querySelector('#risk-state');state.classList.add('error');state.textContent=error.message;
});
