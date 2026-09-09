const SHEET_ID = '1uWbVwsJ6mgUl9WxJz-zbxMaiCW-dG3DI_9gvKkEca18';
const SHEET_GID = '2046046325';
const LIVE_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

const PROVINCE_TO_REGION = {
  'sa-sh': 'East', 'sa-hs': 'East',
  'sa-ri': 'Central', 'sa-qs': 'Central', 'sa-ha': 'Central',
  'sa-tb': 'West', 'sa-md': 'West', 'sa-mk': 'West',
  'sa-ba': 'South', 'sa-as': 'South', 'sa-nj': 'South', 'sa-jz': 'South'
};

const REGION_COLORS = { Central: '#6889d8', East: '#26a69a', South: '#d98b45', West: '#9b72cf', Other: '#304458' };
const HEADER_ROW = 2;
let assets = [];
let headers = [];
let chart;

const $ = (selector) => document.querySelector(selector);
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const isOnAir = status => normalize(status).toUpperCase() === 'ON-AIR';
const regionName = region => {
  const value = normalize(region).toLowerCase();
  if (value === 'east') return 'East';
  if (value === 'central') return 'Central';
  if (value === 'south') return 'South';
  if (value === 'west') return 'West';
  return 'Other';
};

function parseCSV(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function rowsToAssets(rows) {
  headers = rows[HEADER_ROW].map(normalize);
  const index = Object.fromEntries(headers.map((name, i) => [name, i]));
  return rows.slice(HEADER_ROW + 1).map(row => {
    const record = {};
    headers.forEach((header, i) => { if (header) record[header] = normalize(row[i]); });
    return {
      ...record,
      id: normalize(row[index['COW ID']]),
      lat: Number(row[index['Latitude']]),
      lon: Number(row[index['Longitude']]),
      status: normalize(row[index['Site Status']]),
      region: regionName(row[index['Region']])
    };
  }).filter(asset => asset.id && Number.isFinite(asset.lat) && Number.isFinite(asset.lon));
}

async function loadAssets() {
  const cachedResponse = await fetch('site-cache.json', { cache: 'force-cache' });
  if (!cachedResponse.ok) throw new Error('CMDB snapshot unavailable');
  assets = await cachedResponse.json();
  $('#data-state').textContent = `${assets.length} assets · Syncing`;
  $('#loading').hidden = true;
  updateCounts();
  renderMap();
  window.setTimeout(refreshLiveData, 250);
}

async function refreshLiveData() {
  try {
    const response = await fetch(LIVE_CSV, { cache: 'no-store' });
    if (!response.ok) throw new Error('Live CMDB unavailable');
    const freshAssets = rowsToAssets(parseCSV(await response.text()));
    if (!freshAssets.length) throw new Error('Live CMDB returned no assets');
    assets = freshAssets;
    updateCounts();
    if (chart?.series?.[1]) chart.series[1].setData(buildMapPoints(), true, false, false);
    $('#data-state').textContent = `${assets.length} assets · Live CMDB`;
  } catch (error) {
    $('#data-state').textContent = `${assets.length} assets · Cached CMDB`;
    console.warn(error);
  }
}

function updateCounts() {
  ['Central','East','South','West'].forEach(region => {
    const total = assets.filter(asset => asset.region === region).length;
    $(`#count-${region.toLowerCase()}`).textContent = total;
  });
}

function renderMap() {
  const mapData = Highcharts.maps['countries/sa/sa-all'];
  const regions = Highcharts.geojson(mapData).map(area => {
    const region = PROVINCE_TO_REGION[area.properties['hc-key']] || 'Other';
    return { ...area, value: region, color: REGION_COLORS[region], custom: { region } };
  });
  const points = buildMapPoints();

  chart = Highcharts.mapChart('map', {
    chart: { map: mapData, backgroundColor: 'transparent', spacing: [10,10,10,10], animation: true },
    title: { text: null }, credits: { enabled: false }, mapNavigation: { enabled: false },
    legend: { enabled: false },
    tooltip: {
      useHTML: true, backgroundColor: 'rgba(8,17,28,.96)', borderColor: 'rgba(255,255,255,.15)', borderRadius: 10,
      style: { color: '#fff' },
      formatter() {
        if (this.point.custom?.asset) {
          const a = this.point.custom.asset;
          return `<div style="padding:4px 3px"><b>${escapeHTML(a.id)}</b><br><span style="color:#9cabb9">${escapeHTML(a.region)} · ${escapeHTML(a.status || 'Unknown')}</span></div>`;
        }
        return `<b>${escapeHTML(this.point.custom?.region || this.point.name)}</b> Region`;
      }
    },
    plotOptions: {
      map: { borderColor: '#07101b', borderWidth: 2.2, states: { hover: { brightness: .12, borderColor: '#b8c5d2' }, inactive: { opacity: .42 } } },
      mappoint: {
        cursor: 'pointer', marker: { radius: 3.3, lineColor: 'rgba(255,255,255,.72)', lineWidth: .65 },
        states: { hover: { halo: { size: 9, opacity: .18 }, marker: { radius: 6 } } },
        point: { events: { click() { openDetails(this.custom.asset, true); } } }
      }
    },
    series: [
      { type: 'map', name: 'Regions', data: regions, joinBy: null, nullColor: '#27394a', dataLabels: { enabled: false } },
      { type: 'mappoint', name: 'COW Sites', data: points, turboThreshold: 1000 }
    ]
  });
}

function buildMapPoints() {
  return assets.map(asset => ({
    name: asset.id,
    lat: asset.lat,
    lon: asset.lon,
    color: isOnAir(asset.status) ? '#32d583' : '#f04438',
    custom: { asset }
  }));
}

function focusRegion(region) {
  document.querySelectorAll('.region-strip button').forEach(button => button.classList.toggle('selected', button.dataset.region === region));
  const matching = chart.series[0].points.filter(point => point.custom?.region === region);
  chart.series[0].points.forEach(point => point.setState(matching.includes(point) ? 'hover' : 'inactive'));
  setTimeout(() => chart.series[0].points.forEach(point => point.setState('')), 1300);
}

function searchAssets(query) {
  const term = normalize(query).toUpperCase();
  if (!term) return [];
  return assets.filter(asset => asset.id.toUpperCase().includes(term)).sort((a,b) => {
    const aExact = a.id.toUpperCase() === term ? -1 : 0;
    const bExact = b.id.toUpperCase() === term ? -1 : 0;
    return aExact - bExact || a.id.localeCompare(b.id);
  }).slice(0, 8);
}

function renderSuggestions(results) {
  const box = $('#suggestions');
  if (!results.length) {
    box.innerHTML = '<div style="padding:14px;color:#8493a3;font-size:.8rem">No matching site found</div>';
  } else {
    box.innerHTML = results.map((asset, i) => `<button class="suggestion ${i === 0 ? 'active' : ''}" data-site="${escapeHTML(asset.id)}"><span><b>${escapeHTML(asset.id)}</b><br><small>${escapeHTML(asset.region)} · ${escapeHTML(asset.City || asset.District || '')}</small></span><span class="status-pill ${isOnAir(asset.status) ? 'on' : 'off'}">${escapeHTML(asset.status || 'UNKNOWN')}</span></button>`).join('');
  }
  box.hidden = false;
}

function openDetails(asset, zoom = false) {
  if (!asset) return;
  $('#suggestions').hidden = true;
  $('#site-search').value = asset.id;
  const statusClass = isOnAir(asset.status) ? 'on' : 'off';
  const preferred = [
    'Site Label','EBU/Royal','Region','District','City','Site Status','Last Deploying Date','COW OLD/NEW','Vendor','V-Sat',
    '2G/3G/LTE/5G','Tower Height','Shelter/Outdoor','SEC connection','MDB Type & Status','PG Status','Genset QTY','ACES TG',
    'Genset Make','Capacity','Fuel Tank capacity','AC Make','AC Type Split/Package','Qty','HVAC Status','Installed BBU',
    'BBU Volt & Capacity (AH)','No of Strings','BBU Status','BBU Backup Time','DC Power Brand','Installed Rectifiers','Required Rectifiers',
    'Fire Panel Status','Cylinder Status Filled Or Empty Or Expired','Security Light Status','Rented Land','VEHICAL MAKE','PLATE #','TOWER TYPE','GPS Status','FE ID','MW Dish','MW Frequency','MW Link Type','Remarks'
  ];
  const items = preferred.filter(key => asset[key]).map(key => `<div class="detail-item"><label>${escapeHTML(key)}</label><div>${escapeHTML(asset[key])}</div></div>`).join('');
  $('#details-content').innerHTML = `
    <p class="site-kicker">${escapeHTML(asset.region)} Region</p>
    <div class="site-title-row"><h2>${escapeHTML(asset.id)}</h2><span class="status-pill ${statusClass}">${escapeHTML(asset.status || 'UNKNOWN')}</span></div>
    <p class="site-location">${escapeHTML([asset.District, asset.City].filter(Boolean).join(' · ') || 'Location not specified')}</p>
    <section class="detail-section"><h3>CMDB Asset Details</h3><div class="detail-grid">${items || '<p>No additional details available.</p>'}</div></section>
    <a class="map-link" href="https://www.google.com/maps?q=${asset.lat},${asset.lon}" target="_blank" rel="noopener">Open coordinates ↗</a>`;
  $('#details').classList.add('open'); $('#details').setAttribute('aria-hidden','false'); $('#backdrop').classList.add('open');
  if (zoom && chart) chart.mapView.setView([asset.lon, asset.lat], 7, true);
}

function closeDetails() {
  $('#details').classList.remove('open'); $('#details').setAttribute('aria-hidden','true'); $('#backdrop').classList.remove('open');
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}

let toastTimer;
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

$('#site-search').addEventListener('input', event => {
  const query = event.target.value;
  if (!normalize(query)) { $('#suggestions').hidden = true; return; }
  renderSuggestions(searchAssets(query));
});
$('#site-search').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    const match = searchAssets(event.target.value)[0];
    if (match) openDetails(match, true); else showToast('Site not found in CMDB');
  } else if (event.key === 'Escape') { $('#suggestions').hidden = true; closeDetails(); }
});
$('#suggestions').addEventListener('click', event => {
  const button = event.target.closest('[data-site]');
  if (button) openDetails(assets.find(asset => asset.id === button.dataset.site), true);
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && document.activeElement !== $('#site-search')) { event.preventDefault(); $('#site-search').focus(); }
  if (event.key === 'Escape') closeDetails();
});
document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) $('#suggestions').hidden = true; });
document.querySelectorAll('.region-strip button').forEach(button => button.addEventListener('click', () => focusRegion(button.dataset.region)));
$('#close-details').addEventListener('click', closeDetails); $('#backdrop').addEventListener('click', closeDetails);

loadAssets().catch(error => {
  $('#loading').innerHTML = 'Unable to load CMDB data';
  $('#data-state').textContent = 'CMDB unavailable';
  console.error(error);
});
