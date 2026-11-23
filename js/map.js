/* BinBuddy map: bins, route and gestures are drawn on our own canvas. The base map (buildings, roads, labels) is OpenFreeMap vector tiles
   rendered by MapLibre GL underneath the canvas (free, no API key). If MapLibre can't start, we fall back to OpenStreetMap data from Overpass. Walking routes come from routing.openstreetmap.de (foot profile). No Google/Apple map, no tiles, no API keys.
   Bins live in the Supabase `bins` table. Signed-in users add bins with add_bin() (see supabase/schema_patch_2.sql). */
window.BBMap=(()=>{
const cv=$('mapCv'),wrap=$('mapWrap'),g=cv.getContext('2d');
const MLAT=111320,LET={Recycling:'R',Compost:'C',Trash:'T'};
let W=0,H=0,dpr=1,bins=[],filter='All',sel=null,me=null,watchId=null,isOpen=false,raf=0,placing=false,loading=false,loadErr='',hasView=false,anim=null,col={},pend=null,saving=false,lastScale='',lastFix=0,route=null,tmr=0,active=0,gl=null,glKey='',glErr=false,glStyle='';
const TS=0.005,MAXMPP=5,OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'],ROUTE='https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const tiles=new Map(),tq=[];
const C={lat:0,lng:0,mpp:2};
const mLng=()=>MLAT*Math.cos(C.lat*Math.PI/180);
const toS=(lat,lng)=>[W/2+(lng-C.lng)*mLng()/C.mpp,H/2-(lat-C.lat)*MLAT/C.mpp];
const toG=(x,y)=>({lat:C.lat-(y-H/2)*C.mpp/MLAT,lng:C.lng+(x-W/2)*C.mpp/mLng()});
const clampZ=m=>Math.max(.12,Math.min(60,m));
const msg=t=>{$('mapMsg').textContent=t||''};
const readCol=()=>{const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();col={bg:v('--mapbg')||'#e6f1ea',g1:v('--mapg1')||'#0001',g2:v('--mapg2')||'#0002',bld:v('--mapbld')||'#d4dfd8',bldl:v('--mapbldl')||'#b9c8bf',road:v('--maproad')||'#fff',roadl:v('--maproadl')||'#cfdcd4',park:v('--mappark')||'#cfe8d5',water:v('--mapwater')||'#bcd9ee',ink:v('--ink')||'#0d2b24'}};
function dist(a,b,c,d){const R=6371000,r=Math.PI/180,x=(d-b)*r*Math.cos((a+c)/2*r),y=(c-a)*r;return Math.sqrt(x*x+y*y)*R}
const fmt=m=>m<1000?Math.round(m)+' m':(m/1000).toFixed(1)+' km';
const vis=()=>bins.filter(b=>filter==='All'||b.t===filter);
function kick(){if(!isOpen||raf)return;raf=requestAnimationFrame(loop)}
function loop(t){raf=0;if(!isOpen)return;if(anim)anim(t);syncBase();draw(t);if(anim||me||sel!=null)kick()}
function resize(){const r=wrap.getBoundingClientRect();if(!r.width)return;dpr=Math.min(2,window.devicePixelRatio||1);W=r.width;H=r.height;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);if(gl)gl.resize();kick();tilesSoon()}
new ResizeObserver(resize).observe(wrap);
/* ---- base map: MapLibre + OpenFreeMap, kept in lockstep with our canvas camera ---- */
const isDark=()=>{const t=document.documentElement.dataset.theme;return t==='dark'||(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)};
const styleUrl=()=>'https://tiles.openfreemap.org/styles/'+(isDark()?'dark':'liberty');
const glZoom=()=>Math.log2(40075016.686*Math.cos(C.lat*Math.PI/180)/(512*C.mpp));
function initBase(){if(gl||glErr||!hasView||!W)return;
 if(!window.maplibregl){if(!initBase.t)initBase.t=setTimeout(()=>{initBase.t=0;if(!window.maplibregl){glErr=true;tilesSoon();kick()}else initBase()},4000);return}
 try{glStyle=styleUrl();gl=new maplibregl.Map({container:'mapBase',style:glStyle,center:[C.lng,C.lat],zoom:glZoom(),interactive:false,attributionControl:false,fadeDuration:0,maxZoom:24,pitchWithRotate:false,dragRotate:false});
  gl.on('load',()=>{setStat('');kick()});
  gl.on('idle',()=>{if(gl&&gl.isStyleLoaded())setStat('')});
  gl.on('error',e=>{if(gl&&!gl.isStyleLoaded())setStat('Couldn’t load the map. Tap to retry')});
  glKey=''}
 catch(e){gl=null;glErr=true;console.warn('MapLibre failed',e);tilesSoon()}}
function syncBase(){if(!hasView)return;if(!gl){initBase();return}
 const want=styleUrl();if(want!==glStyle){glStyle=want;gl.setStyle(want)}
 const k=C.lat.toFixed(7)+'|'+C.lng.toFixed(7)+'|'+C.mpp.toFixed(5)+'|'+W+'|'+H;if(k===glKey)return;glKey=k;
 gl.jumpTo({center:[C.lng,C.lat],zoom:glZoom()});gl.redraw()}
/* ---- drawing ---- */
function pinShape(x,y,color,s,letter){g.save();g.translate(x,y);g.scale(s,s);g.shadowColor='rgba(0,0,0,.3)';g.shadowBlur=8;g.shadowOffsetY=3;
 g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-5,-9,-15,-14,-15,-25);g.arc(0,-25,15,Math.PI,0);g.bezierCurveTo(15,-14,5,-9,0,0);g.closePath();g.fillStyle=color;g.fill();
 g.shadowColor='transparent';g.lineWidth=3;g.strokeStyle='#fff';g.stroke();
 g.fillStyle='#fff';g.beginPath();g.arc(0,-25,8.5,0,7);g.fill();g.fillStyle=color;g.font='800 12px Poppins,system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(letter,0,-24.5);g.restore()}
const SPEC={motorway:14,trunk:12,primary:11,secondary:9,tertiary:8,unclassified:6,residential:6,living_street:5,service:4,pedestrian:4,track:3,cycleway:2.5,footway:2,path:2,steps:2};
const THIN={footway:1,path:1,steps:1,cycleway:1,track:1};
function visibleTiles(){if(!hasView||!W||C.mpp>MAXMPP)return[];const a=toG(0,H),b=toG(W,0),i0=Math.floor(a.lng/TS),i1=Math.floor(b.lng/TS),j0=Math.floor(a.lat/TS),j1=Math.floor(b.lat/TS);if((i1-i0+1)*(j1-j0+1)>16)return[];const o=[];for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++)o.push([i,j]);return o}
function drawBase(){const ml=mLng(),k=1/C.mpp,hw=W/2,hh=H/2,px=lng=>hw+(lng-C.lng)*ml*k,py=lat=>hh-(lat-C.lat)*MLAT*k,by={w:[],p:[],r:[],b:[]};let any=false;
 for(const[i,j]of visibleTiles()){const t=tiles.get(i+','+j);if(!t||!t.ok)continue;any=true;
  for(const w of t.ways){const x0=px(w.bb[1]),x1=px(w.bb[3]),y0=py(w.bb[2]),y1=py(w.bb[0]);if(x1<-5||x0>W+5||y1<-5||y0>H+5)continue;w.x0=x0;w.x1=x1;w.y0=y0;w.y1=y1;by[w.k].push(w)}}
 const poly=(list,fill,stroke)=>{if(!list.length)return;g.beginPath();for(const w of list){w.pts.forEach((p,n)=>n?g.lineTo(px(p[1]),py(p[0])):g.moveTo(px(p[1]),py(p[0])));g.closePath()}g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=1;g.stroke()}};
 poly(by.w,col.water);poly(by.p,col.park);
 g.lineCap='round';g.lineJoin='round';
 for(const pass of[0,1]){const groups={};for(const w of by.r){const key=(SPEC[w.c]||4)+(THIN[w.c]?'t':'');(groups[key]=groups[key]||[]).push(w)}
  for(const key in groups){const m=parseFloat(key),thin=key.endsWith('t'),wd=Math.max(thin?1:1.5,Math.min(16,m*k));g.beginPath();
   for(const w of groups[key])w.pts.forEach((p,n)=>n?g.lineTo(px(p[1]),py(p[0])):g.moveTo(px(p[1]),py(p[0])));
   g.setLineDash(thin?[4,3]:[]);g.strokeStyle=pass?col.road:col.roadl;g.lineWidth=pass?wd:wd+(thin?0:2);if(!(thin&&!pass))g.stroke()}}
 g.setLineDash([]);poly(by.b,col.bld,col.bldl);
 if(C.mpp<1.6){g.font='600 11px Poppins,system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';const boxes=[];let n=0;
  for(const w of by.b){if(!w.name||n>45)continue;const cx=(w.x0+w.x1)/2,cy=(w.y0+w.y1)/2,tw=g.measureText(w.name).width;if(w.x1-w.x0<Math.min(tw*.7,60)||cx<10||cx>W-10||cy<10||cy>H-10)continue;
   if(boxes.some(b=>Math.abs(b[0]-cx)<(b[2]+tw)/2&&Math.abs(b[1]-cy)<14))continue;boxes.push([cx,cy,tw]);n++;g.lineWidth=3;g.strokeStyle=col.bg;g.strokeText(w.name,cx,cy);g.fillStyle=col.ink;g.fillText(w.name,cx,cy)}}
 return any}
