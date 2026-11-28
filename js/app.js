/* BinBuddy v7 (v6 + camera-only scans, own map, swipe fact card, ID login, install tips): app logic. Accounts, points, history and leaderboards live in Supabase (see supabase/schema.sql). Only theme/sound are stored locally. */
const $=id=>document.getElementById(id);
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P={home:"M3 11l9-8 9 8M5 10v10h14V10",scan:"M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 12h8",pin:"M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11zM12 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3",cup:"M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3",user:"M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6",flame:"M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z",leaf:"M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19l8-8",star:"M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",clock:"M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",check:"M5 12l5 5 9-10",gift:"M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-5-3-4-1s4 1 4 1zm0 0c2-4 5-3 4-1s-4 1-4 1z",bolt:"M13 3L5 14h6l-1 7 8-11h-6z",globe:"M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"};
const ic=n=>`<svg class="i" viewBox="0 0 24 24"><path d="${P[n]}"/></svg>`;
const mascot=w=>`<svg class="mascot" width="${w}" height="${w}" viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="113" rx="32" ry="4" fill="#0003"/><path d="M26 50h68l-7 58a7 7 0 01-7 6H40a7 7 0 01-7-6z" fill="#17a574"/><path d="M26 50h68l-2 14H28z" fill="#0f7f5a" opacity=".5"/><rect x="20" y="36" width="80" height="14" rx="7" fill="#ffc533"/><rect x="48" y="26" width="24" height="12" rx="6" fill="#ffc533"/><g class="eye"><ellipse cx="46" cy="76" rx="10" ry="12" fill="#fff"/><circle cx="48" cy="78" r="5" fill="#0d2b24"/><circle cx="50" cy="75" r="1.8" fill="#fff"/></g><g class="eye"><ellipse cx="76" cy="76" rx="10" ry="12" fill="#fff"/><circle cx="78" cy="78" r="5" fill="#0d2b24"/><circle cx="80" cy="75" r="1.8" fill="#fff"/></g><path d="M50 94q10 9 20 0" stroke="#0d2b24" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="37" cy="90" r="5" fill="#ff8fa3" opacity=".6"/><circle cx="84" cy="90" r="5" fill="#ff8fa3" opacity=".6"/></svg>`;
const ART={Plastic:`<svg viewBox="0 0 64 64"><rect x="24" y="5" width="16" height="9" rx="3" fill="#1d6fd6"/><path d="M22 16h20l4 11v27a7 7 0 01-7 7H25a7 7 0 01-7-7V27z" fill="#6cb4ff"/><rect x="18" y="30" width="28" height="13" fill="#fff" opacity=".6"/></svg>`,
Glass:`<svg viewBox="0 0 64 64"><rect x="20" y="6" width="24" height="9" rx="3" fill="#0f8f63"/><path d="M18 17h28v6c5 3 6 8 6 14v15a7 7 0 01-7 7H19a7 7 0 01-7-7V37c0-6 1-11 6-14z" fill="#5fe0b0"/><rect x="22" y="30" width="6" height="22" rx="3" fill="#fff" opacity=".5"/></svg>`,
Paper:`<svg viewBox="0 0 64 64"><path d="M14 6h28l12 12v38a3 3 0 01-3 3H14a3 3 0 01-3-3V9a3 3 0 013-3z" fill="#ffd96b"/><path d="M42 6v12h12z" fill="#e0a800"/><path d="M20 30h26M20 38h26M20 46h16" stroke="#9a6b00" stroke-width="3" stroke-linecap="round"/></svg>`,
Compost:`<svg viewBox="0 0 64 64"><path d="M32 22c-8-6-20-1-20 14 0 12 8 22 14 22 3 0 4-1 6-1s3 1 6 1c6 0 14-10 14-22 0-15-12-20-20-14z" fill="#e5484d"/><path d="M32 22c0-8 3-13 9-15" stroke="#6b3a12" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M38 12c6-4 12 0 12 0-2 6-9 7-12 0z" fill="#22a35a"/></svg>`,
Metal:`<svg viewBox="0 0 64 64"><rect x="18" y="8" width="28" height="6" rx="3" fill="#8a94a6"/><path d="M18 14h28v36a6 6 0 01-6 6H24a6 6 0 01-6-6z" fill="#c9d1de"/><rect x="18" y="26" width="28" height="14" fill="#e5484d" opacity=".85"/><rect x="23" y="16" width="4" height="36" rx="2" fill="#fff" opacity=".55"/></svg>`,
Landfill:`<svg viewBox="0 0 64 64"><path d="M4 22l14 10L4 42z" fill="#ff8fa3"/><path d="M60 22L46 32l14 10z" fill="#ff8fa3"/><rect x="16" y="18" width="32" height="28" rx="9" fill="#ffc533"/><path d="M22 26l20 12M22 38l20-12" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/></svg>`};
const MATS={Plastic:{c:"#dbeafe",bin:"Recycling",s:"Bottles, cups, containers",d:"Plastic bottles, cups and containers. Empty and rinse them, and keep caps on bottles.",ex:"Water bottles, yogurt cups, takeout containers"},
Glass:{c:"#d5f7e7",bin:"Recycling",s:"Jars and bottles",d:"Glass bottles and jars. Rinse them out. Broken glass or mirrors don't go in.",ex:"Juice bottles, sauce jars, kombucha bottles"},
Paper:{c:"#fff0c2",bin:"Recycling",s:"Paper and cardboard",d:"Clean, dry paper and cardboard. Flatten boxes.",ex:"Notebook paper, flyers, cardboard boxes, cartons"},
Metal:{c:"#e6e9f2",bin:"Recycling",s:"Cans",d:"Aluminum and steel cans. Empty and rinse them. Crushing is optional.",ex:"Soda cans, soup cans, sparkling water cans"},
Compost:{c:"#ffe0e0",bin:"Compost",s:"Food scraps, napkins",d:"Food scraps and soiled paper that can break down into soil.",ex:"Fruit peels, coffee grounds, napkins, greasy pizza boxes"},
Landfill:{c:"#e6e9ee",bin:"Trash",s:"Wrappers, thin plastic",d:"Things that can't be recycled or composted, like thin plastic and mixed materials.",ex:"Candy wrappers, chip bags, plastic bags, straws, foam"}};
/* Recycling rules live HERE, not in the AI. The model only returns an item name; material, points and tip come from this table. [material, points, tip] */
const RULES={"Snack wrapper":["Landfill",5,"Wrappers are too thin to recycle. Trash bin."],"Chip bag":["Landfill",8,"Foil-lined bags go in the trash."],"Plastic bag":["Landfill",8,"Bags jam machines. Trash, or a store drop-off."],"Straw":["Landfill",5,"Too small to recycle. Trash bin."],"Plastic cutlery":["Landfill",6,"Trash bin."],"Styrofoam":["Landfill",8,"Foam is not recyclable here. Trash bin."],
"Napkin":["Compost",10,"Soiled paper goes in compost."],"Food scraps":["Compost",25,"Compost bin."],"Pizza box":["Compost",15,"Greasy cardboard goes in compost or trash."],
"Paper cup":["Paper",15,"Empty it, then recycling or trash per campus rules."],"Paper":["Paper",15,"Keep it dry and clean for paper recycling."],"Cardboard":["Paper",25,"Flatten it and put it in recycling."],"Carton":["Paper",30,"Rinse, then recycling."],
"Aluminum can":["Metal",35,"Rinse and put it in recycling."],"Plastic bottle":["Plastic",55,"Empty it, cap on, into recycling."],"Plastic cup":["Plastic",20,"Rinse, then recycling."],"Plastic container":["Plastic",30,"Rinse, then recycling."],
"Glass bottle":["Glass",55,"Rinse, then glass or recycling bin."],"Glass jar":["Glass",50,"Rinse, then glass or recycling bin."]};
const BINCOL={Recycling:"#3b82f6",Compost:"#22a35a",Trash:"#5b6573"};
const FACTS={Plastic:"Only about 9% of all plastic ever made has been recycled worldwide.",Glass:"Glass can be recycled over and over without losing quality.",Paper:"Roughly two-thirds of paper used in the US gets recycled.",Compost:"Food scraps are the largest single material in US landfills.",Landfill:"The average American generates about 4.9 pounds of trash every day.",Metal:"Recycling an aluminum can uses about 95% less energy than making a new one."};
const binSvg=c=>`<svg class="bin" viewBox="0 0 64 64"><rect x="10" y="12" width="44" height="8" rx="3" fill="${c}" opacity=".75"/><rect x="26" y="7" width="12" height="6" rx="2" fill="${c}"/><path d="M14 24h36l-3 32a3 3 0 01-3 3H20a3 3 0 01-3-3z" fill="${c}"/><path d="M26 31v21M32 31v21M38 31v21" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/></svg>`;
const RW=[["Free coffee",300],["BinBuddy tote bag",600],["Campus store credit",1000],["Priority parking day",1500]];
const BADGES=[{n:"First Toss",i:"leaf",p:s=>[s.items,1]},{n:"3-Day Streak",i:"flame",p:s=>[s.streak,3]},{n:"10 Items",i:"star",p:s=>[s.items,10]},{n:"500 Points",i:"cup",p:s=>[s.pts,500]}];
const wk=()=>{const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return d.toDateString()};
function roll(){const t=new Date().toDateString(),w=wk();
 if(S.last&&S.last!==t&&S.last!==new Date(Date.now()-864e5).toDateString())S.streak=0; // v5: lapsed streaks reset on display, not only on next scan
if(!S.dly||S.dly.d!==t)S.dly={d:t,scans:0,cans:0};if(!S.wkl||S.wkl.w!==w)S.wkl={w,plastic:0}}
const CH=[{t:"Complete 3 scans today",k:"Daily",i:"scan",p:()=>[S.dly.scans,3]},{t:"Recycle an aluminum can",k:"Daily",i:"bolt",p:()=>[S.dly.cans,1]},{t:"Recycle five plastic items",k:"Weekly",i:"globe",p:()=>[S.wkl.plastic,5]},{t:"Keep a 3-day streak",k:"Weekly",i:"flame",p:()=>[S.streak,3]}];
const store={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let sb=null,S=null,cur=null,onId=null,playTab='lb';
/* ---------- permissions (the server enforces these too; hiding buttons is just for tidiness) ---------- */
const adminOn=()=>!!(S&&S.perms&&S.perms.admin&&store.get('bb3:admin')!==false);
const canAdd=()=>!!(S&&S.perms&&(S.perms.can_add||adminOn()));
/* ---------- sound ---------- */
let AC=null;
function tone(f,d,t,g,s,sl){if(store.get('bb3:mute'))return;try{AC=AC||new(window.AudioContext||webkitAudioContext)();const o=AC.createOscillator(),v=AC.createGain(),n=AC.currentTime+(s||0);o.type=t||'sine';o.frequency.setValueAtTime(f,n);if(sl)o.frequency.exponentialRampToValueAtTime(f*sl,n+d);v.gain.setValueAtTime(g||.05,n);v.gain.exponentialRampToValueAtTime(.0001,n+d);o.connect(v);v.connect(AC.destination);o.start(n);o.stop(n+d)}catch(e){}}
const SFX={hover:()=>tone(1300,.04,'sine',.012),click:()=>tone(520,.09,'triangle',.06,0,1.7),nav:()=>tone(380,.2,'sine',.05,0,2.2),ok:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.2,'triangle',.06,i*.08)),bad:()=>tone(200,.28,'sawtooth',.035,0,.6),lvl:()=>[392,523,659,784,1047].forEach((f,i)=>tone(f,.22,'square',.03,i*.09))};
document.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&e.target.closest&&e.target.matches('button,.mat'))SFX.hover()},true);
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button,.mat');if(b&&!b.closest('nav'))SFX.click()});
let toastT=0;function toast(t){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),2600)}
function openGen(t,d,m){$('gMas').innerHTML=mascot(m||120);$('gT').textContent=t;$('gD').textContent=d;$('mGen').classList.add('on')}
/* ---------- static art ---------- */
$('wMascot').innerHTML=mascot(150);$('spMascot').innerHTML=mascot(120);$('sMascot').innerHTML=mascot(84);$('sMas').innerHTML=mascot(72);$('bMas').innerHTML=mascot(96);
[['n1','home'],['n2','scan'],['n3','pin'],['n4','cup'],['n5','user'],['qaScan','scan'],['qaBin','pin'],['qaHi','clock']].forEach(([i,n])=>$(i).innerHTML=ic(n));
/* ---------- nav ---------- */
function screen(id){document.querySelectorAll('.screen').forEach(e=>e.classList.toggle('on',e.id===id))}
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>screen('welcome'));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeAll());
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAll();dismissFact()}});
function closeAll(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));if(typeof stopCam==='function')stopCam()}
const order=['home','scan','map','play','me'];let curV='home';
function movePill(btn,first){const p=$('pill'),l=btn.offsetLeft,w=btn.offsetWidth,ol=+(p.dataset.l||l),ow=+(p.dataset.w||w);p.style.transition=first?'none':'';const nl=Math.min(l,ol),nr=Math.max(l+w,ol+ow);p.style.transform=`translateX(${nl}px)`;p.style.width=(nr-nl)+'px';setTimeout(()=>{p.style.transform=`translateX(${l}px)`;p.style.width=w+'px'},first?0:150);p.dataset.l=l;p.dataset.w=w}
function show(v,first){document.documentElement.style.setProperty('--dir',order.indexOf(v)>=order.indexOf(curV)?1:-1);if(v!=='scan'){camReset();$('res').style.display='none';cur=null}curV=v;if(window.BBMap){if(v==='map')BBMap.open();else BBMap.close()}if(v==='play'&&!first)setPlay('lb');
  document.querySelectorAll('#app .view').forEach(e=>e.classList.toggle('on',e.id==='v-'+v));
  document.querySelectorAll('nav button').forEach(b=>{const on=b.dataset.v===v;b.setAttribute('aria-current',on);if(on)movePill(b,first)});if(!first)SFX.nav();window.scrollTo(0,0)}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
