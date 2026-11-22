/* BinBuddy v4-UI: app logic. Accounts/points are still stored locally (see docs/V4_BACKEND.md). */
const $=id=>document.getElementById(id);
const P={home:"M3 11l9-8 9 8M5 10v10h14V10",scan:"M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 12h8",pin:"M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11zM12 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3",cup:"M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3",user:"M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6",flame:"M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z",leaf:"M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19l8-8",star:"M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",clock:"M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",check:"M5 12l5 5 9-10",gift:"M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-5-3-4-1s4 1 4 1zm0 0c2-4 5-3 4-1s-4 1-4 1z",bolt:"M13 3L5 14h6l-1 7 8-11h-6z",globe:"M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"};
const ic=n=>`<svg class="i" viewBox="0 0 24 24"><path d="${P[n]}"/></svg>`;
const mascot=w=>`<svg class="mascot" width="${w}" height="${w}" viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="113" rx="32" ry="4" fill="#0003"/><path d="M26 50h68l-7 58a7 7 0 01-7 6H40a7 7 0 01-7-6z" fill="#17a574"/><path d="M26 50h68l-2 14H28z" fill="#0f7f5a" opacity=".5"/><rect x="20" y="36" width="80" height="14" rx="7" fill="#ffc533"/><rect x="48" y="26" width="24" height="12" rx="6" fill="#ffc533"/><g class="eye"><ellipse cx="46" cy="76" rx="10" ry="12" fill="#fff"/><circle cx="48" cy="78" r="5" fill="#0d2b24"/><circle cx="50" cy="75" r="1.8" fill="#fff"/></g><g class="eye"><ellipse cx="76" cy="76" rx="10" ry="12" fill="#fff"/><circle cx="78" cy="78" r="5" fill="#0d2b24"/><circle cx="80" cy="75" r="1.8" fill="#fff"/></g><path d="M50 94q10 9 20 0" stroke="#0d2b24" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="37" cy="90" r="5" fill="#ff8fa3" opacity=".6"/><circle cx="84" cy="90" r="5" fill="#ff8fa3" opacity=".6"/></svg>`;
const ART={Plastic:`<svg viewBox="0 0 64 64"><rect x="24" y="5" width="16" height="9" rx="3" fill="#1d6fd6"/><path d="M22 16h20l4 11v27a7 7 0 01-7 7H25a7 7 0 01-7-7V27z" fill="#6cb4ff"/><rect x="18" y="30" width="28" height="13" fill="#fff" opacity=".6"/></svg>`,
Glass:`<svg viewBox="0 0 64 64"><rect x="20" y="6" width="24" height="9" rx="3" fill="#0f8f63"/><path d="M18 17h28v6c5 3 6 8 6 14v15a7 7 0 01-7 7H19a7 7 0 01-7-7V37c0-6 1-11 6-14z" fill="#5fe0b0"/><rect x="22" y="30" width="6" height="22" rx="3" fill="#fff" opacity=".5"/></svg>`,
Paper:`<svg viewBox="0 0 64 64"><path d="M14 6h28l12 12v38a3 3 0 01-3 3H14a3 3 0 01-3-3V9a3 3 0 013-3z" fill="#ffd96b"/><path d="M42 6v12h12z" fill="#e0a800"/><path d="M20 30h26M20 38h26M20 46h16" stroke="#9a6b00" stroke-width="3" stroke-linecap="round"/></svg>`,
Compost:`<svg viewBox="0 0 64 64"><path d="M32 22c-8-6-20-1-20 14 0 12 8 22 14 22 3 0 4-1 6-1s3 1 6 1c6 0 14-10 14-22 0-15-12-20-20-14z" fill="#e5484d"/><path d="M32 22c0-8 3-13 9-15" stroke="#6b3a12" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M38 12c6-4 12 0 12 0-2 6-9 7-12 0z" fill="#22a35a"/></svg>`,
Landfill:`<svg viewBox="0 0 64 64"><path d="M4 22l14 10L4 42z" fill="#ff8fa3"/><path d="M60 22L46 32l14 10z" fill="#ff8fa3"/><rect x="16" y="18" width="32" height="28" rx="9" fill="#ffc533"/><path d="M22 26l20 12M22 38l20-12" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/></svg>`};
const MATS={Plastic:{c:"#dbeafe",bin:"Recycling",s:"Bottles, cans, cups",d:"Bottles, cans, cups and containers. Empty and rinse them, and keep caps on bottles.",ex:"Water bottles, soda cans, yogurt cups, takeout containers"},
Glass:{c:"#d5f7e7",bin:"Recycling",s:"Jars and bottles",d:"Glass bottles and jars. Rinse them out. Broken glass or mirrors don't go in.",ex:"Juice bottles, sauce jars, kombucha bottles"},
Paper:{c:"#fff0c2",bin:"Recycling",s:"Paper and cardboard",d:"Clean, dry paper and cardboard. Flatten boxes.",ex:"Notebook paper, flyers, cardboard boxes, cartons"},
Compost:{c:"#ffe0e0",bin:"Compost",s:"Food scraps, napkins",d:"Food scraps and soiled paper that can break down into soil.",ex:"Fruit peels, coffee grounds, napkins, greasy pizza boxes"},
Landfill:{c:"#e6e9ee",bin:"Trash",s:"Wrappers, thin plastic",d:"Things that can't be recycled or composted, like thin plastic and mixed materials.",ex:"Candy wrappers, chip bags, plastic bags, straws, foam"}};
const BINCOL={Recycling:"#3b82f6",Compost:"#22a35a",Trash:"#5b6573"};
const FACTS={Plastic:"Only about 9% of all plastic ever made has been recycled worldwide.",Glass:"Glass can be recycled over and over without losing quality.",Paper:"Roughly two-thirds of paper used in the US gets recycled.",Compost:"Food scraps are the largest single material in US landfills.",Landfill:"The average American generates about 4.9 pounds of trash every day.",can:"Recycling an aluminum can uses about 95% less energy than making a new one."};
const binSvg=c=>`<svg class="bin" viewBox="0 0 64 64"><rect x="10" y="12" width="44" height="8" rx="3" fill="${c}" opacity=".75"/><rect x="26" y="7" width="12" height="6" rx="2" fill="${c}"/><path d="M14 24h36l-3 32a3 3 0 01-3 3H20a3 3 0 01-3-3z" fill="${c}"/><path d="M26 31v21M32 31v21M38 31v21" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/></svg>`;
/* SAMPLE data: replace with real data from the database in v4 */
const BINS=[{n:"Sample Bin A",t:"Recycling",f:35,d:"120 m",x:22,y:38},{n:"Sample Bin B",t:"Compost",f:72,d:"250 m",x:58,y:28},{n:"Sample Bin C",t:"Trash",f:91,d:"400 m",x:45,y:66},{n:"Sample Bin D",t:"Recycling",f:58,d:"600 m",x:78,y:62},{n:"Sample Bin E",t:"Compost",f:20,d:"750 m",x:18,y:78}];
const LB={Weekly:[["Maya R.",320],["Jordan T.",285],["Priya S.",240],["Leo K.",190],["Sam W.",120]],Monthly:[["Priya S.",1180],["Maya R.",1040],["Jordan T.",960],["Leo K.",730],["Sam W.",560]]};
const RW=[["Free coffee",300],["BinBuddy tote bag",600],["Campus store credit",1000],["Priority parking day",1500]];
const BADGES=[{n:"First Toss",i:"leaf",p:s=>[s.items,1]},{n:"3-Day Streak",i:"flame",p:s=>[s.streak,3]},{n:"10 Items",i:"star",p:s=>[s.items,10]},{n:"500 Points",i:"cup",p:s=>[s.pts,500]}];
const wk=()=>{const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return d.toDateString()};
function roll(){const t=new Date().toDateString(),w=wk();if(!S.dly||S.dly.d!==t)S.dly={d:t,scans:0,cans:0};if(!S.wkl||S.wkl.w!==w)S.wkl={w,plastic:0}}
const CH=[{t:"Complete 3 scans today",k:"Daily",i:"scan",p:()=>[S.dly.scans,3]},{t:"Recycle an aluminum can",k:"Daily",i:"bolt",p:()=>[S.dly.cans,1]},{t:"Recycle five plastic items",k:"Weekly",i:"globe",p:()=>[S.wkl.plastic,5]},{t:"Keep a 3-day streak",k:"Weekly",i:"flame",p:()=>[S.streak,3]}];
const store={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let S=null,cur=null,onId=null,playTab='ch',binF='All';
/* ---------- sound ---------- */
let AC=null;
function tone(f,d,t,g,s,sl){if(store.get('bb3:mute'))return;try{AC=AC||new(window.AudioContext||webkitAudioContext)();const o=AC.createOscillator(),v=AC.createGain(),n=AC.currentTime+(s||0);o.type=t||'sine';o.frequency.setValueAtTime(f,n);if(sl)o.frequency.exponentialRampToValueAtTime(f*sl,n+d);v.gain.setValueAtTime(g||.05,n);v.gain.exponentialRampToValueAtTime(.0001,n+d);o.connect(v);v.connect(AC.destination);o.start(n);o.stop(n+d)}catch(e){}}
const SFX={hover:()=>tone(1300,.04,'sine',.012),click:()=>tone(520,.09,'triangle',.06,0,1.7),nav:()=>tone(380,.2,'sine',.05,0,2.2),ok:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.2,'triangle',.06,i*.08)),bad:()=>tone(200,.28,'sawtooth',.035,0,.6),lvl:()=>[392,523,659,784,1047].forEach((f,i)=>tone(f,.22,'square',.03,i*.09))};
document.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&e.target.closest&&e.target.matches('button,.mat'))SFX.hover()},true);
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button,.mat');if(b&&!b.closest('nav'))SFX.click()});
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),2600)}
function openGen(t,d,m){$('gMas').innerHTML=mascot(m||120);$('gT').textContent=t;$('gD').textContent=d;$('mGen').classList.add('on')}
/* ---------- static art ---------- */
$('wMascot').innerHTML=mascot(150);$('sMascot').innerHTML=mascot(84);$('sMas').innerHTML=mascot(72);$('bMas').innerHTML=mascot(96);
[['n1','home'],['n2','scan'],['n3','pin'],['n4','cup'],['n5','user'],['qaScan','scan'],['qaBin','pin'],['qaHi','clock']].forEach(([i,n])=>$(i).innerHTML=ic(n));
/* ---------- nav ---------- */
function screen(id){document.querySelectorAll('.screen').forEach(e=>e.classList.toggle('on',e.id===id))}
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>screen('welcome'));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeAll());
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
function closeAll(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));if(typeof stopCam==='function')stopCam()}
const order=['home','scan','map','play','me'];let curV='home';
function movePill(btn,first){const p=$('pill'),l=btn.offsetLeft,w=btn.offsetWidth,ol=+(p.dataset.l||l),ow=+(p.dataset.w||w);p.style.transition=first?'none':'';const nl=Math.min(l,ol),nr=Math.max(l+w,ol+ow);p.style.transform=`translateX(${nl}px)`;p.style.width=(nr-nl)+'px';setTimeout(()=>{p.style.transform=`translateX(${l}px)`;p.style.width=w+'px'},first?0:150);p.dataset.l=l;p.dataset.w=w}
function show(v,first){document.documentElement.style.setProperty('--dir',order.indexOf(v)>=order.indexOf(curV)?1:-1);if(v!=='scan')camReset();curV=v;
  document.querySelectorAll('#app .view').forEach(e=>e.classList.toggle('on',e.id==='v-'+v));
  document.querySelectorAll('nav button').forEach(b=>{const on=b.dataset.v===v;b.setAttribute('aria-current',on);if(on)movePill(b,first)});if(!first)SFX.nav();window.scrollTo(0,0)}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
