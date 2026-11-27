/* BinBuddy map: bins, route and gestures are drawn on our own canvas. The base map (buildings, roads, labels) is OpenFreeMap vector tiles
   rendered by MapLibre GL underneath the canvas (free, no API key). If MapLibre can't start, we fall back to OpenStreetMap data from Overpass. Walking routes come from routing.openstreetmap.de (foot profile). No Google/Apple map, no tiles, no API keys.
   Bins live in the Supabase `bins` table. Signed-in users add bins with add_bin() (see supabase/schema_patch_2.sql). */
window.BBMap=(()=>{
const cv=$('mapCv'),wrap=$('mapWrap'),g=cv.getContext('2d');
const MLAT=111320,RAD=Math.PI/180,LET={Recycling:'R',Compost:'C',Trash:'T'};
let W=0,H=0,dpr=1,bins=[],filter='All',sel=null,me=null,watchId=null,isOpen=false,raf=0,placing=false,loading=false,loadErr='',hasView=false,anim=null,col={},pend=null,saving=false,lastScale='',lastFix=0,route=null,tmr=0,active=0,gl=null,glKey='',glErr=false,glStyle='';
const TS=0.005,MAXMPP=5,OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'],ROUTE='https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const tiles=new Map(),tq=[];
const C={lat:0,lng:0,mpp:2,brg:0}; // brg = compass direction that points UP on screen (0 = north up)
let blds=[],floors=[],auto=true,heading=null,gpsHdg=null,hl=null,areaF='All',curB=null,curFl=null,pendB=null,lastBrg=null,orientOn=false,loadP=null;
const mLng=()=>MLAT*Math.cos(C.lat*Math.PI/180);
const toS=(lat,lng)=>{const dx=(lng-C.lng)*mLng(),dy=(lat-C.lat)*MLAT,t=C.brg*RAD,c=Math.cos(t),s=Math.sin(t);return[W/2+(dx*c-dy*s)/C.mpp,H/2-(dx*s+dy*c)/C.mpp]};
const toG=(x,y)=>{const ex=(x-W/2)*C.mpp,up=-(y-H/2)*C.mpp,t=C.brg*RAD,c=Math.cos(t),s=Math.sin(t);return{lat:C.lat+(-ex*s+up*c)/MLAT,lng:C.lng+(ex*c+up*s)/mLng()}};
const clampZ=m=>Math.max(.12,Math.min(60,m));
const msg=t=>{$('mapMsg').textContent=t||''};
const readCol=()=>{const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();col={bg:v('--mapbg')||'#e6f1ea',g1:v('--mapg1')||'#0001',g2:v('--mapg2')||'#0002',bld:v('--mapbld')||'#d4dfd8',bldl:v('--mapbldl')||'#b9c8bf',road:v('--maproad')||'#fff',roadl:v('--maproadl')||'#cfdcd4',park:v('--mappark')||'#cfe8d5',water:v('--mapwater')||'#bcd9ee',ink:v('--ink')||'#0d2b24'}};
function dist(a,b,c,d){const R=6371000,r=Math.PI/180,x=(d-b)*r*Math.cos((a+c)/2*r),y=(c-a)*r;return Math.sqrt(x*x+y*y)*R}
const fmt=m=>m<1000?Math.round(m)+' m':(m/1000).toFixed(1)+' km';
const inCat=b=>filter==='All'||b.t===filter;
const vis=()=>areaF==='Inside'?[]:bins.filter(b=>b.area==='outside'&&inCat(b)); // pins on the map (outside bins)
const visList=()=>bins.filter(b=>inCat(b)&&(areaF==='All'||(areaF==='Outside')===(b.area==='outside')));
const showBlds=()=>areaF!=='Outside';
const bldName=id=>{const b=blds.find(x=>x.id===id);return b?b.n:'Building'};
const floorOf=id=>floors.find(f=>f.id===id);
function kick(){if(!isOpen||raf)return;raf=requestAnimationFrame(loop)}
const curHdg=()=>heading!=null?heading:gpsHdg;
function stepAuto(){if(!auto)return false;const h=curHdg();if(h==null)return false;const d=((h-C.brg+540)%360)-180;if(Math.abs(d)<.4){C.brg=h;return false}C.brg=(C.brg+d*.18+360)%360;return true}
function loop(t){raf=0;if(!isOpen)return;if(anim)anim(t);const mv=stepAuto();syncBase();draw(t);if(anim||me||sel!=null||mv)kick()}
function resize(){const r=wrap.getBoundingClientRect();if(!r.width)return;dpr=Math.min(2,window.devicePixelRatio||1);W=r.width;H=r.height;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);if(gl)gl.resize();kick();tilesSoon()}
new ResizeObserver(resize).observe(wrap);
/* ---- base map: MapLibre + OpenFreeMap, kept in lockstep with our canvas camera ---- */
const isDark=()=>{const t=document.documentElement.dataset.theme;return t==='dark'||(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)};
const STYLES=[['auto','Auto (follows theme)'],['liberty','Liberty'],['bright','Bright'],['positron','Positron (light, minimal)'],['dark','Dark'],['fiord','Fiord']];
let pick=(()=>{const v=store.get('bb3:mapstyle');return STYLES.some(x=>x[0]===v)?v:'auto'})(),found=null;
const styleUrl=()=>'https://tiles.openfreemap.org/styles/'+(pick==='auto'?(isDark()?'dark':'liberty'):pick);
const glZoom=()=>Math.log2(40075016.686*Math.cos(C.lat*Math.PI/180)/(512*C.mpp));
function initBase(){if(gl||glErr||!hasView||!W)return;
 if(!window.maplibregl){if(!initBase.t)initBase.t=setTimeout(()=>{initBase.t=0;if(!window.maplibregl){glErr=true;tilesSoon();kick()}else initBase()},4000);return}
 try{glStyle=styleUrl();gl=new maplibregl.Map({container:'mapBase',style:glStyle,center:[C.lng,C.lat],zoom:glZoom(),bearing:C.brg,interactive:false,attributionControl:false,fadeDuration:0,maxZoom:24,pitchWithRotate:false,dragRotate:false});
  gl.on('load',()=>{setStat('');kick()});
  gl.on('idle',()=>{if(gl&&gl.isStyleLoaded())setStat('')});
  gl.on('error',e=>{if(gl&&!gl.isStyleLoaded())setStat('Couldn’t load the map. Tap to retry')});
  glKey=''}
 catch(e){gl=null;glErr=true;console.warn('MapLibre failed',e);tilesSoon()}}
function syncBase(){if(!hasView)return;if(!gl){initBase();return}
 const want=styleUrl();if(want!==glStyle){glStyle=want;gl.setStyle(want)}
 const k=C.lat.toFixed(7)+'|'+C.lng.toFixed(7)+'|'+C.mpp.toFixed(5)+'|'+C.brg.toFixed(2)+'|'+W+'|'+H;if(k===glKey)return;glKey=k;
 gl.jumpTo({center:[C.lng,C.lat],zoom:glZoom(),bearing:C.brg});gl.redraw()}
/* ---- drawing ---- */
function pinShape(x,y,color,s,letter){g.save();g.translate(x,y);g.scale(s,s);g.shadowColor='rgba(0,0,0,.3)';g.shadowBlur=8;g.shadowOffsetY=3;
 g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-5,-9,-15,-14,-15,-25);g.arc(0,-25,15,Math.PI,0);g.bezierCurveTo(15,-14,5,-9,0,0);g.closePath();g.fillStyle=color;g.fill();
 g.shadowColor='transparent';g.lineWidth=3;g.strokeStyle='#fff';g.stroke();
 g.fillStyle='#fff';g.beginPath();g.arc(0,-25,8.5,0,7);g.fill();g.fillStyle=color;g.font='800 12px Poppins,system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(letter,0,-24.5);g.restore()}
const SPEC={motorway:14,trunk:12,primary:11,secondary:9,tertiary:8,unclassified:6,residential:6,living_street:5,service:4,pedestrian:4,track:3,cycleway:2.5,footway:2,path:2,steps:2};
const THIN={footway:1,path:1,steps:1,cycleway:1,track:1};
function visibleTiles(){if(!hasView||!W||C.mpp>MAXMPP)return[];const cs=[toG(0,0),toG(W,0),toG(0,H),toG(W,H)],ln=cs.map(c=>c.lng),la=cs.map(c=>c.lat),i0=Math.floor(Math.min(...ln)/TS),i1=Math.floor(Math.max(...ln)/TS),j0=Math.floor(Math.min(...la)/TS),j1=Math.floor(Math.max(...la)/TS);if((i1-i0+1)*(j1-j0+1)>16)return[];const o=[];for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++)o.push([i,j]);return o}
function drawBase(){g.save();g.translate(W/2,H/2);g.rotate(-C.brg*RAD);g.translate(-W/2,-H/2);const mg=Math.hypot(W,H),ml=mLng(),k=1/C.mpp,hw=W/2,hh=H/2,px=lng=>hw+(lng-C.lng)*ml*k,py=lat=>hh-(lat-C.lat)*MLAT*k,by={w:[],p:[],r:[],b:[]};let any=false;
 for(const[i,j]of visibleTiles()){const t=tiles.get(i+','+j);if(!t||!t.ok)continue;any=true;
  for(const w of t.ways){const x0=px(w.bb[1]),x1=px(w.bb[3]),y0=py(w.bb[2]),y1=py(w.bb[0]);if(x1<-mg||x0>W+mg||y1<-mg||y0>H+mg)continue;w.x0=x0;w.x1=x1;w.y0=y0;w.y1=y1;by[w.k].push(w)}}
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
 g.restore();return any}
