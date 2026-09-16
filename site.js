const SYSTEMS = [
  ['Radio & Technology',['2G Availability','2G Configuration','LTE Availability','LTE Configuration','5G Availability','5G Configuration','2G/3G/LTE/5G','Multi Beam COWs','Configuration Level']],
  ['Microwave & Transmission',['MW Dish','MW Frequency','MW Link Type','Remarks']],
  ['Tower, Civil & Access',['Shelter/Outdoor','Indoor Light Status','Outdoor Light Status','Tower Light Status','Pad Locks Status','Rented Land','Land Owner','Rental Cost','VEHICAL MAKE','PLATE #','Tower Height','TOWER TYPE','Tower System','GPS Status','FE ID']],
  ['Overview & Location',['COW ID','Site Label','EBU/Royal','Region','District','City','Remote & Metropolitan','Location','Latitude','Longitude','Site Status','Last Deploying Date','Under Replacement','1st Deploying Date','COW OLD/NEW','Vendor','V-Sat']],
  ['Power & Generator',['SEC connection','MDB Type & Status','PG Status','Genset QTY','ACES TG','Genset Repair Status','Genset Make','Engine Make','Alternator Make','ATS Status','Cooling System Status','Fuel Tank capacity']],
  ['HVAC',['AC Make','AC Capacity','AC Type Split/Package','Qty','AC #1 Status','AC #2 Status','HVAC BRAND','PLC Make','HVAC Status']],
  ['DC Power & BBU',['Installed BBU','BBU Volt & Capacity (AH)','No of Cells','No of Strings','BBU Status','BBU Backup Time','BBU Remarks','DC Power Brand','DC Power Capacity','DC Cabinet','Installed Rectifiers','Required Rectifiers']],
  ['Fire, Safety & Security',['Fire Panel Brand','Fire Panel Status','Cylinder Status Filled Or Empty Or Expired','Cylinder Expiry Date','Security System Brand','Security System Status','Shelter Tube Rods','Security Light Status']]
];
const normalize = value => String(value ?? '').replace(/\s+/g,' ').trim();
function parseCSV(text) { const rows=[]; let row=[],value='',quoted=false; for(let i=0;i<text.length;i++){const c=text[i]; if(quoted){if(c==='"'&&text[i+1]==='"'){value+='"';i++;}else if(c==='"')quoted=false;else value+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(value);value='';}else if(c==='\n'){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value='';}else value+=c;} if(value||row.length){row.push(value);rows.push(row);} return rows; }
function create(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function fieldValue(record,requested){if(record[requested]!==undefined)return normalize(record[requested]);if(requested==='AC Capacity'&&record.Capacity!==undefined)return normalize(record.Capacity);const key=Object.keys(record).find(name=>normalize(name).toLowerCase()===requested.toLowerCase());return key?normalize(record[key]):'';}
function hasData(value){return value!==''&&!['n/a','na','none','null','undefined','-','--','not recorded','unknown'].includes(value.toLowerCase());}
function renderRecord(record){
  const id=fieldValue(record,'COW ID'),status=fieldValue(record,'Site Status')||'UNKNOWN';
  document.title=`${id} · Asset Record`; document.querySelector('#record-id').textContent=id;
  document.querySelector('#record-region').textContent=`${fieldValue(record,'Region')||'Unassigned'} Region`;
  document.querySelector('#record-location').textContent=[fieldValue(record,'District'),fieldValue(record,'City')].filter(Boolean).join(' · ')||'Location not recorded';
  const statusEl=document.querySelector('#record-status');statusEl.textContent=status;statusEl.classList.add(status.toUpperCase()==='ON-AIR'?'on':'off');
  const lat=fieldValue(record,'Latitude'),lon=fieldValue(record,'Longitude'),coordinateLink=document.querySelector('#coordinate-link');
  if(/^-?\d+(\.\d+)?$/.test(lat)&&/^-?\d+(\.\d+)?$/.test(lon))coordinateLink.href=`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;else coordinateLink.hidden=true;
  const nav=document.querySelector('#category-nav'),categories=document.querySelector('#categories');
  const priority=create('div','priority-categories'),secondary=create('div','secondary-categories');
  priority.setAttribute('aria-label','Primary deployment categories');secondary.setAttribute('aria-label','Additional asset categories');
  const cards=[];
  const selectCategory=index=>{
    cards.forEach((card,cardIndex)=>{card.hidden=cardIndex!==index;});
    nav.querySelectorAll('[data-category]').forEach(button=>{const active=Number(button.dataset.category)===index;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
  };
  SYSTEMS.forEach(([title,fields],index)=>{
    const anchor=`system-${index+1}`,button=create('button',index<3?'category-card priority':'category-card');
    button.type='button';button.dataset.category=index;button.setAttribute('role','tab');button.setAttribute('aria-controls',anchor);
    const shortTitle=title.split(' & ')[0].split(',')[0];button.append(create('strong','',shortTitle),create('small','',index<3?'Priority telecom asset':`${fields.length} attributes`));
    button.addEventListener('click',()=>selectCategory(index));(index<3?priority:secondary).appendChild(button);
    const card=create('section','system-card');card.id=anchor;card.hidden=index!==0;const header=create('header'),recorded=fields.filter(label=>hasData(fieldValue(record,label))).length;header.append(create('h2','',title),create('span','',`${recorded} of ${fields.length} recorded`));card.appendChild(header);
    const grid=create('div','system-grid');fields.forEach(label=>{const item=create('article','system-field'),value=fieldValue(record,label),available=hasData(value);item.classList.add(available?'data-available':'data-missing');const state=create('span','field-state',available?'Available':'No data');item.append(create('label','',label),create('div',available?'':'empty',available?value:'No data'),state);grid.appendChild(item);});card.appendChild(grid);categories.appendChild(card);cards.push(card);
  });
  nav.append(priority,secondary);selectCategory(0);
  document.querySelector('#record-loading').hidden=true;document.querySelector('#record').hidden=false;
  window.dispatchEvent(new CustomEvent('asset-record-ready',{detail:{id}}));
}
async function loadRecord(){
  const siteId=normalize(new URLSearchParams(location.search).get('site')).toUpperCase();
  if(!/^[A-Z0-9_-]{2,24}$/.test(siteId))throw new Error('A valid site ID is required. Return to the national map and select a site.');
  const url=normalize(window.ASSET_APP_CONFIG?.supabaseUrl).replace(/\/$/,''),key=normalize(window.ASSET_APP_CONFIG?.supabaseAnonKey);if(!url||!key)throw new Error('Supabase configuration is unavailable.');
  const accessToken=sessionStorage.getItem('asset_access_token')||key;
  const response=await fetch(`${url}/rest/v1/assets?id=eq.${encodeURIComponent(siteId)}&select=details`,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:'application/json',apikey:key,Authorization:`Bearer ${accessToken}`}});if(!response.ok)throw new Error('The CMDB service is unavailable. Please try again.');
  const rows=await response.json(),record=rows[0]?.details;if(!record)throw new Error(`Site ${siteId} was not found in the CMDB.`);renderRecord(record);
}
window.assetAuthReady().then(loadRecord).catch(error=>{document.querySelector('#record-loading').hidden=true;const output=document.querySelector('#record-error');output.textContent=error.message;output.hidden=false;});
