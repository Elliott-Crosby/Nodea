/* ===========================
   Nodea - Branch links + Pan/Zoom + Center + Drawer push + Collapsible nodes + Knowledge edges + Auto-branch + Manual Branch button
   =========================== */

/** CONFIG **/
const API_BASE = "https://nodea-api.onrender.com";
const LS_KEY = "OPENAI_KEY";
const LS_BOARD = "NODEA_BOARD";
const LS_ZEN = "NODEA_ZEN";
const MODEL_DEFAULT = "gpt-4o-mini";
const TOKEN_BUDGET_PAIRS = 6;
const NODE_WIDTH_DEFAULT = 520;
const NODE_WIDTH_MIN = 360;
const NODE_WIDTH_MAX = 720;
const NODE_HEIGHT_DEFAULT = 200;
const NODE_VERTICAL_OFFSET = NODE_HEIGHT_DEFAULT + 40;
const NODE_HORIZONTAL_OFFSET = NODE_WIDTH_DEFAULT + 120;
const NODE_CLAMP_LINES = 12;

// Pan/Zoom limits
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.8;
const WORLD_BOUNDS = { minX: -2400, minY: -1600, maxX: 2400, maxY: 1600 };
const GRID_SIZE = 32;
const ALIGN_THRESHOLD = 8;
const MINIMAP_WIDTH = 220;
const MINIMAP_PADDING = 160;
const MINIMAP_IDLE_DELAY = 420;

/** STATE **/
const state = {
  board: {
    nodes: {},
    edges: [], // { id, src, dst, kind: 'lineage' | 'knowledge' }
    selection: new Set(),
    viewport: { x: 0, y: 0, zoom: 1 } // translate(x,y) and scale(zoom) applied to #stage
  },
  ui: { running: false, lastContext: [], pendingConnect: null, highlight: null, highlightTimer: null, zen: false }, // pendingConnect: { srcId }
  pan: { active: false, startX: 0, startY: 0, origX: 0, origY: 0 }
};

