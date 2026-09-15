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
  const displayName = String(
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.username ||
    user.email?.split('@')[0] ||
    'Authorized user'
  ).trim();
  const userLabel = document.querySelector('#current-user');
  if (userLabel) userLabel.textContent = displayName;
  document.documentElement.classList.add('authenticated');
  return { token, user, displayName };
};

window.assetLogout = function assetLogout() {
  sessionStorage.removeItem('asset_access_token');
  location.replace('login.html');
};