/* ---------- ID scanner modal ---------- */
function openScanner(cb){onId=cb;$('sid').value='';$('loginMsg').textContent='';$('mScan').classList.add('on')}
/* scanners sometimes add spaces, * or other characters: keep only letters, numbers and dashes (the database and the id-login function do the same) */
const normId=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9-]/g,'');
$('useId').onclick=()=>{const v=normId($('sid').value);if(!/^[A-Z0-9-]{4,20}$/.test(v)){$('loginMsg').textContent="Enter 4–20 letters or numbers.";SFX.bad();return}const cb=onId;closeAll();if(cb)cb(v)};
/* ---------- accounts (Supabase) ---------- */
const slug=n=>n.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const todayStr=()=>new Date().toDateString();
function authErr(e){const m=(e&&(e.message||e.error_description))||'';
 if(/invalid login/i.test(m))return"Wrong email or password.";
 if(/rate limit|too many|over_email/i.test(m+(e.code||'')))return"Too many tries. Wait a minute and try again.";
 if(/fetch|network/i.test(m))return"Can't reach the server. Check your connection.";
 if(/expired|invalid/i.test(m)&&/token|otp|code/i.test(m))return"That code is wrong or expired. Request a new one.";
 if(/password/i.test(m)&&/6|8|short|weak/i.test(m))return"Choose a stronger password (8+ characters).";
 return m||"Something went wrong. Try again.";}