/** UTIL **/
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = (p="n") => `${p}_${Math.random().toString(36).slice(2,9)}_${Date.now().toString(36)}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;

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
const gridLayer = $("#gridLayer");
const edgesLayer = $("#edgesLayer");
const keyChip = $("#keyChip");
const btnSearch = $("#btnSearch");
const btnQuickExport = $("#btnQuickExport");
const btnOverflow = $("#btnOverflow");
const menuOverflow = $("#menuOverflow");
const contextStatus = $("#contextStatus");
const zenStatus = $("#zenStatus");
const modalSettings = $("#modalSettings");
const inpKey = $("#inpKey");
const inpModel = $("#inpModel");
const btnSaveKey = $("#btnSaveKey");
const btnClearKey = $("#btnClearKey");
const btnNewPrompt = $("#btnNewPrompt");
const drawerContext = $("#drawerContext");
const ctxList = $("#ctxList");
const ctxCount = $("#ctxCount");
const fileImport = $("#fileImport");
const modalClear = $("#modalClear");
const btnCancelClear = $("#btnCancelClear");
const btnConfirmClear = $("#btnConfirmClear");
const mainEl = $("main");
let overflowOpen = false;

let guideLines = null;
let minimap = null;
let minimapNodesLayer = null;
let minimapViewport = null;
let minimapBounds = null;
let minimapScale = 1;
let minimapActivityTimer = null;
const minimapNodeEls = new Map();
let nodeResizeObserver = null;
let activeNodeMenu = null;

/** RENDERERS **/
function renderHeader(){
  const hasKey = !!keyGet();
  if(keyChip){
    keyChip.textContent = hasKey ? "Set" : "Missing";
    keyChip.classList.toggle("muted", !hasKey);
    keyChip.classList.toggle("active", hasKey);
  }
  if(contextStatus){
    const open = !drawerContext.classList.contains("hidden");
    contextStatus.textContent = open ? "On" : "Off";
    contextStatus.classList.toggle("active", open);
  }
  if(zenStatus){
    const on = !!state.ui.zen;
    zenStatus.textContent = on ? "On" : "Off";
    zenStatus.classList.toggle("active", on);
  }
}

function applyZenMode(){
  document.body.classList.toggle("zen-mode", state.ui.zen);
}

function setZenMode(on){
  state.ui.zen = !!on;
  applyZenMode();
  localStorage.setItem(LS_ZEN, state.ui.zen ? "1" : "0");
  renderHeader();
  toast(state.ui.zen ? "Zen mode on." : "Zen mode off.", 1600);
}

function toggleZenMode(){
  setZenMode(!state.ui.zen);
}

function loadZenMode(){
  state.ui.zen = localStorage.getItem(LS_ZEN) === "1";
  applyZenMode();
}

function applyViewport(){
  const { x, y, zoom } = state.board.viewport;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
  updateMinimapViewport();
}

function renderNodes(){
  $$(".node", stage).forEach(n => {
    if(nodeResizeObserver){
      nodeResizeObserver.unobserve(n);
    }
    n.remove();
  });

  closeActiveNodeMenu();
  ensureNodeResizeObserver();
  nodeResizeObserver?.disconnect();

  for(const nodeId in state.board.nodes){
    const n = state.board.nodes[nodeId];
    const el = document.createElement("div");
    const classes = ["node", n.type];
    if(n.dragging) classes.push("dragging");
    if(state.ui.highlight === n.id) classes.push("highlight");
    if(n.meta?.collapsed) classes.push("collapsed");
    el.className = classes.join(" ");
    el.dataset.id = n.id;

    const width = clamp(n.w || NODE_WIDTH_DEFAULT, NODE_WIDTH_MIN, NODE_WIDTH_MAX);
    n.w = width;
    el.style.left = `${n.x || 0}px`;
    el.style.top = `${n.y || 0}px`;
    el.style.width = `${width}px`;

    const header = document.createElement("div");
    header.className = "node-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "node-header-left";

    const chip = document.createElement("span");
    chip.className = "node-chip";
    const chipLabel = n.meta?.model || (n.type === "prompt" ? (modelGet() || MODEL_DEFAULT) : MODEL_DEFAULT);
    chip.textContent = chipLabel;
    headerLeft.appendChild(chip);

    const titleEl = document.createElement("div");
    titleEl.className = "node-title";
    const titleText = (n.title || "").trim() || (n.type === "prompt" ? "Prompt" : "Response");
    titleEl.textContent = titleText;
    titleEl.title = titleText;
    headerLeft.appendChild(titleEl);

    header.appendChild(headerLeft);

    const actions = document.createElement("div");
    actions.className = "node-header-actions";

    const btnBranch = document.createElement("button");
    btnBranch.className = "node-icon";
    btnBranch.type = "button";
    btnBranch.title = "Branch";
    btnBranch.textContent = "➜";
    btnBranch.onclick = (e)=>{ e.stopPropagation(); manualBranch(n.id); };
    actions.appendChild(btnBranch);

    const btnCollapse = document.createElement("button");
    btnCollapse.className = "node-icon";
    btnCollapse.type = "button";
    btnCollapse.title = n.meta?.collapsed ? "Expand" : "Collapse";
    btnCollapse.textContent = n.meta?.collapsed ? "›" : "⌄";
    btnCollapse.onclick = (e)=>{
      e.stopPropagation();
      n.meta = n.meta || {};
      n.meta.collapsed = !n.meta.collapsed;
      saveBoard();
      renderBoard();
    };
    actions.appendChild(btnCollapse);

    const btnMenu = document.createElement("button");
    btnMenu.className = "node-icon";
    btnMenu.type = "button";
    btnMenu.title = "More";
    btnMenu.textContent = "⋯";
    btnMenu.setAttribute("aria-haspopup", "true");
    btnMenu.setAttribute("aria-expanded", "false");
    actions.appendChild(btnMenu);

    header.appendChild(actions);
    el.appendChild(header);

    const body = document.createElement("div");
    body.className = "node-body";

    if(n.type === "prompt"){
      const ta = document.createElement("textarea");
      ta.className = "node-textarea";
      ta.placeholder = "Type your prompt…";
      ta.value = n.content || "";
      ta.addEventListener("pointerdown", e => e.stopPropagation());
      ta.addEventListener("focus", e => e.stopPropagation());
      ta.addEventListener("input", (e) => {
        n.content = e.target.value;
        autoSizeTextarea(ta);
        saveBoard();
      });
      autoSizeTextarea(ta);
      if(n.meta?.autofocus){
        setTimeout(()=> ta.focus(), 0);
        n.meta.autofocus = false;
      }
      body.appendChild(ta);
    } else {
      const contentWrap = document.createElement("div");
      contentWrap.className = "node-body-content";
      renderRichContent(contentWrap, n.content || "");
      body.appendChild(contentWrap);

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "node-toggle";
      toggleBtn.textContent = n.meta?.expanded ? "Show less" : "Show more";
      toggleBtn.onclick = (e)=>{
        e.stopPropagation();
        n.meta = n.meta || {};
        n.meta.expanded = !n.meta.expanded;
        saveBoard();
        renderBoard();
      };

      handleClamp(n, contentWrap, body, toggleBtn);
    }

    el.appendChild(body);

    const menu = document.createElement("div");
    menu.className = "node-menu hidden";

    if(n.type === "prompt"){
      const runItem = document.createElement("button");
      runItem.type = "button";
      runItem.textContent = state.ui.running ? "Running…" : "Run prompt";
      runItem.disabled = !!state.ui.running;
      runItem.onclick = (e)=>{
        e.stopPropagation();
        closeActiveNodeMenu();
        if(!state.ui.running) runPrompt(n.id);
      };
      menu.appendChild(runItem);
    }

    const connectItem = document.createElement("button");
    connectItem.type = "button";
    connectItem.textContent = "Connect knowledge";
    connectItem.onclick = (e)=>{
      e.stopPropagation();
      closeActiveNodeMenu();
      state.ui.pendingConnect = { srcId: n.id };
      toast("Select another node to connect...");
    };
    menu.appendChild(connectItem);

    el.appendChild(menu);

    btnMenu.onclick = (e)=>{
      e.stopPropagation();
      if(activeNodeMenu?.menu === menu){
        closeActiveNodeMenu();
      } else {
        openNodeMenu(btnMenu, menu);
      }
    };

    el.addEventListener("pointerdown", () => closeActiveNodeMenu());
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

    if(nodeResizeObserver){
      nodeResizeObserver.observe(el);
    }

    enableDrag(el, n.id, header);
  }
  renderEdges();
}

function ensureNodeResizeObserver(){
  if(typeof ResizeObserver !== "function") return;
  if(nodeResizeObserver) return;
  nodeResizeObserver = new ResizeObserver(entries => {
    for(const entry of entries){
      const el = entry.target;
      const id = el.dataset.id;
      if(!id) continue;
      const node = state.board.nodes[id];
      if(!node) continue;
      const rect = entry.contentRect;
      const width = clamp(Math.round(rect.width), NODE_WIDTH_MIN, NODE_WIDTH_MAX);
      const height = Math.max(Math.round(rect.height), NODE_HEIGHT_DEFAULT);
      node.w = width;
      node.h = height;
      updateMinimapNodePosition(id, node.x || 0, node.y || 0, width, height);
    }
  });
}

function autoSizeTextarea(el){
  if(!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, 120)}px`;
}