/* ---------- ID scanner modal ---------- */
function openScanner(cb){onId=cb;$('sid').value='';$('loginMsg').textContent='';$('mScan').classList.add('on')}
$('useId').onclick=()=>{const v=$('sid').value.trim();if(!/^[A-Za-z0-9-]{4,20}$/.test(v)){$('loginMsg').textContent="Enter 4–20 letters or numbers.";SFX.bad();return}const cb=onId;closeAll();if(cb)cb(v)};
/* ---------- accounts (device only until v4) ---------- */
const key=n=>'bb3:u:'+n.toLowerCase();
function newUser(n,id){return{name:n,id:id||null,pts:0,items:0,streak:0,last:null,mats:{},avatar:null,hist:[]}}
function save(){store.set(key(S.name),S);if(S.id)store.set('bb3:id:'+S.id,S.name)}
let pendingId=null;
$('toSign').onclick=()=>{screen('signup');$('suName').value='';pendingId=null;$('suIdMsg').textContent="Linking lets you log in fast by scanning your barcode."};
$('toLog').onclick=()=>screen('login');
$('suId').onclick=()=>openScanner(v=>{pendingId=v;$('suIdMsg').textContent="ID linked: "+v;SFX.ok()});
$('suGo').onclick=()=>{const n=$('suName').value.trim();if(!/^[A-Za-z0-9_ ]{3,20}$/.test(n)){$('suMsg').textContent="Username: 3–20 letters, numbers or spaces.";SFX.bad();return}
 if(store.get(key(n))){$('suMsg').textContent="That username is taken on this device.";SFX.bad();return}
 if(pendingId&&store.get('bb3:id:'+pendingId)){$('suMsg').textContent="That ID is already linked to an account.";SFX.bad();return}
 S=newUser(n,pendingId);save();store.set('bb3:last',n);SFX.ok();enter()};
