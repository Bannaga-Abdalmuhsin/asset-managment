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
let regionData;
let infoWindow;
let siteMarkers = [];
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

function loadGoogleMaps() {
  const key = normalize(window.ASSET_APP_CONFIG?.googleMapsApiKey);
  if (!key) return Promise.reject(new Error('Google Maps API key is not configured'));
  return new Promise((resolve, reject) => {
    window.__assetMapReady = resolve;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__assetMapReady&v=weekly`;
    script.async = true; script.defer = true;
    script.onerror = () => reject(new Error('Google Maps JavaScript API failed to load'));
    document.head.appendChild(script);
  });
}

function renderMap() {
  const kingdomBounds = new google.maps.LatLngBounds({ lat: 16.0, lng: 34.4 }, { lat: 32.6, lng: 55.8 });
  map = new google.maps.Map($('#map'), {
    center: { lat: 24.1, lng: 45.2 }, zoom: 5, minZoom: 5, maxZoom: 19,
    restriction: { latLngBounds: { north: 34.5, south: 14.5, west: 32.5, east: 58.0 }, strictBounds: true },
    mapTypeId: 'roadmap', mapTypeControl: true, mapTypeControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
    zoomControl: true, zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
    streetViewControl: true, streetViewControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
    fullscreenControl: true, scaleControl: true, clickableIcons: false
  });
  map.fitBounds(kingdomBounds, 30);
  infoWindow = new google.maps.InfoWindow();
  Promise.all([
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries/SAU.geo.json').then(response => response.json()),
    fetch('https://code.highcharts.com/mapdata/countries/sa/sa-all.geo.json').then(response => response.json())
  ]).then(([country, geojson]) => {
    const borderPath = country.features[0].geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
    new google.maps.Polyline({ map, path: borderPath, strokeColor: '#202a35', strokeOpacity: 1, strokeWeight: 3, clickable: false, zIndex: 3 });
    regionData = new google.maps.Data({ map }); regionData.addGeoJson(geojson);
    regionData.setStyle(feature => { const region = PROVINCE_TO_REGION[feature.getProperty('hc-key')] || 'Other'; return { strokeColor: REGION_COLORS[region], strokeWeight: 2, strokeOpacity: .95, fillColor: REGION_COLORS[region], fillOpacity: 0, zIndex: 2 }; });
    regionData.addListener('mouseover', event => regionData.overrideStyle(event.feature, { fillOpacity: .12, strokeWeight: 3 }));
    regionData.addListener('mouseout', event => regionData.revertStyle(event.feature));
    regionData.addListener('click', event => focusRegion(PROVINCE_TO_REGION[event.feature.getProperty('hc-key')] || 'Other'));
    [['Central',{lat:24.55,lng:45.25}],['East',{lat:25.1,lng:50.45}],['West',{lat:24.6,lng:39.2}],['South',{lat:19.25,lng:43.5}]].forEach(([name, position]) => new google.maps.Marker({ map, position, clickable: false, zIndex: 4, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 }, label: { text: name.toUpperCase(), color: '#ffffff', fontSize: '12px', fontWeight: '800' } }));
  }).catch(error => console.warn('Regional boundaries unavailable', error));
}

function drawMarkers() {
  if (!map) return;
  siteMarkers.forEach(marker => marker.setMap(null)); siteMarkers = []; markerById.clear();
  assets.forEach(asset => {
    const online = isOnAir(asset.status);
    const marker = new google.maps.Marker({ map, position: { lat: asset.lat, lng: asset.lon }, title: asset.id, zIndex: 6, icon: { path: google.maps.SymbolPath.CIRCLE, scale: online ? 5 : 5.5, fillColor: online ? '#32d583' : '#f04438', fillOpacity: .96, strokeColor: '#f4f7fb', strokeWeight: 1 } });
    marker.addListener('click', () => { infoWindow.setContent(`<div class="gm-asset"><b>${escapeHTML(asset.id)}</b><span>${escapeHTML(asset.status || 'Unknown')} · ${escapeHTML(asset.region)}</span><a href="site.html?site=${encodeURIComponent(asset.id)}">View asset record →</a></div>`); infoWindow.open({ map, anchor: marker }); });
    markerById.set(asset.id, marker);
    siteMarkers.push(marker);
  });
}

function focusRegion(region) {
  document.querySelectorAll('.region-strip button').forEach(button => button.classList.toggle('selected', button.dataset.region === region));
  const points = assets.filter(asset => asset.region === region);
  if (points.length) { const bounds = new google.maps.LatLngBounds(); points.forEach(asset => bounds.extend({lat:asset.lat,lng:asset.lon})); map.fitBounds(bounds, 70); google.maps.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > 8) map.setZoom(8); }); }
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
loadGoogleMaps().then(() => { renderMap(); return loadAssets(); }).catch(error => {
  $('#loading').textContent = error.message.includes('key') ? 'Google Maps API key required' : 'Secure CMDB API not configured';
  $('#data-state').textContent = error.message.includes('key') ? 'Map key required' : 'Secure API required';
  console.error(error);
});
