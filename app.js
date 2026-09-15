const supabaseConfig = () => ({
  url: normalize(window.ASSET_APP_CONFIG?.supabaseUrl).replace(/\/$/, ''),
  key: normalize(window.ASSET_APP_CONFIG?.supabaseAnonKey)
});

let assets = [];
let map;
let infoWindow;
let siteMarkers = [];
let activeStatusFilter = 'all';
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

window.gm_authFailure = () => {
  const loading = document.querySelector('#loading');
  if (loading) {
    loading.hidden = false;
    loading.classList.add('error');
    loading.textContent = 'Map is temporarily unavailable. Please try again later.';
  }
};

async function loadAssets() {
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error('Supabase configuration unavailable');
  const accessToken = sessionStorage.getItem('asset_access_token') || key;
  const response = await fetch(`${url}/rest/v1/assets?select=id,lat,lon,status,region,district,city&order=id`, {
    cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/json', apikey: key, Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Asset data service unavailable');
  const payload = await response.json();
  const records = Array.isArray(payload) ? payload : payload.assets;
  if (!Array.isArray(records)) throw new Error('Invalid CMDB API response');
  assets = records.map(asset => ({ ...asset, District: asset.district, City: asset.city, id: normalize(asset.id), region: regionName(asset.region), lat: Number(asset.lat), lon: Number(asset.lon), status: normalize(asset.status) })).filter(asset => asset.id && Number.isFinite(asset.lat) && Number.isFinite(asset.lon));
  applyAssetData();
}

function applyAssetData() {
  $('#loading').hidden = true;
  drawMarkers();
}

function loadGoogleMaps() {
  const key = normalize(window.ASSET_APP_CONFIG?.googleMapsApiKey);
  if (!key) return Promise.reject(new Error('Google Maps API key is not configured'));
  return new Promise((resolve, reject) => {
    window.__assetMapReady = resolve;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__assetMapReady&v=weekly`;
    script.async = true; script.defer = true;
    script.onerror = () => reject(new Error('Map is temporarily unavailable. Please try again later.'));
    document.head.appendChild(script);
  });
}

function renderMap() {
  const kingdomBounds = new google.maps.LatLngBounds({ lat: 16.0, lng: 34.4 }, { lat: 32.6, lng: 55.8 });
  map = new google.maps.Map($('#map'), {
    center: { lat: 24.1, lng: 45.2 }, zoom: 5, minZoom: 2, maxZoom: 19,
    mapTypeId: 'roadmap', mapTypeControl: true, mapTypeControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
    zoomControl: true, zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
    streetViewControl: true, streetViewControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
    fullscreenControl: true, scaleControl: true, clickableIcons: false
  });
  map.fitBounds(kingdomBounds, 30);
  infoWindow = new google.maps.InfoWindow();
  fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries/SAU.geo.json').then(response => response.json()).then(country => {
    const borderPath = country.features[0].geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
    new google.maps.Polyline({ map, path: borderPath, strokeColor: '#4f008c', strokeOpacity: .9, strokeWeight: 3, clickable: false, zIndex: 3 });
  }).catch(error => console.warn('Saudi national border unavailable', error));
}

function drawMarkers() {
  if (!map) return;
  siteMarkers.forEach(marker => marker.setMap(null)); siteMarkers = []; markerById.clear();
  assets.filter(asset => activeStatusFilter === 'all' || (activeStatusFilter === 'on-air' ? isOnAir(asset.status) : !isOnAir(asset.status))).forEach(asset => {
    const online = isOnAir(asset.status);
    const marker = new google.maps.Marker({ map, position: { lat: asset.lat, lng: asset.lon }, title: asset.id, zIndex: 6, icon: { path: google.maps.SymbolPath.CIRCLE, scale: online ? 5 : 5.5, fillColor: online ? '#32d583' : '#f04438', fillOpacity: .96, strokeColor: '#f4f7fb', strokeWeight: 1 } });
    marker.addListener('click', () => { infoWindow.setContent(`<div class="gm-asset"><b>${escapeHTML(asset.id)}</b><span>${escapeHTML(asset.status || 'Unknown')} · ${escapeHTML(asset.region)}</span><a href="site.html?site=${encodeURIComponent(asset.id)}">View asset record →</a></div>`); infoWindow.open({ map, anchor: marker }); });
    markerById.set(asset.id, marker);
    siteMarkers.push(marker);
  });
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
document.querySelectorAll('[data-status-filter]').forEach(button => button.addEventListener('click', () => {
  activeStatusFilter = button.dataset.statusFilter;
  document.querySelectorAll('[data-status-filter]').forEach(item => item.classList.toggle('active', item === button));
  drawMarkers();
}));
window.assetAuthReady().then(() => loadGoogleMaps()).then(() => { renderMap(); return loadAssets(); }).catch(error => {
  $('#loading').hidden = false;
  $('#loading').classList.add('error');
  $('#loading').textContent = error.message.includes('Map') || error.message.includes('key')
    ? 'Map is temporarily unavailable. Please try again later.'
    : 'Asset information is temporarily unavailable. Please try again later.';
  console.error(error);
});
