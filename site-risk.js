(function(){
  const section=document.querySelector('#site-risk');
  if(!section) return;
  const fmt=(value,unit)=>`${Number(value).toFixed(2)} ${unit}`;
  function riskItem(scenario){
    const article=document.createElement('article');article.className='risk-scenario';
    const title=document.createElement('h3');title.textContent=`S${scenario.id} — ${scenario.name}`;
    const list=document.createElement('ul');
    const issues=[];
    if(scenario.id===9){
      if(scenario.flags.battery) issues.push(`Battery autonomy ${fmt(scenario.batteryUsefulHours,'h')} — below 1 hour`);
    }else{
      if(scenario.flags.power) issues.push(`Power margin ${fmt(scenario.powerMarginKw,'kW')}`);
      if(scenario.flags.rectifier) issues.push(`Rectifier margin ${fmt(scenario.rectifierMarginKw,'kW')}`);
      if(scenario.flags.cooling) issues.push(`Cooling margin ${fmt(scenario.coolingMarginBtu,'Btu/h')}`);
    }
    issues.forEach(message=>{const item=document.createElement('li');item.textContent=message;list.append(item);});
    article.append(title,list);return article;
  }
  async function show(id){
    const response=await fetch('risk-sites.json?v=1',{cache:'no-store'});
    if(!response.ok) throw new Error('Assessment data could not be loaded.');
    const rows=await response.json();const raw=rows.find(row=>String(row.cowId).toUpperCase()===id);
    const content=document.querySelector('#site-risk-content');content.replaceChildren();
    if(!raw){content.textContent='Assessment pending: this COW has no verified engineering input in the risk dataset.';return;}
    const result=window.CowRisk.analyze(raw);
    document.querySelector('#site-risk-status').className='risk-pill '+(result.overallRisk?'risk':'safe');
    document.querySelector('#site-risk-status').textContent=result.overallRisk?'At risk':'Assessed safe';
    if(result.override){const note=document.createElement('p');note.className='risk-note';note.textContent=`Field assessment: ${result.override}. Scenario flags below are calculated independently.`;content.append(note);}
    if(!result.riskScenarios.length){
      const note=document.createElement('p');note.textContent=result.overallRisk
        ? 'Confirmed field risk. No scenario in the available engineering inputs crosses a calculated threshold; field findings require review.'
        : 'No flagged scenarios for this site.';content.append(note);return;
    }
    const grid=document.createElement('div');grid.className='risk-scenarios';
    result.riskScenarios.forEach(scenario=>grid.append(riskItem(scenario)));
    content.append(grid);
  }
  window.addEventListener('asset-record-ready',event=>show(event.detail.id).catch(error=>{
    document.querySelector('#site-risk-content').textContent=error.message;
  }));
})();