function drawRoute(){if(!route)return;g.lineCap='round';g.lineJoin='round';
 const b=route.bin,core=route.pts,a=me?[me.lat,me.lng]:null,z=[b.lat,b.lng];
 const line=(pts,dash)=>{if(pts.length<2)return;g.beginPath();pts.forEach((p,n)=>{const[x,y]=toS(p[0],p[1]);n?g.lineTo(x,y):g.moveTo(x,y)});g.setLineDash(dash);g.strokeStyle='#fff';g.lineWidth=9;g.stroke();g.strokeStyle='#17a574';g.lineWidth=5;g.stroke();g.setLineDash([])};
 /* The walking route snaps to the nearest footpath, so it starts and ends a little away from you and from the bin.
    Join both ends with short dashed links so the line always runs from you to the bin. */
 if(core&&core.length>1){line(core,[]);if(a&&dist(a[0],a[1],core[0][0],core[0][1])>1.5)line([a,core[0]],[6,7]);const e=core[core.length-1];if(dist(e[0],e[1],z[0],z[1])>1.5)line([e,z],[6,7])}
 else if(a)line([a,z],[8,8])}
function draw(t){t=t||0;g.setTransform(dpr,0,0,dpr,0,0);if(gl)g.clearRect(0,0,W,H);else{g.fillStyle=col.bg;g.fillRect(0,0,W,H)}
 const ml=mLng(),X0=C.lng*ml,Y0=C.lat*MLAT,st=[1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000].find(s=>s/C.mpp>=48)||50000;g.lineWidth=1;
 const base=gl?true:hasView&&drawBase();
 if(!base){
 for(let k=Math.floor((X0-W/2*C.mpp)/st),e=Math.ceil((X0+W/2*C.mpp)/st);k<=e;k++){const x=Math.round(W/2+(k*st-X0)/C.mpp)+.5;g.strokeStyle=k%5===0?col.g2:col.g1;g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()}
 for(let k=Math.floor((Y0-H/2*C.mpp)/st),e=Math.ceil((Y0+H/2*C.mpp)/st);k<=e;k++){const y=Math.round(H/2-(k*st-Y0)/C.mpp)+.5;g.strokeStyle=k%5===0?col.g2:col.g1;g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}}
 if(!hasView)return;
 drawRoute();
 if(me){const[x,y]=toS(me.lat,me.lng),ar=me.acc/C.mpp;if(ar>10){g.fillStyle='#3b82f622';g.strokeStyle='#3b82f655';g.lineWidth=1;g.beginPath();g.arc(x,y,ar,0,7);g.fill();g.stroke()}
  const p=(t/1400)%1;g.strokeStyle='rgba(59,130,246,'+(.5*(1-p)).toFixed(2)+')';g.lineWidth=3;g.beginPath();g.arc(x,y,9+p*16,0,7);g.stroke();
  g.fillStyle='#fff';g.beginPath();g.arc(x,y,9,0,7);g.fill();g.fillStyle='#3b82f6';g.beginPath();g.arc(x,y,6.5,0,7);g.fill()}
 const L=vis().map(b=>({b,p:toS(b.lat,b.lng)})).filter(o=>o.p[0]>-30&&o.p[0]<W+30&&o.p[1]>-10&&o.p[1]<H+50).sort((a,c)=>a.p[1]-c.p[1]);
 let top=null;for(const o of L){if(o.b.id===sel){top=o;continue}pinShape(o.p[0],o.p[1],BINCOL[o.b.t],1,LET[o.b.t])}
 if(top){const[x,y]=top.p,p=(t/900)%1;g.strokeStyle='rgba(23,165,116,'+(.55*(1-p)).toFixed(2)+')';g.lineWidth=3;g.beginPath();g.ellipse(x,y,6+p*16,3+p*8,0,0,7);g.stroke();pinShape(x,y,BINCOL[top.b.t],1.3,LET[top.b.t])}
 const nice=[1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000].find(s=>s/C.mpp>=60)||50000,k=nice+'|'+Math.round(nice/C.mpp);
 if(k!==lastScale){lastScale=k;$('scTxt').textContent=nice>=1000?nice/1000+' km':nice+' m';$('scBar').style.width=Math.round(nice/C.mpp)+'px'}}
