/* ===========================
   Nodea — Branch links + Pan/Zoom
   =========================== */

/** CONFIG **/
const API_BASE = "https://nodea-api.onrender.com";
const LS_KEY = "OPENAI_KEY";
const LS_BOARD = "NODEA_BOARD";
const MODEL_DEFAULT = "gpt-4o-mini";
const TOKEN_BUDGET_PAIRS = 6;

// Pan/Zoom limits
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.8;
const WORLD_BOUNDS = { minX: -2400, minY: -1600, maxX: 2400, maxY: 1600 };

/** STATE **/
const state = {
  board: {
    nodes: {},
    edges: [], // { id, src, dst, kind: 'lineage' }
    selection: new Set(),
    viewport: { x: 0, y: 0, zoom: 1 } // translate(x,y) and scale(zoom) applied to #stage
  },
  ui: { running: false, lastContext: [] },
  pan: { active: false, startX: 0, startY: 0, origX: 0, origY: 0 }
};

/** UTIL **/
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = (p="n") => `${p}_${Math.random().toString(36).slice(2,9)}_${Date.now().toString(36)}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function saveBoard(){ localStorage.setItem(LS_BOARD, JSON.stringify(state.board)); }
function loadBoard(){
  try{
    const raw = localStorage.getItem(LS_BOARD);
    if(!raw) return;
    const b = JSON.parse(raw);
    state.board.nodes = b.nodes || {};
    state.board.edges = b.edges || [];
    state.board.selection = new Set();
    state.board.viewport = b.viewport || { x:0, y:0, zoom:1 };
  }catch(e){ console.warn("board load failed", e); }
}
function keySet(k){ localStorage.setItem(LS_KEY, k || ""); }
function keyGet(){ return localStorage.getItem(LS_KEY) || ""; }
function modelGet(){ return $("#inpModel")?.value || MODEL_DEFAULT; }

/** DOM refs **/
const canvas = $("#canvas");
const stage  = $("#stage");
const edgesLayer = $("#edgesLayer");
const keyChip = $("#keyChip");
const btnSettings = $("#btnSettings");
const btnContext  = $("#btnContext");
const modalSettings = $("#modalSettings");
const inpKey = $("#inpKey");
const inpModel = $("#inpModel");
const btnSaveKey = $("#btnSaveKey");
const btnClearKey = $("#btnClearKey");
const btnNewPrompt = $("#btnNewPrompt");
const drawerContext = $("#drawerContext");
const ctxList = $("#ctxList");
const ctxCount = $("#ctxCount");
const btnExport = $("#btnExport");
const btnImport = $("#btnImport");
const fileImport = $("#fileImport");
const btnClear = $("#btnClear");
const modalClear = $("#modalClear");
const btnCancelClear = $("#btnCancelClear");
const btnConfirmClear = $("#btnConfirmClear");

/** RENDERERS **/
function renderHeader(){
  const hasKey = !!keyGet();
  keyChip.textContent = hasKey ? "Key: Set" : "Key: Missing";
  keyChip.classList.toggle("muted", !hasKey);
}

function applyViewport(){
  const { x, y, zoom } = state.board.viewport;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
}

function renderNodes(){
  // Clear existing nodes
  $$(".node", stage).forEach(n => n.remove());

  for(const nodeId in state.board.nodes){
    const n = state.board.nodes[nodeId];
    const el = document.createElement("div");
    el.className = `node ${n.type}${n.dragging ? " dragging":""}`;
    el.style.left = (n.x||0) + "px";
    el.style.top  = (n.y||0) + "px";
    el.style.width = (n.w || 320) + "px";
    el.dataset.id = n.id;

    // Toolbar
    const bar = document.createElement("div");
    bar.className = "toolbar";

    const title = document.createElement("div");
    title.className = "title";

    // Drag handle
    const drag = document.createElement("span");
    drag.className = "drag-handle";
    title.appendChild(drag);

    const titleText = document.createElement("span");
    titleText.textContent = n.type === "prompt" ? "Prompt" : (n.type === "response" ? "Response" : "Node");
    title.appendChild(titleText);

    const badges = document.createElement("div");
    badges.className = "badges";
    if(n.meta?.model) {
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = n.meta.model;
      badges.appendChild(b);
    }

    const toolbarRight = document.createElement("div");
    toolbarRight.className = "row";
    const spacer = document.createElement("div"); spacer.className = "spacer";

    if(n.type === "prompt"){
      const btnBranch = document.createElement("button");
      btnBranch.className = "btn secondary";
      btnBranch.textContent = "Branch";
      btnBranch.onclick = (e)=>{ e.stopPropagation(); branchFrom(n.id); };

      const btnRun = document.createElement("button");
      btnRun.className = "btn secondary";
      btnRun.textContent = state.ui.running ? "Running…" : "Run";
      btnRun.disabled = state.ui.running;
      btnRun.onclick = (e)=>{ e.stopPropagation(); runPrompt(n.id); };

      toolbarRight.append(btnBranch, btnRun);
    } else if(n.type === "response"){
      const btnFollow = document.createElement("button");
      btnFollow.className = "btn secondary";
      btnFollow.textContent = "Follow-up";
      btnFollow.onclick = (e)=>{ e.stopPropagation(); branchFrom(n.id); };
      toolbarRight.append(btnFollow);
    }

    bar.append(title, badges, spacer, toolbarRight);
    el.appendChild(bar);

    // Body
    const body = document.createElement("div");
    body.className = "body";
    if(n.type === "prompt"){
      const ta = document.createElement("textarea");
      ta.placeholder = "Type your prompt…";
      ta.value = n.content || "";
      ta.oninput = (e) => { n.content = e.target.value; saveBoard(); };
      body.appendChild(ta);
      if(n.meta?.autofocus){ setTimeout(()=> ta.focus(), 0); n.meta.autofocus = false; }
    } else if(n.type === "response"){
      const pre = document.createElement("pre");
      pre.textContent = n.content || "";
      body.appendChild(pre);
    }
    el.appendChild(body);
    stage.appendChild(el);

    // DRAG: handle-only
    enableDrag(el, n.id, drag);
  }
  renderEdges();
}

function renderEdges(){
  // Clear all paths
  while(edgesLayer.firstChild) edgesLayer.removeChild(edgesLayer.firstChild);

  const { edges, nodes } = state.board;

  for(const e of edges){
    if(e.kind !== "lineage") continue;
    const src = nodes[e.src], dst = nodes[e.dst];
    if(!src || !dst) continue;

    // from center-top of toolbars
    const srcX = (src.x||0) + (src.w||320)/2;
    const srcY = (src.y||0) + 30;
    const dstX = (dst.x||0) + (dst.w||320)/2;
    const dstY = (dst.y||0) + 30;

    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    const dx = (dstX - srcX) * 0.40;
    const d = `M ${srcX} ${srcY} C ${srcX+dx} ${srcY}, ${dstX-dx} ${dstY}, ${dstX} ${dstY}`;
    path.setAttribute("d", d);
    path.setAttribute("fill","none");
    path.setAttribute("stroke","#79a8ff");     // brighter so it’s obvious
    path.setAttribute("stroke-width","2.5");
    path.setAttribute("opacity","0.95");
    edgesLayer.appendChild(path);
  }
}

function renderBoard(){
  renderHeader();
  applyViewport();
  renderNodes();
}

/** DRAG — handle-only **/
function enableDrag(el, nodeId, handleEl){
  const node = state.board.nodes[nodeId];
  let startX=0,startY=0,startLeft=0,startTop=0, dragging=false, moved=false;

  function onDown(ev){
    ev.preventDefault();
    dragging = true; moved = false;
    el.classList.add("dragging");
    startX = ev.clientX; startY = ev.clientY;
    startLeft = parseFloat(el.style.left)||0;
    startTop  = parseFloat(el.style.top)||0;
    handleEl.setPointerCapture?.(ev.pointerId);
  }
  function onMove(ev){
    if(!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if(!moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) moved = true;
    if(!moved) return;

    const nx = clamp(Math.round(startLeft + dx), WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
    const ny = clamp(Math.round(startTop  + dy), WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY);
    el.style.left = nx + "px";
    el.style.top  = ny + "px";
    node.x = nx; node.y = ny;
    renderEdges();
  }
  function onUp(){
    if(!dragging) return;
    dragging = false;
    el.classList.remove("dragging");
    saveBoard();
  }
  handleEl.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/** PAN & ZOOM **/
function startPan(ev){
  state.pan.active = true;
  state.pan.startX = ev.clientX;
  state.pan.startY = ev.clientY;
  state.pan.origX = state.board.viewport.x;
  state.pan.origY = state.board.viewport.y;
  canvas.classList.add("panning");
}
function movePan(ev){
  if(!state.pan.active) return;
  const dx = ev.clientX - state.pan.startX;
  const dy = ev.clientY - state.pan.startY;
  state.board.viewport.x = clamp(state.pan.origX + dx, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  state.board.viewport.y = clamp(state.pan.origY + dy, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY);
  applyViewport();
}
function endPan(){
  if(!state.pan.active) return;
  state.pan.active = false;
  canvas.classList.remove("panning");
  saveBoard();
}

// Zoom around cursor (Ctrl/⌘ + wheel)
function onWheel(ev){
  if(!(ev.ctrlKey || ev.metaKey)) return; // only zoom when modifier held
  ev.preventDefault();
  const { x, y, zoom } = state.board.viewport;

  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;

  // world coords under cursor before zoom
  const wx = (mx - x) / zoom;
  const wy = (my - y) / zoom;

  const delta = -ev.deltaY; // trackpad natural
  const factor = delta > 0 ? 1.1 : 0.9;
  const newZoom = clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX);

  // keep cursor anchored
  state.board.viewport.x = mx - wx * newZoom;
  state.board.viewport.y = my - wy * newZoom;
  state.board.viewport.zoom = newZoom;

  // clamp viewport within bounds
  state.board.viewport.x = clamp(state.board.viewport.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  state.board.viewport.y = clamp(state.board.viewport.y, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY);

  applyViewport();
  saveBoard();
}

/** CREATE / BRANCH / RESPONSE **/
function centerPoint(){
  // convert screen center to world coords
  const rect = canvas.getBoundingClientRect();
  const { x, y, zoom } = state.board.viewport;
  const worldX = (rect.width/2 - x)/zoom - 160;
  const worldY = (rect.height/2 - y)/zoom - 80;
  return {
    x: clamp(Math.round(worldX), WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
    y: clamp(Math.round(worldY), WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY)
  };
}

function createPromptNode(pos){
  const id = uid("prompt");
  const p = { id, type:"prompt", title:"Prompt", content:"", x: pos.x, y: pos.y, w:320, h:140, meta:{ autofocus:true } };
  state.board.nodes[id] = p;
  saveBoard(); renderBoard();
  return id;
}

function createResponseNode(parentId, text, meta={}){
  const parent = state.board.nodes[parentId];
  const id = uid("resp");
  const y = (parent.y||0) + 160;
  const r = { id, type:"response", title:"Response", content: text, x: parent.x, y, w:320, h:140, meta };
  state.board.nodes[id] = r;
  // lineage edge parent -> response
  state.board.edges.push({ id: uid("e"), src: parentId, dst: id, kind:"lineage" });
  saveBoard(); renderBoard();
  return id;
}

function branchFrom(nodeId){
  const parent = state.board.nodes[nodeId];
  if(!parent) return;
  const id = uid("prompt");
  const p = {
    id, type:"prompt", title:"Prompt", content:"", w:320, h:140,
    x: clamp((parent.x||0) + 300, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
    y: parent.y||0, meta:{ autofocus:true }
  };
  state.board.nodes[id] = p;
  // lineage edge parent -> new prompt
  state.board.edges.push({ id: uid("e"), src: nodeId, dst: id, kind:"lineage" });
  saveBoard(); renderBoard();
  return id;
}

/** CONTEXT (lineage only) **/
function getLineage(nodeId){
  const { nodes, edges } = state.board;
  const path = [];
  let current = nodeId;
  const visited = new Set();
  while(current && !visited.has(current)){
    visited.add(current);
    const incoming = edges.find(e => e.kind==="lineage" && e.dst === current);
    if(!incoming) break;
    current = incoming.src;
    if(current) path.push(current);
  }
  return path.reverse();
}

function buildMessagesForPrompt(promptNodeId){
  const { nodes } = state.board;
  const lineageOrder = getLineage(promptNodeId);
  const msgs = [];

  for(const id of lineageOrder){
    const n = nodes[id];
    if(!n) continue;
    if(n.type === "prompt" && n.content)   msgs.push({ role:"user",      content: n.content });
    if(n.type === "response" && n.content) msgs.push({ role:"assistant", content: n.content });
  }

  const current = nodes[promptNodeId];
  const promptText = (current?.content || "").trim();
  if(!promptText) throw new Error("Prompt is empty.");
  msgs.push({ role:"user", content: promptText });

  const maxMsgs = TOKEN_BUDGET_PAIRS*2 + 1;
  const trimmed = msgs.slice(-maxMsgs);
  state.ui.lastContext = trimmed.map(m => ({ role:m.role, content: m.content.slice(0,140) }));
  return trimmed;
}

/** NETWORK **/
async function callChat({ messages, model, temperature=0.2, max_tokens=600 }){
  const key = keyGet();
  if(!key) throw new Error("Missing API key. Open Settings to paste your OpenAI key.");

  const resp = await fetch(`${API_BASE}/chat`, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens })
  });

  const data = await resp.json().catch(()=> ({}));
  if(!resp.ok){
    const msg = data?.error || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

/** RUN **/
async function runPrompt(promptNodeId){
  try{
    state.ui.running = true; renderBoard();

    const messages = buildMessagesForPrompt(promptNodeId);
    openContextDrawer();

    const model = (modelGet() || MODEL_DEFAULT).trim() || MODEL_DEFAULT;
    const result = await callChat({ messages, model, temperature:0.2, max_tokens:600 });

    createResponseNode(promptNodeId, result.text || "", { model: result.model || model });
    toast("Done.");
  }catch(err){
    const msg = String(err?.message || err);
    if(/Missing API key/i.test(msg)) toast("No API key. Open Settings.", 3500);
    else if(/401|invalid api key/i.test(msg)) toast("Invalid or missing API key.", 3500);
    else if(/insufficient_quota|rate|429/i.test(msg)) toast("Your key has no credits or hit rate limits.", 4000);
    else toast(`Error: ${msg}`, 4000);
  }finally{
    state.ui.running = false; renderBoard();
  }
}

/** EXPORT / IMPORT / CLEAR **/
function serializeBoard(){
  return { version: 1, savedAt: new Date().toISOString(), board: state.board };
}
function exportBoard(){
  const blob = new Blob([JSON.stringify(serializeBoard(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `nodea-workspace-${Date.now()}.nodea.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("Workspace exported.");
}
function importBoardFromFile(file){
  const r = new FileReader();
  r.onload = ()=>{
    try{
      const data = JSON.parse(r.result);
      if(!data || !data.board) throw new Error("Invalid file.");
      state.board = data.board; state.board.selection = new Set();
      saveBoard(); renderBoard(); toast("Workspace imported.");
    }catch(e){ toast("Import failed: "+(e.message||e)); }
  };
  r.readAsText(file);
}
function openClearConfirm(){ modalClear.classList.remove("hidden"); modalClear.setAttribute("aria-hidden","false"); }
function closeClearConfirm(){ modalClear.classList.add("hidden"); modalClear.setAttribute("aria-hidden","true"); }
function clearWorkspace(){
  state.board = { nodes:{}, edges:[], selection:new Set(), viewport:{ x:0, y:0, zoom:1 } };
  saveBoard(); renderBoard(); toast("Workspace cleared.");
}

