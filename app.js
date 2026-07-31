import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
const $=id=>document.getElementById(id);
const state={id:crypto.randomUUID(),pdf:null,pdfName:"",pdfData:null,resourceType:"",resourceMime:"",imageUrl:"",page:1,scale:1.35,annotations:{},tool:"pan",drawing:false,history:[],recognition:null,manualStop:true};
const toast=m=>{const e=$("toast");e.textContent=m;e.style.display="block";clearTimeout(e.t);e.t=setTimeout(()=>e.style.display="none",2300)};
const setStatus=m=>$("status").textContent=m;
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button,.tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab).classList.add("active");if(b.dataset.tab==="archive")renderArchive()});
const projectFields=["projectTitle","category","grade","domain","unit","purpose","difficulty","tags","transcript","summary","sourceProblem","variationResults","imageSolution","teacherNotes"];

const dbp=new Promise((resolve,reject)=>{const r=indexedDB.open("KyouzaiStudioDB",1);r.onupgradeneeded=()=>r.result.createObjectStore("projects",{keyPath:"id"});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function dbPut(v){const db=await dbp;return new Promise((res,rej)=>{const t=db.transaction("projects","readwrite");t.objectStore("projects").put(v);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
async function dbAll(){const db=await dbp;return new Promise((res,rej)=>{const r=db.transaction("projects").objectStore("projects").getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function dbGet(id){const db=await dbp;return new Promise((res,rej)=>{const r=db.transaction("projects").objectStore("projects").get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function dbDelete(id){const db=await dbp;return new Promise((res,rej)=>{const t=db.transaction("projects","readwrite");t.objectStore("projects").delete(id);t.oncomplete=res;t.onerror=()=>rej(t.error)})}

$("pdfInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;releaseImageUrl();state.resourceType="pdf";state.resourceMime="application/pdf";state.pdfName=f.name;state.pdfData=await f.arrayBuffer();state.pdf=await pdfjsLib.getDocument({data:state.pdfData.slice(0)}).promise;state.page=1;state.annotations={};$("pageCount").textContent=state.pdf.numPages;$("pdfEmpty").style.display="none";await renderPage();e.target.value="";autoSave()};
$("imageInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;if(!f.type.startsWith("image/"))return toast("画像ファイルを選んでください");releaseImageUrl();state.resourceType="image";state.resourceMime=f.type;state.pdf=null;state.pdfName=f.name;state.pdfData=await f.arrayBuffer();state.page=1;state.annotations={};$("pageCount").textContent="1";$("pdfEmpty").style.display="none";try{await renderImage();autoSave()}catch{setStatus("画像を表示できません");toast("この画像形式は表示できません")}finally{e.target.value=""}};
function releaseImageUrl(){if(state.imageUrl){URL.revokeObjectURL(state.imageUrl);state.imageUrl=""}}
async function renderPage(){if(!state.pdf)return;setStatus("PDF表示中…");const page=await state.pdf.getPage(state.page);const vp=page.getViewport({scale:state.scale});const pc=$("pdfCanvas"),ic=$("inkCanvas"),dpr=devicePixelRatio||1;pc.width=vp.width*dpr;pc.height=vp.height*dpr;pc.style.width=vp.width+"px";pc.style.height=vp.height+"px";ic.width=vp.width*dpr;ic.height=vp.height*dpr;ic.style.width=vp.width+"px";ic.style.height=vp.height+"px";await page.render({canvasContext:pc.getContext("2d"),viewport:vp,transform:[dpr,0,0,dpr,0,0]}).promise;restoreInk();$("pageNum").textContent=state.page;setTool(state.tool);setStatus("準備完了")}
async function renderImage(){if(!state.pdfData||state.resourceType!=="image")return;setStatus("画像表示中…");releaseImageUrl();const blob=new Blob([state.pdfData],{type:state.resourceMime||mimeFromName(state.pdfName)});state.imageUrl=URL.createObjectURL(blob);const im=new Image();await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=state.imageUrl});const maxWidth=1200,scale=Math.min(1.2,maxWidth/im.naturalWidth),width=Math.max(1,Math.round(im.naturalWidth*scale)),height=Math.max(1,Math.round(im.naturalHeight*scale)),dpr=devicePixelRatio||1,pc=$("pdfCanvas"),ic=$("inkCanvas");pc.width=width*dpr;pc.height=height*dpr;pc.style.width=width+"px";pc.style.height=height+"px";ic.width=width*dpr;ic.height=height*dpr;ic.style.width=width+"px";ic.style.height=height+"px";const c=pc.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);c.drawImage(im,0,0,width,height);restoreInk();$("pageNum").textContent="1";$("pageCount").textContent="1";setTool(state.tool);setStatus("画像を表示しました")}
function mimeFromName(name=""){if(/\.png$/i.test(name))return"image/png";if(/\.jpe?g$/i.test(name))return"image/jpeg";if(/\.gif$/i.test(name))return"image/gif";if(/\.webp$/i.test(name))return"image/webp";if(/\.svg$/i.test(name))return"image/svg+xml";if(/\.heic$/i.test(name))return"image/heic";return"application/octet-stream"}
$("prevPage").onclick=async()=>{if(state.pdf&&state.page>1){saveInk();state.page--;await renderPage()}};
$("nextPage").onclick=async()=>{if(state.pdf&&state.page<state.pdf.numPages){saveInk();state.page++;await renderPage()}};

const ink=$("inkCanvas"),ctx=ink.getContext("2d");
function setTool(t){state.tool=t;document.querySelectorAll("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===t));ink.style.pointerEvents=t==="pan"?"none":"auto"}
document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
function xy(e){const r=ink.getBoundingClientRect();return{x:(e.clientX-r.left)*ink.width/r.width,y:(e.clientY-r.top)*ink.height/r.height}}
ink.onpointerdown=e=>{e.preventDefault();state.history.push(ink.toDataURL());state.drawing=true;state.last=xy(e);ink.setPointerCapture(e.pointerId)};
ink.onpointermove=e=>{if(!state.drawing)return;e.preventDefault();const p=xy(e);ctx.save();ctx.lineCap="round";ctx.lineJoin="round";if(state.tool==="eraser"){ctx.globalCompositeOperation="destination-out";ctx.lineWidth=+$("inkWidth").value*5}else{ctx.strokeStyle=$("inkColor").value;ctx.globalAlpha=state.tool==="highlight"?.25:1;ctx.lineWidth=(state.tool==="highlight"?+$("inkWidth").value*3:+$("inkWidth").value)*(devicePixelRatio||1)}ctx.beginPath();ctx.moveTo(state.last.x,state.last.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();state.last=p};
ink.onpointerup=()=>{state.drawing=false;saveInk();autoSave()};
function saveInk(){if(state.pdfData)state.annotations[state.page]=ink.toDataURL("image/png")}
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

function projectObject(includePdf=true){saveInk();return{id:state.id,title:$("projectTitle").value||"無題",category:$("category").value,grade:$("grade").value,domain:$("domain").value,unit:$("unit").value,purpose:$("purpose").value,difficulty:$("difficulty").value,tags:$("tags").value,transcript:$("transcript").value,summary:$("summary").value,sourceProblem:$("sourceProblem").value,variationResults:$("variationResults").value,imageSolution:$("imageSolution").value,teacherNotes:$("teacherNotes").value,pdfName:state.pdfName,resourceType:state.resourceType,resourceMime:state.resourceMime,pdfData:includePdf&&state.pdfData?Array.from(new Uint8Array(state.pdfData)):null,annotations:state.annotations,updatedAt:new Date().toISOString()}}
async function saveProject(show=true){await dbPut(projectObject(true));if(show)toast("教材アーカイブへ保存しました");setStatus("自動保存済み")}
let timer;function autoSave(){clearTimeout(timer);timer=setTimeout(()=>saveProject(false),900)}
projectFields.forEach(id=>$(id).addEventListener("input",autoSave));
$("saveProject").onclick=()=>saveProject(true);
$("newProject").onclick=()=>{if(!confirm("新しい教材を作りますか？ 現在の内容は先に自動保存されます。"))return;saveProject(false);releaseImageUrl();state.id=crypto.randomUUID();state.pdf=null;state.pdfData=null;state.pdfName="";state.resourceType="";state.resourceMime="";state.page=1;state.annotations={};["grade","domain","unit","purpose","difficulty","transcript","summary","sourceProblem","variationResults","imageSolution","teacherNotes","tags"].forEach(id=>$(id).value="");$("category").value="数学";$("projectTitle").value="新しい教材";$("pageNum").textContent="0";$("pageCount").textContent="0";$("pdfCanvas").getContext("2d").clearRect(0,0,$("pdfCanvas").width,$("pdfCanvas").height);ctx.clearRect(0,0,ink.width,ink.height);$("pdfEmpty").style.display="block";toast("新しい教材を開始しました")};

function fillArchiveFilter(id,items,key,label){const el=$(id),current=el.value,values=[...new Set(items.map(x=>x[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ja"));el.innerHTML=`<option value="">${label}</option>`+values.map(v=>`<option>${esc(v)}</option>`).join("");el.value=values.includes(current)?current:""}
async function renderArchive(){const q=$("archiveSearch").value.toLowerCase(),category=$("archiveCategory").value,grade=$("archiveGrade").value,difficulty=$("archiveDifficulty").value,items=(await dbAll()).sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));fillArchiveFilter("archiveCategory",items,"category","すべての教科");fillArchiveFilter("archiveGrade",items,"grade","すべての学年");fillArchiveFilter("archiveDifficulty",items,"difficulty","すべての難易度");const box=$("archiveList");box.innerHTML="";for(const p of items.filter(x=>{const hay=[x.title,x.category,x.grade,x.domain,x.unit,x.purpose,x.difficulty,x.tags,x.transcript,x.summary,x.sourceProblem,x.variationResults,x.imageSolution,x.teacherNotes].join(" ").toLowerCase();return hay.includes(q)&&(!category||x.category===category)&&(!grade||x.grade===grade)&&(!difficulty||x.difficulty===difficulty)})){const d=document.createElement("article");d.className="archive-item";const classification=[p.category,p.grade,p.domain,p.unit,p.purpose,p.difficulty].filter(Boolean).join(" › ");d.innerHTML=`<h3>${esc(p.title)}</h3><div class="meta">${esc(classification||p.category||"未分類")}<br>${new Date(p.updatedAt).toLocaleString("ja-JP")}<br>${esc(p.tags||"")}</div><p>${esc(p.sourceProblem||p.imageSolution||p.transcript||p.summary||"本文なし")}</p><div class="actions"><button data-open>開く</button><button data-export>書出し</button><button data-delete>削除</button></div>`;d.querySelector("[data-open]").onclick=()=>openProject(p.id);d.querySelector("[data-export]").onclick=()=>downloadJSON(p);d.querySelector("[data-delete]").onclick=async()=>{if(confirm("削除しますか？")){await dbDelete(p.id);renderArchive()}};box.appendChild(d)}if(!box.children.length)box.innerHTML='<p>該当する教材はありません。</p>'}
["archiveSearch","archiveCategory","archiveGrade","archiveDifficulty"].forEach(id=>$(id).oninput=renderArchive);
async function openProject(id){const p=await dbGet(id);releaseImageUrl();state.id=p.id;state.pdfName=p.pdfName||"";state.pdfData=p.pdfData?new Uint8Array(p.pdfData).buffer:null;state.resourceType=p.resourceType||(/\.(png|jpe?g|gif|webp|svg|heic)$/i.test(state.pdfName)?"image":state.pdfData?"pdf":"");state.resourceMime=p.resourceMime||(state.resourceType==="image"?mimeFromName(state.pdfName):state.resourceType==="pdf"?"application/pdf":"");state.annotations=p.annotations||{};$("projectTitle").value=p.title||"無題";$("category").value=p.category||"数学";$("grade").value=p.grade||"";$("domain").value=p.domain||"";$("unit").value=p.unit||"";$("purpose").value=p.purpose||"";$("difficulty").value=p.difficulty||"";$("tags").value=p.tags||"";$("transcript").value=p.transcript||"";$("summary").value=p.summary||"";$("sourceProblem").value=p.sourceProblem||"";$("variationResults").value=p.variationResults||"";$("imageSolution").value=p.imageSolution||"";$("teacherNotes").value=p.teacherNotes||"";if(state.pdfData&&state.resourceType==="image"){state.pdf=null;state.page=1;$("pdfEmpty").style.display="none";await renderImage()}else if(state.pdfData){state.pdf=await pdfjsLib.getDocument({data:state.pdfData.slice(0)}).promise;state.page=1;$("pageCount").textContent=state.pdf.numPages;$("pdfEmpty").style.display="none";await renderPage()}else{state.pdf=null;$("pageNum").textContent="0";$("pageCount").textContent="0";$("pdfEmpty").style.display="block"}document.querySelector('[data-tab="studio"]').click();toast("教材を開きました")}

function esc(s=""){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function blobDownload(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function safe(s){return(s||"教材").replace(/[\\/:*?"<>|]/g,"_").slice(0,70)}
function downloadJSON(p=projectObject(true)){blobDownload(new Blob([JSON.stringify(p)],{type:"application/json"}),safe(p.title)+".kyouzai.json")}
$("icloudSave").onclick=async()=>{const p=projectObject(true),data=JSON.stringify(p),name=safe(p.title)+".kyouzai.json";try{if("showSaveFilePicker"in window){const h=await showSaveFilePicker({suggestedName:name,types:[{description:"教材スタジオ",accept:{"application/json":[".json"]}}]});const w=await h.createWritable();await w.write(data);await w.close();toast("選択した場所へ保存しました")}else if(navigator.share){const f=new File([data],name,{type:"application/json"});await navigator.share({files:[f],title:p.title});toast("共有先でiCloud Driveを選択してください")}else downloadJSON(p)}catch(e){if(e.name!=="AbortError")toast("保存できませんでした")}};
$("exportAll").onclick=async()=>blobDownload(new Blob([JSON.stringify(await dbAll())],{type:"application/json"}),"教材アーカイブ全体.json");
$("importBackup").onchange=async e=>{try{const arr=JSON.parse(await e.target.files[0].text());for(const p of arr)await dbPut(p);toast("復元しました")}catch{toast("復元ファイルを確認してください")}};

async function askAi({instruction,text,button,statusText="ChatGPTが作成中…",imageDataUrl=""}){
  const endpoint=$("apiEndpoint").value.trim();
  if(!endpoint)throw new Error("設定画面でAIサーバーURLを入力してください");
  button.disabled=true;setStatus(statusText);
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({instruction,text,title:$("projectTitle").value,imageDataUrl})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||"AIエラー");
    if(!d.output)throw new Error("AIから文章が返りませんでした");
    return d.output;
  }finally{button.disabled=false;setStatus("準備完了")}
}
$("runSummary").onclick=async()=>{const text=$("transcript").value.trim();if(!text)return toast("先に文字起こしまたは文章を入力してください");const prompts={summary:"内容を重要点、補足、結論に分けて日本語で整理してください。",lesson:"中学生向け授業教材として、ねらい、要点、発問、板書案、まとめに整理してください。",questions:"内容に基づく確認問題を5問、解答と解説付きで作成してください。",entrance:"高校入試教材として、問われる知識、思考のポイント、誤答しやすい点、類題案を分析してください。"};try{$("summary").value=await askAi({instruction:prompts[$("summaryMode").value],text,button:$("runSummary")});autoSave();toast("AI結果を作成しました")}catch(e){toast(e.message)}};

function imageDataForAi(){
  if(state.resourceType!=="image"||!state.pdfData)throw new Error("先に問題のスクリーンショットを『画像を開く』で読み込んでください");
  const src=$("pdfCanvas");if(!src.width||!src.height)throw new Error("画像の表示が完了していません");
  const max=1800,scale=Math.min(1,max/Math.max(src.width,src.height)),out=document.createElement("canvas");
  out.width=Math.max(1,Math.round(src.width*scale));out.height=Math.max(1,Math.round(src.height*scale));
  const c=out.getContext("2d");c.fillStyle="#fff";c.fillRect(0,0,out.width,out.height);c.drawImage(src,0,0,out.width,out.height);
  return out.toDataURL("image/jpeg",.88);
}
$("solveImageProblem").onclick=async()=>{
  let imageDataUrl;try{imageDataUrl=imageDataForAi()}catch(e){return toast(e.message)}
  const classification=[`教科:${$("category").value}`,`学年:${$("grade").value||"未指定"}`,`分野:${$("domain").value||"未指定"}`,`単元:${$("unit").value||"未指定"}`].join("、");
  const instruction=`添付画像に写っている教材問題を読み取り、正確に解いてください。教材情報：${classification}

必ず次の形式で日本語で出力してください。
【画像から読み取った問題】
問題文、数値、図形・グラフの条件を省略せず書き起こす。

【答え】
最終的な答えを明確に示す。

【途中式・解法】
計算や論理を飛ばさず、順序立てて示す。

【生徒向けの詳しい解説】
なぜその方法を使うのかを含め、理解しやすく説明する。

【検算・別解】
答えを検算する。別解があれば示す。

【間違えやすい点】
典型的な誤答と、その原因を示す。

【先生が目を付けたいポイント】
授業で強調したい本質、発問、生徒のつまずき、発展の方向を提案する。

重要事項：画像の文字・数値・記号が不鮮明な場合は推測で断定せず、読めない箇所と必要な確認を明記する。数学の計算は途中式と最終結果を照合する。問題が複数ある場合は問題ごとに分ける。`;
  try{$("imageSolution").value=await askAi({instruction,text:"このスクリーンショットの問題を解答・解説してください。",imageDataUrl,button:$("solveImageProblem"),statusText:"画像の問題を解析中…"});autoSave();toast("画像問題の解答・解説を作成しました")}catch(e){toast(e.message)}
};
$("appendImageStudy").onclick=()=>{const solution=$("imageSolution").value.trim(),notes=$("teacherNotes").value.trim();if(!solution&&!notes)return toast("追加する内容がありません");const block=`\n\n＝＝＝＝ スクリーンショット問題研究 ＝＝＝＝\n${solution?`【AIによる解答・解説】\n${solution}\n\n`:""}${notes?`【先生が気をつけたいこと・目をつけたいポイント】\n${notes}\n`:""}`;$("transcript").value=$("transcript").value.replace(/\s*$/,'')+block;$("transcript").dispatchEvent(new Event("input"));toast("問題研究をノート本文へ追加しました")};
$("clearImageStudy").onclick=()=>{if(confirm("画像問題の解答・解説と自分のポイントを消去しますか？")){$("imageSolution").value="";$("teacherNotes").value="";autoSave()}};

$("problemFromTranscript").onclick=()=>{const text=$("transcript").value.trim();if(!text)return toast("ノート本文がありません");if($("sourceProblem").value.trim()&&!confirm("現在の元問題をノート本文で置き換えますか？"))return;$("sourceProblem").value=text;autoSave();toast("ノート本文を元問題へ入れました")};
$("problemFromSummary").onclick=()=>{const text=$("summary").value.trim();if(!text)return toast("AI要約欄に文章がありません");if($("sourceProblem").value.trim()&&!confirm("現在の元問題をAI要約欄の文章で置き換えますか？"))return;$("sourceProblem").value=text;autoSave();toast("AI要約欄を元問題へ入れました")};
$("appendVariations").onclick=()=>{const result=$("variationResults").value.trim();if(!result)return toast("追加する類題がありません");const source=$("sourceProblem").value.trim(),block=`\n\n＝＝＝＝ 類題研究 ＝＝＝＝\n${source?`【元問題】\n${source}\n\n`:""}${result}\n`;$("transcript").value=$("transcript").value.replace(/\s*$/,"")+block;$("transcript").dispatchEvent(new Event("input"));toast("類題研究をノート本文へ追加しました")};
$("clearVariations").onclick=()=>{if(confirm("類題・正答・解説を消去しますか？")){$("variationResults").value="";autoSave()}};
$("runVariations").onclick=async()=>{
  const problem=$("sourceProblem").value.trim();if(!problem)return toast("先に元問題を入力してください");
  const count=Number($("variationCount").value)||3,type=$("variationType").value;
  const typeInstructions={
    numbers:"元問題と同じ数学的本質を保ち、数値だけを変更してください。答えができるだけ整数または授業で扱いやすい値になるよう、数値同士の整合性を先に計算してから問題を作ってください。",
    condition:"元問題の本質を保ちながら条件を一つずつ変更し、条件変更によって何が変わるかが分かる類題にしてください。",
    reverse:"元問題で求める量を条件として与え、元の条件の一つを求める逆問題にしてください。",
    geometry:"元問題の数学的関係を、図形・座標・グラフの場面へ置き換えてください。図がなくても成立するよう、必要な条件を文章ですべて記述してください。",
    entrance:"元問題を土台に、複数段階の問いと説明問題を含む高校入試レベルへ発展させてください。"
  };
  const classification=[`教科:${$("category").value}`,`学年:${$("grade").value||"未指定"}`,`分野:${$("domain").value||"未指定"}`,`単元:${$("unit").value||"未指定"}`,`難易度:${$("difficulty").value||"未指定"}`].join("、");
  const instruction=`あなたは経験豊かな数学教材編集者です。次の元問題から類題を${count}問作成してください。
類題の作り方：${typeInstructions[type]}
教材情報：${classification}

必ず各問を次の形式で出力してください。
【類題1】
問題：
正答：
途中式・解法：
生徒向け解説：
よくある誤答：
検算・条件確認：

重要事項：
- 問題文だけで解けるように必要な条件を省略しない。
- 正答と途中式を実際に計算して照合する。
- 不成立、解なし、複数解になる場合は明記し、意図しない場合は数値や条件を作り直す。
- 元問題の答えを推測で流用せず、各類題を独立して解く。
- ${count}問すべてに正答と解説を付ける。`;
  try{$("variationResults").value=await askAi({instruction,text:problem,button:$("runVariations"),statusText:"類題と答えを作成中…"});autoSave();toast("類題・正答・解説を作成しました")}catch(e){toast(e.message)}
};

const settings=JSON.parse(localStorage.getItem("ks-settings")||"{}");$("apiEndpoint").value=settings.apiEndpoint||"";$("speechLang").value=settings.speechLang||"ja-JP";
$("persistSettings").onclick=()=>{localStorage.setItem("ks-settings",JSON.stringify({apiEndpoint:$("apiEndpoint").value.trim(),speechLang:$("speechLang").value}));toast("設定を保存しました")};
window.addEventListener("beforeunload",()=>saveProject(false));
