/* BinBuddy NFC verification.
   Stickers hold a link like  https://YOUR-SITE/?nfc=<secret code>.
   Android Chrome: the app reads the sticker itself (Web NFC). iPhone/other: tapping the sticker opens this site, which records the tap;
   then the person comes back and presses the button. The server decides everything (see supabase/schema_patch_5.sql). */
window.BBNFC=(()=>{
const supported=()=>'NDEFReader' in window&&window.isSecureContext;
const CODE=/[?&]nfc=([a-f0-9]{32})/i,RAW=/^[a-f0-9]{32}$/i;
const baseUrl=()=>location.origin+location.pathname.replace(/index\.html$/,'');
const tagUrl=c=>baseUrl()+'?nfc='+c;
const hex=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
function codeFrom(message){for(const r of message.records||[]){if(!['url','text','absolute-url','mime'].includes(r.recordType)||!r.data)continue;
  let t='';try{t=new TextDecoder(r.encoding||'utf-8').decode(r.data)}catch(e){continue}const m=t.match(CODE);if(m)return m[1].toLowerCase();if(RAW.test(t.trim()))return t.trim().toLowerCase()}return null}
function checkinErr(e){const m=(e&&e.message)||'';
 if(/unknown_tag/.test(m))return'That sticker isn’t registered with BinBuddy.';
 if(/rate_limited/.test(m))return'Too many taps. Wait a bit and try again.';
 if(/not_authenticated/.test(m))return'You were signed out. Please log in again.';
 if(/find the function|PGRST202/.test(m+(e.code||'')))return'NFC isn’t set up yet. The site owner needs to run schema_patch_5.sql.';
 return'Couldn’t check that sticker. Check your connection and try again.'}
async function checkin(code){const{data,error}=await sb.rpc('nfc_checkin',{p_code:code});if(error)throw error;return data}

/* ---------- verify before points ---------- */
let vState=null;
function vSet(title,text,busy){if(vState){vState.t=title;vState.d=text;vState.b=!!busy}$('nfT').textContent=title;$('nfD').textContent=text;$('nfRing').classList.toggle('busy',!!busy)}
async function handleCode(c){const s=vState;if(!s)return;const prev=[s.t,s.d,s.b];
 try{vSet('Checking…','',true);const d=await checkin(c);if(vState!==s)return;vSet('Verified ✓',d.bin_name+' · '+d.category,false);$('nfMsg').textContent='';SFX.ok();setTimeout(()=>finish(true),700)}
 catch(err){if(vState!==s)return;$('nfMsg').textContent=checkinErr(err);SFX.bad();vSet(prev[0],prev[1],prev[2])}}
function finish(ok){if(!vState)return;const s=vState;vState=null;try{s.ctl&&s.ctl.abort()}catch(e){}document.removeEventListener('visibilitychange',s.vis);$('mNfc').classList.remove('on');s.res(ok)}
function verify(){return new Promise(res=>{
 if(vState)finish(false);
 const s=vState={res,ctl:null,vis:null};
 $('nfMsg').textContent='';$('nfDone').hidden=true;$('nfRetry').hidden=true;$('nfQr').className=supported()?'btn out':'btn sun';$('mNfc').classList.add('on');
 const fallback=why=>{$('nfRing').classList.remove('busy');vSet('Verify at the bin',(why?why+' ':'')+'Scan the QR code on the bin with your camera. No QR code? Tap the NFC sticker with your phone (it opens BinBuddy in your browser), come back here, and press the last button.');$('nfDone').hidden=false;
  s.vis=()=>{if(document.visibilityState==='visible'&&vState===s)finish(true)};
  let away=false;const mark=()=>{if(document.visibilityState==='hidden')away=true};document.addEventListener('visibilitychange',mark);
  s.vis=()=>{if(document.visibilityState==='visible'&&away&&vState===s){document.removeEventListener('visibilitychange',mark);finish(true)}};document.addEventListener('visibilitychange',s.vis)};
 if(!supported()){fallback('');return}
 const start=async()=>{if(vState!==s)return;$('nfRetry').hidden=true;vSet('Tap the sticker on the bin','Hold the back of your phone against the NFC sticker on the bin.',true);
  s.ctl=new AbortController();
  try{const r=new NDEFReader();await r.scan({signal:s.ctl.signal});
   r.onreading=e=>{const c=codeFrom(e.message);if(!c){$('nfMsg').textContent='That sticker isn’t a BinBuddy sticker.';return}handleCode(c)};
   r.onreadingerror=()=>{$('nfMsg').textContent='Couldn’t read that. Hold still and try again.'}}
  catch(err){if(vState!==s)return;
   if(err&&err.name==='AbortError')return;
   if(err&&(err.name==='NotAllowedError'||err.name==='SecurityError')){vSet('Allow NFC','Tap Start NFC and allow NFC when your browser asks.',false);$('nfRetry').hidden=false;return}
   fallback(err&&err.name==='NotSupportedError'?'NFC seems to be off. Turn it on in your phone’s settings, or use this way:':'')}};
 $('nfRetry').onclick=start;start()})}
$('nfQr').onclick=async()=>{if(!vState)return;const c=await scanQr();if(c&&vState)handleCode(c)};
$('nfCancel').onclick=()=>finish(false);$('nfDone').onclick=()=>finish(true);
document.querySelectorAll('#mNfc').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)finish(false)}));