$('lgScan').onclick=()=>openScanner(v=>{const n=store.get('bb3:id:'+v);if(n&&store.get(key(n))){S=store.get(key(n));store.set('bb3:last',n);SFX.ok();enter()}else{$('lgMsg').textContent="No account linked to that ID on this device.";SFX.bad()}});
$('lgGo').onclick=()=>{const n=$('lgName').value.trim(),u=n&&store.get(key(n));if(u){S=u;store.set('bb3:last',S.name);SFX.ok();enter()}else{$('lgMsg').textContent="No account with that username on this device.";SFX.bad()}};
$('logout').onclick=()=>{store.set('bb3:last',null);location.reload()};
function enter(){roll();S.hist=S.hist||[];screen('app');applyTheme();render();curV='home';show('home',true)}
/* ---------- render ---------- */
const setAv=(e,s)=>{e.style.backgroundImage=s.avatar?`url(${s.avatar})`:'';e.textContent=s.avatar?'':s.name[0].toUpperCase()};
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
 renderBins();renderPlay();
 $('pName').value=S.name;$('mItems').textContent=S.items;$('mStreak').textContent=S.streak;$('mPts').textContent=S.pts;$('mId').textContent=S.id?"Linked ("+S.id+")":"Not linked";
 $('swTheme').classList.toggle('on',document.documentElement.dataset.theme==='dark');$('swSound').classList.toggle('on',!store.get('bb3:mute'))}