function scanErr(e){const m=(e&&e.message)||'';
 if(m==='rate_limited')return"Slow down a little. Try again in a few seconds.";
 if(m==='daily_cap_reached')return"You've hit today's scan limit. Come back tomorrow!";
 if(m==='not_authenticated')return"You were signed out. Please log in again.";
 if(m==='nfc_required')return"Tap the NFC sticker on the bin to confirm, then press Add to bin again.";
 if(/^wrong_bin/.test(m))return"That sticker is on a "+(m.split(':')[1]||'different')+" bin. Find the right bin for this item.";
 return"Couldn't save that. Check your connection and try again.";}
const guard=(btn,msg,fn)=>async()=>{if(btn.disabled)return;btn.disabled=true;msg.textContent='';try{await fn()}catch(e){msg.textContent=authErr(e);SFX.bad()}finally{btn.disabled=false}};
let pendingId=null,pend={email:'',pass:'',mode:'signup'},resendAt=0;
function needSb(msg){if(sb)return true;msg.textContent="Can't reach the server. Check your connection and reload.";SFX.bad();return false}
$('toSign').onclick=()=>{screen('signup');$('suName').value='';$('suEmail').value='';$('suPass').value='';pendingId=null;$('suIdMsg').textContent="Optional. You can also link it later in Profile."};
$('toLog').onclick=()=>screen('login');
$('toReset').onclick=()=>{$('rsEmail').value=$('lgEmail').value;$('rsMsg').textContent='';screen('reset')};
$('suId').onclick=()=>openScanner(v=>{pendingId=v;$('suIdMsg').textContent="ID ready to link: "+v+" (it links after you verify your email)";SFX.ok()});
function toVerify(email,pass,mode,info){pend={email,pass,mode};$('vInfo').textContent=info||("We sent a code to "+email+". Enter it below.");$('vCode').value='';$('vMsg').textContent='';screen('verify')}
$('suGo').onclick=guard($('suGo'),$('suMsg'),async()=>{if(!needSb($('suMsg')))return;
 const email=$('suEmail').value.trim().toLowerCase(),pass=$('suPass').value,n=$('suName').value.trim();
 if(!/^\S+@\S+\.\S+$/.test(email)){$('suMsg').textContent="Enter a valid email address.";SFX.bad();return}
 if(pass.length<8){$('suMsg').textContent="Password needs 8 or more characters.";SFX.bad();return}
 if(!/^[A-Za-z0-9_ ]{3,20}$/.test(n)){$('suMsg').textContent="Username: 3–20 letters, numbers or spaces.";SFX.bad();return}
 const av=await sb.rpc('username_available',{p_name:n});if(!av.error&&av.data===false){$('suMsg').textContent="That username is taken.";SFX.bad();return}
 const {data,error}=await sb.auth.signUp({email,password:pass,options:{data:{username:n}}});
 if(error){ if(/database error/i.test(error.message)){$('suMsg').textContent="Couldn't create the account. Use your campus email address, and check the username isn't taken.";SFX.bad();return} throw error}
 if(data.user&&data.user.identities&&data.user.identities.length===0){$('suMsg').textContent="That email already has an account. Try logging in.";SFX.bad();return}
 if(data.session){await afterAuth();return}
 toVerify(email,pass,'signup')});
