/* =========================================================
   USER MODULE — dynamic browser experience
   ========================================================= */
const PENDING_KEY='tb_pendingBooking';
const CATS=['All','Movie','Concert','Sports','Comedy','Exhibition','Festival'];
const OWNER_ID=()=>{let x=sessionStorage.getItem('tb_lockOwner');if(!x){x=DB.genId('tab');sessionStorage.setItem('tb_lockOwner',x)}return x};

function initEventBrowser(){
  const filters=document.getElementById('filters');
  filters.innerHTML=CATS.map(c=>`<button class="chip ${c==='All'?'active':''}" data-cat="${c}">${c}</button>`).join('');
  let state={cat:'All',query:'',city:'All',maxPrice:'All',sort:'date'};
  const search=document.getElementById('search');
  const grid=document.getElementById('event-grid');
  const toolbar=document.createElement('div');
  toolbar.className='filter-toolbar';
  toolbar.innerHTML=`<select id="city-filter"><option>All cities</option></select>
    <select id="price-filter"><option value="All">Any price</option><option value="500">Under ₹500</option><option value="1000">Under ₹1,000</option><option value="2000">Under ₹2,000</option><option value="5000">Under ₹5,000</option></select>
    <select id="sort-filter"><option value="date">Soonest</option><option value="priceLow">Price: low to high</option><option value="priceHigh">Price: high to low</option><option value="name">Name A–Z</option></select>`;
  filters.after(toolbar);
  const cities=[...new Set(DB.getEvents().map(e=>e.venue.split(',').slice(-1)[0].trim()).filter(Boolean))].sort();
  const citySel=toolbar.querySelector('#city-filter');
  citySel.innerHTML='<option value="All">All cities</option>'+cities.map(c=>`<option>${escapeHtml(c)}</option>`).join('');

  function draw(){
    let events=DB.getEvents().filter(ev=>{
      const hay=(ev.title+' '+ev.venue+' '+ev.description).toLowerCase();
      const q=state.query.toLowerCase();
      const priceOk=state.maxPrice==='All'||ev.price<=Number(state.maxPrice);
      const cityOk=state.city==='All'||ev.venue.toLowerCase().includes(state.city.toLowerCase());
      return (state.cat==='All'||ev.category===state.cat)&&(!q||hay.includes(q))&&priceOk&&cityOk;
    });
    events.sort((a,b)=>state.sort==='priceLow'?a.price-b.price:state.sort==='priceHigh'?b.price-a.price:state.sort==='name'?a.title.localeCompare(b.title):a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
    document.getElementById('result-count').textContent=`${events.length} event${events.length===1?'':'s'} found`;
    if(!events.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="big">🔎</div><h3>No matching events</h3><p>Try another category, city, price range or search term.</p></div>';return;}
    grid.innerHTML=events.map(ev=>{
      const left=DB.seatsLeft(ev), sold=left===0;
      return `<a class="event-card event-card-live" href="event.html?id=${ev.id}">
        <div class="event-banner banner-${ev.category.toLowerCase()}"><span>${ev.emoji}</span><small>${ev.sourceVerified?'VERIFIED OCT 2026':'EVENT'}</small></div>
        <div class="event-body"><div class="event-cat">${escapeHtml(ev.category.toUpperCase())}</div>
        <h3>${escapeHtml(ev.title)}</h3><div class="event-meta"><span>📅 ${DB.fmtDate(ev.date)} · ${ev.time}</span><span>📍 ${escapeHtml(ev.venue)}</span></div>
        <div class="event-foot"><span class="price">${ev.price===0?'FREE':DB.fmtMoney(ev.price)}</span><span class="seats-left ${left<12?'low':''}">${sold?'Sold out':left+' seats left'}</span></div></div></a>`;
    }).join('');
  }
  filters.addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;state.cat=c.dataset.cat;filters.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',x===c));draw();});
  search.addEventListener('input',e=>{state.query=e.target.value;draw()});
  citySel.addEventListener('change',e=>{state.city=e.target.value==='All cities'?'All':e.target.value;draw()});
  toolbar.querySelector('#price-filter').addEventListener('change',e=>{state.maxPrice=e.target.value;draw()});
  toolbar.querySelector('#sort-filter').addEventListener('change',e=>{state.sort=e.target.value;draw()});
  if(!document.getElementById('result-count')){const c=document.createElement('div');c.id='result-count';c.className='result-count';grid.before(c)}
  window.addEventListener('tb-events-changed',draw);
  draw();
}

function seatTier(row){
  if(row==='A'||row==='B')return 'Premium';
  if(row==='C'||row==='D')return 'Standard';
  return 'Economy';
}

function initEventDetails(){
  const ev=DB.getEvent(qs('id')),root=document.getElementById('event-page');
  if(!ev){root.innerHTML='<div class="empty-state"><div class="big">🚫</div><h3>Event not found</h3><a class="btn btn-primary" href="dashboard.html">Back to events</a></div>';return;}
  let selected=[];
  root.innerHTML=`<a href="dashboard.html" class="back-link">← Back to events</a>
  <section class="event-hero"><div class="event-hero-icon">${ev.emoji}</div><div><span class="eyebrow">${escapeHtml(ev.category)} · VERIFIED OCTOBER 2026</span><h1>${escapeHtml(ev.title)}</h1>
  <p>📅 ${DB.fmtDate(ev.date)} · ${ev.time} &nbsp; · &nbsp; 📍 ${escapeHtml(ev.venue)}</p><p>${escapeHtml(ev.description)}</p></div></section>
  <div class="checkout-grid"><div class="panel section"><div class="flex-between"><h3>Select your seats</h3><span class="live-dot">LIVE AVAILABILITY</span></div>
  <div class="screen">STAGE / SCREEN</div><div class="seat-map" id="seat-map"></div>
  <div class="legend"><span><i class="sw available"></i>Available</span><span><i class="sw booked"></i>Booked</span><span><i class="sw selected"></i>Selected</span></div></div>
  <div class="panel sticky-summary"><span class="eyebrow">YOUR ORDER</span><h3>${escapeHtml(ev.title)}</h3><p>${DB.fmtDate(ev.date)} · ${ev.time}</p>
  <label for="promo">Promo code</label><input id="promo" placeholder="WELCOME10"><div id="promo-msg" class="msg"></div>
  <div class="summary-row"><span>Seats</span><span id="sum-seats">—</span></div><div class="summary-row"><span>Subtotal</span><span id="sum-subtotal">₹0</span></div><div class="summary-row"><span>Discount</span><span id="sum-discount">₹0</span></div><div class="summary-row total"><span>Total</span><span id="sum-total">₹0</span></div>
  <button class="btn btn-primary btn-block" id="proceed-btn" disabled>Continue to checkout →</button></div></div>`;

  const letters='ABCDEFGHIJKL'.split(''),map=document.getElementById('seat-map');
  let html='';
  for(let r=0;r<ev.rows;r++){const row=letters[r];html+=`<div class="seat-row"><span class="row-label">${row}</span>`;for(let n=1;n<=ev.seatsPerRow;n++){const id=row+n,booked=ev.bookedSeats.includes(id);html+=`<button type="button" class="seat ${booked?'booked':''}" ${booked?'disabled':''} data-seat="${id}" title="${seatTier(row)} · Seat ${id}">${n}</button>`}html+='</div>'}
  map.innerHTML=html;let discountPercent=0;
  function summary(){const subtotal=selected.length*ev.price,disc=Math.round(subtotal*discountPercent/100);document.getElementById('sum-seats').textContent=selected.length?selected.join(', '):'—';document.getElementById('sum-subtotal').textContent=DB.fmtMoney(subtotal);document.getElementById('sum-discount').textContent='-'+DB.fmtMoney(disc);document.getElementById('sum-total').textContent=DB.fmtMoney(subtotal-disc);document.getElementById('proceed-btn').disabled=!selected.length}
  map.addEventListener('click',e=>{const b=e.target.closest('.seat');if(!b||b.disabled)return;const id=b.dataset.seat;if(selected.includes(id)){selected=selected.filter(x=>x!==id);b.classList.remove('selected')}else if(selected.length<8){selected.push(id);b.classList.add('selected')}summary()});
  document.getElementById('promo').addEventListener('input',e=>{const code=e.target.value.trim().toUpperCase(),p=DB.getPromos().find(x=>x.code===code&&x.active),m=document.getElementById('promo-msg');if(!code){discountPercent=0;m.textContent='';m.className='msg'}else if(p){discountPercent=p.discount;m.textContent=`${p.discount}% discount applied`;m.className='msg success'}else{discountPercent=0;m.textContent='Code not recognised';m.className='msg error'}summary()});
  document.getElementById('proceed-btn').addEventListener('click',()=>{
    const subtotal=selected.length*ev.price,discountAmt=Math.round(subtotal*discountPercent/100);
    localStorage.setItem(PENDING_KEY,JSON.stringify({eventId:ev.id,seats:[...selected],promo:document.getElementById('promo').value.trim().toUpperCase()||null,discountPercent,subtotal,discountAmt,total:subtotal-discountAmt,createdAt:Date.now()}));
    location.href='payment.html';
  });summary();
}

function initPayment(){
  const root=document.getElementById('payment-page'),pending=JSON.parse(localStorage.getItem(PENDING_KEY)||'null');
  if(!pending){root.innerHTML='<div class="empty-state"><div class="big">🛒</div><h3>Nothing to check out</h3><a class="btn btn-primary" href="dashboard.html">Browse events</a></div>';return}
  const ev=DB.getEvent(pending.eventId);if(!ev){root.innerHTML='<div class="empty-state"><h3>Event unavailable</h3></div>';return}
  root.innerHTML=`<div class="checkout-head"><span class="eyebrow">STEP 1 OF 2 · ORDER REVIEW</span><h1>Checkout</h1><p>Review your order before continuing to payment.</p></div>
  <div class="checkout-grid"><div class="panel"><h3>${escapeHtml(ev.title)}</h3><p>${DB.fmtDate(ev.date)} · ${ev.time} · ${escapeHtml(ev.venue)}</p><div class="checkout-items"><div><span>Seats</span><strong>${pending.seats.join(', ')}</strong></div><div><span>Subtotal</span><strong>${DB.fmtMoney(pending.subtotal)}</strong></div><div><span>Discount</span><strong>-${DB.fmtMoney(pending.discountAmt)}</strong></div><div class="checkout-total"><span>Total payable</span><strong>${DB.fmtMoney(pending.total)}</strong></div></div></div>
  <div class="panel"><div class="gateway-brand"><div><b>TicketBook Pay</b><small>Payment gateway</small></div></div><p class="muted">Choose a payment method to complete your booking.</p>
  <button id="gateway-btn" class="btn btn-primary btn-block">Continue to Payment Gateway →</button><a href="event.html?id=${ev.id}" class="btn btn-secondary btn-block">Change seats</a></div></div>`;
  document.getElementById('gateway-btn').onclick=()=>{localStorage.setItem('tb_gatewaySession',JSON.stringify({...pending,startedAt:Date.now()}));location.href='gateway.html'};
}

async function initGateway(){
  const root=document.getElementById('gateway-page'),pending=JSON.parse(localStorage.getItem('tb_gatewaySession')||'null');
  if(!pending){root.innerHTML='<div class="empty-state"><h3>Checkout session expired</h3><a class="btn btn-primary" href="dashboard.html">Browse events</a></div>';return}
  const ev=DB.getEvent(pending.eventId),user=DB.currentUser();if(!ev||!user){location.href='index.html';return}
  root.innerHTML=`<div class="gateway-shell"><div class="gateway-top"><span>TicketBook Pay</span><span>Payment gateway</span></div><div class="gateway-grid"><div><span class="eyebrow">PAYMENT GATEWAY</span><h1>Complete payment</h1><p>${escapeHtml(ev.title)} · ${pending.seats.join(', ')}</p>
  <div class="pay-methods"><button class="pay-method active" data-method="UPI">UPI</button><button class="pay-method" data-method="Card">Card</button><button class="pay-method" data-method="NetBanking">Net Banking</button></div>
  <form id="gateway-form"><div id="upi-fields"><label>UPI ID</label><input id="upi" placeholder="name@bank" required></div><div id="card-fields" class="hidden"><label>Card number</label><input id="g-card" inputmode="numeric" maxlength="19" placeholder="•••• •••• •••• ••••"><div class="field-row"><input id="g-exp" maxlength="5" placeholder="MM/YY"><input id="g-cvv" maxlength="3" placeholder="CVV"></div></div><div id="bank-fields" class="hidden"><label>Bank</label><select id="bank"><option>Select bank</option><option>State Bank</option><option>HDFC Bank</option><option>ICICI Bank</option><option>Axis Bank</option></select></div><div class="msg" id="gateway-msg"></div><button class="btn btn-primary btn-block" id="confirm-payment">Pay ${DB.fmtMoney(pending.total)}</button></form></div>
  <aside class="gateway-order"><span class="eyebrow">ORDER SUMMARY</span><h3>${escapeHtml(ev.title)}</h3><p>${DB.fmtDate(ev.date)} · ${ev.time}</p><p>Seats: <b>${pending.seats.join(', ')}</b></p><div class="summary-row total"><span>Total</span><span>${DB.fmtMoney(pending.total)}</span></div><small>Demo gateway: no real charge is made.</small></aside></div></div>`;

  let method='UPI';
  const toggle=()=>{['upi','card','bank'].forEach(x=>document.getElementById(x+'-fields').classList.toggle('hidden',x!==method.toLowerCase().replace('netbanking','bank')))};
  document.querySelectorAll('.pay-method').forEach(b=>b.onclick=()=>{document.querySelectorAll('.pay-method').forEach(x=>x.classList.remove('active'));b.classList.add('active');method=b.dataset.method;toggle()});
  document.getElementById('g-card').addEventListener('input',function(){this.value=this.value.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim()});
  document.getElementById('gateway-form').addEventListener('submit',async e=>{
    e.preventDefault();const msg=document.getElementById('gateway-msg');
    if(method==='UPI'&&!/^[\w.-]+@[\w.-]+$/.test(document.getElementById('upi').value.trim())){msg.textContent='Enter a valid UPI ID.';msg.className='msg error';return}
    if(method==='Card'&&document.getElementById('g-card').value.replace(/\D/g,'').length<12){msg.textContent='Enter a valid card number.';msg.className='msg error';return}
    if(method==='NetBanking'&&document.getElementById('bank').value==='Select bank'){msg.textContent='Select a bank.';msg.className='msg error';return}
    const btn=document.getElementById('confirm-payment');btn.disabled=true;btn.textContent='Authorising payment…';
    const owner=OWNER_ID();
    if(!DB.acquireBookingLock(owner)){msg.textContent='Another checkout is confirming seats. Please try again in a moment.';msg.className='msg error';btn.disabled=false;btn.textContent=`Pay ${DB.fmtMoney(pending.total)}`;return}
    try{
      await new Promise(r=>setTimeout(r,900));
      DB.refreshBookingLock(owner);
      const fresh=DB.getEvent(pending.eventId);
      const free=pending.seats.every(s=>!fresh.bookedSeats.includes(s));
      if(!free)throw new Error('One or more selected seats were just booked. Please return and choose different seats.');
      const events=DB.getEvents(),idx=events.findIndex(x=>x.id===pending.eventId);
      if(idx<0)throw new Error('Event is no longer available.');
      events[idx].bookedSeats.push(...pending.seats);DB.saveEvents(events);broadcastEventsChanged();
      const booking={id:DB.genId('BK'),userId:user.id,userName:user.name,eventId:ev.id,seats:pending.seats,
        subtotal:pending.subtotal,discountAmt:pending.discountAmt,total:pending.total,promo:pending.promo,
        paymentMethod:method,paymentRef:'PAY-'+Date.now().toString(36).toUpperCase(),bookedAt:new Date().toISOString(),status:'confirmed',
        ticketClass:seatTier(pending.seats[0][0])};
      const bookings=DB.getBookings();bookings.push(booking);DB.saveBookings(bookings);
      localStorage.removeItem(PENDING_KEY);localStorage.removeItem('tb_gatewaySession');
      location.href=`ticket.html?bookingId=${booking.id}`;
    }catch(err){msg.textContent=err.message;msg.className='msg error';btn.disabled=false;btn.textContent=`Pay ${DB.fmtMoney(pending.total)}`}
    finally{DB.releaseBookingLock(owner)}
  });
}

function initTicketView(){
  const root=document.getElementById('ticket-page'),booking=DB.getBooking(qs('bookingId'));
  if(!booking){root.innerHTML='<div class="empty-state"><div class="big">🎫</div><h3>Ticket not found</h3><a class="btn btn-primary" href="my-tickets.html">My Tickets</a></div>';return}
  const ev=DB.getEvent(booking.eventId);if(!ev){root.innerHTML='<div class="empty-state"><h3>Event record unavailable</h3></div>';return}
  const ticketCode=booking.id.replace(/[^A-Z0-9]/gi,'').slice(-12).toUpperCase();
  root.innerHTML=`<div class="no-print ticket-actions"><a href="my-tickets.html" class="back-link">← My Tickets</a><button class="btn btn-secondary" onclick="window.print()">🖨 Print / Save PDF</button></div>
  ${booking.status==='cancelled'?'<div class="msg error">This ticket has been cancelled.</div>':''}
  <div class="ticket realistic-ticket"><div class="ticket-main"><div class="ticket-top"><span class="eyebrow">${escapeHtml(ev.category)} · DIGITAL PASS</span><span class="ticket-status">${booking.status.toUpperCase()}</span></div>
  <h1>${escapeHtml(ev.title)}</h1><div class="ticket-grid"><div><small>DATE</small><b>${DB.fmtDate(ev.date)}</b></div><div><small>TIME</small><b>${ev.time}</b></div><div><small>VENUE</small><b>${escapeHtml(ev.venue)}</b></div><div><small>GATE</small><b>${gateForSeat(booking.seats[0])}</b></div><div><small>SEAT(S)</small><b>${booking.seats.join(', ')}</b></div><div><small>CLASS</small><b>${booking.ticketClass||seatTier(booking.seats[0][0])}</b></div></div>
  <div class="ticket-divider"></div><div class="ticket-bottom"><div><small>PASS HOLDER</small><b>${escapeHtml(booking.userName)}</b><small>BOOKING ID</small><b>${booking.id}</b></div><div><small>PAID</small><b>${DB.fmtMoney(booking.total)}</b><small>PAYMENT REF</small><b>${booking.paymentRef||'—'}</b></div></div></div>
  <div class="ticket-stub"><div class="stub-label">SCAN AT ENTRY</div>${qrPattern(booking.id+ev.id)}<div class="barcode">${barcodePattern(ticketCode)}</div><div class="stub-code">${ticketCode}</div><div class="stub-label">KEEP THIS PASS READY</div></div></div>
  <div class="ticket-note">TicketBook digital pass · Present this code at the event entrance. Ticket data is generated from your confirmed booking.</div>`;
}
function gateForSeat(seat){const row=(seat||'A1')[0];return row<'C'?'A':'B'}
function qrPattern(seed){let h=0;for(let i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))>>>0;let c='',n=11;for(let i=0;i<n*n;i++){h=(h*1664525+1013904223)>>>0;const on=((h>>>28)&1)===1;c+=`<i class="${on?'on':''}"></i>`}return `<div class="qr-grid">${c}</div>`}
function barcodePattern(seed){return seed.split('').map((c,i)=>`<i style="height:${12+(c.charCodeAt(0)%16)}px;width:${1+(i%3)}px"></i>`).join('')}

function initMyTickets(){
  const user=DB.currentUser(),list=document.getElementById('my-tickets-list');
  const bookings=DB.getBookings().filter(b=>b.userId===user.id).sort((a,b)=>new Date(b.bookedAt)-new Date(a.bookedAt));
  if(!bookings.length){list.innerHTML='<div class="empty-state"><div class="big">🎫</div><h3>No bookings yet</h3><p>Once you book a ticket, it appears here.</p><a class="btn btn-primary" href="dashboard.html">Browse events</a></div>';return}
  list.innerHTML=`<div class="ticket-history-grid">${bookings.map(b=>{const ev=DB.getEvent(b.eventId);if(!ev)return'';return `<div class="history-card"><div class="event-cat">${escapeHtml(ev.category)}</div><h3>${escapeHtml(ev.title)}</h3><p>📅 ${DB.fmtDate(ev.date)} · ${ev.time}</p><p>🎟 ${b.seats.join(', ')} · ${DB.fmtMoney(b.total)}</p><span class="status-pill ${b.status==='confirmed'?'status-confirmed':'status-cancelled'}">${b.status}</span><a class="btn btn-secondary btn-block" href="ticket.html?bookingId=${b.id}">Open digital ticket →</a></div>`}).join('')}</div>`;
}
