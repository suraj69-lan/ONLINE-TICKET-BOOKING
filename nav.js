/* Renders the top navbar based on who's logged in, and provides
   simple route-guard helpers used by module pages. */

function basePath(){
  const p = location.pathname;
  return (p.includes('/user/') || p.includes('/admin/')) ? '../' : '';
}

function renderNav(activePage){
  const nav = document.getElementById('navbar');
  if(!nav) return;
  const user = DB.currentUser();
  const base = basePath();

  if(!user){
    nav.innerHTML = `<div class="nav-inner"><a href="${base}index.html" class="brand">🎟️ TicketBook</a></div>`;
    return;
  }

  const link = (href, label, key) =>
    `<a href="${base}${href}" class="${activePage===key ? 'active' : ''}">${label}</a>`;

  if(user.role === 'admin'){
    nav.innerHTML = `
      <div class="nav-inner">
        <a href="${base}admin/dashboard.html" class="brand">🎟️ TicketBook <span class="badge">Admin</span></a>
        <div class="nav-links">
          ${link('admin/dashboard.html','Dashboard','dashboard')}
          ${link('admin/events.html','Manage Events','events')}
          ${link('admin/bookings.html','Bookings','bookings')}
          ${link('admin/promotions.html','Promotions','promos')}
          <span class="nav-user">Hi, ${escapeHtml(user.name)}</span>
          <button class="btn-logout" onclick="doLogout()">Logout</button>
        </div>
      </div>`;
  } else {
    nav.innerHTML = `
      <div class="nav-inner">
        <a href="${base}user/dashboard.html" class="brand">🎟️ TicketBook</a>
        <div class="nav-links">
          ${link('user/dashboard.html','Browse Events','dashboard')}
          ${link('user/my-tickets.html','My Tickets','tickets')}
          <span class="nav-user">Hi, ${escapeHtml(user.name)}</span>
          <button class="btn-logout" onclick="doLogout()">Logout</button>
        </div>
      </div>`;
  }
}

function doLogout(){
  DB.logout();
  window.location.href = basePath() + 'index.html';
}

/** Redirect away if no one is logged in, or if the wrong role is logged in. */
function requireRole(role){
  const user = DB.currentUser();
  const base = basePath();
  if(!user){
    window.location.href = base + 'index.html';
    return null;
  }
  if(user.role !== role){
    window.location.href = base + (user.role === 'admin' ? 'admin/dashboard.html' : 'user/dashboard.html');
    return null;
  }
  return user;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function qs(name){
  return new URLSearchParams(location.search).get(name);
}
