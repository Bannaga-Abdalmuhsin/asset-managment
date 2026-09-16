(function(){
  const content=document.querySelector('#site-risk-content');
  const badge=document.querySelector('#site-risk-status');
  if(!content||!badge)return;
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const fmt=(value,d=1)=>Number(value).toFixed(d);
  const field=(name,value)=>{const item=make('div','risk-detail-field');item.append(make('span','',name),make('strong','',value));return item;};
  function renderScenario(sc,panel){
    panel.replaceChildren(make('h3','risk-scenario-title',`S${sc.id} — ${sc.name}`));
    panel.append(make('p','risk-scenario-context',[
      sc.powerSource==='outage'?'Power outage':sc.powerSource==='prime'?'Prime power':'Backup power',
      sc.coolingConfig==='none'?'No cooling':sc.coolingConfig==='ac1'?'AC1 operational':'AC1 + AC2 operational',
      sc.batteryState==='normal'?'Batteries fully charged':sc.batteryState==='charging'?'Batteries charging':'Batteries discharging',
      'Full traffic load','46°C'].join(' · ')));
    const metrics=make('div','risk-metrics');
    for(const [label,key] of [['Power risk','power'],['Cooling risk','cooling'],['Battery risk','battery'],['Rectifier risk','rectifier']]){
      const cell=make('div','risk-metric');cell.append(make('span','',label),make('strong',sc.flags[key]?'negative':'positive',sc.flags[key]?'RISK':'SAFE'));metrics.append(cell);
    }
    panel.append(metrics,make('h4','','Engineering margins'));
    const margins=make('div','risk-margin-list');
    for(const [label,value,unit,key] of [
      ['Power margin',sc.powerMarginKw,'kW','power'],['Rectifier margin',sc.rectifierMarginKw,'kW','rectifier'],
      ['Battery useful time',sc.batteryUsefulHours,'h','battery'],['Cooling margin',sc.coolingMarginBtu/1000,'kBtu/h','cooling']]){
      const row=make('div','risk-margin');row.append(make('span','',label),make('strong',sc.flags[key]?'negative':'',`${fmt(value,2)} ${unit}`));margins.append(row);
    }
    panel.append(margins,make('h4','','Engineering parameters'));
    const inputs=make('div','risk-detail-grid');
    if(sc.primePowerKw>0)inputs.append(field('Prime net power',`${fmt(sc.primePowerKw)} kW`));
    if(sc.backupPowerKw>0)inputs.append(field('Backup generator net power',`${fmt(sc.backupPowerKw)} kW`));
    inputs.append(field('Site load',`${fmt(sc.telecomPowerKw)} kW`),field('Shelter heat',`${fmt(sc.telecomHeatBtu/1000)} kBtu/h`),
      field('AC1 net cooling',`${fmt(sc.ac1NetBtu/1000)} kBtu/h (${fmt(sc.ac1NetPowerKw)} kW)`));
    if(sc.ac2NetBtu>0)inputs.append(field('AC2 net cooling',`${fmt(sc.ac2NetBtu/1000)} kBtu/h (${fmt(sc.ac2NetPowerKw)} kW)`));
    inputs.append(field('Rectifier net',`${fmt(sc.rectifierNetKw)} kW`),field('Battery charging',`${fmt(sc.batteryChargingKw)} kW`));
    panel.append(inputs);
  }
  function renderSite(raw){
    const result=window.CowRisk.analyze(raw);
    badge.className='risk-pill '+(result.overallRisk?'risk':'safe');
    badge.textContent=`${result.overallRisk?'At risk':'Assessed safe'} · ${result.flaggedScenarioCount}/${result.scenarioCount} flagged`;
    const power=raw.powerSource==='SB'?`SEC ${raw.secMeterCapacityAmp} A · Backup ${raw.backupGenCapacityKva} kVA`
      :raw.powerSource==='DG'?`Gen1 ${raw.singleGenCapacityKva} kVA · Gen2 ${raw.backupGenCapacityKva} kVA`
      :`Single generator ${raw.singleGenCapacityKva} kVA`;
    const details=make('div','risk-detail-grid');
    details.append(field('Location',raw.location||'—'),field('Type',raw.shelterType==='Outdoor'?'Outdoor cabinet':'Shelter'),
      field('Power configuration',raw.powerSource==='SB'?'Commercial with backup':raw.powerSource==='DG'?'Dual generator':'Single generator'),
      field('Power source',power),field('Battery',`${raw.batteriesCapacityAh*raw.numStrings} Ah lead-acid`),
      field('AC1',`${fmt(raw.ac1CapacityBtu/1000,0)}k Btu/h`),field('AC2',raw.ac2CapacityBtu?`${fmt(raw.ac2CapacityBtu/1000,0)}k Btu/h`:'—'),
      field('Rectifier',`${raw.rectifierCapacityKw} kW`),field('Site load',`${fmt(raw.telecomLoadTotalKw||raw.telecomLoadAllKw)} kW`),
      field('Shelter heat',`${fmt(raw.telecomHeatDissipationKbtuh/1000,2)} kBtu/h`),field('Technology',raw.connectedTechnology||'—'));
    content.hidden=false;
    content.replaceChildren(details);
    content.append(make('h3','risk-section-title','Engineering scenarios'));
    const tabs=make('div','risk-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Site risk scenarios');
    const panel=make('div','risk-scenario-detail');panel.setAttribute('role','tabpanel');
    result.scenarios.forEach((sc,i)=>{
      const button=make('button',`${sc.actionable?'flagged':'safe'}${i===0?' active':''}`,`S${sc.id}`);
      button.type='button';button.title=sc.name;button.setAttribute('role','tab');button.setAttribute('aria-selected',String(i===0));
      button.addEventListener('click',()=>{
        tabs.querySelectorAll('button').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-selected','false');});
        button.classList.add('active');button.setAttribute('aria-selected','true');renderScenario(sc,panel);
      });tabs.append(button);
    });
    content.append(tabs,panel);renderScenario(result.scenarios[0],panel);
  }
  window.addEventListener('asset-record-ready',async event=>{
    try{
      const response=await fetch('risk-sites.json?v=2',{cache:'no-store'});
      if(!response.ok)throw new Error('Assessment data could not be loaded.');
      const rows=await response.json();const raw=rows.find(row=>String(row.cowId).toUpperCase()===event.detail.id);
      if(raw)renderSite(raw);
      else{content.replaceChildren();content.hidden=true;badge.textContent='Awaiting inputs';}
    }catch(error){content.hidden=false;content.textContent=error.message;}
  });
})();
