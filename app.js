/* ===========================
   Nodea — Branch links + Pan/Zoom + Center + Drawer push + Collapsible nodes + Knowledge edges
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
    edges: [], // { id, src, dst, kind: 'lineage' | 'knowledge' }
    selection: new Set(),
    viewport: { x: 0, y: 0, zoom: 1 } // translate(x,y) and scale(zoom) applied to #stage
  },
  ui: { running: false, lastContext: [], pendingConnect: null }, // pendingConnect: { srcId }
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
const btnCenter   = $("#btnCenter");
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

    // Collapse chevron
    const btnChev = document.createElement("button");
    btnChev.className = "icon-btn chev";
    btnChev.title = (n.meta?.collapsed ? "Expand" : "Collapse");
    btnChev.textContent = n.meta?.collapsed ? "▸" : "▾";
    btnChev.onclick = (e)=>{
      e.stopPropagation();
      n.meta = n.meta || {};
      n.meta.collapsed = !n.meta.collapsed;
      saveBoard();
      renderBoard();
    };
    title.appendChild(btnChev);
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

    // Actions
    if(n.type === "prompt"){
      const btnRun = document.createElement("button");
      btnRun.className = "btn secondary";
      btnRun.textContent = state.ui.running ? "Running…" : "Run";
      btnRun.disabled = state.ui.running;
      btnRun.onclick = (e)=>{ e.stopPropagation(); runPrompt(n.id); };
      toolbarRight.append(btnRun);
    } else if(n.type === "response"){
      const btnFollow = document.createElement("button");
      btnFollow.className = "btn secondary";
      btnFollow.textContent = "Follow-up";
      btnFollow.onclick = (e)=>{ e.stopPropagation(); branchFrom(n.id); };
      toolbarRight.append(btnFollow);
    }

    // Knowledge connector
    const connector = document.createElement("div");
    connector.className = "connector";
    connector.title = "Connect this node to another";
    connector.onpointerdown = (e)=>{
      e.stopPropagation();
      state.ui.pendingConnect = { srcId: n.id };
      toast("Select another node to connect...");
    };
    toolbarRight.append(connector);

    bar.append(title, badges, spacer, toolbarRight);
    el.appendChild(bar);

    // Body + Preview (collapsible)
    const body = document.createElement("div");
    body.className = "body";

    let previewText = "";
    if(n.type === "prompt"){
      const ta = document.createElement("textarea");
      ta.placeholder = "Type your prompt…";
      ta.value = n.content || "";
      ta.oninput = (e) => { n.content = e.target.value; saveBoard(); };
      body.appendChild(ta);
      previewText = (n.content || "").trim();
      if(n.meta?.autofocus){ setTimeout(()=> ta.focus(), 0); n.meta.autofocus = false; }
    } else if(n.type === "response"){
      const pre = document.createElement("pre");
      pre.textContent = n.content || "";
      body.appendChild(pre);
      previewText = (n.content || "").trim();
    }

    const preview = document.createElement("div");
    preview.className = "preview";
    preview.textContent = previewText || (n.type === "prompt" ? "(empty prompt)" : "(empty response)");

    el.appendChild(body);
    el.appendChild(preview);

    if(n.meta?.collapsed){ el.classList.add("collapsed"); }
    else { el.classList.remove("collapsed"); }

    // If releasing on this node while connector active -> make knowledge edge
    el.addEventListener("pointerup", ()=>{
      const pending = state.ui.pendingConnect;
      if(pending && pending.srcId !== n.id){
        const src = pending.srcId;
        const dst = n.id;
        const exists = state.board.edges.some(e =>
          e.kind==="knowledge" && ((e.src===src && e.dst===dst) || (e.src===dst && e.dst===src))
        );
        if(!exists){
          state.board.edges.push({ id: uid("e"), src, dst, kind:"knowledge" });
          saveBoard(); renderBoard();
          toast("Nodes connected.");
        }
        state.ui.pendingConnect = null;
      }
    });

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

  // lineage edges (curved)
  for(const e of edges){
    if(e.kind !== "lineage") continue;
    const src = nodes[e.src], dst = nodes[e.dst];
    if(!src || !dst) continue;

    const srcX = (src.x||0) + (src.w||320)/2;
    const srcY = (src.y||0) + 30;
    const dstX = (dst.x||0) + (dst.w||320)/2;
    const dstY = (dst.y||0) + 30;

    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    const dx = (dstX - srcX) * 0.40;
    const d = `M ${srcX} ${srcY} C ${srcX+dx} ${srcY}, ${dstX-dx} ${dstY}, ${dstX} ${dstY}`;
    path.setAttribute("d", d);
    path.setAttribute("fill","none");
    path.setAttribute("stroke","#79a8ff");
    path.setAttribute("stroke-width","2.5");
    path.setAttribute("opacity","0.95");
    edgesLayer.appendChild(path);
  }

  // knowledge edges (straight dashed)
  for(const e of edges){
    if(e.kind !== "knowledge") continue;
    const a = nodes[e.src], b = nodes[e.dst];
    if(!a || !b) continue;

    const ax = (a.x||0) + (a.w||320)/2;
    const ay = (a.y||0) + 30;
    const bx = (b.x||0) + (b.w||320)/2;
    const by = (b.y||0) + 30;

    const line = document.createElementNS("http://www.w3.org/2000/svg","path");
    line.setAttribute("d", `M ${ax} ${ay} L ${bx} ${by}`);
    line.setAttribute("class","knowledge");
    edgesLayer.appendChild(line);
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
// Start pan when grabbing empty background (canvas or empty stage)
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

// Wheel zoom around cursor
function onWheel(ev){
  ev.preventDefault();
  const vp = state.board.viewport;
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;

  const wx = (mx - vp.x) / vp.zoom;
  const wy = (my - vp.y) / vp.zoom;

  const factor = ev.deltaY < 0 ? 1.1 : 0.9;
  const newZoom = clamp(vp.zoom * factor, ZOOM_MIN, ZOOM_MAX);

  vp.x = mx - wx * newZoom;
  vp.y = my - wy * newZoom;
  vp.zoom = newZoom;

  vp.x = clamp(vp.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  vp.y = clamp(vp.y, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY);

  applyViewport();
  saveBoard();
}

/** CREATE / BRANCH / RESPONSE **/
function centerPoint(){
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
  state.board.edges.push({ id: uid("e"), src: parentId, dst: id, kind:"lineage" });
  saveBoard(); renderBoard();
  return id;
}