/* ---------- scan a QR code with the camera (works on iPhone too) ---------- */
let qrStream=null,qrRun=0;
function stopQr(){qrRun++;if(qrStream){qrStream.getTracks().forEach(t=>t.stop());qrStream=null}const v=$('qrVid');v.srcObject=null;$('mQr').classList.remove('on')}
function scanQr(){return new Promise(async res=>{
 const my=++qrRun;$('qrMsg').textContent='Starting camera…';$('mQr').classList.add('on');
 const done=v=>{if(qrRun===my)stopQr();res(v)};$('qrCancel').onclick=()=>done(null);
 let det=null;try{det=new BarcodeDetector({formats:['qr_code']})}catch(e){}
 const zx=window.ZXingWASM&&ZXingWASM.readBarcodes;
 if(!det&&!zx){$('qrMsg').textContent='The scanner is still loading. Check your connection and try again.';return}
 try{qrStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280}}})}
 catch(e){$('qrMsg').textContent='Camera is blocked. Allow camera access and try again.';return}
 if(qrRun!==my){qrStream.getTracks().forEach(t=>t.stop());qrStream=null;return}
 const v=$('qrVid');v.srcObject=qrStream;try{await v.play()}catch(e){}
 $('qrMsg').textContent='Point the camera at the QR code on the bin.';
 const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});let k=0;
 while(qrRun===my&&$('mQr').classList.contains('on')){
  try{if(v.videoWidth){let t=null;
    if(det){const r=await det.detect(v);if(r.length)t=r[0].rawValue}
    else{const f=Math.min(1,720/v.videoWidth);cv.width=Math.round(v.videoWidth*f);cv.height=Math.round(v.videoHeight*f);cx.drawImage(v,0,0,cv.width,cv.height);
     const r=await ZXingWASM.readBarcodes(cx.getImageData(0,0,cv.width,cv.height),{formats:['QRCode'],tryHarder:(++k%3===0),tryInvert:true,maxNumberOfSymbols:1});if(r.length)t=r[0].text}
    if(t){const m=t.match(CODE)||(RAW.test(t.trim())?[0,t.trim()]:null);if(m){if(navigator.vibrate)navigator.vibrate(60);return done(m[1].toLowerCase())}$('qrMsg').textContent='That isn’t a BinBuddy QR code.'}}}catch(e){}
  await new Promise(r=>setTimeout(r,120))}
 if(qrRun===my)stopQr();res(null)})}