function drawHl(){if(!hl)return;g.beginPath();for(const poly of hl)for(const ring of poly){ring.forEach((c,n)=>{const[x,y]=toS(c[1],c[0]);n?g.lineTo(x,y):g.moveTo(x,y)});g.closePath()}
 g.fillStyle='rgba(240,138,36,.28)';g.fill('evenodd');g.strokeStyle='#f08a24';g.lineWidth=2.5;g.lineJoin='round';g.stroke()}
function bldIcon(b,x,y){const n=b.cnt||0;g.save();g.translate(x,y);g.shadowColor='rgba(0,0,0,.3)';g.shadowBlur=8;g.shadowOffsetY=3;
 g.beginPath();g.roundRect?g.roundRect(-15,-15,30,30,9):g.rect(-15,-15,30,30);g.fillStyle='#f08a24';g.fill();g.shadowColor='transparent';g.lineWidth=3;g.strokeStyle='#fff';g.stroke();
 g.fillStyle='#fff';g.fillRect(-7,-9,14,17);g.fillStyle='#f08a24';for(const[wx,wy]of[[-4.5,-6],[1,-6],[-4.5,-1],[1,-1]])g.fillRect(wx,wy,3.5,3);g.fillStyle='#fff';g.fillRect(-2,4,4,4);
 if(n>0){g.beginPath();g.arc(13,-13,8.5,0,7);g.fillStyle='#fff';g.fill();g.strokeStyle='#f08a24';g.lineWidth=2;g.stroke();g.fillStyle='#b05a00';g.font='800 10px Poppins,system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(n>99?'99+':String(n),13,-12.5)}
 g.restore();
 if(C.mpp<1.6&&b.n){g.font='700 11px Poppins,system-ui,sans-serif';g.textAlign='center';g.textBaseline='top';g.lineJoin='round';g.lineWidth=3;g.strokeStyle=col.bg;g.strokeText(b.n,x,y+19);g.fillStyle=col.ink;g.fillText(b.n,x,y+19)}}
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
 if(!base){const R=Math.hypot(W,H)/2;g.save();g.translate(W/2,H/2);g.rotate(-C.brg*RAD);g.translate(-W/2,-H/2);
 for(let k=Math.floor((X0-R*C.mpp)/st),e=Math.ceil((X0+R*C.mpp)/st);k<=e;k++){const x=Math.round(W/2+(k*st-X0)/C.mpp)+.5;g.strokeStyle=k%5===0?col.g2:col.g1;g.beginPath();g.moveTo(x,H/2-R);g.lineTo(x,H/2+R);g.stroke()}
 for(let k=Math.floor((Y0-R*C.mpp)/st),e=Math.ceil((Y0+R*C.mpp)/st);k<=e;k++){const y=Math.round(H/2-(k*st-Y0)/C.mpp)+.5;g.strokeStyle=k%5===0?col.g2:col.g1;g.beginPath();g.moveTo(W/2-R,y);g.lineTo(W/2+R,y);g.stroke()}g.restore()}
 if(!hasView)return;
 drawHl();drawRoute();
 if(me){const[x,y]=toS(me.lat,me.lng),ar=me.acc/C.mpp;if(ar>10){g.fillStyle='#3b82f622';g.strokeStyle='#3b82f655';g.lineWidth=1;g.beginPath();g.arc(x,y,ar,0,7);g.fill();g.stroke()}
  const p=(t/1400)%1;g.strokeStyle='rgba(59,130,246,'+(.5*(1-p)).toFixed(2)+')';g.lineWidth=3;g.beginPath();g.arc(x,y,9+p*16,0,7);g.stroke();
  const hd=curHdg();if(hd!=null){const a=(hd-C.brg)*RAD-Math.PI/2,gr=g.createRadialGradient(x,y,4,x,y,34);gr.addColorStop(0,'rgba(59,130,246,.55)');gr.addColorStop(1,'rgba(59,130,246,0)');g.fillStyle=gr;g.beginPath();g.moveTo(x,y);g.arc(x,y,34,a-.55,a+.55);g.closePath();g.fill()}
  g.fillStyle='#fff';g.beginPath();g.arc(x,y,9,0,7);g.fill();g.fillStyle='#3b82f6';g.beginPath();g.arc(x,y,6.5,0,7);g.fill()}
 if(found){const[fx,fy]=toS(found.lat,found.lng);pinShape(fx,fy,'#6d4aff',1,'•')}
 if(showBlds())for(const b of blds){const[x,y]=toS(b.lat,b.lng);if(x>-30&&x<W+30&&y>-30&&y<H+30)bldIcon(b,x,y)}
 const L=vis().map(b=>({b,p:toS(b.lat,b.lng)})).filter(o=>o.p[0]>-30&&o.p[0]<W+30&&o.p[1]>-10&&o.p[1]<H+50).sort((a,c)=>a.p[1]-c.p[1]);
 let top=null;for(const o of L){if(o.b.id===sel){top=o;continue}pinShape(o.p[0],o.p[1],BINCOL[o.b.t],1,LET[o.b.t])}
 if(top){const[x,y]=top.p,p=(t/900)%1;g.strokeStyle='rgba(23,165,116,'+(.55*(1-p)).toFixed(2)+')';g.lineWidth=3;g.beginPath();g.ellipse(x,y,6+p*16,3+p*8,0,0,7);g.stroke();pinShape(x,y,BINCOL[top.b.t],1.3,LET[top.b.t])}
 if(lastBrg!==Math.round(C.brg*2)){lastBrg=Math.round(C.brg*2);$('compass').style.transform='rotate('+(-C.brg).toFixed(1)+'deg)'}
 const nice=[1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000].find(s=>s/C.mpp>=60)||50000,k=nice+'|'+Math.round(nice/C.mpp);
 if(k!==lastScale){lastScale=k;$('scTxt').textContent=nice>=1000?nice/1000+' km':nice+' m';$('scBar').style.width=Math.round(nice/C.mpp)+'px'}}