/* log in with a linked student ID: the server emails a one-time code to the account that owns the ID (Edge Function id-login) */
async function idRequest(id){const r=await sb.functions.invoke('id-login',{body:{action:'request',student_id:id}});if(r.error)throw new Error("ID login isn’t available right now. Use your email and password.")}
async function idVerify(code){const r=await sb.functions.invoke('id-login',{body:{action:'verify',student_id:pend.sid,code}});
 if(r.error||!r.data||!r.data.access_token)throw new Error("That code is wrong or expired. Request a new one.");
 const s=await sb.auth.setSession({access_token:r.data.access_token,refresh_token:r.data.refresh_token});if(s.error)throw s.error;await afterAuth()}
$('lgId').onclick=()=>{if(!needSb($('lgMsg')))return;openScanner(async v=>{$('lgMsg').textContent="Sending a code…";
 try{await idRequest(v)}catch(e){$('lgMsg').textContent=e.message;SFX.bad();return}
 toVerify('', '', 'id',"We sent a code to the email on the account that has this ID linked. Enter it below. (For privacy we say the same thing whether or not an account matched.) No email after a minute? Your ID may not be linked yet: log in with your email and password, then link it in Profile.");pend.sid=v;$('lgMsg').textContent=''})};
$('vGo').onclick=guard($('vGo'),$('vMsg'),async()=>{const t=$('vCode').value.trim();if(!/^\d{6,10}$/.test(t)){$('vMsg').textContent="Enter the code from your email.";SFX.bad();return}
 if(pend.mode==='id'){await idVerify(t);return}
 const {error}=await sb.auth.verifyOtp({email:pend.email,token:t,type:'signup'});if(error)throw error;await afterAuth()});
$('vResend').onclick=guard($('vResend'),$('vMsg'),async()=>{if(Date.now()<resendAt){$('vMsg').textContent="Wait a few seconds before requesting another code.";return}
 if(pend.mode==='id'){await idRequest(pend.sid);resendAt=Date.now()+30000;$('vMsg').textContent="If that ID is linked, a new code is on its way.";return}
 const {error}=await sb.auth.resend({type:'signup',email:pend.email});if(error)throw error;resendAt=Date.now()+30000;$('vMsg').textContent="New code sent.";SFX.ok()});
$('lgGo').onclick=guard($('lgGo'),$('lgMsg'),async()=>{if(!needSb($('lgMsg')))return;
 const email=$('lgEmail').value.trim().toLowerCase(),pass=$('lgPass').value;
 if(!email||!pass){$('lgMsg').textContent="Enter your email and password.";SFX.bad();return}
 const {error}=await sb.auth.signInWithPassword({email,password:pass});
 if(error){ if(/not confirmed/i.test(error.message)||error.code==='email_not_confirmed'){await sb.auth.resend({type:'signup',email});toVerify(email,pass,'signup',"Your email isn't verified yet. We sent a new code to "+email+".");return} throw error}
 await afterAuth()});
$('rsSend').onclick=guard($('rsSend'),$('rsMsg'),async()=>{if(!needSb($('rsMsg')))return;const email=$('rsEmail').value.trim().toLowerCase();
 if(!/^\S+@\S+\.\S+$/.test(email)){$('rsMsg').textContent="Enter your email address.";SFX.bad();return}
 const {error}=await sb.auth.resetPasswordForEmail(email);if(error)throw error;$('rsMsg').textContent="If that email has an account, a code is on its way.";SFX.ok()});
$('rsGo').onclick=guard($('rsGo'),$('rsMsg'),async()=>{if(!needSb($('rsMsg')))return;const email=$('rsEmail').value.trim().toLowerCase(),t=$('rsCode').value.trim(),p=$('rsPass').value;
 if(!/^\d{6,10}$/.test(t)){$('rsMsg').textContent="Enter the code from your email.";SFX.bad();return}
 if(p.length<8){$('rsMsg').textContent="Password needs 8 or more characters.";SFX.bad();return}
 const v=await sb.auth.verifyOtp({email,token:t,type:'recovery'});if(v.error)throw v.error;
 const u=await sb.auth.updateUser({password:p});if(u.error)throw u.error;await afterAuth()});
$('logout').onclick=async()=>{try{await sb.auth.signOut()}catch(e){}location.reload()};
async function afterAuth(){ // link a student ID chosen during signup, then enter the app
 if(pendingId){try{const r=await sb.rpc('link_student_id',{p_id:pendingId});if(r.error)toast("Couldn't link that ID. You can try again in Profile.")}catch(e){}pendingId=null}
 SFX.ok();await enter()}
async function loadMe(){
 const {data:{session}}=await sb.auth.getSession();if(!session)throw new Error('no session');const uid=session.user.id;
 const [p,pi,sm,pm]=await Promise.all([sb.from('profiles').select('username,avatar_url,points,items,streak,last_scan').eq('id',uid).single(),sb.from('private_info').select('student_id').eq('id',uid).single(),sb.rpc('my_summary'),sb.rpc('my_perms')]);
 if(p.error)throw p.error;
 const d=(!sm.error&&sm.data)||{mats:{},today_scans:0,today_cans:0,week_plastic:0,recent:[]};
 if(sm.error)console.warn('my_summary missing: run schema_patch_1.sql',sm.error.message);
 if(pm.error)console.warn('my_perms missing: run schema_patch_4.sql',pm.error.message);
 const perms=(!pm.error&&pm.data)||{admin:false,can_add:false};
 S={uid,perms,email:session.user.email,name:p.data.username,avatar:p.data.avatar_url,pts:p.data.points,items:p.data.items,streak:p.data.streak,
  last:p.data.last_scan?new Date(p.data.last_scan+'T00:00:00').toDateString():null,id:(pi.data&&pi.data.student_id)||null,mats:d.mats||{},
  hist:(d.recent||[]).map(r=>({i:r.item,m:r.material,p:r.points,t:Date.parse(r.t)})),dly:{d:todayStr(),scans:d.today_scans,cans:d.today_cans},wkl:{w:wk(),plastic:d.week_plastic}}}
async function enter(){
 try{await loadMe()}catch(e){screen('welcome');$('welMsg').textContent="Couldn't load your account. "+authErr(e);return}
 roll();S.hist=S.hist||[];lbCache={};screen('app');applyTheme();render();curV='home';show('home',true);maybeInstallTip();if(window.BBMap)BBMap.load();if(window.BBNFC)BBNFC.afterLogin()}
