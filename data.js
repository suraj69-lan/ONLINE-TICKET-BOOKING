/* =========================================================
   TICKETBOOK DATA + SECURITY LAYER
   Browser demo architecture:
   - SHA-256 password hashing (never stores plain signup passwords)
   - session authentication + route role checks
   - short-lived event caching
   - localStorage booking lock + BroadcastChannel cross-tab signal
   - atomic-style revalidation immediately before confirmation

   Production note: real authentication, authorization, locking and payment
   must be enforced by a server/database/payment provider.
   ========================================================= */

const DB = {
  KEYS: {
    users:'tb_users', events:'tb_events', bookings:'tb_bookings',
    promos:'tb_promos', session:'tb_currentUser', cache:'tb_eventCache',
    lock:'tb_bookingLock'
  },
  CACHE_TTL: 30000,
  LOCK_TTL: 12000,
  EVENT_DATA_VERSION: '2026-10-clean-v2',

  async hashPassword(password,saltHex=null){
    const salt=saltHex||[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/.{2}/g).map(x=>parseInt(x,16))),iterations:120000,hash:'SHA-256'},key,256);
    const hash=[...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('');
    return salt+'$'+hash;
  },
  isHash(value){ return typeof value === 'string' && /^[a-f0-9]{32}\$[a-f0-9]{64}$/i.test(value); },

  init(){
    if(!localStorage.getItem(this.KEYS.users)){
      /* Demo admin seed. Credentials are intentionally NOT displayed in the UI. */
      localStorage.setItem(this.KEYS.users, JSON.stringify([
        {id:'admin-1',name:'Administrator',email:'admin@ticketbook.com',
         passwordHash:'4f8c2d6a91b7e3c5a1129d4f6e8a7b20$e043eedb30c62efa51f72b28da3acf94590c60f3a90e432f7b4062900bd5ac4c',role:'admin'}
      ]));
    }
    const eventVersion=localStorage.getItem('tb_eventDataVersion');
    if(eventVersion!==this.EVENT_DATA_VERSION){
      localStorage.setItem(this.KEYS.events, JSON.stringify(this.seedEvents()));
      localStorage.setItem('tb_eventDataVersion', this.EVENT_DATA_VERSION);
      localStorage.removeItem(this.KEYS.cache);
    }
    if(!localStorage.getItem(this.KEYS.bookings)) localStorage.setItem(this.KEYS.bookings,'[]');
    if(!localStorage.getItem(this.KEYS.promos)) localStorage.setItem(this.KEYS.promos,JSON.stringify([
      {code:'WELCOME10',discount:10,active:true},
      {code:'FEST20',discount:20,active:true},
      {code:'OCTOBER15',discount:15,active:true}
    ]));
  },



  seedEvents(){
    const raw = [
      ["Bengaluru FC vs Sporting Club Delhi","Sports","⚽","2026-10-10","17:00","Sree Kanteerava Stadium, Bengaluru",699],
      ["FC Goa vs Chennaiyin FC","Sports","⚽","2026-10-10","19:30","Fatorda Stadium, Goa",799],
      ["Inter Kashi vs Kerala Blasters FC","Sports","⚽","2026-10-11","17:00","Venue TBC, India",599],
      ["Churchill Brothers vs Mumbai City FC","Sports","⚽","2026-10-11","19:30","Fatorda Stadium, Goa",699],
      ["NorthEast United FC vs Mohun Bagan Super Giant","Sports","⚽","2026-10-12","19:30","Sarusajai Stadium, Guwahati",799],
      ["Punjab FC vs Odisha FC","Sports","⚽","2026-10-14","19:30","JLN Stadium, Delhi",599],
      ["Sporting Club Delhi vs Mohun Bagan Super Giant","Sports","⚽","2026-10-16","19:30","JLN Stadium, Delhi",699],
      ["Inter Kashi vs Odisha FC","Sports","⚽","2026-10-17","17:00","Venue TBC, India",599],
      ["Bengaluru FC vs Chennaiyin FC","Sports","⚽","2026-10-17","19:30","Sree Kanteerava Stadium, Bengaluru",699],
      ["Churchill Brothers vs East Bengal FC","Sports","⚽","2026-10-18","17:00","Fatorda Stadium, Goa",599],
      ["NorthEast United FC vs Kerala Blasters FC","Sports","⚽","2026-10-18","19:30","Sarusajai Stadium, Guwahati",699],
      ["Punjab FC vs Mumbai City FC","Sports","⚽","2026-10-19","19:30","JLN Stadium, Delhi",599],
      ["Inter Kashi vs East Bengal FC","Sports","⚽","2026-10-23","17:00","Venue TBC, India",599],
      ["Odisha FC vs NorthEast United FC","Sports","⚽","2026-10-24","19:30","Kalinga Stadium, Bhubaneswar",699],
      ["Churchill Brothers vs Punjab FC","Sports","⚽","2026-10-25","17:00","Fatorda Stadium, Goa",599],
      ["Kerala Blasters FC vs Mumbai City FC","Sports","⚽","2026-10-25","19:30","JLN Stadium, Kochi",799],
      ["Mohun Bagan Super Giant vs Chennaiyin FC","Sports","⚽","2026-10-26","19:30","VYBK, Kolkata",899],
      ["FC Goa vs Sporting Club Delhi","Sports","⚽","2026-10-28","19:30","Fatorda Stadium, Goa",699],
      ["NorthEast United FC vs Bengaluru FC","Sports","⚽","2026-10-30","19:30","Sarusajai Stadium, Guwahati",699],
      ["Chennaiyin FC vs Kerala Blasters FC","Sports","⚽","2026-10-31","17:00","JLN Stadium, Chennai",699],
      ["Mohun Bagan Super Giant vs Punjab FC","Sports","⚽","2026-10-31","19:30","VYBK, Kolkata",799],

      ["India vs West Indies — 3rd ODI","Sports","🏏","2026-10-03","14:00","PCA International Cricket Stadium, New Chandigarh",899],
      ["India vs West Indies — 1st T20I","Sports","🏏","2026-10-06","19:00","Ekana Cricket Stadium, Lucknow",799],
      ["India vs West Indies — 2nd T20I","Sports","🏏","2026-10-09","19:00","JSCA International Cricket Stadium, Ranchi",799],
      ["South Africa vs Australia — 1st Test","Sports","🏏","2026-10-09","09:30","Kingsmead, Durban",999],
      ["India vs West Indies — 3rd T20I","Sports","🏏","2026-10-11","19:00","Holkar Cricket Stadium, Indore",799],
      ["India vs West Indies — 4th T20I","Sports","🏏","2026-10-14","19:00","Rajiv Gandhi International Stadium, Hyderabad",899],
      ["India vs West Indies — 5th T20I","Sports","🏏","2026-10-17","19:00","M. Chinnaswamy Stadium, Bengaluru",999],
      ["South Africa vs Australia — 2nd Test","Sports","🏏","2026-10-18","09:30","St George's Park, Gqeberha",999],
      ["New Zealand vs India — 1st T20I","Sports","🏏","2026-10-22","20:00","Hagley Oval, Christchurch",899],
      ["New Zealand vs India — 2nd T20I","Sports","🏏","2026-10-24","20:00","Hagley Oval, Christchurch",899],
      ["South Africa vs Australia — 3rd Test","Sports","🏏","2026-10-27","09:30","Newlands, Cape Town",999],
      ["New Zealand vs India — 3rd T20I","Sports","🏏","2026-10-27","20:00","Sky Stadium, Wellington",899],
      ["New Zealand vs India — 4th T20I","Sports","🏏","2026-10-30","20:00","Eden Gardens, Kolkata",999],

      ["Gurdas Maan Live in Concert","Concert","🎤","2026-10-03","19:00","Plenary Hall, Bharat Mandapam, Delhi",1499],
      ["Akhil Sachdeva — Homecoming India Tour","Concert","🎶","2026-10-03","19:30","KOPA Mall, Pune",799],
      ["AR Rahman — The Wonderment Tour","Concert","🎹","2026-10-03","19:00","Bengaluru",3999],
      ["Seedhe Maut Live at Sunburn Union","Concert","🎧","2026-10-04","19:30","Sunburn Union, Bengaluru",999],
      ["Yatra with Aanchal","Concert","🎼","2026-10-04","20:00","Akan, Hyderabad",999],
      ["Akhil Sachdeva — Homecoming India Tour","Concert","🎶","2026-10-09","19:30","Bengaluru",799],
      ["Legacy World Tour — Udit Narayan & Aditya Narayan","Concert","🎤","2026-10-10","19:00","Dublin Square, Phoenix Marketcity, Mumbai",1499],
      ["Papon Live in Concert","Concert","🎵","2026-10-10","19:00","Oasis, Amanora Mall, Pune",1999],
      ["Reset Live 2026 — October Label Showcase","Concert","🎛️","2026-10-10","19:30","Reset Networks Studios, Delhi",429],
      ["Shukrana-2 — Mohammed Rafi Tribute","Concert","🎙️","2026-10-10","17:30","FabHotel Prime The JK, New Delhi",2500],
      ["Bhairavi: Bard to Bollywood","Concert","🎻","2026-10-10","18:30","GD Birla Sabhaghar, Kolkata",550],
      ["October Octaves — Eternal Echoes","Concert","🎼","2026-10-11","18:00","Prestige Centre for Performing Arts, Bengaluru",250],
      ["Noor-E-Ishq — Harshdeep Kaur","Concert","🎤","2026-10-16","19:00","Major Dhyan Chand National Stadium, Delhi",799],
      ["Raftaar Live","Concert","🎤","2026-10-17","19:00","Major Dhyan Chand National Stadium, Delhi",999],
      ["The Usha Uthup Experience","Concert","🎤","2026-10-23","19:00","Shanmukhananda Hall, Mumbai",999],
      ["MLBx: Mumbai — Badshah, KR$NA & DJ OG Shez","Concert","⚾","2026-10-24","17:00","Mumbai Football Arena, Andheri Sports Complex",799],
      ["Jam2Gather — Live Bollywood Jamming","Concert","🎸","2026-10-24","19:30","Forum South Bengaluru",999],
      ["Raghu Dixit Live in Concert","Concert","🎸","2026-10-24","19:00","Orion Mall, Bengaluru",1399],
      ["Ajay-Atul Live","Concert","🎼","2026-10-25","19:00","Jio World Garden, Mumbai",4999],
      ["RANG JAMAKE JAYENGE","Concert","🎹","2026-10-30","18:30","Shanmukhananda Hall, Mumbai",299],
      ["Moods of Kishore — A Musical Tribute","Concert","🎙️","2026-10-31","18:00","Fine Arts Society, Chembur",50],

      ["TTF Hyderabad 2026","Exhibition","✈️","2026-10-10","14:00","HITEX Exhibition Centre, Hyderabad",50],
      ["TTF Hyderabad 2026 — Day 2","Exhibition","✈️","2026-10-11","11:00","HITEX Exhibition Centre, Hyderabad",50],
      ["Durga Puja — Saptami Celebrations","Festival","🪔","2026-10-18","18:00","Kolkata, West Bengal",0],
      ["Durga Puja — Ashtami Celebrations","Festival","🪔","2026-10-19","18:00","Kolkata, West Bengal",0],
      ["Durga Puja — Navami Celebrations","Festival","🪔","2026-10-20","18:00","Kolkata, West Bengal",0],
      ["Dussehra / Vijayadashami Celebrations","Festival","🏹","2026-10-20","18:30","Pan-India",0],
      ["Kaveri Sankramana","Festival","🌿","2026-10-17","08:00","Talakaveri, Karnataka",0],
      ["Coconut Carnival","Festival","🥥","2026-10-17","10:00","Andaman & Nicobar Islands",0],
      ["Coconut Carnival — Day 2","Festival","🥥","2026-10-18","10:00","Andaman & Nicobar Islands",0],
      ["Anthurium Festival","Festival","🌺","2026-10-04","10:00","Reiek, Mizoram",0],
    ]
    const events=[];
    raw.forEach((item,idx)=>{
      const [title,cat,emoji,date,time,venue,price]=item;
      const rows=cat==="Sports"?6:5;
      const spr=cat==="Sports"?10:8;
      const desc={
        "Sports":"Live October 2026 fixture. Seats are managed dynamically and availability updates during checkout.",
        "Concert":"Live October 2026 performance. Enjoy a polished digital booking experience with live seat selection.",
        "Exhibition":"October 2026 public exhibition/trade event. Entry availability is represented as ticket inventory.",
        "Festival":"October 2026 cultural celebration. Free-entry listings use ₹0 inventory in this demo."
      }[cat]||"October 2026 event.";
      events.push({id: `ev-${idx+1}`,title,category: cat,emoji,date,time,venue,price,rows,seatsPerRow: spr,bookedSeats: [],description: desc,sourceVerified: true
});
    return events;
  },

  _get(key){ try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []} },
  _set(key,val){localStorage.setItem(key,JSON.stringify(val))},
  getUsers(){return this._get(this.KEYS.users)}, saveUsers(v){this._set(this.KEYS.users,v)},
  getEvents(){
    const now=Date.now(), cached=this._get(this.KEYS.cache);
    if(cached && cached.ts && now-cached.ts<this.CACHE_TTL && Array.isArray(cached.data)) return cached.data;
    const events=this._get(this.KEYS.events);
    this._set(this.KEYS.cache,{ts:now,data:events});
    return events;
  },
  saveEvents(v){this._set(this.KEYS.events,v);this._set(this.KEYS.cache,{ts:Date.now(),data:v})},
  getEvent(id){return this.getEvents().find(e=>e.id===id)},
  getBookings(){return this._get(this.KEYS.bookings)}, saveBookings(v){this._set(this.KEYS.bookings,v)},
  getBooking(id){return this.getBookings().find(b=>b.id===id)},
  getPromos(){return this._get(this.KEYS.promos)}, savePromos(v){this._set(this.KEYS.promos,v)},
  currentUser(){return JSON.parse(localStorage.getItem(this.KEYS.session)||'null')},
  setCurrentUser(u){localStorage.setItem(this.KEYS.session,JSON.stringify({id:u.id,name:u.name,email:u.email,role:u.role,loginAt:Date.now()}))},
  logout(){localStorage.removeItem(this.KEYS.session)},
  totalSeats(ev){return ev.rows*ev.seatsPerRow},
  seatsLeft(ev){return Math.max(0,this.totalSeats(ev)-ev.bookedSeats.length)},
  fmtMoney(n){return '₹'+Number(n).toLocaleString('en-IN')},
  fmtDate(d){return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})},
  genId(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)},

  acquireBookingLock(owner){
    const now=Date.now(), existing=this._get(this.KEYS.lock);
    if(existing && existing.expires>now && existing.owner!==owner) return false;
    this._set(this.KEYS.lock,{owner,expires:now+this.LOCK_TTL});
    return true;
  },
  releaseBookingLock(owner){
    const l=this._get(this.KEYS.lock);
    if(l && l.owner===owner)localStorage.removeItem(this.KEYS.lock);
  },
  refreshBookingLock(owner){
    const l=this._get(this.KEYS.lock);
    if(l && l.owner===owner){l.expires=Date.now()+this.LOCK_TTL;this._set(this.KEYS.lock,l);return true}
    return false;
  }
};
DB.init();

if('BroadcastChannel' in window){
  window.tbChannel=new BroadcastChannel('ticketbook-events');
  tbChannel.onmessage=e=>{
    if(e.data && e.data.type==='eventsChanged'){
      localStorage.removeItem(DB.KEYS.cache);
      window.dispatchEvent(new CustomEvent('tb-events-changed'));
    }
  };
}
function broadcastEventsChanged(){
  if(window.tbChannel)tbChannel.postMessage({type:'eventsChanged',at:Date.now()});
  window.dispatchEvent(new CustomEvent('tb-events-changed'));
}
