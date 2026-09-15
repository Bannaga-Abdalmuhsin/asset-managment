const normalize = value => String(value ?? '').trim();
const form = document.querySelector('#login-form');
const output = document.querySelector('#login-error');

if (sessionStorage.getItem('asset_access_token')) location.replace('index.html');

form.addEventListener('submit', async event => {
  event.preventDefault();
  output.hidden = true;
  const button = form.querySelector('button');
  const username = normalize(form.username.value).toLowerCase();
  const password = form.password.value;
  const email = username.includes('@') ? username : `${username}@cow-assets.local`;
  const url = normalize(window.ASSET_APP_CONFIG?.supabaseUrl).replace(/\/$/, '');
  const key = normalize(window.ASSET_APP_CONFIG?.supabaseAnonKey);
  button.disabled = true;
  button.textContent = 'Signing in…';
  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const payload = await response.json();
    if (!response.ok || !payload.access_token) throw new Error('Incorrect username or password.');
    sessionStorage.setItem('asset_access_token', payload.access_token);
    const requested = new URLSearchParams(location.search).get('next');
    const safeNext = requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : 'index.html';
    location.replace(safeNext);
  } catch (error) {
    output.textContent = error.message || 'Unable to sign in.';
    output.hidden = false;
    button.disabled = false;
    button.textContent = 'Sign in';
  }
});

