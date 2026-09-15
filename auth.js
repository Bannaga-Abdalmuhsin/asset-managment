const AUTH_USERNAME_DOMAIN = 'cow-assets.local';

const authConfig = () => ({
  url: String(window.ASSET_APP_CONFIG?.supabaseUrl || '').replace(/\/$/, ''),
  key: String(window.ASSET_APP_CONFIG?.supabaseAnonKey || '')
});

window.assetAuthReady = async function assetAuthReady() {
  const { url, key } = authConfig();
  const token = sessionStorage.getItem('asset_access_token');
  if (!url || !key || !token) {
    location.replace(`login.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return new Promise(() => {});
  }
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!response.ok) {
    sessionStorage.removeItem('asset_access_token');
    location.replace(`login.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return new Promise(() => {});
  }
  const user = await response.json();
  document.documentElement.classList.add('authenticated');
  return { token, user };
};

window.assetLogout = function assetLogout() {
  sessionStorage.removeItem('asset_access_token');
  location.replace('login.html');
};

