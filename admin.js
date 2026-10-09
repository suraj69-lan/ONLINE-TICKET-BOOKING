/* =========================================================
   ADMIN MODULE
   Manage events, monitor sales, control promotions
   ========================================================= */

/* ---------------- Dashboard ---------------- */

function initAdminDashboard(){
  const events = DB.getEvents();
  const bookings = DB.getBookings().filter(b => b.status === 'confirmed');

  const totalRevenue = bookings.reduce((sum,b) => sum + b.total, 0);
  const totalSeatsSold = bookings.reduce((sum,b) => sum + b.seats.length, 0);

  document.getElementById('stat-grid').innerHTML = `
    <div class="stat-card"><div class="num">${events.length}</div><div class="label">Active Events</div></div>
    <div class="stat-card"><div class="num">${bookings.length}</div><div class="label">Tickets Booked</div></div>
    <div class="stat-card"><div class="num">${totalSeatsSold}</div><div class="label">Seats Sold</div></div>
    <div class="stat-card"><div class="num">${DB.fmtMoney(totalRevenue)}</div><div class="label">Total Revenue</div></div>
  `;

  const recent = [...bookings].sort((a,b) => new Date(b.bookedAt) - new Date(a.bookedAt)).slice(0,6);
  const wrap = document.getElementById('recent-bookings');

  if(recent.length === 0){
    wrap.innerHTML = `<div class="empty-state"><div class="big">📭</div><h3>No bookings yet</h3></div>`;
    return;
  }

  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Customer</th><th>Event</th><th>Seats</th><th>Amount</th><th>Booked On</th></tr></thead>
    <tbody>
      ${recent.map(b => {
        const ev = DB.getEvent(b.eventId);
        return `<tr>
          <td>${escapeHtml(b.userName)}</td>
          <td>${ev ? escapeHtml(ev.title) : '—'}</td>
          <td>${b.seats.length}</td>
          <td>${DB.fmtMoney(b.total)}</td>
          <td>${new Date(b.bookedAt).toLocaleString('en-IN', {dateStyle:'medium', timeStyle:'short'})}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
}

/* ---------------- Event manager ---------------- */

function initEventManager(){
  drawEventsTable();
  document.getElementById('event-form').addEventListener('submit', saveEventForm);
}

function drawEventsTable(){
  const events = DB.getEvents();
  const wrap = document.getElementById('events-table');

  if(events.length === 0){
    wrap.innerHTML = `<div class="empty-state"><div class="big">🎪</div><h3>No events yet</h3>
      <p>Add your first event to start selling tickets.</p></div>`;
    return;
  }

  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Event</th><th>Category</th><th>Date</th><th>Venue</th><th>Price</th><th>Seats Left</th><th>Actions</th></tr></thead>
    <tbody>
      ${events.map(ev => `
        <tr>
          <td>${ev.emoji} ${escapeHtml(ev.title)}</td>
          <td>${ev.category}</td>
          <td>${DB.fmtDate(ev.date)} · ${ev.time}</td>
          <td>${escapeHtml(ev.venue)}</td>
          <td>${DB.fmtMoney(ev.price)}</td>
          <td>${DB.seatsLeft(ev)} / ${DB.totalSeats(ev)}</td>
          <td>
            <button class="btn btn-secondary" style="padding:.35rem .8rem; font-size:.8rem;" onclick="openEventModal('${ev.id}')">Edit</button>
            <button class="btn btn-danger" style="padding:.35rem .8rem; font-size:.8rem;" onclick="deleteEvent('${ev.id}')">Delete</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table></div>`;
}

function openEventModal(eventId){
  const overlay = document.getElementById('event-modal-overlay');
  const title = document.getElementById('event-modal-title');
  document.getElementById('event-form-msg').textContent = '';
  document.getElementById('event-form').reset();

  if(eventId){
    const ev = DB.getEvent(eventId);
    title.textContent = 'Edit Event';
    document.getElementById('ev-id').value = ev.id;
    document.getElementById('ev-title').value = ev.title;
    document.getElementById('ev-category').value = ev.category;
    document.getElementById('ev-emoji').value = ev.emoji;
    document.getElementById('ev-date').value = ev.date;
    document.getElementById('ev-time').value = ev.time;
    document.getElementById('ev-venue').value = ev.venue;
    document.getElementById('ev-price').value = ev.price;
    document.getElementById('ev-rows').value = ev.rows;
    document.getElementById('ev-seatsperrow').value = ev.seatsPerRow;
    document.getElementById('ev-desc').value = ev.description;
  } else {
    title.textContent = 'Add Event';
    document.getElementById('ev-id').value = '';
    document.getElementById('ev-emoji').value = '🎫';
    document.getElementById('ev-rows').value = 5;
    document.getElementById('ev-seatsperrow').value = 8;
  }
  overlay.classList.add('open');
}

function closeEventModal(){
  document.getElementById('event-modal-overlay').classList.remove('open');
}

function saveEventForm(e){
  e.preventDefault();
  const id = document.getElementById('ev-id').value;
  const rows = parseInt(document.getElementById('ev-rows').value, 10);
  const seatsPerRow = parseInt(document.getElementById('ev-seatsperrow').value, 10);
  const msg = document.getElementById('event-form-msg');

  const events = DB.getEvents();

  if(id){
    const idx = events.findIndex(ev => ev.id === id);
    const existing = events[idx];
    const newCapacity = rows * seatsPerRow;
    if(existing.bookedSeats.length > newCapacity){
      msg.textContent = 'Cannot shrink seating below the number of seats already booked.';
      return;
    }
    events[idx] = {
      ...existing,
      title: document.getElementById('ev-title').value.trim(),
      category: document.getElementById('ev-category').value,
      emoji: document.getElementById('ev-emoji').value.trim() || '🎫',
      date: document.getElementById('ev-date').value,
      time: document.getElementById('ev-time').value,
      venue: document.getElementById('ev-venue').value.trim(),
      price: parseFloat(document.getElementById('ev-price').value),
      rows, seatsPerRow,
      description: document.getElementById('ev-desc').value.trim()
    };
  } else {
    events.push({
      id: DB.genId('ev'),
      title: document.getElementById('ev-title').value.trim(),
      category: document.getElementById('ev-category').value,
      emoji: document.getElementById('ev-emoji').value.trim() || '🎫',
      date: document.getElementById('ev-date').value,
      time: document.getElementById('ev-time').value,
      venue: document.getElementById('ev-venue').value.trim(),
      price: parseFloat(document.getElementById('ev-price').value),
      rows, seatsPerRow,
      bookedSeats: [],
      description: document.getElementById('ev-desc').value.trim()
    });
  }

  DB.saveEvents(events);
  closeEventModal();
  drawEventsTable();
}

function deleteEvent(id){
  if(!confirm('Delete this event? Existing bookings for it will remain in history but the event will no longer be bookable.')) return;
  const events = DB.getEvents().filter(ev => ev.id !== id);
  DB.saveEvents(events);
  drawEventsTable();
}

/* ---------------- Bookings view ---------------- */

function initBookingsView(){
  let query = '';

  function draw(){
    const bookings = DB.getBookings()
      .sort((a,b) => new Date(b.bookedAt) - new Date(a.bookedAt))
      .filter(b => {
        const ev = DB.getEvent(b.eventId);
        const haystack = (b.userName + ' ' + (ev ? ev.title : '')).toLowerCase();
        return haystack.includes(query.toLowerCase());
      });

    const wrap = document.getElementById('bookings-table');
    if(bookings.length === 0){
      wrap.innerHTML = `<div class="empty-state"><div class="big">📭</div><h3>No bookings found</h3></div>`;
      return;
    }

    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Booking ID</th><th>Customer</th><th>Event</th><th>Seats</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${bookings.map(b => {
          const ev = DB.getEvent(b.eventId);
          return `<tr>
            <td>${b.id}</td>
            <td>${escapeHtml(b.userName)}</td>
            <td>${ev ? escapeHtml(ev.title) : '<em>deleted event</em>'}</td>
            <td>${b.seats.join(', ')}</td>
            <td>${DB.fmtMoney(b.total)}</td>
            <td><span class="status-pill status-${b.status === 'confirmed' ? 'confirmed' : 'cancelled'}">${b.status}</span></td>
            <td>${b.status === 'confirmed'
              ? `<button class="btn btn-danger" style="padding:.35rem .8rem; font-size:.8rem;" onclick="adminCancelBooking('${b.id}')">Cancel</button>`
              : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  document.getElementById('booking-search').addEventListener('input', e => {
    query = e.target.value;
    draw();
  });

  draw();
  window._redrawBookings = draw;
}

function adminCancelBooking(bookingId){
  if(!confirm('Cancel this booking and release its seats?')) return;
  const bookings = DB.getBookings();
  const idx = bookings.findIndex(b => b.id === bookingId);
  if(idx === -1) return;
  const booking = bookings[idx];
  booking.status = 'cancelled';
  DB.saveBookings(bookings);

  const events = DB.getEvents();
  const evIdx = events.findIndex(e => e.id === booking.eventId);
  if(evIdx !== -1){
    events[evIdx].bookedSeats = events[evIdx].bookedSeats.filter(s => !booking.seats.includes(s));
    DB.saveEvents(events);
  }
  if(window._redrawBookings) window._redrawBookings();
}

/* ---------------- Promotions ---------------- */

function initPromoManager(){
  drawPromosTable();
  document.getElementById('promo-form').addEventListener('submit', e => {
    e.preventDefault();
    const code = document.getElementById('pr-code').value.trim().toUpperCase();
    const discount = parseInt(document.getElementById('pr-discount').value, 10);
    const msg = document.getElementById('promo-form-msg');

    const promos = DB.getPromos();
    if(promos.some(p => p.code === code)){
      msg.textContent = 'That code already exists.';
      return;
    }
    promos.push({ code, discount, active: true });
    DB.savePromos(promos);
    document.getElementById('promo-form').reset();
    msg.textContent = '';
    drawPromosTable();
  });
}

function drawPromosTable(){
  const promos = DB.getPromos();
  const wrap = document.getElementById('promos-table');

  if(promos.length === 0){
    wrap.innerHTML = `<div class="empty-state"><div class="big">🏷️</div><h3>No promo codes yet</h3></div>`;
    return;
  }

  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Code</th><th>Discount</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>
      ${promos.map(p => `
        <tr>
          <td>${p.code}</td>
          <td>${p.discount}%</td>
          <td><span class="status-pill ${p.active ? 'status-confirmed' : 'status-cancelled'}">${p.active ? 'active' : 'disabled'}</span></td>
          <td>
            <button class="btn btn-secondary" style="padding:.35rem .8rem; font-size:.8rem;" onclick="togglePromo('${p.code}')">${p.active ? 'Disable' : 'Enable'}</button>
            <button class="btn btn-danger" style="padding:.35rem .8rem; font-size:.8rem;" onclick="deletePromo('${p.code}')">Delete</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table></div>`;
}

function togglePromo(code){
  const promos = DB.getPromos();
  const idx = promos.findIndex(p => p.code === code);
  promos[idx].active = !promos[idx].active;
  DB.savePromos(promos);
  drawPromosTable();
}

function deletePromo(code){
  if(!confirm('Delete this promo code?')) return;
  DB.savePromos(DB.getPromos().filter(p => p.code !== code));
  drawPromosTable();
}