function renderBins(){const st=f=>f<60?["Available","#17a574"]:f<85?["Almost full","#e0a800"]:["Full","#e5484d"],L=BINS.filter(b=>binF==='All'||b.t===binF);
 $('map').innerHTML=L.map((b,i)=>`<button class="pin" style="left:${b.x}%;top:${b.y}%;background:${BINCOL[b.t]}" aria-label="${b.n}" data-i="${i}"></button>`).join('')+'<span class="msg" style="position:absolute;left:12px;bottom:8px">Sample map. Real map comes with campus data.</span>';
 document.querySelectorAll('.pin').forEach(p=>p.onclick=()=>{const b=L[p.dataset.i];toast(b.n+" · "+b.t+" · "+b.f+"% full")});
 $('binList').innerHTML=L.length?L.map(b=>{const[s,c]=st(b.f);return`<div class="li"><div style="width:38px">${binSvg(BINCOL[b.t]).replace('class="bin"','width="38" height="38"')}</div><div><b>${b.n}</b> <span class="tag">SAMPLE</span><br><small>${b.t} · ${b.d} · <b style="color:${c}">${s}</b></small><div class="fill"><i style="width:${b.f}%;background:${c}"></i></div></div><b>${b.f}%</b></div>`}).join(''):`<div style="text-align:center">${mascot(80)}<p class="msg">No bins of that type yet.</p></div>`}