/* ---- camera moves ---- */
function jump(lat,lng,mpp){C.lat=lat;C.lng=lng;C.mpp=clampZ(mpp||C.mpp);hasView=true;$('mapHint').hidden=true;kick();tilesSoon()}
function fly(lat,lng,mpp,ms){if(!hasView)return jump(lat,lng,mpp);const a={lat:C.lat,lng:C.lng,mpp:C.mpp},b={lat,lng,mpp:clampZ(mpp||C.mpp)},t0=performance.now(),d=ms||450;
 anim=t=>{const k=Math.min(1,((t||performance.now())-t0)/d),e=1-Math.pow(1-k,3);C.lat=a.lat+(b.lat-a.lat)*e;C.lng=a.lng+(b.lng-a.lng)*e;C.mpp=a.mpp*Math.pow(b.mpp/a.mpp,e);if(k>=1){anim=null;tilesSoon()}};kick()}
function zoomAt(x,y,f){const p=toG(x,y);C.mpp=clampZ(C.mpp*f);C.lat=p.lat+(y-H/2)*C.mpp/MLAT;C.lng=p.lng-(x-W/2)*C.mpp/mLng();kick();tilesSoon()}
function pan(dx,dy){C.lng-=dx*C.mpp/mLng();C.lat+=dy*C.mpp/MLAT;kick();tilesSoon()}
function fitPts(pts,v){if(!pts.length)return;const la=pts.map(p=>p[0]),ln=pts.map(p=>p[1]),a=Math.min(...la),b=Math.max(...la),c=Math.min(...ln),d=Math.max(...ln),lat=(a+b)/2,lng=(c+d)/2;
 const ml=MLAT*Math.cos(lat*Math.PI/180),m=Math.max((b-a)*MLAT/(H*(v||.6)),(d-c)*ml/(W*.7),.3);jump(lat,lng,m)}