/* ---------- render ---------- */
const setAv=(e,s)=>{e.style.backgroundImage=s.avatar?`url("${s.avatar}")`:'';e.textContent=s.avatar?'':s.name[0].toUpperCase()};
const bdg=s=>BADGES.map(b=>{const[a,g]=b.p(s),got=a>=g;return`<div class="badge ${got?'got':''}"><div class="bi">${ic(b.i)}</div><b>${b.n}</b><div class="msg">${got?'Unlocked':Math.min(a,g)+' / '+g}</div></div>`}).join('');
const chRow=c=>{const[a,g]=c.p(),d=a>=g;return`<div class="ch ${d?'done':''}"><div class="ci">${ic(d?'check':c.i)}</div><div><b style="font-size:14px">${c.t}</b> <span class="tag">${c.k}</span><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100,a/g*100)}%"></i></div><small>${Math.min(a,g)} / ${g}</small></div></div>`};
function render(){roll();const lv=Math.floor(S.pts/100)+1,h=new Date().getHours(),div=Object.entries(S.mats).reduce((a,[k,v])=>a+(k==='Landfill'?0:v),0);
 setAv($('hAv'),S);setAv($('pAv'),S);$('hName').textContent=S.name;$('hLv').textContent="Level "+lv;$('hPts').textContent=S.pts;
 $('hGreet').textContent=h<12?"Good morning":h<18?"Good afternoon":"Good evening";$('hHello').textContent=S.name+", ready to sort?";$('bigPts').textContent=S.pts;
 $('xp').style.width=(S.pts%100)+"%";$('xpTxt').textContent="Level "+lv+" · "+(100-S.pts%100)+" points to level "+(lv+1);$('hMascot').innerHTML=mascot(96);
 $('stats').innerHTML=[["Items recycled",S.items,"leaf","#17a574"],["Points earned",S.pts,"star","#e0a800"],["Day streak",S.streak,"flame","#ef6c3a"],["Diverted from landfill",div,"globe","#3b82f6"]].map(([l,v,i,c])=>`<div class="stat"><div class="ic" style="background:${c}">${ic(i)}</div><b>${v}</b><span>${l}</span></div>`).join('');
 $('mats').innerHTML=Object.entries(MATS).map(([k,m])=>`<button class="mat" data-m="${k}"><div class="em" style="background:${m.c}">${ART[k]}</div><b>${k}</b><small>${m.s}</small></button>`).join('');
 document.querySelectorAll('.mat').forEach(b=>b.onclick=()=>{const m=MATS[b.dataset.m];$('iArt').innerHTML=ART[b.dataset.m];$('iT').textContent=b.dataset.m;$('iBin').textContent="Goes in: "+m.bin+" bin";$('iD').textContent=m.d;$('iEx').textContent="Examples: "+m.ex;$('mInfo').classList.add('on')});
 $('badges').innerHTML=$('badges2').innerHTML=bdg(S);$('chHome').innerHTML=CH.map(chRow).join('');
 renderBins();renderPlay();$('adminOpen').hidden=!(S.perms&&S.perms.admin);
 $('pName').value=S.name;$('mItems').textContent=S.items;$('mStreak').textContent=S.streak;$('mPts').textContent=S.pts;$('mEmail').textContent=S.email||'';$('mId').textContent=S.id?"Linked ("+S.id+")":"Not linked";
 const dk=document.documentElement.dataset.theme==='dark',snd=!store.get('bb3:mute');$('swTheme').classList.toggle('on',dk);$('swTheme').setAttribute('aria-checked',dk);$('swSound').classList.toggle('on',snd);$('swSound').setAttribute('aria-checked',snd)}
function renderBins(){window.BBMap&&BBMap.refreshList()}
const MEDAL={1:["#f5b301","#ffd966","#7a5600"],2:["#aab4c3","#dfe5ee","#4d5666"],3:["#cd7f32","#e8b07a","#6b3a0f"]};
const medalSvg=r=>{const[a,b,d]=MEDAL[r];return`<svg class="medal" viewBox="0 0 32 32" role="img" aria-label="${['','Gold','Silver','Bronze'][r]} medal"><path d="M8 1h6l3 9-5 3z" fill="${a}" opacity=".75"/><path d="M24 1h-6l-3 9 5 3z" fill="${a}" opacity=".95"/><circle cx="16" cy="21" r="9.5" fill="${a}"/><circle cx="16" cy="21" r="7" fill="${b}"/><path d="M16 15.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="${d}"/></svg>`};
const lbRow=r=>`<div class="li lb ${r.is_me?'me':''} ${r.rank<=3?'m'+r.rank:''}"><div class="rk">${r.rank<=3?medalSvg(r.rank):r.rank}</div><div class="av" style="${r.avatar_url?`background-image:url('${esc(r.avatar_url)}')`:''}">${r.avatar_url?'':esc(r.username[0].toUpperCase())}</div><div class="grow"><b>${esc(r.username)}${r.is_me?' (you)':''}</b></div><b class="pt">${r.points}</b></div>`;
let lbP='Weekly',lbCache={};
async function loadLb(){const k=lbP,per={Weekly:'week',Monthly:'month','All time':'all'}[k];try{const [a,b]=await Promise.all([sb.rpc('leaderboard',{p_period:per}),sb.rpc('campus_stats')]);if(a.error)throw a.error;lbCache[k]={rows:a.data,stats:b.error?null:b.data}}catch(e){lbCache[k]={err:true}}if(playTab==='lb'&&lbP===k)renderPlay()}
function renderPlay(){let h='';
 if(playTab==='ch')h=`<div class="card">${CH.map(chRow).join('')}</div><p class="msg">Challenge progress comes from your saved scans.</p>`;
 if(playTab==='lb'){const c=lbCache[lbP],seg=`<div class="seg" id="lbSeg"><button class="${lbP==='Weekly'?'on':''}">Weekly</button><button class="${lbP==='Monthly'?'on':''}">Monthly</button><button class="${lbP==='All time'?'on':''}">All time</button></div>`;
  if(!c){h=seg+`<div class="card"><p class="msg">Loading…</p></div>`;loadLb()}
  else if(c.err)h=seg+`<div class="card"><p class="msg">Couldn't load the leaderboard. Check your connection.</p></div>`;
  else{const rows=c.rows||[],st=c.stats;
   h=seg+(st?`<p class="msg">This week on campus: <b>${st.items_week}</b> items scanned by <b>${st.students_active_week}</b> students. These count scans, not verified disposals.</p>`:'')+
   `<div class="card">${rows.length?rows.map(lbRow).join(''):`<div style="text-align:center">${mascot(80)}<p class="msg">No scans in this period yet. Be the first!</p></div>`}</div>`}}
 if(playTab==='rw')h=`<p class="msg"><span class="tag">PREVIEW</span> Rewards can't be redeemed yet. This shows how they'll work.</p><div class="bento">${RW.map(([n,c])=>`<div class="card"><div style="display:flex;gap:12px;align-items:center"><div class="ci" style="width:44px;height:44px;border-radius:14px;background:var(--sun);color:#3a2a00;display:grid;place-items:center">${ic('gift')}</div><div style="flex:1"><b>${n}</b><br><small class="msg">${c} points</small></div></div><div class="bar" style="margin-top:10px"><i style="width:${Math.min(100,S.pts/c*100)}%"></i></div><small class="msg">${Math.min(S.pts,c)} / ${c} · ${S.pts>=c?'Unlocked (not redeemable yet)':'Locked'}</small></div>`).join('')}</div>`;
 $('playBody').innerHTML=h;const sg=$('lbSeg');if(sg)sg.querySelectorAll('button').forEach(b=>b.onclick=()=>{lbP=b.textContent;renderPlay()})}
