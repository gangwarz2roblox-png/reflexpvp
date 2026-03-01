const DISCORD_CLIENT_ID = '1470840282760085515';
const REDIRECT_URI = encodeURIComponent('https://reflexpvp.co.uk/dashboard.html');
const SCOPES = 'identify';

const DISCORD_AUTH_URL =
  `https://discord.com/api/oauth2/authorize` +
  `?client_id=${DISCORD_CLIENT_ID}` +
  `&redirect_uri=${REDIRECT_URI}` +
  `&response_type=token` +
  `&scope=${SCOPES}`;

const USER_KEY = 'mps_discord_user';
const TOKEN_KEY = 'mps_discord_token';

function getUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveUser(user) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

function logout() {
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  window.location.href = 'index.html';
}

async function fetchDiscordUser(token) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

function parseHashToken() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token') || null;
}

function clearHash() {
  history.replaceState(null, '', window.location.pathname);
}

const loginBtn = document.getElementById('loginBtn');
if (loginBtn) {
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = DISCORD_AUTH_URL;
  });
}

(async function handleCallback() {
  const token = parseHashToken();
  if (!token) return;
  clearHash();
  try {
    const user = await fetchDiscordUser(token);
    sessionStorage.setItem(TOKEN_KEY, token);
    saveUser(user);
    window.location.reload();
  } catch (err) {
    console.error('Discord auth error:', err);
    alert('Login failed: ' + err.message);
    window.location.href = 'index.html';
  }
})();
