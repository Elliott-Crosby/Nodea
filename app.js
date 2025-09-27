/* ===========================
   Nodea — Phase 1 Frontend
   =========================== */

/** CONFIG **/
const API_BASE = "https://nodea-api.onrender.com"; // Your Render backend URL
const LS_KEY = "OPENAI_KEY";
const LS_BOARD = "NODEA_BOARD";
const MODEL_DEFAULT = "gpt-4o-mini";
const TOKEN_BUDGET_PAIRS = 6; // keep last N prompt/response pairs from lineage

/** STATE **/
const state = {
  board: {
    nodes: {},        // id -> node
    edges: [],        // { id, src, dst, kind: 'lineage' }
    selection: new Set(),
    viewport: { x: 0, y: 0, zoom: 1 }
  },
  ui: {
    running: false,
    lastContext: []   // preview of messages about to be sent
  }
};

/** UTIL **/
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = (p="n") => `${p}_${Math.random().toString(36).slice(2,9)}_${Date.now().toString(36)}`;

function saveBoard(){
  localStorage.setItem(LS_BOARD, JSON.stringify(state.board));
}
function loadBoard(){
  try{
    const raw = localStorage.getItem(LS_BOARD);
    if(!raw) return;
    const b = JSON.parse(raw);
    // revive selection / defaults
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

/** RENDERERS **/
function renderHeader(){
  const hasKey = !!keyGet();
  keyChip.textContent = hasKey ? "Key: Set" : "Key: Missing";
  keyChip.classList.toggle("muted", !hasKey);
}

function renderNodes(){
  // Clear existing nodes (simple approach for Phase 1)
  $$(".node", canvas).forEach(n => n.remove());

  for(const nodeId in state.board.nodes){
    const n = state.board.nodes[nodeId];
    const el = document.createElement("div");
    el.className = `node ${n.type}${n.dragging ? " dragging":""}`;
    el.style.left = (n.x||0) + "px";
    el.style.top  = (n.y||0) + "px";
    el.style.width = (n.w || 320) + "px";
    el.dataset.id = n.id;

    // Toolbar (drag handle + title + actions)
    const bar = document.createElement("div");
    bar.className = "toolbar";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = n.type === "prompt" ? "Prompt" : (n.type === "response" ? "Response" : "Node");

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

    // Actions vary by node type
    if(n.type === "prompt"){
      const btnRun = document.createElement("button");
      btnRun.className = "btn secondary";
      btnRun.textContent = state.ui.running ? "Running…" : "Run";
      btnRun.disabled = state.ui.running;
      btnRun.onclick = () => runPrompt(n.id);

      const btnBranch = document.createElement("button");
      btnBranch.className = "btn secondary";
      btnBranch.textContent = "Branch";
      btnBranch.onclick = () => branchFrom(n.id);

      toolbarRight.append(btnBranch, btnRun);
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
    } else if(n.type === "response"){
      const pre = document.createElement("pre");
      pre.textContent = n.content || "";
      body.appendChild(pre);
    }

    el.appendChild(body);
    canvas.appendChild(el);

    // Dragging
    enableDrag(el, n.id);
  }
}

function renderEdges(){
  // Clear svg
  while(edgesLayer.firstChild) edgesLayer.removeChild(edgesLayer.firstChild);
  const { edges, nodes } = state.board;

  for(const e of edges){
    if(e.kind !== "lineage") continue;
    const src = nodes[e.src], dst = nodes[e.dst];
    if(!src || !dst) continue;

    const srcX = (src.x||0) + (src.w||320)/2;
    const srcY = (src.y||0) + 30; // toolbar center
    const dstX = (dst.x||0) + (dst.w||320)/2;
    const dstY = (dst.y||0) + 30;

    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    const dx = (dstX - srcX) * 0.4;
    const d = `M ${srcX} ${srcY} C ${srcX+dx} ${srcY}, ${dstX-dx} ${dstY}, ${dstX} ${dstY}`;
    path.setAttribute("d", d);
    path.setAttribute("fill","none");
    path.setAttribute("stroke","#2f3a55");
    path.setAttribute("stroke-width","2");
    path.setAttribute("opacity","0.9");
    edgesLayer.appendChild(path);
  }
}

function renderBoard(){
  renderHeader();
  renderNodes();
  renderEdges();
}

/** DRAG **/
function enableDrag(el, nodeId){
  const node = state.board.nodes[nodeId];
  const handle = el.querySelector(".toolbar");
  let startX=0,startY=0,startLeft=0,startTop=0, dragging=false;

  handle.addEventListener("pointerdown", (ev)=>{
    dragging = true;
    el.classList.add("dragging");
    startX = ev.clientX; startY = ev.clientY;
    startLeft = parseFloat(el.style.left)||0;
    startTop  = parseFloat(el.style.top)||0;
    el.setPointerCapture(ev.pointerId);
  });

  handle.addEventListener("pointermove", (ev)=>{
    if(!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const nx = Math.round((startLeft + dx));
    const ny = Math.round((startTop  + dy));
    el.style.left = nx + "px";
    el.style.top  = ny + "px";
    node.x = nx; node.y = ny;
    renderEdges(); // cheap redraw
  });

  handle.addEventListener("pointerup", (ev)=>{
    if(!dragging) return;
    dragging = false;
    el.classList.remove("dragging");
    saveBoard();
  });
}

/** CREATE / BRANCH / RESPONSE **/
function centerPoint(){
  const rect = canvas.getBoundingClientRect();
  const scrollX = canvas.scrollLeft || 0;
  const scrollY = canvas.scrollTop || 0;
  return { x: Math.round(scrollX + rect.width/2 - 160), y: Math.round(scrollY + rect.height/2 - 80) };
}

function createPromptNode(pos){
  const id = uid("prompt");
  const p = { id, type:"prompt", title:"Prompt", content:"", x: pos.x, y: pos.y, w:320, h:140, meta:{} };
  state.board.nodes[id] = p;
  saveBoard(); renderBoard();
  return id;
}

function createResponseNode(parentId, text, meta={}){
  const parent = state.board.nodes[parentId];
  const id = uid("resp");
  const y = (parent.y||0) + 160; // below
  const r = { id, type:"response", title:"Response", content: text, x: parent.x, y, w:320, h:140, meta };
  state.board.nodes[id] = r;
  // lineage edge
  state.board.edges.push({ id: uid("e"), src: parentId, dst: id, kind:"lineage" });
  saveBoard(); renderBoard();
  return id;
}

function branchFrom(nodeId){
  const parent = state.board.nodes[nodeId];
  const id = uid("prompt");
  const p = {
    id, type:"prompt", title:"Prompt", content:"", w:320, h:140, meta:{},
    x: (parent.x||0) + 260, y: parent.y||0
  };
  state.board.nodes[id] = p;
  state.board.edges.push({ id: uid("e"), src: nodeId, dst: id, kind:"lineage" });
  saveBoard(); renderBoard();
  return id;
}

/** CONTEXT (Phase 1: lineage only) **/
function getLineage(nodeId){
  const { nodes, edges } = state.board;
  // Walk backwards following incoming lineage edges to root
  const path = [];
  let current = nodeId;
  // Collect ancestors (prompts + responses)
  const visited = new Set();
  while(current && !visited.has(current)){
    visited.add(current);
    const incoming = edges.find(e => e.kind==="lineage" && e.dst === current);
    if(!incoming) break;
    current = incoming.src;
    if(current) path.push(current);
  }
  // path now has ancestors from child→...→root, reverse to root→...→parent
  return path.reverse();
}

function buildMessagesForPrompt(promptNodeId){
  const { nodes } = state.board;
  const lineageOrder = getLineage(promptNodeId); // root..parent
  const msgs = [];

  // Convert lineage nodes into alternating user/assistant
  for(const id of lineageOrder){
    const n = nodes[id];
    if(!n) continue;
    if(n.type === "prompt" && n.content) msgs.push({ role:"user", content: n.content });
    if(n.type === "response" && n.content) msgs.push({ role:"assistant", content: n.content });
  }

  // Finally add the current prompt text
  const current = nodes[promptNodeId];
  const promptText = (current?.content || "").trim();
  if(!promptText) throw new Error("Prompt is empty.");
  msgs.push({ role:"user", content: promptText });

  // Budget: keep last N prompt/response pairs (~2 msgs per pair)
  // We'll approximate by keeping last ~ (TOKEN_BUDGET_PAIRS*2 + 1) messages (the final user)
  const maxMsgs = TOKEN_BUDGET_PAIRS*2 + 1;
  const trimmed = msgs.slice(-maxMsgs);

  // Save preview for drawer
  state.ui.lastContext = trimmed.map(m => ({ role:m.role, content: m.content.slice(0,140) }));
  return trimmed;
}

/** NETWORKING **/
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
  return data; // { text, usage, model }
}

/** RUN **/
async function runPrompt(promptNodeId){
  try{
    state.ui.running = true; renderBoard();

    // Build context
    const messages = buildMessagesForPrompt(promptNodeId);
    openContextDrawer(); // show preview

    // Call model
    const model = ($("#inpModel")?.value || MODEL_DEFAULT).trim() || MODEL_DEFAULT;
    const result = await callChat({ messages, model, temperature:0.2, max_tokens:600 });

    // Create response
    createResponseNode(promptNodeId, result.text || "", { model: result.model || model });
    toast("Done.");
  }catch(err){
    const msg = String(err?.message || err);
    // Friendly translations
    if(/Missing API key/i.test(msg)) toast("No API key. Open Settings.", 3500);
    else if(/401|invalid api key/i.test(msg)) toast("Invalid or missing API key.", 3500);
    else if(/insufficient_quota|rate|429/i.test(msg)) toast("Your key has no credits or hit rate limits.", 4000);
    else toast(`Error: ${msg}`, 4000);
  }finally{
    state.ui.running = false; renderBoard();
  }
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
  // Populate list
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
  btnSettings.onclick = openSettings;
  $("[data-close-settings]").onclick = closeSettings;
  btnSaveKey.onclick = ()=>{ keySet(inpKey.value.trim()); renderHeader(); closeSettings(); toast("Key saved."); };
  btnClearKey.onclick = ()=>{ keySet(""); renderHeader(); closeSettings(); toast("Key cleared."); };

  btnContext.onclick = openContextDrawer;
  $("[data-close-context]").onclick = closeContextDrawer;

  btnNewPrompt.onclick = ()=>{ createPromptNode(centerPoint()); };

  // Close modals on background click
  modalSettings.addEventListener("click", (e)=>{ if(e.target === modalSettings) closeSettings(); });
  drawerContext.addEventListener("click", (e)=>{ if(e.target === drawerContext) closeContextDrawer(); });

  // Background click clears selection (future)
  canvas.addEventListener("pointerdown", (e)=>{ if(e.target === canvas) state.board.selection.clear(); });
}

function init(){
  loadBoard();
  renderHeader();
  ensureFirstPrompt();
  wireEvents();
  renderBoard();
}

document.addEventListener("DOMContentLoaded", init);