/** UI — Settings / Context **/
function openSettings(){
  modalSettings.classList.remove("hidden");
  modalSettings.setAttribute("aria-hidden","false");
  inpKey.value = keyGet();
  if(inpModel) inpModel.value = MODEL_DEFAULT;
}
function closeSettings(){
  modalSettings.classList.add("hidden");
  modalSettings.setAttribute("aria-hidden","true");
}
function openContextDrawer(){
  ctxList.innerHTML = "";
  (state.ui.lastContext||[]).forEach((m,i)=>{
    const li = document.createElement("li");
    li.textContent = `${i+1}. ${m.role}: ${m.content}`;
    ctxList.appendChild(li);
  });
  ctxCount.textContent = (state.ui.lastContext||[]).length;
  drawerContext.classList.remove("hidden");
  drawerContext.setAttribute("aria-hidden","false");
}
function closeContextDrawer(){
  drawerContext.classList.add("hidden");
  drawerContext.setAttribute("aria-hidden","true");
}

/** TOAST **/
let toastEl=null, toastTimer=null;
function toast(msg, ms=1800){
  if(!toastEl){
    toastEl = document.createElement("div");
    toastEl.className = "toast"; document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toastEl.style.display = "none", ms);
}

/** BOOTSTRAP **/
function ensureFirstPrompt(){
  const anyPrompt = Object.values(state.board.nodes).find(n => n.type==="prompt");
  if(anyPrompt) return;
  const pos = centerPoint();
  createPromptNode(pos);
}