/* ---------- admin: make a QR code to print ---------- */
function qrSvg(text){const q=qrcode(0,'M');q.addData(text);q.make();const n=q.getModuleCount(),m=2;let d='';
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))d+=`M${c+m} ${r+m}h1v1h-1z`;
 return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n+m*2} ${n+m*2}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`}
let lastBin={};
function showQr(code){if(typeof qrcode==='undefined'){toast('The QR maker is still loading. Try again in a moment.');return}
 const svg=qrSvg(tagUrl(code)),cap=(lastBin.name||'Bin')+' · '+(lastBin.category||'')+' bin';
 $('qsBox').innerHTML=svg;$('qsCap').textContent=cap;$('mQrShow').classList.add('on');
 $('qsPrint').onclick=()=>{$('qrPrint').innerHTML=`<h1>Scan to verify</h1>${svg}<p><b>${esc(lastBin.name||'Bin')}</b> · ${esc(lastBin.category||'')} bin</p><p>BinBuddy → Add to bin → Scan the bin’s QR code</p>`;window.print()}}
/* ---------- a sticker tapped outside the app (iPhone, or Android when the app wasn't scanning) ---------- */
let pending=null;
try{const q=new URLSearchParams(location.search).get('nfc');if(q&&RAW.test(q)){pending=q.toLowerCase();history.replaceState({},'',location.pathname+location.hash)}}catch(e){}
async function afterLogin(){if(!pending)return;const c=pending;pending=null;
 try{const d=await checkin(c);SFX.ok();openGen('Sticker verified ✓','That was the '+d.bin_name+' ('+d.category+' bin). Go back to the scan screen and tap Add to bin.')}
 catch(e){toast(checkinErr(e));SFX.bad()}}

/* ---------- admin: require switch + sticker manager ---------- */
const adm=e=>{const m=(e&&e.message)||'';return/not_allowed|42501/.test(m+(e.code||''))?'Only the admin account can do that.':/find the function|PGRST202/.test(m+(e.code||''))?'Run schema_patch_5.sql in Supabase first.':/too_many_tags/.test(m)?'That bin already has 10 stickers.':'Something went wrong. Check your connection and try again.'};
async function adminInit(){const sw=$('swNfc');if(!sw)return;
 try{const{data,error}=await sb.rpc('nfc_config');if(error)throw error;const on=!!(data&&data.required);sw.classList.toggle('on',on);sw.setAttribute('aria-checked',on);sw.disabled=false}catch(e){sw.disabled=true;$('nfcAdmMsg').textContent=adm(e)}
 sw.onclick=async()=>{const want=!sw.classList.contains('on');sw.disabled=true;
  try{const{error}=await sb.rpc('admin_set_require_nfc',{p_on:want});if(error)throw error;sw.classList.toggle('on',want);sw.setAttribute('aria-checked',want);toast(want?'NFC check is now required for points':'NFC check is off');SFX.ok()}catch(e){toast(adm(e));SFX.bad()}finally{sw.disabled=false}}}
let tagBin=null,draft=null;
async function adminTags(binId){tagBin=binId;draft=null;$('mNfcAdm').classList.add('on');await renderTags()}
async function renderTags(){const box=$('ntBody');box.innerHTML='<p class="msg">Loading…</p>';
 try{const{data,error}=await sb.rpc('admin_list_nfc_tags',{p_bin_id:tagBin});if(error)throw error;const b=data.bin||{},T=data.tags||[];lastBin=b;
  box.innerHTML=`<p class="msg" style="margin-top:0"><b>${esc(b.name||'Bin')}</b> · ${esc(b.category||'')} · ${b.area==='inside'?'Inside':'Outside'}</p>
  ${T.length?T.map(t=>`<div class="li"><div class="grow"><b>Sticker …${esc(t.tail)}</b><br><small>${t.uses} scan${t.uses==1?'':'s'} · added ${new Date(t.created_at).toLocaleDateString()}</small></div>${t.code?`<button class="btn out sm" data-qr="${esc(t.code)}">QR</button>`:''}<button class="btn danger sm" data-nt="${t.id}" style="margin-left:6px">Remove</button></div>`).join(''):'<p class="msg">No stickers on this bin yet. A sticker can only be used for this bin.</p>'}
  <div id="ntNew"></div><button class="btn sun" id="ntAdd" style="margin-top:12px">${supported()?'Add an NFC sticker (hold it to your phone)':'Add an NFC sticker'}</button><button class="btn out" id="ntQrOnly" style="margin-top:8px">Make a QR code (no sticker)</button><p class="msg" id="ntMsg" role="status"></p>`;
  box.querySelectorAll('[data-nt]').forEach(x=>x.onclick=async()=>{if(!confirm('Remove this sticker? Taps on it will stop working.'))return;try{const{error}=await sb.rpc('admin_delete_nfc_tag',{p_id:+x.dataset.nt});if(error)throw error;toast('Sticker removed');renderTags()}catch(e){toast(adm(e))}});
  box.querySelectorAll('[data-qr]').forEach(x=>x.onclick=()=>showQr(x.dataset.qr));
  $('ntQrOnly').onclick=async()=>{const code=hex();try{await register(code);SFX.ok();await renderTags();showQr(code)}catch(e){const m=$('ntMsg');if(m)m.textContent=adm(e);SFX.bad()}};
  $('ntAdd').onclick=addSticker}catch(e){box.innerHTML=`<p class="msg">${esc(adm(e))}</p>`}}
async function register(code){const{error}=await sb.rpc('admin_register_nfc_tag',{p_bin_id:tagBin,p_code:code});if(error)throw error}
async function addSticker(){const code=hex(),url=tagUrl(code),msg=t=>{const e=$('ntMsg');if(e)e.textContent=t};
 if(supported()){msg('Hold a blank sticker against the back of your phone…');$('ntAdd').disabled=true;
  try{await new NDEFReader().write({records:[{recordType:'url',data:url}]},{overwrite:true,signal:AbortSignal.timeout?AbortSignal.timeout(30000):undefined});
   await register(code);SFX.ok();toast('Sticker written and linked');renderTags()}
  catch(e){console.warn('nfc write',e);msg(/not_allowed|42501|schema/.test((e&&e.message)||'')?adm(e):e&&e.name==='NotAllowedError'?'NFC permission was blocked. Allow it and try again.':e&&e.name==='NotSupportedError'?'NFC is off or this phone can’t write stickers.':'Couldn’t write that sticker. Hold it steady against the phone and try again.');SFX.bad();const a=$('ntAdd');if(a)a.disabled=false}return}
 draft=code;$('ntNew').innerHTML=`<div class="note">This browser can’t write NFC stickers. Write this link with the free <b>NFC Tools</b> app: Write → Add a record → URL → paste the link → Write. Then tap Save.</div><input type="text" id="ntUrl" readonly value="${esc(url)}" aria-label="Link to write" style="margin-top:8px"><div class="stack two" style="margin-top:8px"><button class="btn out sm" id="ntCopy" style="width:100%">Copy link</button><button class="btn sm" id="ntSave" style="width:100%">I wrote it. Save</button></div>`;
 $('ntAdd').hidden=true;$('ntCopy').onclick=async()=>{try{await navigator.clipboard.writeText(url);toast('Link copied')}catch(e){$('ntUrl').select()}};
 $('ntSave').onclick=async()=>{try{await register(draft);draft=null;SFX.ok();toast('Sticker saved');renderTags()}catch(e){msg(adm(e));SFX.bad()}}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-nfc]');if(b){e.preventDefault();adminTags(+b.dataset.nfc)}});
const api={verify,afterLogin,adminInit,adminTags,supported};
// the app may have finished signing in before this file loaded; afterLogin only acts once
setTimeout(()=>{if(typeof S!=='undefined'&&S&&S.uid)afterLogin()},0);
return api})();
