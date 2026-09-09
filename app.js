const SHEET_ID = '1uWbVwsJ6mgUl9WxJz-zbxMaiCW-dG3DI_9gvKkEca18';
const SHEET_GID = '2046046325';
const LIVE_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
const MAP_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}&tq=select%20B,E,F,G,J,K,L%20offset%202`;
const BROWSER_CACHE_KEY = 'aces-cmdb-map-v1';

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
let map;
let regionLayer;
let onlineLayer;
let offlineLayer;
const markerById = new Map();

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
  renderMap();
  let hasCachedAssets = false;
  try {
    const cached = JSON.parse(localStorage.getItem(BROWSER_CACHE_KEY) || '[]');
    if (Array.isArray(cached) && cached.length) {
      assets = cached;
      hasCachedAssets = true;
      applyAssetData(`${assets.length} assets · Updating`);
    }
  } catch (error) { console.warn('Browser cache unavailable', error); }

  let response;
  try {
    response = await fetch(MAP_CSV, { cache: 'no-store' });
    if (!response.ok) throw new Error('Live CMDB unavailable');
  } catch (error) {
    if (hasCachedAssets) {
      $('#data-state').textContent = `${assets.length} assets · Cached CMDB`;
      return;
    }
    throw error;
  }
  const rows = parseCSV(await response.text());
  assets = rows.slice(1).map(row => ({
    id: normalize(row[0]), region: regionName(row[1]), District: normalize(row[2]), City: normalize(row[3]),
    lat: Number(row[4]), lon: Number(row[5]), status: normalize(row[6])
  })).filter(asset => asset.id && Number.isFinite(asset.lat) && Number.isFinite(asset.lon));
  localStorage.setItem(BROWSER_CACHE_KEY, JSON.stringify(assets));
  applyAssetData(`${assets.length} assets · Live CMDB`);
  window.setTimeout(refreshLiveData, 50);
}

function applyAssetData(stateText) {
  $('#data-state').textContent = stateText;
  $('#loading').hidden = true;
  updateCounts();
  drawMarkers();
}

async function refreshLiveData() {
  try {
    const response = await fetch(LIVE_CSV, { cache: 'no-store' });
    if (!response.ok) throw new Error('Live CMDB unavailable');
    const freshAssets = rowsToAssets(parseCSV(await response.text()));
    if (!freshAssets.length) throw new Error('Live CMDB returned no assets');
    assets = freshAssets;
    localStorage.setItem(BROWSER_CACHE_KEY, JSON.stringify(assets));
    applyAssetData(`${assets.length} assets · Live CMDB`);
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
  const kingdomBounds = L.latLngBounds([15.2, 34.2], [33.4, 56.8]);
  map = L.map('map', { zoomControl: false, minZoom: 5, maxZoom: 18, maxBounds: kingdomBounds.pad(.08), maxBoundsViscosity: 1, preferCanvas: true });
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20
  }).addTo(map);
  onlineLayer = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 38, disableClusteringAtZoom: 12 });
  offlineLayer = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 38, disableClusteringAtZoom: 12 });
  map.addLayer(onlineLayer); map.addLayer(offlineLayer);
  L.control.layers(null, { 'ON-AIR Sites': onlineLayer, 'OFF-AIR Sites': offlineLayer }, { position: 'topright', collapsed: true }).addTo(map);
  map.fitBounds(kingdomBounds, { padding: [18,18] });
  fetch('https://code.highcharts.com/mapdata/countries/sa/sa-all.geo.json').then(response => response.json()).then(geojson => {
    regionLayer = L.geoJSON(geojson, {
      style(feature) {
        const region = PROVINCE_TO_REGION[feature.properties['hc-key']] || 'Other';
        return { color: '#d3dce5', weight: 1.15, opacity: .7, fillColor: REGION_COLORS[region], fillOpacity: .2 };
      },
      onEachFeature(feature, layer) {
        const region = PROVINCE_TO_REGION[feature.properties['hc-key']] || 'Other';
        layer.bindTooltip(`${region} Region · ${feature.properties.name}`, { sticky: true });
        layer.on({ mouseover: () => layer.setStyle({ fillOpacity: .38, weight: 2 }), mouseout: () => regionLayer.resetStyle(layer) });
      }
    }).addTo(map);
    regionLayer.bringToBack();
  }).catch(error => console.warn('Regional boundaries unavailable', error));
}

function drawMarkers() {
  if (!map || !onlineLayer || !offlineLayer) return;
  onlineLayer.clearLayers(); offlineLayer.clearLayers(); markerById.clear();
  assets.forEach(asset => {
    const online = isOnAir(asset.status);
    const marker = L.circleMarker([asset.lat, asset.lon], { radius: online ? 5 : 5.5, color: '#f4f7fb', weight: 1, fillColor: online ? '#32d583' : '#f04438', fillOpacity: .95 });
    marker.bindTooltip(`<b>${escapeHTML(asset.id)}</b><br>${escapeHTML(asset.status || 'Unknown')} · ${escapeHTML(asset.region)}`, { direction: 'top', offset: [0,-5] });
    marker.on('click', () => openDetails(asset, false));
    markerById.set(asset.id, marker);
    (online ? onlineLayer : offlineLayer).addLayer(marker);
  });
}

function focusRegion(region) {
  document.querySelectorAll('.region-strip button').forEach(button => button.classList.toggle('selected', button.dataset.region === region));
  const points = assets.filter(asset => asset.region === region).map(asset => [asset.lat, asset.lon]);
  if (points.length) map.fitBounds(points, { padding: [70,70], maxZoom: 8, animate: true });
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
  if (zoom && map) {
    map.flyTo([asset.lat, asset.lon], 14, { duration: 1.1 });
    const marker = markerById.get(asset.id);
    if (marker) window.setTimeout(() => marker.openTooltip(), 1150);
  }
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