function fitAll(){const pts=vis().map(b=>[b.lat,b.lng]);if(me)pts.push([me.lat,me.lng]);fitPts(pts)}
/* ---- base map data (OpenStreetMap via Overpass), cached on the device ---- */
function parse(json){const out=[];for(const e of json.elements||[]){if(e.type!=='way'||!e.geometry||e.geometry.length<2)continue;const t=e.tags||{};let k,c=null;
 if(t.building)k='b';else if(t.highway){k='r';c=t.highway}else if(t.natural==='water')k='w';else if(t.leisure==='park')k='p';else continue;
 const pts=e.geometry.map(p=>[p.lat,p.lon]);let s=90,w=180,n=-90,ee=-180;for(const p of pts){if(p[0]<s)s=p[0];if(p[0]>n)n=p[0];if(p[1]<w)w=p[1];if(p[1]>ee)ee=p[1]}
 out.push({k,c,pts,bb:[s,w,n,ee],name:k==='b'?(t.name||t['addr:housename']||''):''})}return out}
function tilesSoon(){clearTimeout(tmr);tmr=setTimeout(ensureTiles,250)}
function setStat(t){const e=$('mapStat');e.hidden=!t;e.textContent=t||''}
function ensureTiles(){if(gl||!isOpen||!hasView||(!glErr&&window.maplibregl))return;const vs=visibleTiles();
 if(C.mpp>MAXMPP){setStat('Zoom in to see buildings');return}
 vs.sort((a,b)=>Math.hypot((a[0]+.5)*TS-C.lng,(a[1]+.5)*TS-C.lat)-Math.hypot((b[0]+.5)*TS-C.lng,(b[1]+.5)*TS-C.lat));
 let busy=false,err=false;
 for(const[i,j]of vs){const key=i+','+j;let t=tiles.get(key);if(!t){t={ok:false,ways:[],busy:false,err:false,t:0};tiles.set(key,t)}
  if(t.ok)continue;if(t.busy){busy=true;continue}if(t.err&&Date.now()-t.t<20000){err=true;continue}t.busy=true;busy=true;tq.push([i,j])}
 if(tiles.size>60){for(const[key,t]of tiles){if(tiles.size<=40)break;if(!t.busy&&!vs.some(v=>v.join(',')===key))tiles.delete(key)}}
 pump();setStat(busy?'Loading map details…':err?'Couldn’t load buildings. Tap to retry':'')}