document.querySelectorAll('#binSeg button').forEach(b=>b.onclick=()=>{binF=b.dataset.f;document.querySelectorAll('#binSeg button').forEach(x=>x.classList.toggle('on',x===b));renderBins()});
let lbP='Weekly';
function renderPlay(){let h='';
 if(playTab==='ch')h=`<div class="card">${CH.map(chRow).join('')}</div><p class="msg">Challenge progress is tracked from your real scans on this device.</p>`;
 if(playTab==='lb'){const rows=LB[lbP].map(r=>({n:r[0],p:r[1],me:false}));rows.push({n:S.name+" (you, all-time)",p:S.pts,me:true});rows.sort((a,b)=>b.p-a.p);
  h=`<p class="msg"><span class="tag">SAMPLE DATA</span> Other students are placeholders until the shared database exists. Your row shows your real total.</p><div class="seg" id="lbSeg"><button class="${lbP==='Weekly'?'on':''}">Weekly</button><button class="${lbP==='Monthly'?'on':''}">Monthly</button></div><div class="card">${rows.map((r,i)=>`<div class="li ${r.me?'me':''}"><div class="rk">${i+1}</div><div class="av" style="width:38px;height:38px;font-size:14px">${r.n[0]}</div><div><b>${r.n}</b></div><b>${r.p}</b></div>`).join('')}</div>`}
 if(playTab==='rw')h=`<p class="msg"><span class="tag">PREVIEW</span> Rewards can't be redeemed yet. This shows how they'll work.</p><div class="bento">${RW.map(([n,c])=>`<div class="card"><div style="display:flex;gap:12px;align-items:center"><div class="ci" style="width:44px;height:44px;border-radius:14px;background:var(--sun);color:#3a2a00;display:grid;place-items:center">${ic('gift')}</div><div style="flex:1"><b>${n}</b><br><small class="msg">${c} points</small></div></div><div class="bar" style="margin-top:10px"><i style="width:${Math.min(100,S.pts/c*100)}%"></i></div><small class="msg">${Math.min(S.pts,c)} / ${c} · ${S.pts>=c?'Unlocked (not redeemable yet)':'Locked'}</small></div>`).join('')}</div>`;
 $('playBody').innerHTML=h;const sg=$('lbSeg');if(sg)sg.querySelectorAll('button').forEach(b=>b.onclick=()=>{lbP=b.textContent;renderPlay()})}
document.querySelectorAll('#playSeg button').forEach(b=>b.onclick=()=>{playTab=b.dataset.p;document.querySelectorAll('#playSeg button').forEach(x=>x.classList.toggle('on',x===b));renderPlay()});
$('qaHist').onclick=()=>{const H=S.hist;$('histBody').innerHTML=H.length?H.map(h=>`<div class="li"><div style="width:40px">${ART[h.m]}</div><div><b>${h.i}</b><br><small>${new Date(h.t).toLocaleString()}</small></div><b>+${h.p}</b></div>`).join(''):`<div style="text-align:center;padding:12px">${mascot(100)}<p class="msg">Nothing yet. Scan your first item!</p></div>`;$('mHist').classList.add('on')};
/* ---------- settings ---------- */
function applyTheme(){const t=store.get('bb3:theme');if(t)document.documentElement.dataset.theme=t}
$('swTheme').onclick=()=>{const d=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=d?'dark':'light';store.set('bb3:theme',d?'dark':'light');render()};
$('swSound').onclick=()=>{store.set('bb3:mute',!store.get('bb3:mute'));render()};
$('saveName').onclick=()=>{const n=$('pName').value.trim();if(!/^[A-Za-z0-9_ ]{3,20}$/.test(n)){toast("Username: 3–20 letters or numbers");SFX.bad();return}
 if(n.toLowerCase()!==S.name.toLowerCase()&&store.get(key(n))){toast("Username taken");SFX.bad();return}
 try{localStorage.removeItem(key(S.name))}catch(e){}S.name=n;save();store.set('bb3:last',n);render();toast("Saved!");SFX.ok()};
