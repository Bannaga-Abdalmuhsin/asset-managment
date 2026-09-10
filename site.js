const SYSTEMS = [
  ['Overview & Location',['COW ID','Site Label','EBU/Royal','Region','District','City','Remote & Metropolitan','Location','Latitude','Longitude','Site Status','Last Deploying Date','Under Replacement','1st Deploying Date','COW OLD/NEW','Vendor','V-Sat']],
  ['Radio & Technology',['2G Availability','2G Configuration','3G Availability','3G Configuration','LTE Availability','LTE Configuration','5G Availability','5G Configuration','2G/3G/LTE/5G','Multi Beam COWs','Configuration Level']],
  ['Power & Generator',['SEC connection','MDB Type & Status','PG Status','Genset QTY','ACES TG','Genset Repair Status','Genset Make','Engine Make','Alternator Make','Capacity','ATS Status','Cooling System Status','Fuel Tank capacity']],
  ['HVAC',['AC Make','AC Capacity','AC Type Split/Package','Qty','AC #1 Status','AC #2 Status','HVAC BRAND','PLC Make','HVAC Status']],
  ['DC Power & BBU',['Installed BBU','BBU Volt & Capacity (AH)','No of Cells','No of Strings','BBU Status','BBU Backup Time','BBU Remarks','DC Power Brand','DC Power Capacity','DC Cabinet','Installed Rectifiers','Required Rectifiers']],
  ['Fire, Safety & Security',['Fire Panel Brand','Fire Panel Status','Cylinder Status Filled Or Empty Or Expired','Cylinder Expiry Date','Security System Brand','Security System Status','Shelter Tube Rods','Security Light Status']],
  ['Tower, Civil & Access',['Shelter/Outdoor','Indoor Light Status','Outdoor Light Status','Tower Light Status','Pad Locks Status','Rented Land','Land Owner','Rental Cost','VEHICAL MAKE','PLATE #','Tower Height','TOWER TYPE','Tower System','GPS Status','FE ID']],
  ['Microwave & Transmission',['MW Dish','MW Frequency','MW Link Type','Remarks']]
];
const normalize = value => String(value ?? '').replace(/\s+/g,' ').trim();
function create(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function fieldValue(record,requested){if(record[requested]!==undefined)return normalize(record[requested]);const key=Object.keys(record).find(name=>normalize(name).toLowerCase()===requested.toLowerCase());return key?normalize(record[key]):'';}
function renderRecord(record){
  const id=fieldValue(record,'COW ID'),status=fieldValue(record,'Site Status')||'UNKNOWN';
  document.title=`${id} · Asset Record`; document.querySelector('#record-id').textContent=id;
  document.querySelector('#record-region').textContent=`${fieldValue(record,'Region')||'Unassigned'} Region · CMDB Asset Record`;
  document.querySelector('#record-location').textContent=[fieldValue(record,'District'),fieldValue(record,'City')].filter(Boolean).join(' · ')||'Location not recorded';
  const statusEl=document.querySelector('#record-status');statusEl.textContent=status;statusEl.classList.add(status.toUpperCase()==='ON-AIR'?'on':'off');
  const lat=fieldValue(record,'Latitude'),lon=fieldValue(record,'Longitude'),coordinateLink=document.querySelector('#coordinate-link');
  if(/^-?\d+(\.\d+)?$/.test(lat)&&/^-?\d+(\.\d+)?$/.test(lon))coordinateLink.href=`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;else coordinateLink.hidden=true;
  const nav=document.querySelector('#category-nav'),categories=document.querySelector('#categories');
  SYSTEMS.forEach(([title,fields],index)=>{const anchor=`system-${index+1}`,link=create('a','',title);link.href=`#${anchor}`;nav.appendChild(link);const card=create('section','system-card');card.id=anchor;const header=create('header');header.append(create('h2','',title),create('span','',`${fields.length} attributes`));card.appendChild(header);const grid=create('div','system-grid');fields.forEach(label=>{const item=create('div','system-field'),value=fieldValue(record,label);item.append(create('label','',label),create('div',value?'':'empty',value||'Not recorded'));grid.appendChild(item);});card.appendChild(grid);categories.appendChild(card);});
  document.querySelector('#record-loading').hidden=true;document.querySelector('#record').hidden=false;
}
async function loadRecord(){
  const siteId=normalize(new URLSearchParams(location.search).get('site')).toUpperCase();
  if(!/^[A-Z0-9_-]{2,24}$/.test(siteId))throw new Error('A valid site ID is required. Return to the national map and select a site.');
  const response=await fetch(`./api/assets/${encodeURIComponent(siteId)}`,{cache:'no-store',credentials:'include',headers:{Accept:'application/json'}});if(response.status===404)throw new Error(`Site ${siteId} was not found in the CMDB.`);if(!response.ok)throw new Error('The secure CMDB API is unavailable. Sign in through the STC portal and try again.');
  const record=await response.json();renderRecord(record);
}
loadRecord().catch(error=>{document.querySelector('#record-loading').hidden=true;const output=document.querySelector('#record-error');output.textContent=error.message;output.hidden=false;});