function setPlay(t){playTab=t;if(t==='lb')lbCache={};document.querySelectorAll('#playSeg button').forEach(x=>x.classList.toggle('on',x.dataset.p===t));renderPlay()}
document.querySelectorAll('#playSeg button').forEach(b=>b.onclick=()=>setPlay(b.dataset.p));
$('qaHist').onclick=()=>{const H=S.hist;$('histBody').innerHTML=H.length?H.map(h=>`<div class="li"><div style="width:40px">${ART[h.m]||''}</div><div class="grow"><b>${esc(h.i)}</b><br><small>${new Date(h.t).toLocaleString()}</small></div><b>+${h.p}</b></div>`).join(''):`<div style="text-align:center;padding:12px">${mascot(100)}<p class="msg">Nothing yet. Scan your first item!</p></div>`;$('mHist').classList.add('on')};
/* ---------- admin panel (only the admin account sees the button; every action is checked again on the server) ---------- */
let auUsers=[],auFilter='all';
function adminErr(e){const m=(e&&e.message)||'';if(/not_allowed|42501/.test(m+(e.code||'')))return"Only the admin account can do that.";if(/find the function|PGRST202/.test(m+(e.code||'')))return"Admin tools aren’t set up yet. Run schema_patch_4.sql in Supabase.";return"Something went wrong. Check your connection and try again."}
function renderUsers(){const q=$('auQ').value.trim().toLowerCase();
 const L=auUsers.filter(u=>(auFilter==='all'||u.can_add_bins)&&(!q||u.username.toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)));
 $('auList').innerHTML=L.length?L.map(u=>`<div class="li"><div class="av" style="${u.avatar?'':''}">${esc(u.username[0].toUpperCase())}</div><div class="grow"><b>${esc(u.username)}</b>${u.id===S.uid?' <span class="tag">YOU</span>':''}<br><small>${esc(u.email||'')} · ${u.points} pts · ${u.bins_added} bin${u.bins_added==1?'':'s'} added</small></div><button class="sw ${u.can_add_bins||u.id===S.uid?'on':''}" data-u="${u.id}" role="switch" aria-checked="${!!u.can_add_bins}" aria-label="Can add bins: ${esc(u.username)}" ${u.id===S.uid?'disabled title="The admin can always add bins in Admin mode"':''}></button></div>`).join(''):`<p class="msg">${auUsers.length?'No one matches.':'No users yet.'}</p>`;
 $('auList').querySelectorAll('.sw[data-u]').forEach(b=>{if(b.disabled)return;b.onclick=async()=>{const u=auUsers.find(x=>x.id===b.dataset.u),want=!u.can_add_bins;b.disabled=true;
  try{const {error}=await sb.rpc('admin_set_can_add',{p_user:u.id,p_allowed:want});if(error)throw error;u.can_add_bins=want;toast(want?u.username+" can now add bins":u.username+" can no longer add bins");SFX.ok()}catch(e){toast(adminErr(e));SFX.bad()}
  renderUsers()}})}
async function loadUsers(){$('auList').innerHTML='<p class="msg">Loading…</p>';
 try{const {data,error}=await sb.rpc('admin_list_users');if(error)throw error;auUsers=data||[];renderUsers()}catch(e){$('auList').innerHTML=`<p class="msg">${esc(adminErr(e))}</p>`}}
function openAdmin(){if(!(S&&S.perms&&S.perms.admin))return;const on=store.get('bb3:admin')!==false;$('swAdmin').classList.toggle('on',on);$('swAdmin').setAttribute('aria-checked',on);$('mAdmin').classList.add('on');loadUsers();if(window.BBNFC)BBNFC.adminInit()}
$('adminOpen').onclick=openAdmin;$('adminBarBtn').onclick=openAdmin;$('auRef').onclick=loadUsers;$('auQ').addEventListener('input',renderUsers);
$('auSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{auFilter=b.dataset.u;$('auSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderUsers()});
$('swAdmin').onclick=()=>{const on=store.get('bb3:admin')===false;store.set('bb3:admin',on);$('swAdmin').classList.toggle('on',on);$('swAdmin').setAttribute('aria-checked',on);if(window.BBMap)BBMap.refreshPerms();toast(on?"Admin mode on":"Admin mode off")};
/* ---------- settings ---------- */
function applyTheme(){const t=store.get('bb3:theme');if(t)document.documentElement.dataset.theme=t}
$('swTheme').onclick=()=>{const d=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=d?'dark':'light';store.set('bb3:theme',d?'dark':'light');render()};
$('swSound').onclick=()=>{store.set('bb3:mute',!store.get('bb3:mute'));render()};
$('saveName').onclick=async()=>{const n=$('pName').value.trim();if(!/^[A-Za-z0-9_ ]{3,20}$/.test(n)){toast("Username: 3–20 letters or numbers");SFX.bad();return}
 if(n===S.name)return;const {error}=await sb.from('profiles').update({username:n}).eq('id',S.uid);
 if(error){toast(error.code==='23505'?"Username taken":"Couldn't save that username");SFX.bad();return}S.name=n;lbCache={};render();toast("Saved!");SFX.ok()};
