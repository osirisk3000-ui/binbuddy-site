/* BinBuddy map: our own map, drawn on a canvas. No Google/Apple/OpenStreetMap, no tiles, no API keys.
   Bins live in the Supabase `bins` table. Signed-in users add bins with add_bin() (see supabase/schema_patch_2.sql). */
window.BBMap=(()=>{
const cv=$('mapCv'),wrap=$('mapWrap'),g=cv.getContext('2d');
const MLAT=111320,LET={Recycling:'R',Compost:'C',Trash:'T'};
let W=0,H=0,dpr=1,bins=[],filter='All',sel=null,me=null,watchId=null,isOpen=false,raf=0,placing=false,loading=false,loadErr='',hasView=false,anim=null,col={},pend=null,saving=false,lastScale='',lastFix=0;
const C={lat:0,lng:0,mpp:2};
const mLng=()=>MLAT*Math.cos(C.lat*Math.PI/180);
const toS=(lat,lng)=>[W/2+(lng-C.lng)*mLng()/C.mpp,H/2-(lat-C.lat)*MLAT/C.mpp];
const toG=(x,y)=>({lat:C.lat-(y-H/2)*C.mpp/MLAT,lng:C.lng+(x-W/2)*C.mpp/mLng()});
const clampZ=m=>Math.max(.12,Math.min(60,m));
const msg=t=>{$('mapMsg').textContent=t||''};
const readCol=()=>{const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();col={bg:v('--mapbg')||'#e6f1ea',g1:v('--mapg1')||'#0001',g2:v('--mapg2')||'#0002'}};
function dist(a,b,c,d){const R=6371000,r=Math.PI/180,x=(d-b)*r*Math.cos((a+c)/2*r),y=(c-a)*r;return Math.sqrt(x*x+y*y)*R}
const fmt=m=>m<1000?Math.round(m)+' m':(m/1000).toFixed(1)+' km';
const vis=()=>bins.filter(b=>filter==='All'||b.t===filter);
function kick(){if(!isOpen||raf)return;raf=requestAnimationFrame(loop)}
function loop(t){raf=0;if(!isOpen)return;if(anim)anim(t);draw(t);if(anim||me||sel!=null)kick()}
function resize(){const r=wrap.getBoundingClientRect();if(!r.width)return;dpr=Math.min(2,window.devicePixelRatio||1);W=r.width;H=r.height;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);kick()}
new ResizeObserver(resize).observe(wrap);
/* ---- drawing ---- */
function pinShape(x,y,color,s,letter){g.save();g.translate(x,y);g.scale(s,s);g.shadowColor='rgba(0,0,0,.3)';g.shadowBlur=8;g.shadowOffsetY=3;
 g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-5,-9,-15,-14,-15,-25);g.arc(0,-25,15,Math.PI,0);g.bezierCurveTo(15,-14,5,-9,0,0);g.closePath();g.fillStyle=color;g.fill();
 g.shadowColor='transparent';g.lineWidth=3;g.strokeStyle='#fff';g.stroke();
 g.fillStyle='#fff';g.beginPath();g.arc(0,-25,8.5,0,7);g.fill();g.fillStyle=color;g.font='800 12px Poppins,system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(letter,0,-24.5);g.restore()}
function draw(t){t=t||0;g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle=col.bg;g.fillRect(0,0,W,H);
 const ml=mLng(),X0=C.lng*ml,Y0=C.lat*MLAT,st=[1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000].find(s=>s/C.mpp>=48)||50000;g.lineWidth=1;
 for(let k=Math.floor((X0-W/2*C.mpp)/st),e=Math.ceil((X0+W/2*C.mpp)/st);k<=e;k++){const x=Math.round(W/2+(k*st-X0)/C.mpp)+.5;g.strokeStyle=k%5===0?col.g2:col.g1;g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()}
 for(let k=Math.floor((Y0-H/2*C.mpp)/st),e=Math.ceil((Y0+H/2*C.mpp)/st);k<=e;k++){const y=Math.round(H/2-(k*st-Y0)/C.mpp)+.5;g.strokeStyle=k%5===0?col.g2:col.g1;g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
 if(!hasView)return;
 if(me){const[x,y]=toS(me.lat,me.lng),ar=me.acc/C.mpp;if(ar>10){g.fillStyle='#3b82f622';g.strokeStyle='#3b82f655';g.lineWidth=1;g.beginPath();g.arc(x,y,ar,0,7);g.fill();g.stroke()}
  const p=(t/1400)%1;g.strokeStyle='rgba(59,130,246,'+(.5*(1-p)).toFixed(2)+')';g.lineWidth=3;g.beginPath();g.arc(x,y,9+p*16,0,7);g.stroke();
  g.fillStyle='#fff';g.beginPath();g.arc(x,y,9,0,7);g.fill();g.fillStyle='#3b82f6';g.beginPath();g.arc(x,y,6.5,0,7);g.fill()}
 const L=vis().map(b=>({b,p:toS(b.lat,b.lng)})).filter(o=>o.p[0]>-30&&o.p[0]<W+30&&o.p[1]>-10&&o.p[1]<H+50).sort((a,c)=>a.p[1]-c.p[1]);
 let top=null;for(const o of L){if(o.b.id===sel){top=o;continue}pinShape(o.p[0],o.p[1],BINCOL[o.b.t],1,LET[o.b.t])}
 if(top){const[x,y]=top.p,p=(t/900)%1;g.strokeStyle='rgba(23,165,116,'+(.55*(1-p)).toFixed(2)+')';g.lineWidth=3;g.beginPath();g.ellipse(x,y,6+p*16,3+p*8,0,0,7);g.stroke();pinShape(x,y,BINCOL[top.b.t],1.3,LET[top.b.t])}
 const nice=[1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000].find(s=>s/C.mpp>=60)||50000,k=nice+'|'+Math.round(nice/C.mpp);
 if(k!==lastScale){lastScale=k;$('scTxt').textContent=nice>=1000?nice/1000+' km':nice+' m';$('scBar').style.width=Math.round(nice/C.mpp)+'px'}}
/* ---- camera moves ---- */
function jump(lat,lng,mpp){C.lat=lat;C.lng=lng;C.mpp=clampZ(mpp||C.mpp);hasView=true;$('mapHint').hidden=true;kick()}
function fly(lat,lng,mpp,ms){if(!hasView)return jump(lat,lng,mpp);const a={lat:C.lat,lng:C.lng,mpp:C.mpp},b={lat,lng,mpp:clampZ(mpp||C.mpp)},t0=performance.now(),d=ms||450;
 anim=t=>{const k=Math.min(1,((t||performance.now())-t0)/d),e=1-Math.pow(1-k,3);C.lat=a.lat+(b.lat-a.lat)*e;C.lng=a.lng+(b.lng-a.lng)*e;C.mpp=a.mpp*Math.pow(b.mpp/a.mpp,e);if(k>=1)anim=null};kick()}
function zoomAt(x,y,f){const p=toG(x,y);C.mpp=clampZ(C.mpp*f);C.lat=p.lat+(y-H/2)*C.mpp/MLAT;C.lng=p.lng-(x-W/2)*C.mpp/mLng();kick()}
function pan(dx,dy){C.lng-=dx*C.mpp/mLng();C.lat+=dy*C.mpp/MLAT;kick()}
function fitAll(){const pts=vis().map(b=>[b.lat,b.lng]);if(me)pts.push([me.lat,me.lng]);if(!pts.length)return;
 const la=pts.map(p=>p[0]),ln=pts.map(p=>p[1]),a=Math.min(...la),b=Math.max(...la),c=Math.min(...ln),d=Math.max(...ln),lat=(a+b)/2,lng=(c+d)/2;
 const ml=MLAT*Math.cos(lat*Math.PI/180),m=Math.max((b-a)*MLAT/(H*.6),(d-c)*ml/(W*.7),.3);jump(lat,lng,m)}
/* ---- gestures ---- */
const ptr=new Map();let gs=null;
const pos=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);const p=pos(e);ptr.set(e.pointerId,{x:p.x,y:p.y,sx:p.x,sy:p.y,moved:false});anim=null;
 if(ptr.size===2){const[a,b]=[...ptr.values()];gs={d:Math.hypot(a.x-b.x,a.y-b.y)||1,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};ptr.forEach(q=>q.moved=true)}});