// Only allow response -> prompt branches for follow-ups
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

  if(parent.type === "response"){
    state.board.edges.push({ id: uid("e"), src: nodeId, dst: id, kind:"lineage" });
  }
  saveBoard(); renderBoard();
  return id;
}

/** CONTEXT **/
function getLineage(nodeId){
  const { edges } = state.board;
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

function getConnectedComponent(startId){
  const { edges } = state.board;
  const visited = new Set();
  const stack = [startId];
  while(stack.length){
    const id = stack.pop();
    if(visited.has(id)) continue;
    visited.add(id);
    for(const e of edges){
      if(e.kind !== "knowledge") continue;
      if(e.src === id && !visited.has(e.dst)) stack.push(e.dst);
      if(e.dst === id && !visited.has(e.src)) stack.push(e.src);
    }
  }
  return Array.from(visited);
}

function buildMessagesForPrompt(promptNodeId){
  const { nodes } = state.board;
  const lineageOrder = getLineage(promptNodeId);
  const network = getConnectedComponent(promptNodeId);

  const msgs = [];

  // lineage first
  for(const id of lineageOrder){
    const n = nodes[id];
    if(!n) continue;
    if(n.type === "prompt" && n.content)   msgs.push({ role:"user",      content: n.content });
    if(n.type === "response" && n.content) msgs.push({ role:"assistant", content: n.content });
  }

  // current prompt
  const current = nodes[promptNodeId];
  const promptText = (current?.content || "").trim();
  if(!promptText) throw new Error("Prompt is empty.");
  msgs.push({ role:"user", content: promptText });

  // add other nodes in knowledge network
  for(const id of network){
    if(id === promptNodeId || lineageOrder.includes(id)) continue;
    const n = nodes[id];
    if(!n || !n.content) continue;
    if(n.type === "prompt")   msgs.push({ role:"user", content: n.content });
    if(n.type === "response") msgs.push({ role:"assistant", content: n.content });
  }

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
    // no auto-open of context drawer

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
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** EXPORT with Save As */
async function exportBoard(){
  const data = serializeBoard();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const suggested = `nodea-workspace-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.nodea.json`;

  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggested,
        types: [{ description: "Nodea Workspace", accept: { "application/json": [".nodea.json", ".json"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      toast("Workspace saved.");
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
    console.warn("showSaveFilePicker failed, falling back:", err);
  }

  const name = (prompt("File name:", suggested) || suggested).trim() || suggested;
  downloadBlob(blob, name);
  toast("Saved to your Downloads folder.");
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
  document.body.classList.add("drawer-open");
}
function closeContextDrawer(){
  drawerContext.classList.add("hidden");
  drawerContext.setAttribute("aria-hidden","true");
  document.body.classList.remove("drawer-open");
}

/** Center on graph **/
function centerOnGraph(){
  const ids = Object.keys(state.board.nodes);
  if(ids.length === 0) return;

  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  for(const id of ids){
    const n = state.board.nodes[id];
    const x = n.x||0, y = n.y||0, w = n.w||320, h = n.h||140;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
  }
  const cx = (minX + maxX)/2;
  const cy = (minY + maxY)/2;

  const rect = canvas.getBoundingClientRect();
  const vp = state.board.viewport;
  const z = vp.zoom;

  vp.x = rect.width/2  - cx * z;
  vp.y = rect.height/2 - cy * z;
  vp.x = clamp(vp.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  vp.y = clamp(vp.y, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY);

  applyViewport(); saveBoard();
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

  // Center
  if(btnCenter) btnCenter.onclick = centerOnGraph;

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

  // Pan on empty background and cancel pending connector
  canvas.addEventListener("pointerdown", (e)=>{
    if(e.target === canvas || e.target === stage){
      state.board.selection.clear?.();
      state.ui.pendingConnect = null;
      startPan(e);
    }
  });
  window.addEventListener("pointermove", movePan);
  window.addEventListener("pointerup", endPan);

  // Zoom anywhere over canvas
  canvas.addEventListener("wheel", onWheel, { passive:false });

  // Optional keyboard toggle for collapse on focused node
  document.addEventListener("keydown", (e)=>{
    const el = document.activeElement?.closest?.(".node");
    if(!el) return;
    const id = el.dataset.id;
    const n = state.board.nodes[id];
    if(!n) return;
    n.meta = n.meta || {};
    n.meta.collapsed = !n.meta.collapsed;
    saveBoard();
    renderBoard();
  });
}

function init(){
  loadBoard();
  renderHeader();
  ensureFirstPrompt();
  wireEvents();
  renderBoard();
}

document.addEventListener("DOMContentLoaded", init);