$('relink').onclick=()=>openScanner(async v=>{const {error}=await sb.rpc('link_student_id',{p_id:v});if(error){toast("That ID can't be linked");SFX.bad();return}S.id=v.toUpperCase();render();toast("ID linked");SFX.ok()});
$('unlink').onclick=async()=>{if(!S.id){toast("No ID linked");return}const {error}=await sb.rpc('unlink_student_id');if(error){toast("Couldn't unlink");SFX.bad();return}S.id=null;render();toast("ID unlinked");SFX.ok()};
$('chPw').onclick=()=>{$('newPw').value='';$('pwMsg').textContent='';$('mPw').classList.add('on')};
$('pwGo').onclick=guard($('pwGo'),$('pwMsg'),async()=>{const p=$('newPw').value;if(p.length<8){$('pwMsg').textContent="Password needs 8 or more characters.";SFX.bad();return}
 const {error}=await sb.auth.updateUser({password:p});if(error)throw error;closeAll();toast("Password changed");SFX.ok()});
$('avBtn').onclick=()=>$('avFile').click();
$('avFile').onchange=e=>{const f=e.target.files[0];e.target.value="";if(!f)return;const i=new Image();
 i.onload=()=>{const c=document.createElement('canvas');c.width=c.height=256;const m=Math.min(i.width,i.height);c.getContext('2d').drawImage(i,(i.width-m)/2,(i.height-m)/2,m,m,0,0,256,256);URL.revokeObjectURL(i.src);
  c.toBlob(async b=>{try{if(!b)throw new Error('Could not encode the image');
   // a new file name every time: plain upload needs only the INSERT permission (no overwrite, no SELECT policy)
   const path=S.uid+'/avatar-'+Date.now()+'.jpg',up=await sb.storage.from('avatars').upload(path,b,{contentType:'image/jpeg',cacheControl:'3600'});if(up.error)throw up.error;
   const url=sb.storage.from('avatars').getPublicUrl(path).data.publicUrl,u=await sb.from('profiles').update({avatar_url:url}).eq('id',S.uid);if(u.error)throw u.error;
   const old=S.avatar;S.avatar=url;lbCache={};render();SFX.ok();toast("Profile photo updated");
   try{const mm=old&&old.match(/\/avatars\/([^?]+)/);if(mm)await sb.storage.from('avatars').remove([decodeURIComponent(mm[1])])}catch(x){} // tidy up the old file, best effort
  }catch(err){console.error('avatar upload failed',err);toast("Couldn’t upload that photo"+(err&&err.message?" ("+String(err.message).slice(0,70)+")":""));SFX.bad()}},'image/jpeg',.85)};
 i.onerror=()=>toast("Couldn’t read that image. Try a JPEG or PNG.");i.src=URL.createObjectURL(f)};
/* ---------- scanner UI ---------- */
let pStream=null;
const camSet=c=>$('cam2').className='cam '+c;
function stopPcam(){if(pStream){pStream.getTracks().forEach(t=>t.stop());pStream=null}$('pcam').classList.remove('on')}
function camReset(){stopPcam();$('prev').classList.remove('on');camSet('');$('shutter').hidden=true;$('snap').textContent='Start camera'}
$('snap').onclick=async()=>{if(pStream){camReset();return}$('res').style.display='none';$('prev').classList.remove('on');
 try{pStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280}}});const v=$('pcam');v.srcObject=pStream;v.classList.add('on');await v.play();camSet('live');$('shutter').hidden=false;$('snap').textContent='Stop camera'}
 catch(e){stopPcam();$('scanMsg').textContent="Camera unavailable. Allow camera access in your browser settings, then tap Start camera again."}};
$('shutter').onclick=()=>{const v=$('pcam'),c=document.createElement('canvas'),s=Math.min(1,800/Math.max(v.videoWidth,v.videoHeight));c.width=v.videoWidth*s;c.height=v.videoHeight*s;c.getContext('2d').drawImage(v,0,0,c.width,c.height);c.toBlob(b=>handle(b),'image/jpeg',.85)};
function shrink(f){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const s=Math.min(1,800/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(ok,'image/jpeg',.8)};i.onerror=no;i.src=URL.createObjectURL(f)})}
async function handle(f){cur=null;$('res').style.display='none';$('scanMsg').textContent="";
 try{const b=await shrink(f);stopPcam();$('shutter').hidden=true;$('snap').textContent='Start camera';if($('prev').dataset.u)URL.revokeObjectURL($('prev').dataset.u);$('prev').dataset.u=URL.createObjectURL(b);$('prev').src=$('prev').dataset.u;$('prev').classList.add('on');camSet('busy');
  const r=await analyze(b),rule=RULES[r.item];if(!rule)throw new Error('no rule');const m=rule[0],bin=MATS[m].bin;
  cur={item:r.item,m,pts:Math.max(1,Math.min(60,rule[1])),tip:rule[2]};camSet('shot');
  $('rName').textContent=cur.item;$('rTip').textContent=cur.tip;$('rPts').textContent="+"+cur.pts;$('rMat').textContent=m;$('rBin').textContent=bin;$('rBinIcon').innerHTML=binSvg(BINCOL[bin]);
  $('rFi').innerHTML=mascot(40);$('rFact').textContent="Did you know? "+FACTS[m];$('res').style.display='block';SFX.ok()
 }catch(err){bootHide();camSet('');$('prev').classList.remove('on');$('scanMsg').textContent=err&&err.aiLoad?"The AI couldn’t finish loading. Check your connection, close other tabs, and try again.":"Couldn't identify that. Move closer, center one item, use good light, and try again.";SFX.bad()}}