cv.addEventListener('pointermove',e=>{const q=ptr.get(e.pointerId);if(!q||!hasView)return;const p=pos(e);
 if(ptr.size===1){if(!q.moved&&Math.hypot(p.x-q.sx,p.y-q.sy)>6)q.moved=true;if(q.moved)pan(p.x-q.x,p.y-q.y);q.x=p.x;q.y=p.y}
 else if(ptr.size===2&&gs){q.x=p.x;q.y=p.y;const[a,b]=[...ptr.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;pan(mx-gs.mx,my-gs.my);zoomAt(mx,my,gs.d/d);gs={d,mx,my}}});
const up=e=>{const q=ptr.get(e.pointerId);if(!q)return;ptr.delete(e.pointerId);if(e.type==='pointerup'&&!q.moved&&ptr.size===0)tap(q.x,q.y);gs=null;ptr.forEach(r=>r.moved=true)};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{if(!hasView)return;e.preventDefault();const p=pos(e);zoomAt(p.x,p.y,Math.exp(e.deltaY*.0015))},{passive:false});
cv.addEventListener('dblclick',e=>{if(!hasView||placing)return;const p=pos(e);zoomAt(p.x,p.y,.5)});
function tap(x,y){if(!hasView)return;if(placing){const p=toG(x,y);fly(p.lat,p.lng,C.mpp,300);return}
 const L=vis().map(b=>({b,p:toS(b.lat,b.lng)})).sort((a,c)=>c.p[1]-a.p[1]);
 for(const o of L){const dx=x-o.p[0],dy=y-(o.p[1]-24);if(dx*dx+dy*dy<24*24){select(o.b.id,false);return}}
 deselect()}