$('relink').onclick=()=>openScanner(v=>{const o=store.get('bb3:id:'+v);if(o&&o!==S.name){toast("ID already linked elsewhere");SFX.bad();return}S.id=v;save();render();toast("ID linked");SFX.ok()});
$('avBtn').onclick=()=>$('avFile').click();
$('avFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=c.height=128;const s=Math.min(i.width,i.height);c.getContext('2d').drawImage(i,(i.width-s)/2,(i.height-s)/2,s,s,0,0,128,128);S.avatar=c.toDataURL('image/jpeg',.8);save();render();SFX.ok()};i.src=URL.createObjectURL(f);e.target.value=""};
/* ---------- scanner UI ---------- */
let pStream=null;
const camSet=c=>$('cam2').className='cam '+c;
function stopPcam(){if(pStream){pStream.getTracks().forEach(t=>t.stop());pStream=null}$('pcam').classList.remove('on')}
function camReset(){stopPcam();$('prev').classList.remove('on');camSet('');$('shutter').hidden=true;$('snap').textContent='Start camera'}
$('snap').onclick=async()=>{if(pStream){camReset();return}$('res').style.display='none';$('prev').classList.remove('on');
 try{pStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280}}});const v=$('pcam');v.srcObject=pStream;v.classList.add('on');await v.play();camSet('live');$('shutter').hidden=false;$('snap').textContent='Stop camera'}
 catch(e){stopPcam();$('scanMsg').textContent="Camera unavailable. Upload a photo instead.";$('photo').click()}};
$('upload').onclick=()=>$('photo').click();
$('photo').onchange=e=>{const f=e.target.files[0];e.target.value="";if(f)handle(f)};
$('shutter').onclick=()=>{const v=$('pcam'),c=document.createElement('canvas'),s=Math.min(1,800/Math.max(v.videoWidth,v.videoHeight));c.width=v.videoWidth*s;c.height=v.videoHeight*s;c.getContext('2d').drawImage(v,0,0,c.width,c.height);c.toBlob(b=>handle(b),'image/jpeg',.85)};
function shrink(f){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const s=Math.min(1,800/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(ok,'image/jpeg',.8)};i.onerror=no;i.src=URL.createObjectURL(f)})}
async function handle(f){cur=null;$('res').style.display='none';$('scanMsg').textContent="";
 try{const b=await shrink(f);stopPcam();$('shutter').hidden=true;$('snap').textContent='Start camera';$('prev').src=URL.createObjectURL(b);$('prev').classList.add('on');camSet('busy');
  const r=await analyze(b),m=MATS[r.material]?r.material:"Landfill",bin=MATS[m].bin;
  cur={item:r.item,m,pts:Math.max(1,Math.min(60,Math.round(r.points)||5)),tip:r.tip};camSet('shot');
  $('rName').textContent=cur.item;$('rTip').textContent=cur.tip;$('rPts').textContent="+"+cur.pts;$('rMat').textContent=m;$('rBin').textContent=bin;$('rBinIcon').innerHTML=binSvg(BINCOL[bin]);
  $('rFi').innerHTML=mascot(40);$('rFact').textContent="Did you know? "+(cur.item==="Aluminum can"?FACTS.can:FACTS[m]);$('res').style.display='block';SFX.ok()
 }catch(err){bootHide();camSet('');$('prev').classList.remove('on');$('scanMsg').textContent="Couldn't identify that. Move closer, center one item, use good light, and try again.";SFX.bad()}}
$('addBin').onclick=()=>{if(!cur)return;roll();const t=new Date().toDateString(),lv0=Math.floor(S.pts/100);
 if(S.last!==t){const y=new Date(Date.now()-864e5).toDateString();S.streak=S.last===y?S.streak+1:1;S.last=t}
 S.pts+=cur.pts;S.items++;S.mats[cur.m]=(S.mats[cur.m]||0)+1;S.dly.scans++;if(cur.item==="Aluminum can")S.dly.cans++;if(cur.m==="Plastic")S.wkl.plastic++;
 S.hist.unshift({i:cur.item,m:cur.m,p:cur.pts,t:Date.now()});S.hist=S.hist.slice(0,30);save();
 toast("+"+cur.pts+" points! Walk it to the "+MATS[cur.m].bin+" bin.");const lvl=Math.floor(S.pts/100)>lv0;cur=null;$('res').style.display='none';camReset();render();
 if(lvl)setTimeout(()=>{SFX.lvl();openGen("Level up!","You reached level "+(Math.floor(S.pts/100)+1)+". Keep sorting!")},700);else SFX.ok()};
/* ---------- start ---------- */
applyTheme();try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
const last=store.get('bb3:last');if(last&&store.get(key(last))){S=store.get(key(last));enter()}
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
