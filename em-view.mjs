const clean=value=>String(value??'').trim();
const GROUPS={pending:'Awaiting installation / approval',completed:'Completed',closed:'Closed without completion',unknown:'Status not recorded'};
const ORDER=['pending','completed','closed','unknown'];
function node(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el;}
function config(){const base=clean(window.ASSET_APP_CONFIG?.supabaseUrl).replace(/\/$/,'');const key=clean(window.ASSET_APP_CONFIG?.supabaseAnonKey),token=sessionStorage.getItem('asset_access_token');if(!base||!key||!token)throw Error('Sign in required');return {base,headers:{apikey:key,Authorization:'Bearer '+token,Accept:'application/json'}};}
async function query(params){const {base,headers}=config();const response=await fetch(base+'/rest/v1/em_work_orders?'+params,{headers,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(16000)});if(!response.ok)throw Error('Request data unavailable');return response.json();}
async function assetIds(){
  const {base,headers}=config(),ids=new Set();
  for(let offset=0;;offset+=1000){
    const response=await fetch(base+'/rest/v1/assets?select=id&order=id&limit=1000&offset='+offset,{headers,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(16000)});
    if(!response.ok)throw Error('Asset catalogue unavailable');
    const page=await response.json();
    if(!Array.isArray(page))throw Error('Asset catalogue unavailable');
    page.forEach(row=>{const id=clean(row.id).toUpperCase();if(id)ids.add(id);});
    if(page.length<1000)break;
  }
  if(!ids.size)throw Error('Asset catalogue unavailable');
  return ids;
}
function latestCapex(rows){
  const latest=new Map(),others=[];
  for(const row of rows){
    if(row.expense_type!=='CAPEX'){others.push(row);continue;}
    const key=clean(row.site_id).toUpperCase()+'\u0000'+(clean(row.element).toUpperCase()||'OTHER');
    const old=latest.get(key);
    const stamp=value=>{const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:-Infinity;};
    const recent=value=>Math.max(stamp(value.last_modified_at),stamp(value.created_at));
    if(!old||recent(row)>recent(old)||recent(row)===recent(old)&&Number(row.id)>Number(old.id))latest.set(key,row);
  }
  return others.concat([...latest.values()]);
}
const day=date=>date?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date)):'—';
const badge=group=>node('span','em-badge '+group,GROUPS[group]||GROUPS.unknown);
function categories(rows,container,selected,onSelect){
  const counts=new Map();for(const row of rows){const key=row.element||'Other';if(!counts.has(key))counts.set(key,{total:0,pending:0,completed:0});const n=counts.get(key);n.total++;n[row.status_group]=(n[row.status_group]||0)+1;}
  container.replaceChildren();
  for(const [name,n] of [...counts].sort((a,b)=>b[1].total-a[1].total||a[0].localeCompare(b[0]))){const button=node('button','em-category'+(selected===name?' active':''));button.type='button';button.setAttribute('aria-pressed',String(selected===name));button.append(node('strong','',name),node('span','',n.total+' requests'),node('small','',(n.total-n.completed)+' not completed · '+n.completed+' completed'));button.addEventListener('click',()=>onSelect(name===selected?'all':name));container.append(button);}
}
function tableRow(row){const tr=document.createElement('tr'),site=document.createElement('td'),link=node('a','',row.site_id);link.href='site.html?site='+encodeURIComponent(row.site_id);site.append(link);tr.append(site,node('td','',row.element||'—'));const status=document.createElement('td');status.append(badge(row.status_group),node('small','em-workflow',row.workflow_status||'No status'));tr.append(status,node('td','',String(row.id)),node('td','',day(row.last_modified_at||row.created_at)));return tr;}
async function summary(){
  const view=new URLSearchParams(location.search).get('view');if(!['capex','opex'].includes(view))return;
  const state=document.querySelector('#em-state');state.hidden=false;
  try{
    const idsPromise=assetIds();
    const rows=[];for(let offset=0;;offset+=1000){const page=await query('select=id,site_id,site_name,expense_type,element,workflow_status,status_group,created_at,last_modified_at&order=id&limit=1000&offset='+offset);rows.push(...page);if(page.length<1000)break;}
    const ids=await idsPromise;
    const source=latestCapex(rows.filter(row=>row.expense_type===view.toUpperCase() && ids.has(clean(row.site_id).toUpperCase())));
    if(!source.length){state.textContent='No '+view.toUpperCase()+' requests have been imported yet.';return;}
    for(const group of ORDER){const target=document.querySelector('#em-'+group);if(target)target.textContent=source.filter(row=>row.status_group===group).length.toLocaleString();}
    document.querySelector('#em-not-completed').textContent=source.filter(row=>row.status_group!=='completed').length.toLocaleString();
    const container=document.querySelector('#em-categories'),body=document.querySelector('#em-rows'),input=document.querySelector('#em-search'),match=document.querySelector('#em-match'),more=document.querySelector('#em-more');
    const sortButtons=[...document.querySelectorAll('#em-summary [data-sort]')];
    const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
    let category='all',group='not-completed',shown=80,sortKey='updated',sortDirection=-1;
    const buttons=[...document.querySelectorAll('[data-em-filter]')];
    const sortValue=(row,key)=>{
      if(key==='site')return row.site_id;
      if(key==='category')return row.element||'';
      if(key==='status')return (row.status_group||'')+' '+(row.workflow_status||'');
      if(key==='request')return Number(row.id)||0;
      return Date.parse(row.last_modified_at||row.created_at||'')||0;
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
    function refresh(){
      buttons.forEach(b=>{const active=b.dataset.emFilter===group;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
      categories(source,container,category,next=>{category=next;shown=80;refresh();});
      const q=input.value.trim().toUpperCase();
      const filtered=source.filter(row=>(category==='all'||row.element===category)&&(group==='all'||group==='not-completed'&&row.status_group!=='completed'||row.status_group===group)&&(!q||row.site_id.toUpperCase().includes(q)||String(row.site_name||'').toUpperCase().includes(q)));
      filtered.sort(compare);
      body.replaceChildren(...filtered.slice(0,shown).map(tableRow));
      if(!filtered.length){const tr=document.createElement('tr'),td=node('td','em-empty','No matching requests.');td.colSpan=5;tr.append(td);body.append(tr);}
      match.textContent='Showing '+Math.min(shown,filtered.length).toLocaleString()+' of '+filtered.length.toLocaleString()+' requests'+(category==='all'?'':' · '+category);
      more.hidden=shown>=filtered.length;
    }
    sortButtons.forEach(button=>button.addEventListener('click',()=>{
      const key=button.dataset.sort;
      if(sortKey===key)sortDirection*=-1;else{sortKey=key;sortDirection=1;}
      shown=80;updateSortHeaders();refresh();
    }));
    updateSortHeaders();
    buttons.forEach(b=>b.addEventListener('click',()=>{group=b.dataset.emFilter;shown=80;refresh();}));
    input.addEventListener('input',()=>{shown=80;refresh();});more.addEventListener('click',()=>{shown+=80;refresh();});
    state.hidden=true;document.querySelector('#em-summary').hidden=false;refresh();
  }catch(_){state.textContent='CAPEX/OPEX records are temporarily unavailable. Please try again later.';}
}
async function site(){
  const panel=document.querySelector('#site-em');if(!panel)return;
  const id=new URLSearchParams(location.search).get('site')?.trim().toUpperCase();if(!/^[A-Z0-9_-]{2,24}$/.test(id))return;
  try{
    const {base,headers}=config();
    const assetResponse=await fetch(base+'/rest/v1/assets?select=id&id=eq.'+encodeURIComponent(id)+'&limit=1',{headers,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(16000)});
    if(!assetResponse.ok)throw Error('Asset catalogue unavailable');
    if(!(await assetResponse.json()).length){panel.hidden=true;return;}
    const rows=await query('select=id,site_id,expense_type,element,workflow_status,status_group,created_at,last_modified_at&site_id=eq.'+encodeURIComponent(id)+'&order=id.desc&limit=1000');
    panel.replaceChildren(node('h2','','CAPEX / OPEX requests'));
    if(!rows.length){panel.append(node('p','em-empty','No CAPEX or OPEX requests are recorded for this site.'));return;}
    for(const type of ['CAPEX','OPEX']){
      const entries=latestCapex(rows.filter(row=>row.expense_type===type));if(!entries.length)continue;
      const details=document.createElement('details');details.className='em-site-details';details.open=true;
      details.append(node('summary','',type+' · '+entries.length+' requests'));
      for(const [label,selected] of [['Not completed',entries.filter(row=>row.status_group!=='completed')],['Completed',entries.filter(row=>row.status_group==='completed')]]){
        const section=node('section','em-site-group'),heading=node('h3','',label+' · '+selected.length);
        section.append(heading);
        if(selected.length){
          const grid=node('div','em-site-grid');
          for(const row of selected){
            const card=node('article','em-site-card '+row.status_group),head=node('div','em-site-card-head');
            head.append(node('strong','',row.element||'Other'),badge(row.status_group));
            card.append(head,node('span','',row.workflow_status||'Status not recorded'),node('small','','Request #'+row.id+' · '+day(row.last_modified_at||row.created_at)));
            grid.append(card);
          }
          section.append(grid);
        }else section.append(node('p','em-empty','No '+label.toLowerCase()+' requests.'));
        details.append(section);
      }
      panel.append(details);
    }
  }catch(_){panel.replaceChildren(node('h2','','CAPEX / OPEX requests'),node('p','em-empty','Request records are temporarily unavailable.'));}
}
window.assetAuthReady().then(()=>document.querySelector('#em-summary')?summary():site()).catch(()=>{const state=document.querySelector('#em-state');if(state){state.hidden=false;state.textContent='CAPEX/OPEX records are temporarily unavailable.';}});