/* ---- camera moves ---- */
function jump(lat,lng,mpp){C.lat=lat;C.lng=lng;C.mpp=clampZ(mpp||C.mpp);hasView=true;$('mapHint').hidden=true;kick();tilesSoon()}
function fly(lat,lng,mpp,ms){if(!hasView)return jump(lat,lng,mpp);const a={lat:C.lat,lng:C.lng,mpp:C.mpp},b={lat,lng,mpp:clampZ(mpp||C.mpp)},t0=performance.now(),d=ms||450;
 anim=t=>{const k=Math.min(1,((t||performance.now())-t0)/d),e=1-Math.pow(1-k,3);C.lat=a.lat+(b.lat-a.lat)*e;C.lng=a.lng+(b.lng-a.lng)*e;C.mpp=a.mpp*Math.pow(b.mpp/a.mpp,e);if(k>=1){anim=null;tilesSoon()}};kick()}
function zoomAt(x,y,f){const p=toG(x,y);C.mpp=clampZ(C.mpp*f);const q=toG(x,y);C.lat+=p.lat-q.lat;C.lng+=p.lng-q.lng;kick();tilesSoon()}
function rotateAt(x,y,deg){const p=toG(x,y);C.brg=((C.brg+deg)%360+360)%360;const q=toG(x,y);C.lat+=p.lat-q.lat;C.lng+=p.lng-q.lng;kick();tilesSoon()}
function pan(dx,dy){const p=toG(W/2-dx,H/2-dy);C.lat=p.lat;C.lng=p.lng;kick();tilesSoon()}
function setAuto(on){auto=on;const b=$('mapAuto');b.classList.toggle('on',auto);b.setAttribute('aria-pressed',auto);b.title=auto?'Auto orientation is on. Rotate with two fingers to turn it off.':'Tap to follow the way you face again';kick()}
function setManual(){if(auto)setAuto(false)}
function fitPts(pts,v){if(!pts.length)return;const la=pts.map(p=>p[0]),ln=pts.map(p=>p[1]),a=Math.min(...la),b=Math.max(...la),c=Math.min(...ln),d=Math.max(...ln),lat=(a+b)/2,lng=(c+d)/2;
 const ml=MLAT*Math.cos(lat*Math.PI/180),diag=Math.hypot((b-a)*MLAT,(d-c)*ml),m=Math.max(diag/Math.min(W*.8,H*(v||.6)*.9),.3); // diagonal, so it fits at any rotation
 jump(lat,lng,m)}
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
 if(ptr.size===2){const[a,b]=[...ptr.values()];gs={d:Math.hypot(a.x-b.x,a.y-b.y)||1,a:Math.atan2(b.y-a.y,b.x-a.x),cum:0,rot:false,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};ptr.forEach(q=>q.moved=true)}});
