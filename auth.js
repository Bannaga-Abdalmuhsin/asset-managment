const AUTH_USERNAME_DOMAIN = 'cow-assets.local';
const authConfig = () => ({ url: String(window.ASSET_APP_CONFIG?.supabaseUrl || '').replace(/\/$/, ''), key: String(window.ASSET_APP_CONFIG?.supabaseAnonKey || '') });
const accountDisplayName = user => String(user.user_metadata?.display_name || user.user_metadata?.username || user.email?.split('@')[0] || 'User').trim();

function showAccountMessage(message, isError = false) {
  const output = document.querySelector('#account-message');
  if (!output) return;
  output.textContent = message; output.classList.toggle('error', isError); output.hidden = false;
}

async function updateSupabaseUser(payload, token) {
  const { url, key } = authConfig();
  const response = await fetch(`${url}/auth/v1/user`, { method: 'PUT', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.message || 'Account update failed.');
  return result;
}

async function signedAvatarUrl(path, token) {
  if (!path) return '';
  const { url, key } = authConfig();
  const response = await fetch(`${url}/storage/v1/object/sign/avatars/${path}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) });
  if (!response.ok) return '';
  const result = await response.json();
  return result.signedURL ? `${url}/storage/v1${result.signedURL}` : '';
}

async function renderUser(user, token) {
  const name = accountDisplayName(user);
  document.querySelectorAll('#current-user').forEach(el => { el.textContent = name; });
  document.querySelectorAll('#account-email').forEach(el => { el.textContent = user.email || 'Not available'; });
  const usernameInput = document.querySelector('#username-form [name="username"]');
  if (usernameInput) usernameInput.value = name;
  const lastSignIn = document.querySelector('#account-last-sign-in');
  if (lastSignIn) lastSignIn.textContent = user.last_sign_in_at ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(user.last_sign_in_at)) : 'Not available';
  const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
  document.querySelectorAll('.user-initials').forEach(el => { el.textContent = initials; });
  const avatarUrl = await signedAvatarUrl(user.user_metadata?.avatar_path, token);
  if (avatarUrl) {
    document.querySelectorAll('.user-avatar').forEach(img => { img.src = avatarUrl; img.hidden = false; img.nextElementSibling.hidden = true; });
    const preview = document.querySelector('#profile-avatar-preview');
    if (preview) { preview.src = avatarUrl; preview.hidden = false; if (preview.nextElementSibling) preview.nextElementSibling.hidden = true; }
  }
}

function initializeUserMenu() {
  const trigger = document.querySelector('#account-trigger'), menu = document.querySelector('#account-menu');
  if (!trigger || !menu) return;
  const setOpen = open => { menu.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); };
  trigger.addEventListener('click', event => { event.stopPropagation(); setOpen(menu.hidden); });
  document.addEventListener('click', event => { if (!event.target.closest('.account-state')) setOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
}

function initializeSettings(user, token) {
  const usernameForm = document.querySelector('#username-form');
  if (usernameForm) usernameForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = usernameForm.querySelector('button'), username = String(usernameForm.username.value || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) return showAccountMessage('Use 3–32 letters, numbers, dots, underscores or hyphens.', true);
    button.disabled = true;
    try {
      user = await updateSupabaseUser({ email: `${username}@${AUTH_USERNAME_DOMAIN}`, data: { ...user.user_metadata, username, display_name: username } }, token);
      await renderUser(user, token); showAccountMessage('Username updated successfully.');
    } catch (error) { showAccountMessage(error.message, true); } finally { button.disabled = false; }
  });
  const passwordForm = document.querySelector('#password-form');
  if (passwordForm) passwordForm.addEventListener('submit', async event => {
    event.preventDefault(); const button = passwordForm.querySelector('button'); button.disabled = true;
    try { await updateSupabaseUser({ password: passwordForm.password.value }, token); passwordForm.reset(); showAccountMessage('Password changed successfully.'); }
    catch (error) { showAccountMessage(error.message, true); } finally { button.disabled = false; }
  });
  const avatarForm = document.querySelector('#avatar-form');
  if (avatarForm) avatarForm.addEventListener('submit', async event => {
    event.preventDefault(); const file = avatarForm.avatar.files[0];
    if (!file || !file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) return showAccountMessage('Select a JPG, PNG or WebP image smaller than 2 MB.', true);
    const button = avatarForm.querySelector('button'); button.disabled = true;
    try {
      const { url, key } = authConfig(), extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, ''), path = `${user.id}/profile.${extension}`;
      const response = await fetch(`${url}/storage/v1/object/avatars/${path}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'x-upsert': 'true' }, body: file });
      if (!response.ok) { const result = await response.json(); throw new Error(result.message || 'Profile image upload failed.'); }
      user = await updateSupabaseUser({ data: { ...user.user_metadata, avatar_path: path } }, token);
      await renderUser(user, token); avatarForm.reset(); showAccountMessage('Profile image updated successfully.');
    } catch (error) { showAccountMessage(error.message, true); } finally { button.disabled = false; }
  });
}

window.assetLogout = async function assetLogout() {
  const token = sessionStorage.getItem('asset_access_token'), { url, key } = authConfig();
  sessionStorage.removeItem('asset_access_token');
  try { if (token && url && key) await fetch(`${url}/auth/v1/logout`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}` } }); }
  finally { location.replace('login.html'); }
};

window.assetAuthReady = async function assetAuthReady() {
  const { url, key } = authConfig(), token = sessionStorage.getItem('asset_access_token');
  if (!url || !key || !token) { location.replace(`login.html?next=${encodeURIComponent(location.pathname + location.search)}`); return new Promise(() => {}); }
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) { sessionStorage.removeItem('asset_access_token'); location.replace(`login.html?next=${encodeURIComponent(location.pathname + location.search)}`); return new Promise(() => {}); }
  const user = await response.json();
  await renderUser(user, token); initializeUserMenu(); initializeSettings(user, token);
  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', window.assetLogout));
  document.documentElement.classList.add('authenticated');
  return { token, user, displayName: accountDisplayName(user) };
};