function renderRichContent(container, text){
  if(!container) return;
  container.innerHTML = "";
  if(!text){
    const p = document.createElement("p");
    p.textContent = "(empty response)";
    container.appendChild(p);
    return;
  }

  const lines = text.split(/\r?\n/);
  let paragraph = [];
  let currentList = null;
  let listTag = null;
  let inCode = false;
  let codeBuffer = [];

  const flushParagraph = () => {
    if(!paragraph.length) return;
    const p = document.createElement("p");
    p.textContent = paragraph.join(" ").trim();
    container.appendChild(p);
    paragraph = [];
  };

  const flushList = () => {
    if(currentList){
      container.appendChild(currentList);
      currentList = null;
      listTag = null;
    }
  };

  const flushCode = () => {
    const pre = document.createElement("pre");
    pre.textContent = codeBuffer.join("\n");
    container.appendChild(pre);
    codeBuffer = [];
    inCode = false;
  };

  for(const line of lines){
    if(line.trim().startsWith("```")){
      flushParagraph();
      flushList();
      if(inCode){
        flushCode();
      } else {
        inCode = true;
      }
      continue;
    }

    if(inCode){
      codeBuffer.push(line);
      continue;
    }

    const trimmed = line.trim();
    if(trimmed === ""){
      flushParagraph();
      flushList();
      continue;
    }

    const bulletMatch = line.match(/^\s*([*+-])\s+(.*)$/);
    if(bulletMatch){
      flushParagraph();
      if(listTag !== "ul"){
        flushList();
        currentList = document.createElement("ul");
        listTag = "ul";
      }
      const li = document.createElement("li");
      li.textContent = bulletMatch[2].trim();
      currentList.appendChild(li);
      continue;
    }

    const orderedMatch = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if(orderedMatch){
      flushParagraph();
      if(listTag !== "ol"){
        flushList();
        currentList = document.createElement("ol");
        listTag = "ol";
      }
      const li = document.createElement("li");
      li.textContent = orderedMatch[2].trim();
      currentList.appendChild(li);
      continue;
    }

    const quoteMatch = line.match(/^\s*>+\s?(.*)$/);
    if(quoteMatch){
      flushParagraph();
      flushList();
      const blockquote = document.createElement("blockquote");
      blockquote.textContent = quoteMatch[1];
      container.appendChild(blockquote);
      continue;
    }

    paragraph.push(trimmed);
  }

  if(inCode){
    flushCode();
  }

  flushParagraph();
  flushList();

  if(container.childElementCount === 0){
    const p = document.createElement("p");
    p.textContent = text;
    container.appendChild(p);
  }
}

