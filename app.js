const MAP_API = './api/assets/map';

const PROVINCE_TO_REGION = {
  'sa-sh': 'East', 'sa-hs': 'East',
  'sa-ri': 'Central', 'sa-qs': 'Central', 'sa-ha': 'Central',
  'sa-tb': 'West', 'sa-md': 'West', 'sa-mk': 'West',
  'sa-ba': 'South', 'sa-as': 'South', 'sa-nj': 'South', 'sa-jz': 'South'
};

const REGION_COLORS = { Central: '#6889d8', East: '#26a69a', South: '#d98b45', West: '#9b72cf', Other: '#304458' };
let assets = [];
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

async function loadAssets() {
  renderMap();
  const response = await fetch(MAP_API, { cache: 'no-store', credentials: 'include', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Secure CMDB API unavailable');
  const payload = await response.json();
  const records = Array.isArray(payload) ? payload : payload.assets;
  if (!Array.isArray(records)) throw new Error('Invalid CMDB API response');
  assets = records.map(asset => ({ ...asset, id: normalize(asset.id), region: regionName(asset.region), lat: Number(asset.lat), lon: Number(asset.lon), status: normalize(asset.status) })).filter(asset => asset.id && Number.isFinite(asset.lat) && Number.isFinite(asset.lon));
  applyAssetData(`${assets.length} assets · Live CMDB`);
}

function applyAssetData(stateText) {
  $('#data-state').textContent = stateText;
  $('#loading').hidden = true;
  updateCounts();
  drawMarkers();
}

function updateCounts() {
  ['Central','East','South','West'].forEach(region => {
    const total = assets.filter(asset => asset.region === region).length;
    $(`#count-${region.toLowerCase()}`).textContent = total;
  });
}

function renderMap() {
  const kingdomBounds = L.latLngBounds([16.0, 34.4], [32.6, 55.8]);
  map = L.map('map', { zoomControl: false, minZoom: 5, maxZoom: 18, zoomSnap: .25, zoomDelta: .5, maxBounds: kingdomBounds.pad(.16), maxBoundsViscosity: 1, preferCanvas: true });
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
  }).addTo(map);
  onlineLayer = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 38, disableClusteringAtZoom: 12 });
  offlineLayer = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 38, disableClusteringAtZoom: 12 });
  map.addLayer(onlineLayer); map.addLayer(offlineLayer);
  L.control.layers(null, { 'ON-AIR Sites': onlineLayer, 'OFF-AIR Sites': offlineLayer }, { position: 'topright', collapsed: true }).addTo(map);
  map.fitBounds(kingdomBounds, { padding: [28,28], maxZoom: 6.5 });
  Promise.all([
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries/SAU.geo.json').then(response => response.json()),
    fetch('https://code.highcharts.com/mapdata/countries/sa/sa-all.geo.json').then(response => response.json())
  ]).then(([country, geojson]) => {
    const hole = country.features[0].geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
    const outside = [[-85,-180],[-85,180],[85,180],[85,-180]];
    L.polygon([outside, hole], { stroke: false, fillColor: '#06101b', fillOpacity: .9, interactive: false }).addTo(map);
    regionLayer = L.geoJSON(geojson, {
      style(feature) {
        const region = PROVINCE_TO_REGION[feature.properties['hc-key']] || 'Other';
        return { color: '#d3dce5', weight: 1.35, opacity: .82, fillColor: REGION_COLORS[region], fillOpacity: .3 };
      },
      onEachFeature(feature, layer) {
        const region = PROVINCE_TO_REGION[feature.properties['hc-key']] || 'Other';
        layer.bindTooltip(`${region} Region · ${feature.properties.name}`, { sticky: true });
        layer.on({ mouseover: () => layer.setStyle({ fillOpacity: .5, weight: 2 }), mouseout: () => regionLayer.resetStyle(layer), click: () => focusRegion(region) });
      }
    }).addTo(map);
    [['Central',[24.55,45.25]],['East',[25.1,50.45]],['West',[24.6,39.2]],['South',[19.25,43.5]]].forEach(([name, point]) => L.marker(point, {
      interactive: false,
      icon: L.divIcon({ className: 'region-label', html: `<span>${name}</span>`, iconSize: [90,28], iconAnchor: [45,14] })
    }).addTo(map));
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
  window.location.assign(`site.html?site=${encodeURIComponent(asset.id)}`);
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
  } else if (event.key === 'Escape') { $('#suggestions').hidden = true; }
});
$('#suggestions').addEventListener('click', event => {
  const button = event.target.closest('[data-site]');
  if (button) openDetails(assets.find(asset => asset.id === button.dataset.site), true);
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && document.activeElement !== $('#site-search')) { event.preventDefault(); $('#site-search').focus(); }
});
document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) $('#suggestions').hidden = true; });
document.querySelectorAll('.region-strip button').forEach(button => button.addEventListener('click', () => focusRegion(button.dataset.region)));
loadAssets().catch(error => {
  $('#loading').innerHTML = 'Secure CMDB API not configured';
  $('#data-state').textContent = 'Secure API required';
  console.error(error);
});