function wireEvents(){
  // Settings
  btnSettings.onclick = openSettings;
  $("[data-close-settings]").onclick = closeSettings;
  btnSaveKey.onclick = ()=>{ keySet(inpKey.value.trim()); renderHeader(); closeSettings(); toast("Key saved."); };
  btnClearKey.onclick = ()=>{ keySet(""); renderHeader(); closeSettings(); toast("Key cleared."); };

  // Context
  btnContext.onclick = openContextDrawer;
  $("[data-close-context]").onclick = closeContextDrawer;

  // New prompt
  btnNewPrompt.onclick = ()=> createPromptNode(centerPoint());

  // Export / Import
  btnExport.onclick = exportBoard;
  btnImport.onclick = ()=> fileImport.click();
  fileImport.onchange = (e)=>{ const f = e.target.files?.[0]; if(f) importBoardFromFile(f); e.target.value=""; };

  // Clear workspace
  btnClear.onclick = openClearConfirm;
  btnCancelClear.onclick = closeClearConfirm;
  $("[data-close-clear]").onclick = closeClearConfirm;
  btnConfirmClear.onclick = ()=>{ closeClearConfirm(); clearWorkspace(); };

  // Pan
  canvas.addEventListener("pointerdown", (e)=>{
    // only pan if background is grabbed (not a node / not a control)
    if(e.target === canvas){
      startPan(e);
    }
  });
  window.addEventListener("pointermove", movePan);
  window.addEventListener("pointerup", endPan);
  canvas.addEventListener("wheel", onWheel, { passive:false });
}

function init(){
  loadBoard();
  renderHeader();
  ensureFirstPrompt();
  wireEvents();
  renderBoard();
}

document.addEventListener("DOMContentLoaded", init);