function pump(){while(active<2&&tq.length){const[i,j]=tq.shift();fetchTile(i,j)}}
async function fetchTile(i,j){const t=tiles.get(i+','+j);if(!t)return;active++;
 try{const bb='('+[j*TS,i*TS,(j+1)*TS,(i+1)*TS].map(x=>x.toFixed(5)).join(',')+')';
  const q='[out:json][timeout:25];(way["building"]'+bb+';way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|footway|path|steps|cycleway|track)$"]'+bb+';way["leisure"="park"]'+bb+';way["natural"="water"]'+bb+';);out geom;';
  const urls=OVERPASS.map(u=>u+'?data='+encodeURIComponent(q));let json=null,cache=null;
  try{cache=await caches.open('bb-osm-v1');const hit=await cache.match(urls[0]);if(hit){const d=Date.parse(hit.headers.get('date')||'');if(!d||Date.now()-d<14*864e5)json=await hit.json()}}catch(x){}
  if(!json)for(const u of urls){try{const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),30000),r=await fetch(u,{signal:ctl.signal});clearTimeout(to);if(!r.ok)continue;const copy=r.clone();json=await r.json();if(cache)cache.put(urls[0],copy).catch(()=>{});break}catch(x){}}
  if(!json)throw new Error('overpass');t.ways=parse(json);t.ok=true;t.err=false}
 catch(e){t.err=true;t.t=Date.now()}
 finally{t.busy=false;active--;pump();kick();if(!tq.length&&active===0)ensureTiles()}}
$('mapStat').onclick=()=>{if(gl){glStyle='';glKey='';setStat('Loading map…');kick();return}tiles.forEach(t=>{if(t.err)t.t=0});ensureTiles()};
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
function mapsUrl(b){return platform()==='ios'?`https://maps.apple.com/?daddr=${b.lat},${b.lng}&dirflg=w`:`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}&travelmode=walking`}
function renderInfo(){const b=bins.find(x=>x.id===sel);if(!b){$('mapInfo').hidden=true;return}
 const d=me?fmt(dist(me.lat,me.lng,b.lat,b.lng))+' away':'',r=route&&route.bin.id===b.id?route:null;
 let act='';
 if(r&&r.loading)act='<p class="msg" style="margin-top:8px">Finding a walking route…</p>';
 else if(r)act=`<p style="margin-top:8px;font-weight:600">🚶 ${fmt(r.dist)} · about ${Math.max(1,Math.round(r.dist/80))} min walk</p>${r.pts?'':'<p class="msg">Couldn’t load the route. Showing a straight line.</p>'}<div class="stack two" style="margin-top:8px"><a class="btn sm sun" href="${mapsUrl(b)}" target="_blank" rel="noopener">Open in Maps</a><button class="btn out sm" id="miClear" style="width:100%">Clear route</button></div>`;
 else act='<button class="btn sm" id="miWalk" style="margin-top:10px;width:100%">Walk there</button>';
 $('mapInfo').innerHTML=`<div class="mi"><div style="width:40px;flex:none">${binSvgSmall(BINCOL[b.t])}</div><div class="grow"><b>${esc(b.n)}</b>${b.mine?' <span class="tag">YOURS</span>':''}<br><small class="msg">${b.t}${d?' · '+d:''}</small></div><button class="x" id="miX" aria-label="Close">✕</button></div>${act}${b.mine?'<button class="btn out sm" id="miDel" style="margin-top:8px;width:100%">Delete this bin</button>':''}`;
 $('mapInfo').hidden=false;$('miX').onclick=deselect;const w=$('miWalk');if(w)w.onclick=()=>walkTo(b);const c=$('miClear');if(c)c.onclick=()=>{route=null;renderInfo();kick()};const del=$('miDel');if(del)del.onclick=()=>removeBin(b)}
