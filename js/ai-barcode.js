/* Reused from v3: barcode scanning (BarcodeDetector / zxing-wasm) and on-device CLIP analyzer with first-load progress. */
// ---- barcode: native BarcodeDetector if present, else zxing-wasm (fast C++ decoder) ----
const FORMATS=["Code128","Code39","Codabar","ITF","EAN-13","UPC-A","QRCode"]; // trim to your ID's format for max speed
let camStream=null,scanning=false,nativeDet=null;
try{nativeDet=new BarcodeDetector({formats:["code_128","code_39","codabar","itf","ean_13","upc_a","qr_code"]})}catch(e){}
const wasmRead=()=>window.ZXingWASM&&ZXingWASM.readBarcodes;
function stopCam(){scanning=false;if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null}$('cam').style.display='none'}
function gotId(t){stopCam();$('sid').value=t;$('loginMsg').textContent="Got it: "+t+". Tap Create account.";if(navigator.vibrate)navigator.vibrate(80)}
$('scanBtn').onclick=async()=>{
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
          const w=Math.min(v.videoWidth,1280),h=Math.round(w*0.5),sx=(v.videoWidth-v.videoWidth)/2,sh=v.videoHeight*0.5;
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
// ---- analyzer: ENGINE "device" = CLIP model running on the phone (no server, unlimited); "ollama" = your own server ----
const CONFIG={engine:"device",url:"http://localhost:11434",model:"gemma3:4b"};
const ITEMS=[ // [what the model looks for, display name, material, points, tip]
["a candy or snack wrapper","Snack wrapper","Landfill",5,"Wrappers are too thin to recycle. Trash bin."],
["a chip bag","Chip bag","Landfill",8,"Foil-lined bags go in the trash."],
["a plastic bag or plastic film","Plastic bag","Landfill",8,"Bags jam machines. Trash, or a store drop-off."],
["a straw","Straw","Landfill",5,"Too small to recycle. Trash bin."],
["a plastic fork, spoon or cutlery","Plastic cutlery","Landfill",6,"Trash bin."],
["a styrofoam container","Styrofoam","Landfill",8,"Foam is not recyclable here. Trash bin."],
["a used napkin or paper towel","Napkin","Compost",10,"Soiled paper goes in compost."],
["food scraps or a fruit peel","Food scraps","Compost",25,"Compost bin."],
["a paper coffee cup","Paper cup","Paper",15,"Empty it, then recycling or trash per campus rules."],
["a sheet of paper or notebook paper","Paper","Paper",15,"Keep it dry and clean for paper recycling."],
["a cardboard box","Cardboard","Paper",25,"Flatten it and put it in recycling."],
["a pizza box","Pizza box","Compost",15,"Greasy cardboard goes in compost or trash."],
["a milk or juice carton","Carton","Paper",30,"Rinse, then recycling."],
["an aluminum soda can","Aluminum can","Plastic",35,"Rinse and put it in recycling."],
["a plastic water bottle","Plastic bottle","Plastic",55,"Empty it, cap on, into recycling."],
["a plastic cup","Plastic cup","Plastic",20,"Rinse, then recycling."],
["a plastic food container","Plastic container","Plastic",30,"Rinse, then recycling."],
["a glass bottle","Glass bottle","Glass",55,"Rinse, then glass or recycling bin."],
["a glass jar","Glass jar","Glass",50,"Rinse, then glass or recycling bin."],
["a person's face, hand or an empty background","",null,0,""]];
let clf=null;
async function analyze(b){
  if(CONFIG.engine==="ollama")return ollama(b);
  if(!clf){bootShow();
    const T=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1");
    const dev=navigator.gpu?"webgpu":"wasm";
    try{clf=await T.pipeline("zero-shot-image-classification","Xenova/clip-vit-base-patch32",{progress_callback:onProg,device:dev,dtype:dev==="webgpu"?"fp32":"q8"})}
    catch(e){clf=await T.pipeline("zero-shot-image-classification","Xenova/clip-vit-base-patch32",{progress_callback:onProg,device:"wasm",dtype:"q8"})}
    bootHide()}
  const url=URL.createObjectURL(b),out=await clf(url,ITEMS.map(i=>i[0]),{hypothesis_template:"a photo of {}."});
  const top=out[0],it=ITEMS.find(i=>i[0]===top.label);
  if(!it[2]||top.score<0.3)throw new Error("unsure");
  return {item:it[1],material:it[2],points:it[3],tip:it[4]}}
const b64=b=>new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(f.result.split(',')[1]);f.readAsDataURL(b)});
async function ollama(b){
  const res=await fetch(CONFIG.url+"/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:CONFIG.model,prompt:PROMPT,images:[await b64(b)],stream:false,format:"json"})});
  if(!res.ok)throw new Error("bad status");
  return JSON.parse((await res.json()).response)}