/* ---- selection + info card ---- */
function binSvgSmall(c){return binSvg(c).replace('class="bin"','width="40" height="40"')}
function select(id,focus){const b=bins.find(x=>x.id===id);if(!b)return;sel=id;
 const d=me?fmt(dist(me.lat,me.lng,b.lat,b.lng))+' away':'';
 $('mapInfo').innerHTML=`<div class="mi"><div style="width:40px;flex:none">${binSvgSmall(BINCOL[b.t])}</div><div class="grow"><b>${esc(b.n)}</b>${b.mine?' <span class="tag">YOURS</span>':''}<br><small class="msg">${b.t}${d?' · '+d:''}</small></div><button class="x" id="miX" aria-label="Close">✕</button></div>${b.mine?'<button class="btn out sm" id="miDel" style="margin-top:10px;width:100%">Delete this bin</button>':''}`;
 $('mapInfo').hidden=false;$('miX').onclick=deselect;const del=$('miDel');if(del)del.onclick=()=>removeBin(b);
 if(focus){fly(b.lat,b.lng,Math.min(C.mpp,.8))}else{const[x,y]=toS(b.lat,b.lng);if(x<30||x>W-30||y<60||y>H-100)fly(b.lat,b.lng,C.mpp,350)}kick()}
function deselect(){sel=null;$('mapInfo').hidden=true;kick()}
async function removeBin(b){if(!confirm('Delete this bin from the map?'))return;
 try{const{error}=await sb.rpc('delete_my_bin',{p_id:b.id});if(error)throw error;toast('Bin deleted');deselect();await loadBins()}catch(e){toast('Couldn’t delete that bin');SFX.bad()}}
/* ---- list ---- */
function renderList(){const L=vis().map(b=>({b,d:me?dist(me.lat,me.lng,b.lat,b.lng):null}));if(me)L.sort((a,c)=>a.d-c.d);
 let h;
 if(loadErr)h=`<p class="msg">${esc(loadErr)}</p>`;
 else if(loading&&!bins.length)h='<p class="msg">Loading bins…</p>';
 else if(!L.length)h=`<div style="text-align:center">${mascot(80)}<p class="msg">${bins.length?'No bins of that type yet.':'No bins on the map yet. Be the first to add one!'}</p></div>`;
 else h=`<p class="msg" style="margin:0 0 4px">${L.length} bin${L.length===1?'':'s'}${me?', nearest first':''}</p>`+L.map(({b,d})=>`<button class="li bl" data-id="${b.id}"><div style="width:38px;flex:none">${binSvgSmall(BINCOL[b.t]).replace('width="40" height="40"','width="38" height="38"')}</div><div class="grow"><b>${esc(b.n)}</b>${b.mine?' <span class="tag">YOURS</span>':''}<br><small>${b.t}${d!=null?' · '+fmt(d):''}</small></div></button>`).join('');
 $('binList').innerHTML=h;$('binList').querySelectorAll('.bl').forEach(el=>el.onclick=()=>{select(+el.dataset.id,true);wrap.scrollIntoView({behavior:'smooth',block:'center'})})}
async function loadBins(){if(loading||!sb)return;loading=true;renderList();
 try{const{data,error}=await sb.from('bins').select('id,name,category,lat,lng,created_by').not('lat','is',null).not('lng','is',null).order('id',{ascending:false}).limit(500);if(error)throw error;
  bins=data.map(b=>({id:b.id,n:b.name,t:b.category,lat:b.lat,lng:b.lng,mine:!!S&&b.created_by===S.uid}));loadErr=''}
 catch(e){console.warn('bins load failed',e);bins=[];loadErr='Couldn’t load bins. Check your connection (and that schema_patch_2.sql has been run).'}
 finally{loading=false}renderList();if(!hasView&&bins.length)fitAll();kick()}
