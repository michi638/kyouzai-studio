import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
const $=id=>document.getElementById(id);
const state={id:crypto.randomUUID(),pdf:null,pdfName:"",pdfData:null,page:1,scale:1.35,annotations:{},tool:"pan",drawing:false,history:[],recognition:null,manualStop:true};
const toast=m=>{const e=$("toast");e.textContent=m;e.style.display="block";clearTimeout(e.t);e.t=setTimeout(()=>e.style.display="none",2300)};
const setStatus=m=>$("status").textContent=m;
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button,.tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab).classList.add("active");if(b.dataset.tab==="archive")renderArchive()});

const dbp=new Promise((resolve,reject)=>{const r=indexedDB.open("KyouzaiStudioDB",1);r.onupgradeneeded=()=>r.result.createObjectStore("projects",{keyPath:"id"});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function dbPut(v){const db=await dbp;return new Promise((res,rej)=>{const t=db.transaction("projects","readwrite");t.objectStore("projects").put(v);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
async function dbAll(){const db=await dbp;return new Promise((res,rej)=>{const r=db.transaction("projects").objectStore("projects").getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function dbGet(id){const db=await dbp;return new Promise((res,rej)=>{const r=db.transaction("projects").objectStore("projects").get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function dbDelete(id){const db=await dbp;return new Promise((res,rej)=>{const t=db.transaction("projects","readwrite");t.objectStore("projects").delete(id);t.oncomplete=res;t.onerror=()=>rej(t.error)})}

$("pdfInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;state.pdfName=f.name;state.pdfData=await f.arrayBuffer();state.pdf=await pdfjsLib.getDocument({data:state.pdfData.slice(0)}).promise;state.page=1;$("pageCount").textContent=state.pdf.numPages;$("pdfEmpty").style.display="none";await renderPage();autoSave()};
async function renderPage(){if(!state.pdf)return;setStatus("PDF表示中…");const page=await state.pdf.getPage(state.page);const vp=page.getViewport({scale:state.scale});const pc=$("pdfCanvas"),ic=$("inkCanvas"),dpr=devicePixelRatio||1;pc.width=vp.width*dpr;pc.height=vp.height*dpr;pc.style.width=vp.width+"px";pc.style.height=vp.height+"px";ic.width=vp.width*dpr;ic.height=vp.height*dpr;ic.style.width=vp.width+"px";ic.style.height=vp.height+"px";await page.render({canvasContext:pc.getContext("2d"),viewport:vp,transform:[dpr,0,0,dpr,0,0]}).promise;restoreInk();$("pageNum").textContent=state.page;setTool(state.tool);setStatus("準備完了")}
$("prevPage").onclick=async()=>{if(state.pdf&&state.page>1){saveInk();state.page--;await renderPage()}};
$("nextPage").onclick=async()=>{if(state.pdf&&state.page<state.pdf.numPages){saveInk();state.page++;await renderPage()}};

const ink=$("inkCanvas"),ctx=ink.getContext("2d");
function setTool(t){state.tool=t;document.querySelectorAll("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===t));ink.style.pointerEvents=t==="pan"?"none":"auto"}
document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
function xy(e){const r=ink.getBoundingClientRect();return{x:(e.clientX-r.left)*ink.width/r.width,y:(e.clientY-r.top)*ink.height/r.height}}
ink.onpointerdown=e=>{e.preventDefault();state.history.push(ink.toDataURL());state.drawing=true;state.last=xy(e);ink.setPointerCapture(e.pointerId)};
ink.onpointermove=e=>{if(!state.drawing)return;e.preventDefault();const p=xy(e);ctx.save();ctx.lineCap="round";ctx.lineJoin="round";if(state.tool==="eraser"){ctx.globalCompositeOperation="destination-out";ctx.lineWidth=+$("inkWidth").value*5}else{ctx.strokeStyle=$("inkColor").value;ctx.globalAlpha=state.tool==="highlight"?.25:1;ctx.lineWidth=(state.tool==="highlight"?+$("inkWidth").value*3:+$("inkWidth").value)*(devicePixelRatio||1)}ctx.beginPath();ctx.moveTo(state.last.x,state.last.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();state.last=p};
ink.onpointerup=()=>{state.drawing=false;saveInk();autoSave()};
function saveInk(){if(state.pdf)state.annotations[state.page]=ink.toDataURL("image/png")}
function restoreInk(){ctx.clearRect(0,0,ink.width,ink.height);const s=state.annotations[state.page];if(s){const im=new Image();im.onload=()=>ctx.drawImage(im,0,0);im.src=s}}
$("undoInk").onclick=()=>{const s=state.history.pop();if(!s)return;const im=new Image();im.onload=()=>{ctx.clearRect(0,0,ink.width,ink.height);ctx.drawImage(im,0,0);saveInk()};im.src=s};
$("clearPageInk").onclick=()=>{if(confirm("このページの注釈を消去しますか？")){ctx.clearRect(0,0,ink.width,ink.height);delete state.annotations[state.page];autoSave()}};

function setupSpeech(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$("startSpeech").disabled=true;setStatus("このSafariでは音声認識を利用できません");return}const r=new SR();state.recognition=r;r.continuous=true;r.interimResults=true;r.lang=$("speechLang").value;r.onstart=()=>{setStatus("文字起こし中…");$("startSpeech").disabled=true;$("stopSpeech").disabled=false};r.onresult=e=>{let fin="",inter="";for(let i=e.resultIndex;i<e.results.length;i++){const s=e.results[i][0].transcript;e.results[i].isFinal?fin+=s:inter+=s}if(fin){const ta=$("transcript"),sp=ta.selectionStart;ta.setRangeText(fin+"。",sp,ta.selectionEnd,"end");autoSave()}$("interim").textContent=inter};r.onerror=e=>{setStatus("音声認識: "+e.error);if(["not-allowed","service-not-allowed"].includes(e.error))state.manualStop=true};r.onend=()=>{if(!state.manualStop)setTimeout(()=>{try{r.start()}catch{}},400);else{$("startSpeech").disabled=false;$("stopSpeech").disabled=true;$("interim").textContent="";setStatus("停止")}}}
setupSpeech();
$("startSpeech").onclick=()=>{state.manualStop=false;state.recognition.lang=$("speechLang").value;try{state.recognition.start()}catch{toast("少し待って、もう一度押してください")}};
$("stopSpeech").onclick=()=>{state.manualStop=true;try{state.recognition.stop()}catch{}};
$("insertTime").onclick=()=>{const t=$("transcript"),s=`\n[${new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}] `;t.setRangeText(s,t.selectionStart,t.selectionEnd,"end");autoSave()};
$("copyTranscript").onclick=async()=>{await navigator.clipboard.writeText($("transcript").value);toast("文章をコピーしました")};
$("clearTranscript").onclick=()=>{if(confirm("文字起こし文章を消去しますか？")){$("transcript").value="";autoSave()}};

function projectObject(includePdf=true){saveInk();return{id:state.id,title:$("projectTitle").value||"無題",category:$("category").value,tags:$("tags").value,transcript:$("transcript").value,summary:$("summary").value,pdfName:state.pdfName,pdfData:includePdf&&state.pdfData?Array.from(new Uint8Array(state.pdfData)):null,annotations:state.annotations,updatedAt:new Date().toISOString()}}
async function saveProject(show=true){await dbPut(projectObject(true));if(show)toast("教材アーカイブへ保存しました");setStatus("自動保存済み")}
let timer;function autoSave(){clearTimeout(timer);timer=setTimeout(()=>saveProject(false),900)}
["projectTitle","category","tags","transcript","summary"].forEach(id=>$(id).addEventListener("input",autoSave));
$("saveProject").onclick=()=>saveProject(true);
$("newProject").onclick=()=>{if(!confirm("新しい教材を作りますか？ 現在の内容は先に自動保存されます。"))return;saveProject(false);state.id=crypto.randomUUID();state.pdf=null;state.pdfData=null;state.pdfName="";state.page=1;state.annotations={};["transcript","summary","tags"].forEach(id=>$(id).value="");$("projectTitle").value="新しい教材";$("pageNum").textContent="0";$("pageCount").textContent="0";$("pdfCanvas").getContext("2d").clearRect(0,0,$("pdfCanvas").width,$("pdfCanvas").height);ctx.clearRect(0,0,ink.width,ink.height);$("pdfEmpty").style.display="block";toast("新しい教材を開始しました")};

async function renderArchive(){const q=$("archiveSearch").value.toLowerCase(),items=(await dbAll()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));const box=$("archiveList");box.innerHTML="";for(const p of items.filter(x=>[x.title,x.tags,x.transcript,x.summary].join(" ").toLowerCase().includes(q))){const d=document.createElement("article");d.className="archive-item";d.innerHTML=`<h3>${esc(p.title)}</h3><div class="meta">${esc(p.category)}｜${new Date(p.updatedAt).toLocaleString("ja-JP")}<br>${esc(p.tags||"")}</div><p>${esc(p.transcript||p.summary||"本文なし")}</p><div class="actions"><button data-open>開く</button><button data-export>書出し</button><button data-delete>削除</button></div>`;d.querySelector("[data-open]").onclick=()=>openProject(p.id);d.querySelector("[data-export]").onclick=()=>downloadJSON(p);d.querySelector("[data-delete]").onclick=async()=>{if(confirm("削除しますか？")){await dbDelete(p.id);renderArchive()}};box.appendChild(d)}if(!box.children.length)box.innerHTML='<p>該当する教材はありません。</p>'}
$("archiveSearch").oninput=renderArchive;
async function openProject(id){const p=await dbGet(id);state.id=p.id;state.pdfName=p.pdfName||"";state.pdfData=p.pdfData?new Uint8Array(p.pdfData).buffer:null;state.annotations=p.annotations||{};$("projectTitle").value=p.title;$("category").value=p.category;$("tags").value=p.tags||"";$("transcript").value=p.transcript||"";$("summary").value=p.summary||"";if(state.pdfData){state.pdf=await pdfjsLib.getDocument({data:state.pdfData.slice(0)}).promise;state.page=1;$("pageCount").textContent=state.pdf.numPages;$("pdfEmpty").style.display="none";await renderPage()}document.querySelector('[data-tab="studio"]').click();toast("教材を開きました")}

function esc(s=""){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function blobDownload(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function safe(s){return(s||"教材").replace(/[\\/:*?"<>|]/g,"_").slice(0,70)}
function downloadJSON(p=projectObject(true)){blobDownload(new Blob([JSON.stringify(p)],{type:"application/json"}),safe(p.title)+".kyouzai.json")}
$("icloudSave").onclick=async()=>{const p=projectObject(true),data=JSON.stringify(p),name=safe(p.title)+".kyouzai.json";try{if("showSaveFilePicker"in window){const h=await showSaveFilePicker({suggestedName:name,types:[{description:"教材スタジオ",accept:{"application/json":[".json"]}}]});const w=await h.createWritable();await w.write(data);await w.close();toast("選択した場所へ保存しました")}else if(navigator.share){const f=new File([data],name,{type:"application/json"});await navigator.share({files:[f],title:p.title});toast("共有先でiCloud Driveを選択してください")}else downloadJSON(p)}catch(e){if(e.name!=="AbortError")toast("保存できませんでした")}};
$("exportAll").onclick=async()=>blobDownload(new Blob([JSON.stringify(await dbAll())],{type:"application/json"}),"教材アーカイブ全体.json");
$("importBackup").onchange=async e=>{try{const arr=JSON.parse(await e.target.files[0].text());for(const p of arr)await dbPut(p);toast("復元しました")}catch{toast("復元ファイルを確認してください")}};

$("runSummary").onclick=async()=>{const endpoint=$("apiEndpoint").value.trim(),text=$("transcript").value.trim();if(!text)return toast("先に文字起こしまたは文章を入力してください");if(!endpoint)return toast("設定画面でAIサーバーURLを入力してください");const prompts={summary:"内容を重要点、補足、結論に分けて日本語で整理してください。",lesson:"中学生向け授業教材として、ねらい、要点、発問、板書案、まとめに整理してください。",questions:"内容に基づく確認問題を5問、解答と解説付きで作成してください。",entrance:"高校入試教材として、問われる知識、思考のポイント、誤答しやすい点、類題案を分析してください。"};$("runSummary").disabled=true;setStatus("ChatGPTが作成中…");try{const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({instruction:prompts[$("summaryMode").value],text,title:$("projectTitle").value})});const d=await r.json();if(!r.ok)throw new Error(d.error||"AIエラー");$("summary").value=d.output;autoSave();toast("AI結果を作成しました")}catch(e){toast(e.message)}finally{$("runSummary").disabled=false;setStatus("準備完了")}};

const settings=JSON.parse(localStorage.getItem("ks-settings")||"{}");$("apiEndpoint").value=settings.apiEndpoint||"";$("speechLang").value=settings.speechLang||"ja-JP";
$("persistSettings").onclick=()=>{localStorage.setItem("ks-settings",JSON.stringify({apiEndpoint:$("apiEndpoint").value.trim(),speechLang:$("speechLang").value}));toast("設定を保存しました")};
window.addEventListener("beforeunload",()=>saveProject(false));