let adding=false;
$('addBin').onclick=async()=>{if(!cur||adding)return;adding=true;const c=cur;
 try{let rs=await sb.rpc('record_scan',{p_item_key:slug(c.item)});
  if(rs.error&&/nfc_required/.test(rs.error.message||'')&&window.BBNFC){if(!await BBNFC.verify())return;rs=await sb.rpc('record_scan',{p_item_key:slug(c.item)})}
  const {data,error}=rs;if(error)throw error;
  roll();const t=todayStr();S.pts=data.total_points;S.items=data.items;S.streak=data.streak;S.last=t;
  S.mats[c.m]=(S.mats[c.m]||0)+1;S.dly.scans++;if(c.item==="Aluminum can")S.dly.cans++;if(c.m==="Plastic")S.wkl.plastic++;
  S.hist.unshift({i:c.item,m:c.m,p:data.points_awarded,t:Date.now()});S.hist=S.hist.slice(0,30);lbCache={};
  showFact(`<div class="fc-pts">+${data.points_awarded} points!</div><p>Walk your ${esc(c.item.toLowerCase())} to the <b>${MATS[c.m].bin}</b> bin.</p><div class="fc-fact">${mascot(40)}<span><b>Did you know?</b> ${FACTS[c.m]}</span></div><small class="msg">You’re #${data.item_count_today_campus} ${esc(c.item.toLowerCase())} scanned on campus today.</small>`);
  cur=null;$('res').style.display='none';camReset();render();
  if(data.level_up)setTimeout(()=>{SFX.lvl();openGen("Level up!","You reached level "+data.level+". Keep sorting!")},700);else SFX.ok()
 }catch(e){toast(scanErr(e));SFX.bad()}finally{adding=false}};
/* ---------- swipe-away fun fact card ---------- */
const fcCard=$('factCard'),fcIn=$('fcIn');
function showFact(html){$('fcBody').innerHTML=html;fcIn.style.transition='none';fcIn.style.transform='';fcIn.style.opacity='';fcCard.classList.add('on');fcIn.classList.remove('in');void fcIn.offsetWidth;fcIn.classList.add('in')}
function dismissFact(dx,dy){if(!fcCard.classList.contains('on'))return;const x=dx||0,y=dy||0;fcIn.style.transition='transform .22s ease-in,opacity .22s';
 fcIn.style.transform=Math.abs(x)>=Math.abs(y)?`translate(${x>=0?520:-520}px,${y}px) rotate(${x>=0?18:-18}deg)`:'translateY(-220px)';fcIn.style.opacity='0';
 setTimeout(()=>{fcCard.classList.remove('on');fcIn.style.transition='none';fcIn.style.transform='';fcIn.style.opacity=''},240)}
(function(){let pid=null,x0=0,y0=0;
 fcIn.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;pid=e.pointerId;x0=e.clientX;y0=e.clientY;try{fcIn.setPointerCapture(pid)}catch(x){}fcIn.style.transition='none';fcIn.classList.remove('in')});
 fcIn.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;const dx=e.clientX-x0,dy=Math.min(0,e.clientY-y0);fcIn.style.transform=`translate(${dx}px,${dy}px) rotate(${dx/28}deg)`;fcIn.style.opacity=String(Math.max(.35,1-Math.hypot(dx,dy)/360))});
 const end=e=>{if(e.pointerId!==pid)return;pid=null;const dx=e.clientX-x0,dy=e.clientY-y0;
  if(Math.abs(dx)>70||dy<-55)dismissFact(dx,dy);else{fcIn.style.transition='transform .25s cubic-bezier(.3,1.4,.5,1),opacity .2s';fcIn.style.transform='';fcIn.style.opacity=''}};
 fcIn.addEventListener('pointerup',end);fcIn.addEventListener('pointercancel',end);
 fcIn.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')dismissFact(-200,0);if(e.key==='ArrowRight')dismissFact(200,0)});
 $('fcX').onclick=()=>dismissFact(300,0)})();
/* ---------- add to home screen tutorial ---------- */
let deferredInstall=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('instNow').hidden=false});
$('instNow').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();try{await deferredInstall.userChoice}catch(e){}deferredInstall=null;$('instNow').hidden=true;closeAll()};
const standalone=()=>(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
const platform=()=>{const u=navigator.userAgent;return /iPhone|iPad|iPod/.test(u)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':/Android/.test(u)?'android':'desktop'};
const shareIc='<svg class="sh" viewBox="0 0 24 24"><path d="M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1"/></svg>';
const INST={
 ios:["Open BinBuddy in <b>Safari</b> (the blue compass), not inside another app.","Tap the <b>Share</b> button "+shareIc+" at the bottom of the screen (on iPad it’s at the top).","Scroll down and tap <b>Add to Home Screen</b>.","Tap <b>Add</b> in the top corner. The BinBuddy icon appears on your home screen.","Open BinBuddy from that icon. It runs full screen like an app."],
 android:["Open BinBuddy in <b>Chrome</b>.","Tap the <b>⋮</b> menu in the top right corner.","Tap <b>Install app</b> or <b>Add to Home screen</b>.","Tap <b>Install</b> to confirm. The BinBuddy icon appears with your other apps."],
 desktop:["Use <b>Chrome</b> or <b>Edge</b>.","Click the <b>install icon</b> at the right end of the address bar, or open the browser menu and choose <b>Install BinBuddy</b>.","On Safari (Mac), choose <b>File → Add to Dock</b>."]};
function openInstall(p){p=p||platform();$('iMas').innerHTML=mascot(72);
 document.querySelectorAll('#instSeg button').forEach(b=>{b.classList.toggle('on',b.dataset.p===p);b.onclick=()=>openInstall(b.dataset.p)});
 $('instBody').innerHTML=INST[p].map(s=>`<li><span>${s}</span></li>`).join('');$('instNow').hidden=!(deferredInstall&&p===platform());$('mInstall').classList.add('on')}
$('howInstall').onclick=()=>openInstall();
function maybeInstallTip(){if(store.get('bb3:installSeen')||standalone())return;store.set('bb3:installSeen',1);setTimeout(()=>{if(!document.querySelector('.modal.on'))openInstall()},900)}
/* ---------- start ---------- */
applyTheme();try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
try{if(window.supabase&&window.BB_CONFIG)sb=window.supabase.createClient(BB_CONFIG.url,BB_CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})}catch(e){sb=null}
if(sb){sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'&&S)location.reload()});
 sb.auth.getSession().then(({data})=>{if(data.session)enter();else screen('welcome')}).catch(()=>screen('welcome'))}
else{screen('welcome');$('welMsg').textContent="Can't reach the server right now. Check your connection and reload."}
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