function handleClamp(node, contentEl, bodyEl, toggleBtn){
  requestAnimationFrame(()=>{
    if(!contentEl?.isConnected) return;
    const styles = getComputedStyle(contentEl);
    const lineHeight = parseFloat(styles.lineHeight) || 22;
    const clampHeight = lineHeight * NODE_CLAMP_LINES;
    const expanded = !!node.meta?.expanded;
    const fullHeight = contentEl.scrollHeight;

    if(expanded){
      contentEl.style.maxHeight = `${fullHeight}px`;
      contentEl.classList.remove("is-clamped");
      toggleBtn.textContent = "Show less";
      if(toggleBtn.parentElement !== bodyEl) bodyEl.appendChild(toggleBtn);
    } else if(fullHeight > clampHeight + 2){
      contentEl.style.maxHeight = `${clampHeight}px`;
      contentEl.classList.add("is-clamped");
      toggleBtn.textContent = "Show more";
      if(toggleBtn.parentElement !== bodyEl) bodyEl.appendChild(toggleBtn);
    } else {
      contentEl.style.maxHeight = "";
      contentEl.classList.remove("is-clamped");
      if(toggleBtn.parentElement) toggleBtn.remove();
    }
  });
}

function openNodeMenu(button, menu){
  if(!menu || !button) return;
  closeActiveNodeMenu();
  menu.classList.remove("hidden");
  button.setAttribute("aria-expanded", "true");
  const card = button.closest(".node");
  card?.classList.add("menu-open");
  activeNodeMenu = { button, menu, card };
}

function closeActiveNodeMenu(){
  if(!activeNodeMenu) return;
  activeNodeMenu.menu.classList.add("hidden");
  activeNodeMenu.button.setAttribute("aria-expanded", "false");
  activeNodeMenu.card?.classList.remove("menu-open");
  activeNodeMenu = null;
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

    const srcWidth = src.w || NODE_WIDTH_DEFAULT;
    const dstWidth = dst.w || NODE_WIDTH_DEFAULT;
    const srcX = (src.x||0) + srcWidth/2;
    const srcY = (src.y||0) + 30;
    const dstX = (dst.x||0) + dstWidth/2;
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

    const aw = a.w || NODE_WIDTH_DEFAULT;
    const bw = b.w || NODE_WIDTH_DEFAULT;
    const ax = (a.x||0) + aw/2;
    const ay = (a.y||0) + 30;
    const bx = (b.x||0) + bw/2;
    const by = (b.y||0) + 30;

    const line = document.createElementNS("http://www.w3.org/2000/svg","path");
    line.setAttribute("d", `M ${ax} ${ay} L ${bx} ${by}`);
    line.setAttribute("class","knowledge");
    edgesLayer.appendChild(line);
  }
}

function setupGuides(){
  if(guideLines || !stage) return;
  const vertical = document.createElement("div");
  vertical.className = "guide-line vertical";
  const horizontal = document.createElement("div");
  horizontal.className = "guide-line horizontal";
  stage.appendChild(vertical);
  stage.appendChild(horizontal);
  guideLines = { vertical, horizontal };
}

function hideGuides(){
  if(!guideLines) return;
  guideLines.vertical.classList.remove("active");
  guideLines.horizontal.classList.remove("active");
}

function updateAlignmentGuides(nodeId, x, y, w, h){
  setupGuides();
  if(!guideLines) return;

  const nodes = state.board.nodes;
  const currentX = [x, x + w / 2, x + w];
  const currentY = [y, y + h / 2, y + h];
  let bestVertical = null;
  let bestHorizontal = null;

  for(const id in nodes){
    if(id === nodeId) continue;
    const other = nodes[id];
    if(!other) continue;
    const ox = other.x || 0;
    const oy = other.y || 0;
    const ow = other.w || NODE_WIDTH_DEFAULT;
    const oh = other.h || NODE_HEIGHT_DEFAULT;
    const otherX = [ox, ox + ow / 2, ox + ow];
    const otherY = [oy, oy + oh / 2, oy + oh];

    for(const cx of currentX){
      for(const oxVal of otherX){
        const diff = Math.abs(cx - oxVal);
        if(diff <= ALIGN_THRESHOLD && (!bestVertical || diff < bestVertical.diff)){
          bestVertical = { pos: oxVal, diff };
        }
      }
    }

    for(const cy of currentY){
      for(const oyVal of otherY){
        const diff = Math.abs(cy - oyVal);
        if(diff <= ALIGN_THRESHOLD && (!bestHorizontal || diff < bestHorizontal.diff)){
          bestHorizontal = { pos: oyVal, diff };
        }
      }
    }
  }

  if(bestVertical){
    guideLines.vertical.style.left = `${bestVertical.pos}px`;
    guideLines.vertical.classList.add("active");
  } else {
    guideLines.vertical.classList.remove("active");
  }

  if(bestHorizontal){
    guideLines.horizontal.style.top = `${bestHorizontal.pos}px`;
    guideLines.horizontal.classList.add("active");
  } else {
    guideLines.horizontal.classList.remove("active");
  }
}

