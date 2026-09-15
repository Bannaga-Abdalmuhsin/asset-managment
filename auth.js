const AUTH_USERNAME_DOMAIN = 'cow-assets.local';

const authConfig = () => ({
  url: String(window.ASSET_APP_CONFIG?.supabaseUrl || '').replace(/\/$/, ''),
  key: String(window.ASSET_APP_CONFIG?.supabaseAnonKey || '')
});

const accountDisplayName = user => String(
  user.user_metadata?.display_name ||
  user.user_metadata?.full_name ||
  user.user_metadata?.username ||
  user.email?.split('@')[0] ||
  'Authorized user'
).trim();

function showAccountMessage(message, isError = false) {
  const output = document.querySelector('#account-message');
  if (!output) return;
  output.textContent = message;
  output.classList.toggle('error', isError);
  output.hidden = false;
}

async function updateSupabaseUser(payload, token) {
  const { url, key } = authConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer'
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.message || 'Account update failed.');
  return result;
}

function initializeAccountMenu(user, token) {
  const trigger = document.querySelector('#account-trigger');
  const menu = document.querySelector('#account-menu');
  if (!trigger || !menu) return;

  const username = accountDisplayName(user);
  document.querySelector('#current-user').textContent = username;
  document.querySelector('#account-email').textContent = user.email || 'Not available';
  document.querySelector('#account-last-sign-in').textContent = user.last_sign_in_at
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(user.last_sign_in_at))
    : 'Not available';
  document.querySelector('#username-form').username.value = username;

  const setMenuOpen = open => {
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  };
  trigger.addEventListener('click', event => {
    event.stopPropagation();
    setMenuOpen(menu.hidden);
  });
  document.querySelector('#account-close').addEventListener('click', () => setMenuOpen(false));
  document.addEventListener('click', event => {
    if (!event.target.closest('.account-state')) setMenuOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMenuOpen(false);
  });

  document.querySelector('#username-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const nextUsername = String(form.username.value || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(nextUsername)) {
      showAccountMessage('Use 3–32 letters, numbers, dots, underscores or hyphens.', true);
      return;
    }
    button.disabled = true;
    try {
      const updated = await updateSupabaseUser({
        email: `${nextUsername}@${AUTH_USERNAME_DOMAIN}`,
        data: { ...user.user_metadata, username: nextUsername, display_name: nextUsername }
      }, token);
      user = updated;
      document.querySelector('#current-user').textContent = nextUsername;
      document.querySelector('#account-email').textContent = updated.email || user.email || 'Pending confirmation';
      showAccountMessage('Username updated. Use the new username for your next login.');
    } catch (error) {
      showAccountMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const password = form.password.value;
    button.disabled = true;
    try {
      await updateSupabaseUser({ password }, token);
      form.reset();
      showAccountMessage('Password changed successfully.');
    } catch (error) {
      showAccountMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

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
  const displayName = accountDisplayName(user);
  const userLabel = document.querySelector('#current-user');
  if (userLabel) userLabel.textContent = displayName;
  initializeAccountMenu(user, token);
  document.documentElement.classList.add('authenticated');
  return { token, user, displayName };
};

window.assetLogout = function assetLogout() {
  sessionStorage.removeItem('asset_access_token');
  location.replace('login.html');
};
