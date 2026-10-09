/* =========================================================
   AUTHENTICATION
   Email validation + strong password policy + SHA-256 hashing.
   ========================================================= */

(async function(){
  const user=DB.currentUser();
  if(user) location.href=user.role==='admin'?'admin/dashboard.html':'user/dashboard.html';
})();

function emailValid(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}
function passwordChecks(password){
  return {
    length: password.length>=10,
    upper:/[A-Z]/.test(password),
    lower:/[a-z]/.test(password),
    number:/\d/.test(password),
    symbol:/[^A-Za-z0-9]/.test(password)
  };
}
function passwordStrong(p){
  const c=passwordChecks(p);
  return Object.values(c).every(Boolean);
}
function showAuthMsg(id,text,type='error'){
  const el=document.getElementById(id);
  el.textContent=text; el.className='msg '+type;
}
function updatePasswordMeter(){
  const p=document.getElementById('su-password').value;
  const c=passwordChecks(p);
  const score=Object.values(c).filter(Boolean).length;
  const meter=document.getElementById('password-meter');
  const label=document.getElementById('password-meter-label');
  if(!p){meter.style.width='0%';label.textContent='Use 10+ characters with upper/lowercase, a number and symbol.';return;}
  meter.style.width=(score*20)+'%';
  label.textContent=score===5?'Strong password':'Password strength: '+score+'/5';
  document.querySelectorAll('[data-check]').forEach(x=>x.classList.toggle('ok',!!c[x.dataset.check]));
}
function switchTab(tab){
  document.getElementById('tab-login').classList.toggle('active',tab==='login');
  document.getElementById('tab-signup').classList.toggle('active',tab==='signup');
  document.getElementById('panel-login').classList.toggle('active',tab==='login');
  document.getElementById('panel-signup').classList.toggle('active',tab==='signup');
}
document.getElementById('su-password').addEventListener('input',updatePasswordMeter);

document.getElementById('signup-form').addEventListener('submit',async function(e){
  e.preventDefault();
  const name=document.getElementById('su-name').value.trim();
  const email=document.getElementById('su-email').value.trim().toLowerCase();
  const password=document.getElementById('su-password').value;
  if(name.length<2){showAuthMsg('su-msg','Enter your full name.');return;}
  if(!emailValid(email)){showAuthMsg('su-msg','Enter a valid email address.');return;}
  if(!passwordStrong(password)){showAuthMsg('su-msg','Password must meet every security requirement shown below.');return;}
  const users=DB.getUsers();
  if(users.some(u=>u.email===email)){showAuthMsg('su-msg','An account with this email already exists.');return;}
  const passwordHash=await DB.hashPassword(password);
  users.push({id:DB.genId('user'),name,email,passwordHash,role:'user',createdAt:new Date().toISOString()});
  DB.saveUsers(users);
  showAuthMsg('su-msg','Account created securely. You can now log in.','success');
  document.getElementById('signup-form').reset();updatePasswordMeter();
  setTimeout(()=>switchTab('login'),700);
});

document.getElementById('login-form').addEventListener('submit',async function(e){
  e.preventDefault();
  const email=document.getElementById('li-email').value.trim().toLowerCase();
  const password=document.getElementById('li-password').value;
  if(!emailValid(email)){showAuthMsg('li-msg','Enter a valid email address.');return;}
  if(!password){showAuthMsg('li-msg','Enter your password.');return;}
  const users=DB.getUsers();
  const found=users.find(u=>u.email===email);
  if(!found){showAuthMsg('li-msg','Incorrect email or password.');return;}
  let hash=found.passwordHash;
  /* Migrate older demo accounts that stored plain passwords. */
  if(!hash && found.password){
    hash=await DB.hashPassword(found.password);
    found.passwordHash=hash;delete found.password;DB.saveUsers(users);
  }
  const supplied=DB.isHash(hash)?await DB.hashPassword(password,hash.split('$')[0]):await DB.hashPassword(password);
  if(supplied!==hash){showAuthMsg('li-msg','Incorrect email or password.');return;}
  DB.setCurrentUser(found);
  location.href=found.role==='admin'?'admin/dashboard.html':'user/dashboard.html';
});