/* ---- location ---- */
function startWatch(){if(watchId!=null||!navigator.geolocation)return;
 watchId=navigator.geolocation.watchPosition(p=>{me={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy};kick();if(Date.now()-lastFix>8000){lastFix=Date.now();renderList()}},()=>{},{enableHighAccuracy:true,maximumAge:5000})}
function stopWatch(){if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null}}
function locate(zoom){return new Promise(res=>{if(!navigator.geolocation){msg('Location isn’t available on this device.');return res(null)}msg('Finding you…');
 navigator.geolocation.getCurrentPosition(p=>{me={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy};lastFix=Date.now();startWatch();msg('');
  if(zoom!==false)fly(me.lat,me.lng,hasView?Math.min(C.mpp,1):1);renderList();kick();res(me)},
  err=>{msg(err.code===1?'Location is blocked. Allow it in your browser settings so the map can find you.':'Couldn’t get your location. Try again outside or near a window.');res(null)},{enableHighAccuracy:true,timeout:12000,maximumAge:5000})})}
/* ---- adding bins ---- */
function startPlacing(note){placing=true;deselect();$('crossPin').hidden=false;$('placeBar').hidden=false;$('addBtns').hidden=true;$('placeTxt').textContent=note||'Drag the map so the pin sits on the bin, then tap Place pin here.';kick()}
function stopPlacing(){placing=false;$('crossPin').hidden=true;$('placeBar').hidden=true;$('addBtns').hidden=false}
$('binHere').onclick=async()=>{const m=await locate(false);if(!m)return;fly(m.lat,m.lng,.25,500);
 startPlacing(m.acc>40?`GPS is only accurate to about ${Math.round(m.acc)} m here. Drag the map so the pin sits exactly on the bin.`:'Pin is at your spot. Nudge the map if needed, then tap Place pin here.')};
$('binDrop').onclick=async()=>{if(!hasView){const m=await locate(true);if(!m)return}startPlacing()};
$('placeNo').onclick=stopPlacing;
$('placeOk').onclick=()=>{pend={lat:C.lat,lng:C.lng};stopPlacing();$('binWhere').textContent=(me?fmt(dist(me.lat,me.lng,pend.lat,pend.lng))+' from you. ':'')+'Pick the kind of bin it is.';
 $('binName').value='';$('binMsg').textContent='';$('mBin').classList.add('on')};
$('binType').querySelectorAll('button').forEach(b=>b.onclick=()=>$('binType').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)));
function binErr(e){const m=(e&&e.message)||'';
 if(/duplicate_bin/.test(m))return'There’s already a bin of that type right here.';
 if(/daily_bin_cap/.test(m))return'You’ve added a lot of bins today. Try again tomorrow.';
 if(/not_authenticated/.test(m))return'You were signed out. Please log in again.';
 if(/find the function|PGRST202/.test(m+(e.code||'')))return'Adding bins isn’t set up yet. The site owner needs to run schema_patch_2.sql.';
 return'Couldn’t save that bin. Check your connection and try again.'}
$('binSave').onclick=async()=>{if(!pend||saving)return;saving=true;$('binMsg').textContent='';
 try{const t=$('binType').querySelector('.on').dataset.t,n=$('binName').value.trim();
  const{data,error}=await sb.rpc('add_bin',{p_name:n,p_category:t,p_lat:pend.lat,p_lng:pend.lng});if(error)throw error;
  closeAll();toast('Bin added. Thanks for mapping it!');SFX.ok();pend=null;await loadBins();if(data&&data.id)select(data.id,false)}
 catch(e){$('binMsg').textContent=binErr(e);SFX.bad()}finally{saving=false}};
/* ---- buttons + lifecycle ---- */
$('mapLoc').onclick=()=>locate(true);$('hintLoc').onclick=()=>locate(true);
$('zIn').onclick=()=>hasView&&fly(C.lat,C.lng,C.mpp*.5,250);$('zOut').onclick=()=>hasView&&fly(C.lat,C.lng,C.mpp*2,250);
document.querySelectorAll('#binSeg button').forEach(b=>b.onclick=()=>{filter=b.dataset.f;document.querySelectorAll('#binSeg button').forEach(x=>x.classList.toggle('on',x===b));if(sel!=null&&!vis().some(x=>x.id===sel))deselect();renderList();kick()});
new MutationObserver(()=>{readCol();kick()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener&&matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readCol();kick()});
function open(){isOpen=true;readCol();resize();if(me)startWatch();$('mapHint').hidden=hasView;loadBins();kick()}
function close(){isOpen=false;stopWatch();if(raf){cancelAnimationFrame(raf);raf=0}if(placing)stopPlacing()}
readCol();
return{open,close,refreshList:()=>renderList()}})();