function setupMinimap(){
  if(minimap || !mainEl) return;
  minimap = document.createElement("div");
  minimap.id = "minimap";
  minimap.className = "minimap";
  minimap.setAttribute("aria-hidden", "true");

  minimapNodesLayer = document.createElement("div");
  minimapNodesLayer.className = "minimap-nodes";
  minimapViewport = document.createElement("div");
  minimapViewport.className = "minimap-viewport";

  minimap.append(minimapNodesLayer, minimapViewport);
  mainEl.appendChild(minimap);
}

function getBoardBounds(){
  const nodes = state.board.nodes || {};
  const ids = Object.keys(nodes);
  if(ids.length === 0){
    return {
      minX: WORLD_BOUNDS.minX,
      minY: WORLD_BOUNDS.minY,
      maxX: WORLD_BOUNDS.maxX + NODE_WIDTH_MAX,
      maxY: WORLD_BOUNDS.maxY + NODE_HEIGHT_DEFAULT
    };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for(const id of ids){
    const node = nodes[id];
    if(!node) continue;
    const w = node.w || NODE_WIDTH_DEFAULT;
    const h = node.h || NODE_HEIGHT_DEFAULT;
    const x = node.x || 0;
    const y = node.y || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  return {
    minX: minX - MINIMAP_PADDING,
    minY: minY - MINIMAP_PADDING,
    maxX: maxX + MINIMAP_PADDING,
    maxY: maxY + MINIMAP_PADDING
  };
}

function renderMinimap(){
  if(!mainEl) return;
  if(!minimap) setupMinimap();
  if(!minimap || !minimapNodesLayer || !minimapViewport) return;

  const bounds = getBoardBounds();
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  minimapScale = MINIMAP_WIDTH / width;
  minimapBounds = { minX: bounds.minX, minY: bounds.minY, width, height };
  minimap.style.height = `${height * minimapScale}px`;

  minimapNodesLayer.innerHTML = "";
  minimapNodeEls.clear();

  for(const id in state.board.nodes){
    const node = state.board.nodes[id];
    if(!node) continue;
    const nodeEl = document.createElement("div");
    nodeEl.className = `minimap-node${node.type ? ` ${node.type}` : ""}`;
    const nodeWidth = Math.max((node.w || NODE_WIDTH_DEFAULT) * minimapScale, 4);
    const nodeHeight = Math.max((node.h || NODE_HEIGHT_DEFAULT) * minimapScale, 4);
    const left = ((node.x || 0) - minimapBounds.minX) * minimapScale;
    const top = ((node.y || 0) - minimapBounds.minY) * minimapScale;
    nodeEl.style.width = `${nodeWidth}px`;
    nodeEl.style.height = `${nodeHeight}px`;
    nodeEl.style.left = `${left}px`;
    nodeEl.style.top = `${top}px`;
    minimapNodesLayer.appendChild(nodeEl);
    minimapNodeEls.set(id, nodeEl);
  }

  updateMinimapViewport();
}

function updateMinimapViewport(){
  if(!minimap || !minimapViewport || !minimapBounds || !canvas) return;
  const { viewport } = state.board;
  const rect = canvas.getBoundingClientRect();
  const worldX = (-viewport.x) / viewport.zoom;
  const worldY = (-viewport.y) / viewport.zoom;
  const worldW = rect.width / viewport.zoom;
  const worldH = rect.height / viewport.zoom;

  const left = (worldX - minimapBounds.minX) * minimapScale;
  const top = (worldY - minimapBounds.minY) * minimapScale;
  const width = Math.max(worldW * minimapScale, 6);
  const height = Math.max(worldH * minimapScale, 6);

  const mapWidth = minimapBounds.width * minimapScale;
  const mapHeight = minimapBounds.height * minimapScale;
  const clampedLeft = Math.min(Math.max(left, 0), Math.max(mapWidth - width, 0));
  const clampedTop = Math.min(Math.max(top, 0), Math.max(mapHeight - height, 0));

  minimapViewport.style.width = `${width}px`;
  minimapViewport.style.height = `${height}px`;
  minimapViewport.style.left = `${clampedLeft}px`;
  minimapViewport.style.top = `${clampedTop}px`;
}

function updateMinimapNodePosition(nodeId, x, y, w, h){
  if(!minimapBounds || !minimapNodeEls.has(nodeId)) return;
  const el = minimapNodeEls.get(nodeId);
  if(!el) return;
  el.style.left = `${(x - minimapBounds.minX) * minimapScale}px`;
  el.style.top = `${(y - minimapBounds.minY) * minimapScale}px`;
  el.style.width = `${Math.max(w * minimapScale, 4)}px`;
  el.style.height = `${Math.max(h * minimapScale, 4)}px`;
}

function beginMinimapInteraction(){
  if(!minimap) return;
  minimap.classList.add("interacting");
  if(minimapActivityTimer){
    clearTimeout(minimapActivityTimer);
    minimapActivityTimer = null;
  }
}

function endMinimapInteraction(delay = MINIMAP_IDLE_DELAY){
  if(!minimap) return;
  if(minimapActivityTimer){
    clearTimeout(minimapActivityTimer);
  }
  minimapActivityTimer = setTimeout(()=>{
    minimap?.classList.remove("interacting");
    minimapActivityTimer = null;
  }, delay);
}

function flashMinimap(){
  beginMinimapInteraction();
  endMinimapInteraction();
}

function renderBoard(){
  renderHeader();
  applyViewport();
  hideGuides();
  renderNodes();
  renderMinimap();
}

/** SEARCH & FOCUS **/
function highlightNode(nodeId, { render = true } = {}){
  if(state.ui.highlightTimer){
    clearTimeout(state.ui.highlightTimer);
    state.ui.highlightTimer = null;
  }
  state.ui.highlight = nodeId || null;
  if(render) renderBoard();
  if(nodeId){
    state.ui.highlightTimer = setTimeout(()=>{
      state.ui.highlight = null;
      state.ui.highlightTimer = null;
      renderBoard();
    }, 2000);
  }
}

function focusOnNode(nodeId){
  const node = state.board.nodes[nodeId];
  if(!node) return;

  const vp = state.board.viewport;
  const rect = canvas.getBoundingClientRect();
  const w = node.w || NODE_WIDTH_DEFAULT;
  const h = node.h || NODE_HEIGHT_DEFAULT;
  const z = vp.zoom;

  const targetX = rect.width/2  - ((node.x||0) + w/2) * z;
  const targetY = rect.height/2 - ((node.y||0) + h/2) * z;

  vp.x = clamp(targetX, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  vp.y = clamp(targetY, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY);

  saveBoard();
  highlightNode(nodeId, { render: false });
  renderBoard();
}

function openSearchDialog(){
  const nodes = Object.values(state.board.nodes);
  if(nodes.length === 0){
    toast("No nodes on the board yet.");
    return;
  }

  const input = prompt("Search nodes (matches prompt & response text):");
  if(!input) return;

  const query = input.trim().toLowerCase();
  if(!query) return;

  const match = nodes.find(n => {
    const haystack = `${n.title || ""} ${n.content || ""} ${n.id || ""}`.toLowerCase();
    return haystack.includes(query);
  });

  if(!match){
    toast("No nodes matched your search.");
    return;
  }

  focusOnNode(match.id);
  const label = match.type === "prompt" ? "prompt" : (match.type === "response" ? "response" : "node");
  toast(`Focused on ${label}.`, 1400);
}

/** DRAG - handle-only **/
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
    setupGuides();
    hideGuides();
    handleEl.setPointerCapture?.(ev.pointerId);
  }
  function onMove(ev){
    if(!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if(!moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) moved = true;
    if(!moved) return;

    const rawX = startLeft + dx;
    const rawY = startTop + dy;
    const nx = clamp(snapToGrid(rawX), WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
    const ny = clamp(snapToGrid(rawY), WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY);
    el.style.left = nx + "px";
    el.style.top  = ny + "px";
    node.x = nx; node.y = ny;
    const width = node.w || NODE_WIDTH_DEFAULT;
    const height = node.h || NODE_HEIGHT_DEFAULT;
    updateAlignmentGuides(nodeId, nx, ny, width, height);
    updateMinimapNodePosition(nodeId, nx, ny, width, height);
    renderEdges();
  }
  function onUp(ev){
    if(!dragging) return;
    dragging = false;
    el.classList.remove("dragging");
    hideGuides();
    if(moved) renderMinimap();
    saveBoard();
    handleEl.releasePointerCapture?.(ev.pointerId);
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
  beginMinimapInteraction();
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
  endMinimapInteraction();
}

// Wheel zoom around cursor
function onWheel(ev){
  ev.preventDefault();
  flashMinimap();
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
  endMinimapInteraction();
}

/** CREATE / BRANCH / RESPONSE **/
function centerPoint(){
  const rect = canvas.getBoundingClientRect();
  const { x, y, zoom } = state.board.viewport;
  const worldX = (rect.width/2 - x)/zoom - NODE_WIDTH_DEFAULT/2;
  const worldY = (rect.height/2 - y)/zoom - NODE_HEIGHT_DEFAULT/2;
  return {
    x: clamp(snapToGrid(worldX), WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
    y: clamp(snapToGrid(worldY), WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY)
  };
}

function createPromptNode(pos){
  const id = uid("prompt");
  const px = clamp(snapToGrid(pos?.x ?? 0), WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  const py = clamp(snapToGrid(pos?.y ?? 0), WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY);
  const p = { id, type:"prompt", title:"Prompt", content:"", x: px, y: py, w: NODE_WIDTH_DEFAULT, h: NODE_HEIGHT_DEFAULT, meta:{ autofocus:true } };
  state.board.nodes[id] = p;
  saveBoard(); renderBoard();
  return id;
}

function createResponseNode(parentId, text, meta={}){
  const parent = state.board.nodes[parentId];
  const id = uid("resp");
  const x = clamp(snapToGrid(parent.x||0), WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  const y = clamp(snapToGrid((parent.y||0) + NODE_VERTICAL_OFFSET), WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY);
  const r = { id, type:"response", title:"Response", content: text, x, y, w: NODE_WIDTH_DEFAULT, h: NODE_HEIGHT_DEFAULT, meta };
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
    id, type:"prompt", title:"Prompt", content:"", w: NODE_WIDTH_DEFAULT, h: NODE_HEIGHT_DEFAULT,
    x: clamp(snapToGrid((parent.x||0) + NODE_HORIZONTAL_OFFSET), WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
    y: clamp(snapToGrid(parent.y||0), WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY),
    meta:{ autofocus:true }
  };
  state.board.nodes[id] = p;

  if(parent.type === "response"){
    state.board.edges.push({ id: uid("e"), src: nodeId, dst: id, kind:"lineage" });
  }
  saveBoard(); renderBoard();
  return id;
}

// Manual Branch wrapper to focus and scroll
function manualBranch(nodeId){
  const id = branchFrom(nodeId);
  if (state.board.nodes[id]) {
    state.board.nodes[id].meta = state.board.nodes[id].meta || {};
    state.board.nodes[id].meta.autofocus = true;
  }
  setTimeout(()=>{
    const el = document.querySelector(`.node[data-id="${id}"]`);
    if(el) el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, 0);
  saveBoard(); renderBoard();
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
    // no auto-open; user opens Context manually if needed

    const model = (modelGet() || MODEL_DEFAULT).trim() || MODEL_DEFAULT;
    const result = await callChat({ messages, model, temperature:0.2, max_tokens:600 });

    // 1) create response under the prompt
    const respId = createResponseNode(promptNodeId, result.text || "", { model: result.model || model });

    // 2) auto-branch to a new prompt on the right of the response
    const newPromptId = branchFrom(respId);
    if (state.board.nodes[newPromptId]) {
      state.board.nodes[newPromptId].meta = state.board.nodes[newPromptId].meta || {};
      state.board.nodes[newPromptId].meta.autofocus = true;
    }
    setTimeout(()=>{
      const el = document.querySelector(`.node[data-id="${newPromptId}"]`);
      if(el) el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }, 0);

    saveBoard(); renderBoard();
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

async function copyBoardToClipboard(){
  try{
    const payload = JSON.stringify(serializeBoard(), null, 2);
    await navigator.clipboard.writeText(payload);
    toast("Workspace copied to clipboard.");
  }catch(err){
    console.warn("Clipboard copy failed", err);
    toast("Copy failed. Check browser permissions.", 2400);
  }
}
function importBoardFromFile(file){
  const r = new FileReader();
  r.onload = ()=>{
    try{
      const data = JSON.parse(r.result);
      if(!data || !data.board) throw new Error("Invalid file.");
      state.board = data.board; state.board.selection = new Set();
      if(state.ui.highlightTimer){
        clearTimeout(state.ui.highlightTimer);
        state.ui.highlightTimer = null;
      }
      state.ui.highlight = null;
      saveBoard(); renderBoard(); toast("Workspace imported.");
    }catch(e){ toast("Import failed: "+(e.message||e)); }
  };
  r.readAsText(file);
}
function openClearConfirm(){
  closeOverflowMenu();
  modalClear.classList.remove("hidden");
  modalClear.setAttribute("aria-hidden","false");
}
function closeClearConfirm(){ modalClear.classList.add("hidden"); modalClear.setAttribute("aria-hidden","true"); }
function clearWorkspace(){
  state.board = { nodes:{}, edges:[], selection:new Set(), viewport:{ x:0, y:0, zoom:1 } };
  if(state.ui.highlightTimer){
    clearTimeout(state.ui.highlightTimer);
    state.ui.highlightTimer = null;
  }
  state.ui.highlight = null;
  saveBoard(); renderBoard(); toast("Workspace cleared.");
}

/** UI - Settings / Context **/
function openSettings(){
  closeOverflowMenu();
  modalSettings.classList.remove("hidden");
  modalSettings.setAttribute("aria-hidden","false");
  inpKey.value = keyGet();
  if(inpModel) inpModel.value = MODEL_DEFAULT;
  setTimeout(()=> inpKey?.focus(), 50);
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
  renderHeader();
}
function closeContextDrawer(){
  drawerContext.classList.add("hidden");
  drawerContext.setAttribute("aria-hidden","true");
  document.body.classList.remove("drawer-open");
  renderHeader();
}

function toggleContextPanel(){
  if(drawerContext.classList.contains("hidden")) openContextDrawer();
  else closeContextDrawer();
}

function openOverflowMenu(){
  if(!menuOverflow) return;
  menuOverflow.classList.remove("hidden");
  menuOverflow.setAttribute("aria-hidden","false");
  btnOverflow?.setAttribute("aria-expanded","true");
  overflowOpen = true;
}

function closeOverflowMenu(){
  if(!menuOverflow) return;
  menuOverflow.classList.add("hidden");
  menuOverflow.setAttribute("aria-hidden","true");
  btnOverflow?.setAttribute("aria-expanded","false");
  overflowOpen = false;
}

function toggleOverflowMenu(){
  if(overflowOpen) closeOverflowMenu();
  else openOverflowMenu();
}

function handleOverflowAction(ev){
  const target = ev.target.closest("[data-action]");
  if(!target) return;
  const action = target.dataset.action;

  switch(action){
    case "key":
    case "settings":
      openSettings();
      break;
    case "import":
      closeOverflowMenu();
      fileImport?.click();
      break;
    case "export-download":
      closeOverflowMenu();
      exportBoard();
      break;
    case "export-copy":
      closeOverflowMenu();
      copyBoardToClipboard();
      break;
    case "center":
      closeOverflowMenu();
      centerOnGraph();
      break;
    case "context":
      closeOverflowMenu();
      toggleContextPanel();
      break;
    case "zen":
      closeOverflowMenu();
      toggleZenMode();
      break;
    case "clear":
      openClearConfirm();
      break;
  }
}

function handleGlobalClick(ev){
  if(!overflowOpen) return;
  if(menuOverflow?.contains(ev.target) || btnOverflow?.contains(ev.target)) return;
  closeOverflowMenu();
}

function handleGlobalKeydown(ev){
  if(ev.key === "Escape" && overflowOpen){
    closeOverflowMenu();
  }
}

/** Center on graph **/
function centerOnGraph(){
  const ids = Object.keys(state.board.nodes);
  if(ids.length === 0) return;

  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  for(const id of ids){
    const n = state.board.nodes[id];
    const x = n.x||0, y = n.y||0, w = n.w||NODE_WIDTH_DEFAULT, h = n.h||NODE_HEIGHT_DEFAULT;
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
  btnSearch?.addEventListener("click", ()=>{ closeOverflowMenu(); openSearchDialog(); });
  btnQuickExport?.addEventListener("click", ()=>{ closeOverflowMenu(); exportBoard(); });
  btnOverflow?.addEventListener("click", toggleOverflowMenu);
  menuOverflow?.addEventListener("click", handleOverflowAction);
  document.addEventListener("click", handleGlobalClick);
  document.addEventListener("keydown", handleGlobalKeydown);
  document.addEventListener("pointerdown", (ev)=>{
    if(!activeNodeMenu) return;
    const { menu, button } = activeNodeMenu;
    if(menu.contains(ev.target) || button.contains(ev.target)) return;
    closeActiveNodeMenu();
  });

  const closeSettingsBtn = $("[data-close-settings]");
  closeSettingsBtn?.addEventListener("click", closeSettings);
  btnSaveKey?.addEventListener("click", ()=>{
    keySet(inpKey.value.trim());
    renderHeader();
    closeSettings();
    toast("Key saved.");
  });
  btnClearKey?.addEventListener("click", ()=>{
    keySet("");
    renderHeader();
    closeSettings();
    toast("Key cleared.");
  });

  const closeContextBtn = $("[data-close-context]");
  closeContextBtn?.addEventListener("click", closeContextDrawer);

  btnNewPrompt?.addEventListener("click", ()=> createPromptNode(centerPoint()));

  if(fileImport){
    fileImport.onchange = (e)=>{
      const f = e.target.files?.[0];
      if(f) importBoardFromFile(f);
      e.target.value="";
    };
  }

  btnCancelClear?.addEventListener("click", closeClearConfirm);
  $("[data-close-clear]")?.addEventListener("click", closeClearConfirm);
  btnConfirmClear?.addEventListener("click", ()=>{ closeClearConfirm(); clearWorkspace(); });

  canvas.addEventListener("pointerdown", (e)=>{
    if(e.target === canvas || e.target === stage){
      state.board.selection.clear?.();
      state.ui.pendingConnect = null;
      startPan(e);
    }
  });
  window.addEventListener("pointermove", movePan);
  window.addEventListener("pointerup", endPan);

  canvas.addEventListener("wheel", onWheel, { passive:false });
}

function init(){
  loadBoard();
  loadZenMode();
  renderHeader();
  ensureFirstPrompt();
  wireEvents();
  setupGuides();
  setupMinimap();
  renderBoard();
}

document.addEventListener("DOMContentLoaded", init);