cv.addEventListener('pointermove',e=>{const q=ptr.get(e.pointerId);if(!q||!hasView)return;const p=pos(e);
 if(ptr.size===1){if(!q.moved&&Math.hypot(p.x-q.sx,p.y-q.sy)>6)q.moved=true;if(q.moved){if(e.shiftKey){rotateAt(W/2,H/2,-(p.x-q.x)*.4);setManual()}else pan(p.x-q.x,p.y-q.y)}q.x=p.x;q.y=p.y}
 else if(ptr.size===2&&gs){q.x=p.x;q.y=p.y;const[a,b]=[...ptr.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1,mx=(a.x+b.x)/2,my=(a.y+b.y)/2,ang=Math.atan2(b.y-a.y,b.x-a.x);
  let da=ang-gs.a;if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;
  pan(mx-gs.mx,my-gs.my);zoomAt(mx,my,gs.d/d);
  gs.cum+=da;if(!gs.rot&&Math.abs(gs.cum)>7*RAD){gs.rot=true;setManual()} // small twists while pinching to zoom are ignored
  if(gs.rot)rotateAt(mx,my,-da/RAD);
  gs={d,a:ang,cum:gs.cum,rot:gs.rot,mx,my}}});
const up=e=>{const q=ptr.get(e.pointerId);if(!q)return;ptr.delete(e.pointerId);if(e.type==='pointerup'&&!q.moved&&ptr.size===0)tap(q.x,q.y);gs=null;ptr.forEach(r=>r.moved=true)};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{if(!hasView)return;e.preventDefault();const p=pos(e);zoomAt(p.x,p.y,Math.exp(e.deltaY*.0015))},{passive:false});
cv.addEventListener('dblclick',e=>{if(!hasView||placing)return;const p=pos(e);zoomAt(p.x,p.y,.5)});
function inPoly(x,y,poly){let ins=false;for(const ring of poly){for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])ins=!ins}}return ins}
/* which building outline is under this point? MapLibre knows what it drew; the Overpass fallback has its own list */
function buildingAt(x,y){const p=toG(x,y);
 if(gl){let fs=[];try{fs=gl.queryRenderedFeatures([x,y])}catch(e){}
  const f=fs.find(f=>f.sourceLayer==='building'&&f.geometry&&(f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon'));
  if(f){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;return{polys,p,name:(f.properties&&f.properties.name)||''}}return null}
 for(const[i,j]of visibleTiles()){const t=tiles.get(i+','+j);if(!t||!t.ok)continue;for(const w of t.ways){if(w.k!=='b')continue;const ring=w.pts.map(q=>[q[1],q[0]]);if(inPoly(p.lng,p.lat,[ring]))return{polys:[[ring]],p,name:w.name||''}}}
 return null}
function tap(x,y){if(!hasView)return;if(placing){const p=toG(x,y);fly(p.lat,p.lng,C.mpp,300);return}
 const L=vis().map(b=>({b,p:toS(b.lat,b.lng)})).sort((a,c)=>c.p[1]-a.p[1]);
 for(const o of L){const dx=x-o.p[0],dy=y-(o.p[1]-24);if(dx*dx+dy*dy<24*24){select(o.b.id,false);return}}
 if(showBlds()){for(const b of blds){const[bx,by]=toS(b.lat,b.lng);if(Math.abs(x-bx)<20&&Math.abs(y-by)<20){deselect();openBuilding(b.id);return}}
  const hit=buildingAt(x,y);
  if(hit){const reg=blds.find(b=>hit.polys.some(poly=>inPoly(b.lng,b.lat,poly)));
   if(reg){deselect();openBuilding(reg.id);return}
   if(canAdmin()){deselect();hl=hit.polys;pendB={lat:hit.p.lat,lng:hit.p.lng,name:hit.name};renderInfo();kick();return}}}
 deselect()}
/* ---- selection + info card ---- */
function binSvgSmall(c){return binSvg(c).replace('class="bin"','width="40" height="40"')}
function mapsUrl(b){return platform()==='ios'?`https://maps.apple.com/?daddr=${b.lat},${b.lng}&dirflg=w`:`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}&travelmode=walking`}
const canAdmin=()=>adminOn();
const canDelete=b=>canAdmin()||(b.mine&&canAdd());
function renderInfo(){const b=bins.find(x=>x.id===sel);
 if(!b&&pendB){$('mapInfo').innerHTML=`<div class="mi"><div style="width:40px;flex:none"><svg viewBox="0 0 24 24" width="40" height="40"><rect width="24" height="24" rx="7" fill="#f08a24"/><path d="M7 18V7h10v11M10 10h1.5M12.5 10H14M10 13h1.5M12.5 13H14" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></div><div class="grow"><b>Building not set up yet</b><br><small class="msg">Set it up to add floors and indoor trash cans.</small></div><button class="x" id="miX" aria-label="Close">✕</button></div><button class="btn sm sun" id="miSetup" style="margin-top:10px;width:100%">Set up this building</button>`;
  $('mapInfo').hidden=false;$('miX').onclick=deselect;$('miSetup').onclick=()=>{$('bnName').value=pendB.name||'';$('bnMsg').textContent='';$('mBldNew').classList.add('on')};return}
 if(!b){$('mapInfo').hidden=true;return}
 const d=me?fmt(dist(me.lat,me.lng,b.lat,b.lng))+' away':'',r=route&&route.bin.id===b.id?route:null;
 let act='';
 if(r&&r.loading)act='<p class="msg" style="margin-top:8px">Finding a walking route…</p>';
 else if(r)act=`<p style="margin-top:8px;font-weight:600">🚶 ${fmt(r.dist)} · about ${Math.max(1,Math.round(r.dist/80))} min walk</p>${r.pts?'':'<p class="msg">Couldn’t load the route. Showing a straight line.</p>'}<div class="stack two" style="margin-top:8px"><a class="btn sm sun" href="${mapsUrl(b)}" target="_blank" rel="noopener">Open in Maps</a><button class="btn out sm" id="miClear" style="width:100%">Clear route</button></div>`;
 else act='<button class="btn sm" id="miWalk" style="margin-top:10px;width:100%">Walk there</button>';
 $('mapInfo').innerHTML=`<div class="mi"><div style="width:40px;flex:none">${binSvgSmall(BINCOL[b.t])}</div><div class="grow"><b>${esc(b.n)}</b>${b.mine?' <span class="tag">YOURS</span>':''}<br><small class="msg">${b.t} · <span class="tagio out">Outside · always open</span>${d?' · '+d:''}</small></div><button class="x" id="miX" aria-label="Close">✕</button></div>${act}${canDelete(b)?'<button class="btn out sm" id="miDel" style="margin-top:8px;width:100%">Delete this bin</button>':''}`;
 $('mapInfo').hidden=false;$('miX').onclick=deselect;const w=$('miWalk');if(w)w.onclick=()=>walkTo(b);const c=$('miClear');if(c)c.onclick=()=>{route=null;renderInfo();kick()};const del=$('miDel');if(del)del.onclick=()=>removeBin(b)}
function select(id,focus){const b=bins.find(x=>x.id===id);if(!b)return;if(b.area==='inside'){deselect();openBuilding(b.bid,b.fid);return}hl=null;pendB=null;sel=id;if(route&&route.bin.id!==id)route=null;renderInfo();
 if(focus){fly(b.lat,b.lng,Math.min(C.mpp,.8))}else{const[x,y]=toS(b.lat,b.lng);if(x<30||x>W-30||y<60||y>H-170)fly(b.lat,b.lng,C.mpp,350)}kick()}
async function walkTo(b){if(!me){const m=await locate(false);if(!m)return}
 const r=route={bin:b,loading:true,pts:null,dist:dist(me.lat,me.lng,b.lat,b.lng)};renderInfo();fitPts([[me.lat,me.lng],[b.lat,b.lng]],.4);
 try{const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),12000),res=await fetch(`${ROUTE}${me.lng},${me.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,{signal:ctl.signal});clearTimeout(to);
  const j=await res.json();if(!res.ok||!j.routes||!j.routes[0])throw new Error('route');r.pts=j.routes[0].geometry.coordinates.map(c=>[c[1],c[0]]);const f=r.pts[0],l=r.pts[r.pts.length-1];r.dist=j.routes[0].distance+dist(me.lat,me.lng,f[0],f[1])+dist(l[0],l[1],b.lat,b.lng)}catch(e){r.pts=null}
 r.loading=false;if(route===r){renderInfo();if(r.pts)fitPts(r.pts.concat([[me.lat,me.lng],[b.lat,b.lng]]),.4);kick()}}
function deselect(){sel=null;route=null;hl=null;pendB=null;$('mapInfo').hidden=true;kick()}
async function removeBin(b){if(!confirm('Delete this bin from the map?'))return;
 try{const{error}=await sb.rpc('delete_my_bin',{p_id:b.id});if(error)throw error;toast('Bin deleted');deselect();await loadBins()}catch(e){toast('Couldn’t delete that bin');SFX.bad()}}
/* ---- list ---- */
function renderList(){const L=visList().map(b=>({b,d:me?dist(me.lat,me.lng,b.lat,b.lng):null}));if(me)L.sort((a,c)=>a.d-c.d);
 let h;
 if(loadErr)h=`<p class="msg">${esc(loadErr)}</p>`;
 else if(loading&&!bins.length)h='<p class="msg">Loading bins…</p>';
 else if(!L.length)h=`<div style="text-align:center">${mascot(80)}<p class="msg">${bins.length?'No bins match that filter yet.':'No bins on the map yet.'+(canAdd()?' Be the first to add one!':'')}</p></div>`;
 else h=`<p class="msg" style="margin:0 0 4px">${L.length} bin${L.length===1?'':'s'}${me?', nearest first':''}</p>`+L.map(({b,d})=>`<button class="li bl" data-id="${b.id}"><div style="width:38px;flex:none">${binSvgSmall(BINCOL[b.t]).replace('width="40" height="40"','width="38" height="38"')}</div><div class="grow"><b>${esc(b.n)}</b>${b.mine?' <span class="tag">YOURS</span>':''}<br><small>${b.t}${d!=null?' · '+fmt(d):''}</small> ${b.area==='inside'?`<span class="tagio in">Inside · ${esc(bldName(b.bid))}${floorOf(b.fid)?' · '+esc(floorOf(b.fid).label):''}</span>`:'<span class="tagio out">Outside</span>'}</div></button>`).join('');
 $('binList').innerHTML=h;$('binList').querySelectorAll('.bl').forEach(el=>el.onclick=()=>{select(+el.dataset.id,true);const b=bins.find(x=>x.id===+el.dataset.id);if(b&&b.area==='outside')wrap.scrollIntoView({behavior:'smooth',block:'center'})})}
const LEGACY='id,name,category,lat,lng,created_by',NEWCOLS=LEGACY+',area,building_id,floor_id';
function updateCount(err){const o=bins.filter(b=>b.area==='outside').length,i=bins.length-o,n=bins.length;
 $('mapCount').innerHTML=err?'<span>Couldn’t count the trash cans</span>':`<b>${n}</b> trash can${n===1?'':'s'} on campus <span>· ${o} outside (always open) · ${i} inside (may be closed)</span>`;
 $('homeBinsN').textContent=err?'–':n;$('homeBinsSub').textContent=err?'Trash cans on campus':`trash can${n===1?'':'s'} on campus · ${o} outside, ${i} inside`}
function loadBins(){if(loadP||!sb)return loadP;loading=true;renderList();
 loadP=(async()=>{
  try{let r=await sb.from('bins').select(NEWCOLS).not('lat','is',null).not('lng','is',null).order('id',{ascending:false}).limit(1000);
   if(r.error)r=await sb.from('bins').select(LEGACY).not('lat','is',null).not('lng','is',null).order('id',{ascending:false}).limit(1000); // schema_patch_4.sql not run yet
   if(r.error)throw r.error;
   bins=r.data.map(b=>({id:b.id,n:b.name,t:b.category,lat:b.lat,lng:b.lng,mine:!!S&&b.created_by===S.uid,area:b.area||'outside',bid:b.building_id||null,fid:b.floor_id||null}));loadErr='';
   try{const[bl,fl]=await Promise.all([sb.from('buildings').select('id,name,lat,lng').order('id'),sb.from('floors').select('id,building_id,label,level,closed').order('level').order('id')]);
    blds=bl.error?[]:bl.data.map(b=>({id:b.id,n:b.name,lat:b.lat,lng:b.lng}));floors=fl.error?[]:fl.data.map(f=>({id:f.id,b:f.building_id,label:f.label,lv:f.level,closed:f.closed}))}catch(e){blds=[];floors=[]}
   for(const b of blds)b.cnt=bins.filter(x=>x.bid===b.id).length}
  catch(e){console.warn('bins load failed',e);bins=[];blds=[];floors=[];loadErr='Couldn’t load bins. Check your connection (and that the schema patches have been run).'}
  finally{loading=false;loadP=null}
  updateCount(!!loadErr);renderList();if($('mBld').classList.contains('on'))renderBld();if(!hasView&&bins.length&&isOpen)fitAll();kick()})();
 return loadP}
/* ---- location ---- */
function startWatch(){if(watchId!=null||!navigator.geolocation)return;
 watchId=navigator.geolocation.watchPosition(p=>{me={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy};gpsHdg=(typeof p.coords.heading==='number'&&!isNaN(p.coords.heading)&&p.coords.speed>.7)?p.coords.heading:gpsHdg;kick();if(Date.now()-lastFix>8000){lastFix=Date.now();renderList()}},()=>{},{enableHighAccuracy:true,maximumAge:5000})}
function stopWatch(){if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null}}
function locate(zoom){return new Promise(res=>{if(!navigator.geolocation){msg('Location isn’t available on this device.');return res(null)}msg('Finding you…');
 navigator.geolocation.getCurrentPosition(p=>{me={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy};lastFix=Date.now();startWatch();msg('');
  if(zoom!==false)fly(me.lat,me.lng,hasView?Math.min(C.mpp,1):1);renderList();kick();res(me)},
  err=>{msg(err.code===1?'Location is blocked. Allow it in your browser settings so the map can find you.':'Couldn’t get your location. Try again outside or near a window.');res(null)},{enableHighAccuracy:true,timeout:12000,maximumAge:5000})})}
/* ---- adding bins ---- */
function startPlacing(note){placing=true;deselect();$('crossPin').hidden=false;$('placeBar').hidden=false;$('addBtns').hidden=true;$('nearBtn').hidden=true;$('placeTxt').textContent=note||'Drag the map so the pin sits on the bin, then tap Place pin here.';kick()}
function stopPlacing(){placing=false;$('crossPin').hidden=true;$('placeBar').hidden=true;$('nearBtn').hidden=false;refreshPerms()}
$('binHere').onclick=async()=>{if(!canAdd())return;const m=await locate(false);if(!m)return;fly(m.lat,m.lng,.25,500);
 startPlacing(m.acc>40?`GPS is only accurate to about ${Math.round(m.acc)} m here. Drag the map so the pin sits exactly on the bin.`:'Pin is at your spot. Nudge the map if needed, then tap Place pin here.')};
$('binDrop').onclick=async()=>{if(!canAdd())return;if(!hasView){const m=await locate(true);if(!m)return}startPlacing()};
$('placeNo').onclick=stopPlacing;
$('placeOk').onclick=()=>{pend={lat:C.lat,lng:C.lng};stopPlacing();$('binWhere').textContent=(me?fmt(dist(me.lat,me.lng,pend.lat,pend.lng))+' from you. ':'')+'Pick the kind of bin it is.';
 $('binName').value='';$('binMsg').textContent='';$('mBin').classList.add('on')};
$('binType').querySelectorAll('button').forEach(b=>b.onclick=()=>$('binType').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)));
function binErr(e){const m=(e&&e.message)||'';
 if(/duplicate_bin/.test(m))return'There’s already a bin of that type right here.';
 if(/daily_bin_cap/.test(m))return'You’ve added a lot of bins today. Try again tomorrow.';
 if(/not_allowed|42501/.test(m+(e.code||'')))return'You don’t have permission to add bins. Ask the admin for access.';
 if(/bad_floor/.test(m))return'That floor no longer exists.';
 if(/not_authenticated/.test(m))return'You were signed out. Please log in again.';
 if(/find the function|PGRST202/.test(m+(e.code||'')))return'Adding bins isn’t set up yet. The site owner needs to run schema_patch_4.sql.';
 return'Couldn’t save that bin. Check your connection and try again.'}
$('binSave').onclick=async()=>{if(!pend||saving)return;saving=true;$('binMsg').textContent='';
 try{const t=$('binType').querySelector('.on').dataset.t,n=$('binName').value.trim();
  const fl=pend.floor?floorOf(pend.floor):null,{data,error}=await sb.rpc('add_bin',{p_name:n,p_category:t,p_lat:pend.lat,p_lng:pend.lng,p_floor_id:fl?fl.id:null});if(error)throw error;
  closeAll();toast(fl?'Trash can added to '+fl.label+'.':'Bin added. Thanks for mapping it!');SFX.ok();pend=null;await loadBins();
  if(fl)openBuilding(fl.b,fl.id);else if(data&&data.id)select(data.id,false)}
 catch(e){$('binMsg').textContent=binErr(e);SFX.bad()}finally{saving=false}};
/* ---- map style picker ---- */
function renderStyleMenu(){const m=$('styleMenu');m.innerHTML=STYLES.map(([k,n])=>`<button data-k="${k}" class="${k===pick?'on':''}">${n}</button>`).join('');
 m.querySelectorAll('button').forEach(b=>b.onclick=()=>{pick=b.dataset.k;store.set('bb3:mapstyle',pick);m.hidden=true;renderStyleMenu();glKey='';kick()})}
$('mapStyleBtn').onclick=()=>{const m=$('styleMenu');m.hidden=!m.hidden;if(!m.hidden)renderStyleMenu()};
/* ---- search: your bins by name first, then places. Suggestions appear as you type (Photon, a free OpenStreetMap geocoder, no key);
   if Photon is down, pressing Search falls back to OpenStreetMap Nominatim. ---- */
let srSeq=0,srTmr=0,srCtl=null,lastNom=0;
function goTo(lat,lng,name){found={lat,lng,name};$('srRes').hidden=true;$('srClear').hidden=false;msg(name?'Showing: '+name:'');fly(lat,lng,Math.min(C.mpp,1.2),600);kick()}
$('srClear').onclick=()=>{srSeq++;found=null;$('srRes').hidden=true;$('srClear').hidden=true;$('srQ').value='';msg('');kick()};
const photonPlace=f=>{const p=f.properties||{},c=f.geometry&&f.geometry.coordinates;if(!c)return null;
 const st=[p.street&&(p.housenumber?p.housenumber+' ':'')+p.street,p.city||p.town||p.village||p.district,p.state,p.country].filter(x=>x&&x!==p.name);
 return{name:p.name||st[0]||'Place',sub:st.join(', '),lat:c[1],lng:c[0]}};
async function getJson(url,ms){const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),ms||8000);if(srCtl)srCtl.abort();srCtl=ctl;
 try{const r=await fetch(url,{signal:ctl.signal});if(!r.ok)throw new Error('http');return await r.json()}finally{clearTimeout(to)}}
async function findPlaces(q,allowFallback){
 const bias=hasView?`&lat=${C.lat.toFixed(5)}&lon=${C.lng.toFixed(5)}`:'';
 try{const j=await getJson('https://photon.komoot.io/api/?limit=6&lang=en&q='+encodeURIComponent(q)+bias);return(j.features||[]).map(photonPlace).filter(Boolean)}
 catch(e){if(e.name==='AbortError'&&srCtl&&srCtl.signal.aborted&&!allowFallback)throw e;if(!allowFallback)throw e}
 const wait=1100-(Date.now()-lastNom);if(wait>0)await new Promise(r=>setTimeout(r,wait));lastNom=Date.now();
 const vb=hasView?`&viewbox=${(C.lng-.3).toFixed(4)},${(C.lat+.3).toFixed(4)},${(C.lng+.3).toFixed(4)},${(C.lat-.3).toFixed(4)}`:'';
 const j=await getJson('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q='+encodeURIComponent(q)+vb,10000);
 return j.map(p=>({name:p.name||p.display_name.split(',')[0],sub:p.display_name,lat:+p.lat,lng:+p.lon}))}
async function doSearch(auto){const q=$('srQ').value.trim();const box=$('srRes');if(q.length<(auto?3:2)){if(auto)box.hidden=true;return}
 const my=++srSeq,local=bins.filter(b=>b.n&&b.n.toLowerCase().includes(q.toLowerCase())).slice(0,3);let places=[],note='';
 const row=(i,t,sub)=>`<button data-i="${i}"><b>${esc(t)}</b><small>${esc(sub)}</small></button>`;
 const paint=()=>{box.hidden=false;box.innerHTML=local.map((b,i)=>row('b'+i,b.n,b.t+' bin')).join('')+places.map((p,i)=>row('p'+i,p.name,p.sub)).join('')+(note?`<p class="msg" style="margin:6px 10px">${note}</p>`:'');
  box.querySelectorAll('button').forEach(el=>el.onclick=()=>{const k=el.dataset.i,n=+k.slice(1);if(k[0]==='b'){box.hidden=true;select(local[n].id,true)}else goTo(places[n].lat,places[n].lng,places[n].name)})};
 note='Searching places…';paint();
 try{places=await findPlaces(q,!auto);if(my!==srSeq)return;note=!places.length&&!local.length?'No matches. Try a building name, street or city.':''}
 catch(e){if(my!==srSeq)return;note=auto?'':'Couldn’t search places right now. Try again in a moment.'}
 paint()}
$('srGo').onclick=()=>{clearTimeout(srTmr);doSearch(false)};
$('srQ').addEventListener('input',()=>{clearTimeout(srTmr);const v=$('srQ').value.trim();if(v.length<3){srSeq++;$('srRes').hidden=true;return}srTmr=setTimeout(()=>doSearch(true),350)});
$('srQ').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(srTmr);doSearch(false)}});
/* ---- phone orientation: the map turns to match the way you face ---- */
function onOrient(e){let h=null;
 if(typeof e.webkitCompassHeading==='number'&&!isNaN(e.webkitCompassHeading))h=e.webkitCompassHeading; // iPhone: already tilt-corrected
 else if(e.alpha!=null&&(e.absolute||e.type==='deviceorientationabsolute')){
  const a=e.alpha*RAD,b=(e.beta||0)*RAD,gm=(e.gamma||0)*RAD;
  if(Math.abs(e.beta||0)<40)h=(360-e.alpha)%360; // phone roughly flat: the top edge points where you face
  else{const vx=-Math.cos(a)*Math.sin(gm)-Math.sin(a)*Math.sin(b)*Math.cos(gm),vy=-Math.sin(a)*Math.sin(gm)+Math.cos(a)*Math.sin(b)*Math.cos(gm);h=(Math.atan2(vx,vy)/RAD+360)%360} // phone held upright: the direction the back camera faces
 }
 if(h==null)return;const so=(screen.orientation&&screen.orientation.angle)||0;h=(h+so+360)%360; // landscape
 heading=h;if(auto)kick()}
function listenOrient(){if(orientOn)return;orientOn=true;addEventListener('deviceorientationabsolute',onOrient,true);addEventListener('deviceorientation',onOrient,true)}
function requestCompass(){listenOrient(); // listening is harmless: iPhones send nothing until you allow it
 const D=window.DeviceOrientationEvent;
 if(D&&typeof D.requestPermission==='function')D.requestPermission().then(r=>{if(r==='denied')msg('Compass access was denied, so the map can’t follow your direction. You can still rotate it with two fingers.')}).catch(()=>{})}
$('mapAuto').onclick=()=>{requestCompass();setAuto(true);setTimeout(()=>{if(auto&&curHdg()==null)msg('This device didn’t give us a compass reading. Walk a few steps (we’ll use your direction of travel) or rotate with two fingers.');else if(auto)msg('')},2000)};
$('compass').onclick=()=>{setAuto(false);const a=C.brg>180?C.brg-360:C.brg,t0=performance.now(),d=300;anim=t=>{const k=Math.min(1,((t||performance.now())-t0)/d);C.brg=((a*(1-(1-Math.pow(1-k,3)))%360)+360)%360;if(k>=1){C.brg=0;anim=null}};kick()};
/* ---- inside / outside filter ---- */
const AREA_NOTE={All:'Outside bins are always available. Inside bins can be unavailable if that area is closed.',Outside:'Outside bins are open to everyone, all day.',Inside:'Inside bins can be unavailable when the building or floor is closed. Tap a building to see its floors.'};
function paintArea(){document.querySelectorAll('#areaSeg button').forEach(x=>x.classList.toggle('on',x.dataset.a===areaF));$('areaNote').textContent=AREA_NOTE[areaF]}
document.querySelectorAll('#areaSeg button').forEach(b=>b.onclick=()=>{areaF=b.dataset.a;paintArea();if(sel!=null&&!vis().some(x=>x.id===sel))deselect();renderList();kick()});
/* ---- permissions ---- */
function refreshPerms(){const a=canAdd();$('addBtns').hidden=!a||placing;$('addNote').hidden=a;$('adminBar').hidden=!canAdmin();renderList();renderInfo();if($('mBld').classList.contains('on'))renderBld()}
/* ---- buildings and floors ---- */
const bFloors=id=>floors.filter(f=>f.b===id).slice().sort((a,c)=>a.lv-c.lv||a.id-c.id);
function floorLevel(label,id){const t=label.trim(),n=parseInt(t,10);if(/^-?\d+$/.test(t))return n;if(/^(b|basement|lower|lg|ll)/i.test(t))return -1;if(/^(g|ground|lobby)/i.test(t))return 0;const fl=bFloors(id);return fl.length?Math.max(...fl.map(f=>f.lv))+1:1}
function openBuilding(id,floorId){const b=blds.find(x=>x.id===id);if(!b)return;if(curB!==id)curFl=null;curB=id;const fl=bFloors(id);
 curFl=fl.some(f=>f.id===floorId)?floorId:fl.some(f=>f.id===curFl)?curFl:(fl[0]?fl[0].id:null);renderBld();$('mBld').classList.add('on')}
async function bAct(fn,okMsg){try{await fn();if(okMsg)toast(okMsg);SFX.ok();await loadBins()}catch(e){const m=(e&&e.message)||'';toast(/duplicate_floor/.test(m)?'That floor already exists.':/not_allowed|42501/.test(m+(e.code||''))?'Only the admin can do that.':/find the function|PGRST202/.test(m+(e.code||''))?'Run schema_patch_4.sql in Supabase first.':'Couldn’t save that. Try again.');SFX.bad()}}
function renderBld(){const b=blds.find(x=>x.id===curB);if(!b){$('mBld').classList.remove('on');return}
 const fl=bFloors(b.id),f=fl.find(x=>x.id===curFl)||null,inside=bins.filter(x=>x.bid===b.id),here=f?inside.filter(x=>x.fid===f.id):[],adm=canAdmin();
 const near=bins.filter(x=>x.area==='outside'&&dist(b.lat,b.lng,x.lat,x.lng)<80).map(x=>({x,d:dist(b.lat,b.lng,x.lat,x.lng)})).sort((a,c)=>a.d-c.d).slice(0,4);
 let h=`<div class="mh"><div><h3>${esc(b.n)}</h3><p class="msg" style="margin-top:2px">${fl.length} floor${fl.length===1?'':'s'} · ${inside.length} trash can${inside.length===1?'':'s'} inside</p></div><button class="x2" data-close aria-label="Close">✕</button></div>
 <div class="note">Inside trash cans can be unavailable when a floor or room is closed. Outside bins are always available.</div>`;
 h+=fl.length?`<div class="fchips" role="tablist" aria-label="Floors">${fl.map(x=>`<button role="tab" class="${x.id===curFl?'on':''} ${x.closed?'cl':''}" data-f="${x.id}" aria-selected="${x.id===curFl}">${esc(x.label)}</button>`).join('')}</div>`:`<p class="msg">No floors yet.${adm?' Add the first one below.':''}</p>`;
 if(adm)h+=`<div class="inl"><input type="text" id="bFlName" maxlength="20" placeholder="New floor, e.g. 1, 2, Basement" aria-label="New floor name"><button class="btn sm" id="bFlAdd">Add floor</button></div>`;
 if(f){h+=`<h4>${esc(f.label)} ${f.closed?'<span class="tagio closed">Marked closed</span>':''}</h4>`;
  if(f.closed)h+=`<div class="note bad">This floor is marked closed, so its trash cans may not be reachable right now. Use an outside bin instead.</div>`;
  h+=here.length?here.map(x=>`<div class="li"><div style="width:38px;flex:none">${binSvgSmall(BINCOL[x.t]).replace('width="40" height="40"','width="38" height="38"')}</div><div class="grow"><b>${esc(x.n)}</b>${x.mine?' <span class="tag">YOURS</span>':''}<br><small>${x.t}</small></div>${canDelete(x)?`<button class="x2" data-del="${x.id}" aria-label="Delete this bin">🗑</button>`:''}</div>`).join(''):`<p class="msg">No trash cans on this floor yet.</p>`;
  if(canAdd())h+=`<button class="btn sun" id="bAddBin" style="margin-top:10px">Add a trash can on ${esc(f.label)}</button>`;
  if(adm)h+=`<div class="stack two" style="margin-top:10px"><button class="btn out sm" id="bFlClose" style="width:100%">${f.closed?'Mark open':'Mark closed'}</button><button class="btn danger sm" id="bFlDel" style="width:100%">Delete floor</button></div>`}
 h+=`<h4>Outside nearby <span class="tagio out">always available</span></h4>`+(near.length?near.map(o=>`<button class="li bl" data-o="${o.x.id}"><div style="width:38px;flex:none">${binSvgSmall(BINCOL[o.x.t]).replace('width="40" height="40"','width="38" height="38"')}</div><div class="grow"><b>${esc(o.x.n)}</b><br><small>${o.x.t} · ${fmt(o.d)} away</small></div></button>`).join(''):`<p class="msg">No outside bins mapped within 80 m yet.</p>`);
 if(adm)h+=`<h4>Building (admin)</h4><div class="inl"><input type="text" id="bRen" maxlength="60" value="${esc(b.n)}" aria-label="Building name"><button class="btn out sm" id="bRenGo">Rename</button></div><button class="btn danger sm" id="bDel" style="width:100%">Delete building and its floors</button>`;
 $('bBody').innerHTML=h;const q=sl=>$('bBody').querySelector(sl);
 $('bBody').querySelectorAll('[data-close]').forEach(x=>x.onclick=closeAll);
 $('bBody').querySelectorAll('[data-f]').forEach(x=>x.onclick=()=>{curFl=+x.dataset.f;renderBld()});
 $('bBody').querySelectorAll('[data-o]').forEach(x=>x.onclick=()=>{closeAll();select(+x.dataset.o,true);wrap.scrollIntoView({behavior:'smooth',block:'center'})});
 $('bBody').querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>{if(!confirm('Delete this trash can?'))return;bAct(async()=>{const{error}=await sb.rpc('delete_my_bin',{p_id:+x.dataset.del});if(error)throw error},'Bin deleted')});
 const add=q('#bFlAdd');if(add){const go=()=>{const v=q('#bFlName').value.trim();if(!v)return;bAct(async()=>{const{data,error}=await sb.rpc('admin_add_floor',{p_building:b.id,p_label:v,p_level:floorLevel(v,b.id)});if(error)throw error;curFl=data&&data.id||curFl},'Floor added').then(()=>renderBld())};add.onclick=go;q('#bFlName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go()}})}
 const ab=q('#bAddBin');if(ab)ab.onclick=()=>{pend={lat:b.lat,lng:b.lng,floor:f.id};$('binWhere').textContent='Adding to '+b.n+' · '+f.label+'. Pick the kind of trash can it is.';$('binName').value='';$('binMsg').textContent='';$('mBin').classList.add('on')};
 const fc=q('#bFlClose');if(fc)fc.onclick=()=>bAct(async()=>{const{error}=await sb.rpc('admin_set_floor_closed',{p_id:f.id,p_closed:!f.closed});if(error)throw error},f.closed?'Marked open':'Marked closed');
 const fd=q('#bFlDel');if(fd)fd.onclick=()=>{if(!confirm('Delete floor '+f.label+' and every trash can on it?'))return;bAct(async()=>{const{error}=await sb.rpc('admin_delete_floor',{p_id:f.id});if(error)throw error;curFl=null},'Floor deleted')};
 const rn=q('#bRenGo');if(rn)rn.onclick=()=>{const v=q('#bRen').value.trim();if(!v||v===b.n)return;bAct(async()=>{const{error}=await sb.rpc('admin_rename_building',{p_id:b.id,p_name:v});if(error)throw error},'Renamed')};
 const bd=q('#bDel');if(bd)bd.onclick=()=>{if(!confirm('Delete '+b.n+', all its floors and every trash can inside it?'))return;bAct(async()=>{const{error}=await sb.rpc('admin_delete_building',{p_id:b.id});if(error)throw error;curB=null;curFl=null;closeAll()},'Building deleted')}}
$('bnSave').onclick=async()=>{const n=$('bnName').value.trim();if(!n){$('bnMsg').textContent='Enter a name.';return}if(!pendB)return;$('bnSave').disabled=true;$('bnMsg').textContent='';
 try{const{data,error}=await sb.rpc('admin_add_building',{p_name:n,p_lat:pendB.lat,p_lng:pendB.lng});if(error)throw error;closeAll();SFX.ok();toast('Building created. Now add its floors.');deselect();await loadBins();if(data&&data.id)openBuilding(data.id)}
 catch(e){const m=(e&&e.message)||'';$('bnMsg').textContent=/duplicate_building/.test(m)?'A building is already set up right here.':/find the function|PGRST202/.test(m+(e.code||''))?'Run schema_patch_4.sql in Supabase first.':/not_allowed|42501/.test(m+(e.code||''))?'Only the admin can do that.':'Couldn’t save. Try again.';SFX.bad()}
 finally{$('bnSave').disabled=false}};
$('binCancel').onclick=()=>{$('mBin').classList.remove('on');if(pend&&pend.floor&&curB)return;pend=null}; // cancelling from a floor goes back to the building sheet
/* ---- buttons + lifecycle ---- */
$('nearBtn').onclick=async()=>{if(!me){const m=await locate(false);if(!m)return}const L=bins.filter(b=>b.area==='outside'&&inCat(b));if(!L.length){msg('No outside bins of that type yet.');return}msg('');
 const n=L.reduce((a,b)=>dist(me.lat,me.lng,b.lat,b.lng)<dist(me.lat,me.lng,a.lat,a.lng)?b:a);select(n.id,false);walkTo(n)};
$('mapLoc').onclick=()=>{requestCompass();locate(true)};$('hintLoc').onclick=()=>{requestCompass();locate(true)};
$('zIn').onclick=()=>hasView&&fly(C.lat,C.lng,C.mpp*.5,250);$('zOut').onclick=()=>hasView&&fly(C.lat,C.lng,C.mpp*2,250);
document.querySelectorAll('#binSeg button').forEach(b=>b.onclick=()=>{filter=b.dataset.f;document.querySelectorAll('#binSeg button').forEach(x=>x.classList.toggle('on',x===b));if(sel!=null&&!vis().some(x=>x.id===sel))deselect();renderList();kick()});
new MutationObserver(()=>{readCol();kick()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener&&matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readCol();kick()});
function open(){isOpen=true;readCol();resize();if(me)startWatch();$('mapHint').hidden=hasView;requestCompass();setAuto(auto);paintArea();refreshPerms();loadBins();syncBase();kick();tilesSoon()}
function close(){isOpen=false;stopWatch();if(raf){cancelAnimationFrame(raf);raf=0}if(placing)stopPlacing()}
readCol();paintArea();
return{open,close,load:()=>loadBins(),refreshPerms,refreshList:()=>renderList()}})();
