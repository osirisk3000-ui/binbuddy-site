/* Reused from v3: barcode scanning (BarcodeDetector / zxing-wasm) and on-device CLIP analyzer with first-load progress. */
// ---- barcode: native BarcodeDetector if present, else zxing-wasm (fast C++ decoder) ----
const FORMATS=["Code128","Code39","Codabar","ITF","EAN-13","UPC-A","QRCode"]; // trim to your ID's format for max speed
let camStream=null,scanning=false,nativeDet=null;
try{nativeDet=new BarcodeDetector({formats:["code_128","code_39","codabar","itf","ean_13","upc_a","qr_code"]})}catch(e){}
const wasmRead=()=>window.ZXingWASM&&ZXingWASM.readBarcodes;
function stopCam(){scanning=false;if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null}$('cam').style.display='none'}
function gotId(t){stopCam();$('sid').value=t;$('loginMsg').textContent="Got it: "+t+". Tap Create account.";if(navigator.vibrate)navigator.vibrate(80)}
$('scanBtn').onclick=async()=>{
  if(scanning||camStream)return;
  if(!nativeDet&&!wasmRead()){$('loginMsg').textContent="Scanner is still loading. Check your connection and try again.";return}
  try{camStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}})}
  catch(e){$('loginMsg').textContent="Camera is blocked. Allow camera access, upload a barcode photo, or type your ID.";return}
  try{await camStream.getVideoTracks()[0].applyConstraints({advanced:[{focusMode:"continuous"}]})}catch(e){}
  const v=$('cam');v.srcObject=camStream;v.style.display='block';await v.play();scanning=true;$('loginMsg').textContent="Point at the barcode. It scans as it focuses.";
  const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});let n=0;
  while(scanning){
    try{
      if(v.videoWidth){
        let text=null;
        if(nativeDet){const r=await nativeDet.detect(v);if(r.length)text=r[0].rawValue}
        else{ // wide center band (barcodes are wide), downscaled for speed
          const sh=v.videoHeight*0.5,k=Math.min(1,1280/v.videoWidth),w=Math.round(v.videoWidth*k),h=Math.round(sh*k); // keep aspect ratio (v4 stretched the band)
          cv.width=w;cv.height=h;cx.drawImage(v,0,(v.videoHeight-sh)/2,v.videoWidth,sh,0,0,w,h);
          const r=await ZXingWASM.readBarcodes(cx.getImageData(0,0,w,h),{formats:FORMATS,tryHarder:(++n%3===0),tryRotate:true,tryInvert:true,maxNumberOfSymbols:1});
          if(r.length)text=r[0].text}
        if(text)return gotId(text)}
    }catch(e){}
    await new Promise(r=>requestAnimationFrame(r))}
};
$('upBtn').onclick=()=>$('bcFile').click();
$('bcFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;
  try{let t=null;
    if(wasmRead()){const r=await ZXingWASM.readBarcodes(f,{formats:FORMATS,tryHarder:true,tryRotate:true,tryInvert:true,maxNumberOfSymbols:1});if(r.length)t=r[0].text}
    else if(nativeDet){const r=await nativeDet.detect(await createImageBitmap(f));if(r.length)t=r[0].rawValue}
    if(t){$('sid').value=t;$('loginMsg').textContent="Got it: "+t}else $('loginMsg').textContent="No barcode found. Try a sharper, closer photo."}
  catch(err){$('loginMsg').textContent="Couldn't read that photo."}
  e.target.value=""};


/* ---------- first-time AI loader ---------- */
const files={};
function bootShow(){$('boot').classList.add('on')}
function bootHide(){$('boot').classList.remove('on')}
function onProg(p){if(p.status==='progress'&&p.total){files[p.file]=[p.loaded,p.total];let l=0,t=0;for(const k in files){l+=files[k][0];t+=files[k][1]}const pc=Math.min(99,Math.round(l/t*100));$('bootBar').style.width=pc+'%';$('bootTxt').textContent="Downloading… "+pc+"%"}else if(p.status==='ready'){$('bootBar').style.width='100%';$('bootTxt').textContent="Almost ready…"}else if(p.status==='initiate'){$('bootTxt').textContent="Preparing…"}}
// ---- analyzer: on-device CLIP. It ONLY says which label looks closest. Material, bin, points and tips live in RULES (app.js). ----
// [what the model looks for, item name]. Item names must exist in RULES. Rows with name null are "not trash" and get rejected.
const ITEMS=[
["a candy or snack wrapper","Snack wrapper"],["a chip bag","Chip bag"],["a plastic bag or plastic film","Plastic bag"],["a straw","Straw"],
["a plastic fork, spoon or cutlery","Plastic cutlery"],["a styrofoam container","Styrofoam"],["a used napkin or paper towel","Napkin"],
["food scraps or a fruit peel","Food scraps"],["a paper coffee cup","Paper cup"],["a sheet of paper or notebook paper","Paper"],
["a cardboard box","Cardboard"],["a pizza box","Pizza box"],["a milk or juice carton","Carton"],["an aluminum soda can","Aluminum can"],
["a plastic water bottle","Plastic bottle"],["a plastic cup","Plastic cup"],["a plastic food container","Plastic container"],
["a glass bottle","Glass bottle"],["a glass jar","Glass jar"],
// reject labels (v5 added the extra ones so unrelated photos have somewhere to land; accuracy not yet measured)
["a person's face, hand or an empty background",null],["a laptop, phone or electronics",null],["a room, furniture or a wall",null],["a plant, tree or pet",null]];
const MIN_SCORE=0.3;
let clf=null;
async function analyze(b){
  if(!clf){bootShow();
    const T=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1");
    const dev=navigator.gpu?"webgpu":"wasm";
    try{clf=await T.pipeline("zero-shot-image-classification","Xenova/clip-vit-base-patch32",{progress_callback:onProg,device:dev,dtype:dev==="webgpu"?"fp32":"q8"})}
    catch(e){clf=await T.pipeline("zero-shot-image-classification","Xenova/clip-vit-base-patch32",{progress_callback:onProg,device:"wasm",dtype:"q8"})}
    bootHide()}
  const url=URL.createObjectURL(b);let out;
  try{out=await clf(url,ITEMS.map(i=>i[0]),{hypothesis_template:"a photo of {}."})}finally{URL.revokeObjectURL(url)}
  const top=out[0],it=ITEMS.find(i=>i[0]===top.label);
  if(!it||!it[1]||top.score<MIN_SCORE)throw new Error("unsure");
  return {item:it[1],score:top.score}}