function select(id,focus){const b=bins.find(x=>x.id===id);if(!b)return;sel=id;if(route&&route.bin.id!==id)route=null;renderInfo();
 if(focus){fly(b.lat,b.lng,Math.min(C.mpp,.8))}else{const[x,y]=toS(b.lat,b.lng);if(x<30||x>W-30||y<60||y>H-170)fly(b.lat,b.lng,C.mpp,350)}kick()}
async function walkTo(b){if(!me){const m=await locate(false);if(!m)return}
 const r=route={bin:b,loading:true,pts:null,dist:dist(me.lat,me.lng,b.lat,b.lng)};renderInfo();fitPts([[me.lat,me.lng],[b.lat,b.lng]],.4);
 try{const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),12000),res=await fetch(`${ROUTE}${me.lng},${me.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,{signal:ctl.signal});clearTimeout(to);
  const j=await res.json();if(!res.ok||!j.routes||!j.routes[0])throw new Error('route');r.pts=j.routes[0].geometry.coordinates.map(c=>[c[1],c[0]]);const f=r.pts[0],l=r.pts[r.pts.length-1];r.dist=j.routes[0].distance+dist(me.lat,me.lng,f[0],f[1])+dist(l[0],l[1],b.lat,b.lng)}catch(e){r.pts=null}
 r.loading=false;if(route===r){renderInfo();if(r.pts)fitPts(r.pts.concat([[me.lat,me.lng],[b.lat,b.lng]]),.4);kick()}}
function deselect(){sel=null;route=null;$('mapInfo').hidden=true;kick()}
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
function startPlacing(note){placing=true;deselect();$('crossPin').hidden=false;$('placeBar').hidden=false;$('addBtns').hidden=true;$('nearBtn').hidden=true;$('placeTxt').textContent=note||'Drag the map so the pin sits on the bin, then tap Place pin here.';kick()}
function stopPlacing(){placing=false;$('crossPin').hidden=true;$('placeBar').hidden=true;$('addBtns').hidden=false;$('nearBtn').hidden=false}
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
$('nearBtn').onclick=async()=>{if(!me){const m=await locate(false);if(!m)return}const L=vis();if(!L.length){msg('No bins of that type yet.');return}msg('');
 const n=L.reduce((a,b)=>dist(me.lat,me.lng,b.lat,b.lng)<dist(me.lat,me.lng,a.lat,a.lng)?b:a);select(n.id,false);walkTo(n)};
$('mapLoc').onclick=()=>locate(true);$('hintLoc').onclick=()=>locate(true);
$('zIn').onclick=()=>hasView&&fly(C.lat,C.lng,C.mpp*.5,250);$('zOut').onclick=()=>hasView&&fly(C.lat,C.lng,C.mpp*2,250);
document.querySelectorAll('#binSeg button').forEach(b=>b.onclick=()=>{filter=b.dataset.f;document.querySelectorAll('#binSeg button').forEach(x=>x.classList.toggle('on',x===b));if(sel!=null&&!vis().some(x=>x.id===sel))deselect();renderList();kick()});
new MutationObserver(()=>{readCol();kick()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener&&matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readCol();kick()});
function open(){isOpen=true;readCol();resize();if(me)startWatch();$('mapHint').hidden=hasView;loadBins();syncBase();kick();tilesSoon()}
function close(){isOpen=false;stopWatch();if(raf){cancelAnimationFrame(raf);raf=0}if(placing)stopPlacing()}
readCol();
return{open,close,refreshList:()=>renderList()}})();
