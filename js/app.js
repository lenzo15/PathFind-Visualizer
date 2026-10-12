/* Browser controller: drawing, canvas rendering and cancellable animation. */
(function () {
  "use strict";
  const PF = window.PathFind;
  let storage;
  try { storage = window.localStorage; } catch (_) { /* Language switching also works when storage is blocked. */ }
  const localizer = window.PathFindI18n.createLocalizer({ storage, languages: navigator.languages || [navigator.language] });
  const t = (key, params) => localizer.t(key, params);
  const $ = id => document.getElementById(id);
  const canvas = $("grid");
  const ctx = canvas.getContext("2d");
  const viewport = $("board-viewport");
  const wrapper = $("canvas-wrapper");
  const toolButtons = [...document.querySelectorAll("[data-tool]")];
  const lockable = [...document.querySelectorAll("[data-lock]")];
  const colors = { empty: "#1c2b35", wall: "#52616e", frontier: "#c8af72", visited: "#28565e", path: "#8ae8c4", start: "#8ae8c4", end: "#f29a88" };
  let grid = PF.createGrid(41, 25);
  let overlay = new Uint8Array(grid.walls.length);
  let tool = "wall";
  let zoom = 1;
  let cellSize = 20;
  let current = -1;
  let keyboardCell = grid.start;
  let showKeyboard = false;
  let drawing = null;
  let animation = null;
  let animationFrame = 0;
  let drawPending = false;
  let visitedCount = 0;
  let speed = 50;
  let status = { key: "status.ready", params: {}, type: "ready" };
  let pathNoteKey = "metrics.waiting";

  function renderStatus() {
    const params = { ...status.params };
    if (params.mazeAlgorithm) params.algorithm = t(`maze.${params.mazeAlgorithm}`);
    $("status-text").textContent = t(status.key, params);
    $("status-indicator").className = "status-indicator" + (status.type === "running" ? " running" : status.type === "warning" ? " warning" : "");
  }

  function setStatus(key, params = {}, type = "ready") {
    status = { key, params, type };
    renderStatus();
  }

  function setPathNote(key) {
    pathNoteKey = key;
    $("path-note").textContent = t(key);
  }

  function updateCanvasLabel() {
    canvas.setAttribute("aria-label", showKeyboard && !animation
      ? t("grid.cursorLabel", { row: Math.floor(keyboardCell / grid.width) + 1, column: keyboardCell % grid.width + 1 })
      : t("grid.label"));
  }

  function refreshTranslations() {
    localizer.apply(document);
    $("language").value = localizer.language;
    updateControls();
    updateSpeed();
    $("path-note").textContent = t(pathNoteKey);
    updateCanvasLabel();
    renderStatus();
    resizeCanvas();
  }

  function showError(error) {
    const key = `errors.${error.code}`;
    setStatus(Object.hasOwn(window.PathFindI18n.messages["zh-CN"], key) ? key : "errors.unexpected", error.params || {}, "warning");
  }

  function updateControls() {
    const busy = Boolean(animation);
    lockable.forEach(element => { element.disabled = busy; });
    $("run").disabled = busy;
    $("pause").disabled = !busy;
    $("pause").querySelector("span").textContent = t(busy && animation.paused ? "controls.resume" : "controls.pause");
    $("pause").querySelector("use").setAttribute("href", busy && animation.paused ? "#icon-play" : "#icon-pause");
    $("step").disabled = !busy || !animation.paused;
    $("stop").disabled = !busy;
    $("mobile-run").querySelector("span").textContent = t(!busy ? "controls.run" : animation.paused ? "mobile.resume" : "mobile.pause");
    $("mobile-run").querySelector("use").setAttribute("href", busy && !animation.paused ? "#icon-pause" : "#icon-play");
    $("mobile-step").disabled = !busy || !animation.paused;
    $("mobile-stop").disabled = !busy;
    canvas.classList.toggle("locked", busy);
    canvas.setAttribute("aria-busy", String(busy));
  }

  function updateStats() {
    $("visited-count").textContent = visitedCount;
    const accessible = grid.walls.length - grid.walls.reduce((sum, wall) => sum + wall, 0);
    $("visited-progress").style.width = `${Math.min(100, visitedCount / Math.max(1, accessible) * 100)}%`;
  }

  function clearVisuals() {
    overlay.fill(0);
    current = -1;
    visitedCount = 0;
    $("path-length").textContent = "—";
    setPathNote("metrics.waiting");
    $("compute-time").textContent = "—";
    updateStats();
    requestDraw();
  }

  function updateAlgorithm() {
    // The simplified UI no longer includes an algorithm description or badge.
    clearVisuals();
  }

  function updateSpeed() {
    const value = Number($("speed").value);
    speed = Math.round(5 * Math.pow(100, value / 100));
    $("speed-value").textContent = t("controls.speedValue", { speed });
    $("speed").style.background = `linear-gradient(to right, var(--accent) ${(value - 1) / 99 * 100}%, #34434d 0)`;
  }

  function requestDraw() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(() => { drawPending = false; render(); });
  }

  function resizeCanvas() {
    const padding = parseFloat(getComputedStyle(wrapper).paddingLeft) || 0;
    const base = Math.max(2, Math.min(28, (viewport.clientWidth - padding * 2) / grid.width, (viewport.clientHeight - padding * 2) / grid.height));
    cellSize = base * zoom;
    const width = grid.width * cellSize;
    const height = grid.height * cellSize;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    $("zoom-value").textContent = `${Math.round(zoom * 100)}%`;
    $("grid-size").textContent = t("grid.size", { width: grid.width, height: grid.height });
    requestDraw();
  }

  function render() {
    const s = cellSize;
    const gap = s >= 8 ? .8 : .35;
    ctx.fillStyle = "#14232c";
    ctx.fillRect(0, 0, grid.width * s, grid.height * s);
    for (let index = 0; index < grid.walls.length; index++) {
      const x = index % grid.width * s;
      const y = Math.floor(index / grid.width) * s;
      let color = grid.walls[index] ? colors.wall : overlay[index] === 1 ? colors.frontier : overlay[index] === 2 ? colors.visited : overlay[index] === 3 ? colors.path : colors.empty;
      if (index === grid.start) color = colors.start;
      if (index === grid.end) color = colors.end;
      ctx.fillStyle = color;
      ctx.fillRect(x + gap, y + gap, s - gap * 2, s - gap * 2);
      if (overlay[index] === 3 && index !== grid.start && index !== grid.end && s > 9) {
        ctx.fillStyle = "#376856";
        ctx.beginPath();
        ctx.arc(x + s / 2, y + s / 2, Math.max(1, s * .075), 0, Math.PI * 2);
        ctx.fill();
      }
      if ((index === grid.start || index === grid.end) && s >= 9) drawEndpoint(x, y, s, index === grid.start);
      if (index === current && index !== grid.start && index !== grid.end && s >= 6) {
        ctx.strokeStyle = animation && animation.kind === "maze" ? colors.frontier : "#e3f7ee";
        ctx.lineWidth = Math.max(1, s / 13);
        ctx.strokeRect(x + 2, y + 2, Math.max(1, s - 4), Math.max(1, s - 4));
      }
    }
    if (showKeyboard && !animation && s >= 3) {
      const x = keyboardCell % grid.width * s;
      const y = Math.floor(keyboardCell / grid.width) * s;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      ctx.setLineDash([]);
    }
  }

  function drawEndpoint(x, y, size, start) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = "#18332a";
    ctx.strokeStyle = start ? "#18332a" : "#53332b";
    ctx.lineWidth = 1.6;
    if (start) {
      ctx.beginPath();
      ctx.moveTo(9, 6); ctx.lineTo(18, 12); ctx.lineTo(9, 18); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(7, 19); ctx.lineTo(7, 5); ctx.lineTo(18, 5); ctx.lineTo(18, 13); ctx.lineTo(7, 13); ctx.stroke();
      ctx.fillStyle = "#53332b";
      ctx.fillRect(8, 6, 4, 3); ctx.fillRect(13, 9, 4, 3);
    }
    ctx.restore();
  }

  function setZoom(value) {
    const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / Math.max(1, viewport.scrollWidth);
    const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / Math.max(1, viewport.scrollHeight);
    zoom = Math.max(.25, Math.min(3, value));
    resizeCanvas();
    viewport.scrollLeft = centerX * viewport.scrollWidth - viewport.clientWidth / 2;
    viewport.scrollTop = centerY * viewport.scrollHeight - viewport.clientHeight / 2;
  }

  function replaceGrid(nextGrid) {
    grid = nextGrid;
    overlay = new Uint8Array(grid.walls.length);
    keyboardCell = grid.start;
    showKeyboard = false;
    updateCanvasLabel();
    drawing = null;
    zoom = 1;
    $("columns").value = grid.width;
    $("rows").value = grid.height;
    clearVisuals();
    resizeCanvas();
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  }

  function loadDemo() {
    const next = PF.createGrid(41, 25);
    for (let y = 2; y < 23; y++) if (y !== 6) next.walls[y * 41 + 13] = 1;
    for (let y = 0; y < 21; y++) if (y !== 16) next.walls[y * 41 + 21] = 1;
    for (let y = 5; y < 25; y++) if (y !== 10) next.walls[y * 41 + 28] = 1;
    for (let x = 14; x < 20; x++) next.walls[5 * 41 + x] = 1;
    replaceGrid(next);
    setStatus("status.mapReady");
  }

  function beginAnimation(kind, events, result, duration, algorithm) {
    drawing = null;
    showKeyboard = false;
    animation = { kind, events, result, duration, algorithm, cursor: 0, paused: false, accumulator: 0, lastTime: performance.now() };
    updateControls();
    updateCanvasLabel();
    setStatus(kind === "maze" ? "status.generating" : "status.searching", kind === "maze"
      ? { mazeAlgorithm: algorithm }
      : { algorithm: PF.searchAlgorithms[algorithm].name }, "running");
    animationFrame = requestAnimationFrame(tick);
  }

  function applyEvent(event) {
    if (event.type === "frontier") event.cells.forEach(cell => { if (overlay[cell] === 0) overlay[cell] = 1; });
    else if (event.type === "visit") {
      overlay[event.cell] = 2;
      current = event.cell;
      visitedCount++;
      event.frontier.forEach(cell => { if (overlay[cell] === 0) overlay[cell] = 1; });
    } else if (event.type === "path") {
      overlay[event.cell] = 3;
      current = event.cell;
    } else if (event.type === "wall" || event.type === "carve") {
      event.cells.forEach(cell => {
        if (cell !== grid.start && cell !== grid.end) grid.walls[cell] = event.type === "wall" ? 1 : 0;
      });
      current = event.current;
    } else if (event.type === "focus") current = event.current;
  }

  function advance(count) {
    if (!animation) return;
    const end = Math.min(animation.events.length, animation.cursor + count);
    while (animation.cursor < end) applyEvent(animation.events[animation.cursor++]);
    updateStats();
    requestDraw();
    if (animation.cursor >= animation.events.length) finishAnimation();
  }

  function tick(time) {
    if (!animation || animation.paused) return;
    animation.accumulator += Math.min(100, Math.max(0, time - animation.lastTime)) * speed / 1000;
    animation.lastTime = time;
    const count = Math.floor(animation.accumulator);
    if (count > 0) { animation.accumulator -= count; advance(count); }
    if (animation && !animation.paused) animationFrame = requestAnimationFrame(tick);
  }

  function finishAnimation() {
    const finished = animation;
    cancelAnimationFrame(animationFrame);
    animation = null;
    current = -1;
    if (finished.kind === "maze") {
      grid.walls = finished.result.walls.slice();
      overlay.fill(0);
      const wallCount = grid.walls.reduce((sum, wall) => sum + wall, 0);
      setStatus("status.mazeDone", { mazeAlgorithm: finished.algorithm, walls: wallCount, seed: finished.result.seed });
    } else {
      const selected = PF.searchAlgorithms[finished.algorithm];
      if (finished.result.found) {
        $("path-length").textContent = finished.result.cost;
        setPathNote(selected.shortest ? "metrics.shortest" : "metrics.notShortest");
        setStatus(selected.shortest ? "status.shortestFound" : "status.pathFound", { algorithm: selected.name, steps: finished.result.cost, visited: visitedCount });
      } else {
        $("path-length").textContent = "—";
        setPathNote("metrics.unreachable");
        setStatus("status.noPath", {}, "warning");
      }
    }
    updateStats();
    updateControls();
    requestDraw();
  }

  function runSearch() {
    if (animation) return;
    clearVisuals();
    try {
      const algorithm = $("algorithm").value;
      const startTime = performance.now();
      const result = PF.findPath(grid, algorithm);
      const duration = performance.now() - startTime;
      $("compute-time").textContent = duration.toFixed(2);
      const events = result.events.concat(result.path.map(cell => ({ type: "path", cell })));
      beginAnimation("search", events, result, duration, algorithm);
    } catch (error) { showError(error); }
  }

  function runMaze() {
    if (animation) return;
    try {
      const algorithm = $("maze").value;
      const seed = $("seed").value.trim() || String(window.crypto.getRandomValues(new Uint32Array(1))[0]);
      $("seed").value = seed;
      const oldWidth = grid.width;
      const oldHeight = grid.height;
      const result = PF.generateMaze(grid.width, grid.height, algorithm, seed);
      replaceGrid({ width: result.width, height: result.height, walls: result.initialWalls.slice(), start: result.start, end: result.end });
      grid.walls[grid.start] = 0;
      grid.walls[grid.end] = 0;
      beginAnimation("maze", result.steps, result, 0, algorithm);
      if (oldWidth !== result.width || oldHeight !== result.height) setStatus("status.normalized", { width: result.width, height: result.height, mazeAlgorithm: algorithm }, "running");
    } catch (error) { showError(error); }
  }

  function togglePause() {
    if (!animation) return;
    animation.paused = !animation.paused;
    cancelAnimationFrame(animationFrame);
    if (!animation.paused) {
      animation.lastTime = performance.now();
      animationFrame = requestAnimationFrame(tick);
      setStatus(animation.kind === "search" ? "status.resumedSearch" : "status.resumedMaze", {}, "running");
    } else setStatus("status.paused", { current: animation.cursor, total: animation.events.length });
    updateControls();
  }

  function stopAnimation() {
    if (!animation) return;
    cancelAnimationFrame(animationFrame);
    const isMaze = animation.kind === "maze";
    animation = null;
    current = -1;
    updateControls();
    requestDraw();
    setStatus(isMaze ? "status.stoppedMaze" : "status.stoppedSearch");
  }

  function setTool(value) {
    if (animation) return;
    tool = value;
    toolButtons.forEach(button => {
      const active = button.dataset.tool === value;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const names = { wall: "status.toolWall", erase: "status.toolErase", start: "status.toolStart", end: "status.toolEnd" };
    setStatus(names[value]);
  }

  function paintCell(cell, mode) {
    if (animation || cell == null) return;
    let changed = false;
    if (mode === "start" && cell !== grid.end && cell !== grid.start) { grid.start = cell; grid.walls[cell] = 0; changed = true; }
    else if (mode === "end" && cell !== grid.start && cell !== grid.end) { grid.end = cell; grid.walls[cell] = 0; changed = true; }
    else if ((mode === "wall" || mode === "erase") && cell !== grid.start && cell !== grid.end) {
      const value = mode === "wall" ? 1 : 0;
      changed = grid.walls[cell] !== value;
      grid.walls[cell] = value;
    }
    if (changed) {
      if (!drawing || !drawing.changed) {
        clearVisuals();
        setStatus("status.edited");
        if (drawing) drawing.changed = true;
      }
      requestDraw();
    }
  }

  function pointerCell(event) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * grid.width);
    const y = Math.floor((event.clientY - rect.top) / rect.height * grid.height);
    return x >= 0 && x < grid.width && y >= 0 && y < grid.height ? y * grid.width + x : null;
  }

  // Bresenham interpolation prevents gaps when the pointer moves quickly.
  function paintLine(from, to, mode) {
    if (from == null || mode === "start" || mode === "end") { paintCell(to, mode); return; }
    let x = from % grid.width;
    let y = Math.floor(from / grid.width);
    const targetX = to % grid.width;
    const targetY = Math.floor(to / grid.width);
    const dx = Math.abs(targetX - x);
    const dy = -Math.abs(targetY - y);
    const sx = x < targetX ? 1 : -1;
    const sy = y < targetY ? 1 : -1;
    let error = dx + dy;
    while (true) {
      paintCell(y * grid.width + x, mode);
      if (x === targetX && y === targetY) break;
      const twice = error * 2;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  }

  canvas.addEventListener("pointerdown", event => {
    if (animation || drawing || (event.button !== 0 && event.button !== 2)) return;
    const cell = pointerCell(event);
    if (cell == null) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    showKeyboard = false;
    keyboardCell = cell;
    updateCanvasLabel();
    const mode = event.button === 2 ? "erase" : cell === grid.start ? "start" : cell === grid.end ? "end" : tool === "wall" && grid.walls[cell] ? "erase" : tool;
    drawing = { pointer: event.pointerId, last: cell, mode, changed: false };
    canvas.setPointerCapture(event.pointerId);
    paintCell(cell, mode);
    requestDraw();
  });
  canvas.addEventListener("pointermove", event => {
    const cell = pointerCell(event);
    $("coordinates").textContent = cell == null ? "— , —" : `${cell % grid.width}, ${Math.floor(cell / grid.width)}`;
    if (!drawing || event.pointerId !== drawing.pointer) return;
    if (cell != null) {
      keyboardCell = cell;
      if (cell !== drawing.last) paintLine(drawing.last, cell, drawing.mode);
    }
    drawing.last = cell;
  });
  function endDrawing(event) {
    if (drawing && drawing.pointer === event.pointerId) drawing = null;
  }
  canvas.addEventListener("pointerup", endDrawing);
  canvas.addEventListener("pointercancel", endDrawing);
  canvas.addEventListener("lostpointercapture", endDrawing);
  canvas.addEventListener("pointerleave", () => { $("coordinates").textContent = "— , —"; });
  canvas.addEventListener("contextmenu", event => event.preventDefault());
  canvas.addEventListener("focus", () => { showKeyboard = true; updateCanvasLabel(); requestDraw(); });
  canvas.addEventListener("blur", () => { showKeyboard = false; updateCanvasLabel(); requestDraw(); });

  $("run").addEventListener("click", runSearch);
  $("generate-maze").addEventListener("click", runMaze);
  $("algorithm").addEventListener("change", () => { updateAlgorithm(); setStatus("status.algorithmChanged"); });
  $("language").addEventListener("change", () => { localizer.setLanguage($("language").value); refreshTranslations(); });
  $("speed").addEventListener("input", updateSpeed);
  $("pause").addEventListener("click", togglePause);
  $("stop").addEventListener("click", stopAnimation);
  function singleStep() {
    if (!animation || !animation.paused) return;
    advance(1);
    if (animation) setStatus("status.paused", { current: animation.cursor, total: animation.events.length });
  }
  $("step").addEventListener("click", singleStep);
  $("mobile-run").addEventListener("click", () => { if (animation) togglePause(); else runSearch(); });
  $("mobile-step").addEventListener("click", singleStep);
  $("mobile-stop").addEventListener("click", stopAnimation);
  $("clear-path").addEventListener("click", () => { if (!animation) { clearVisuals(); setStatus("status.pathCleared"); } });
  $("clear-map").addEventListener("click", () => { if (!animation) { grid.walls.fill(0); clearVisuals(); setStatus("status.mapCleared"); } });
  $("demo").addEventListener("click", () => { if (!animation) loadDemo(); });
  $("grid-form").addEventListener("submit", event => {
    event.preventDefault();
    if (animation) return;
    const width = Number($("columns").value);
    const height = Number($("rows").value);
    if (![width, height].every(n => Number.isInteger(n) && n >= 5 && n <= PF.MAX_SIZE)) {
      setStatus("errors.uiDimensions", {}, "warning");
      return;
    }
    replaceGrid(PF.createGrid(width, height));
    setStatus("status.created", { width, height });
  });
  toolButtons.forEach(button => button.addEventListener("click", () => setTool(button.dataset.tool)));
  $("zoom-in").addEventListener("click", () => setZoom(zoom * 1.2));
  $("zoom-out").addEventListener("click", () => setZoom(zoom / 1.2));
  $("zoom-fit").addEventListener("click", () => setZoom(1));
  viewport.addEventListener("wheel", event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });
  $("help-link").addEventListener("click", event => { event.preventDefault(); $("help-dialog").showModal(); });
  $("help-dialog").addEventListener("click", event => {
    const rect = $("help-dialog").getBoundingClientRect();
    if (event.target === $("help-dialog") && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) $("help-dialog").close();
  });

  document.addEventListener("keydown", event => {
    if ($("help-dialog").open || event.target.closest("input, select, textarea, [contenteditable='true']")) return;
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) { if (animation) togglePause(); else runSearch(); }
      return;
    }
    if (event.key === "Escape") { stopAnimation(); return; }
    if (animation || event.ctrlKey || event.metaKey || event.altKey) return;
    const tools = { w: "wall", e: "erase", s: "start", f: "end" };
    if (tools[event.key.toLowerCase()]) { setTool(tools[event.key.toLowerCase()]); return; }
    if (event.target !== canvas) return;
    let x = keyboardCell % grid.width;
    let y = Math.floor(keyboardCell / grid.width);
    if (event.key === "ArrowUp") y = Math.max(0, y - 1);
    else if (event.key === "ArrowDown") y = Math.min(grid.height - 1, y + 1);
    else if (event.key === "ArrowLeft") x = Math.max(0, x - 1);
    else if (event.key === "ArrowRight") x = Math.min(grid.width - 1, x + 1);
    else if (event.key === "Enter") paintCell(keyboardCell, tool === "wall" && grid.walls[keyboardCell] ? "erase" : tool);
    else return;
    event.preventDefault();
    keyboardCell = y * grid.width + x;
    showKeyboard = true;
    $("coordinates").textContent = `${x}, ${y}`;
    updateCanvasLabel();
    requestDraw();
  });

  new ResizeObserver(resizeCanvas).observe(viewport);
  window.addEventListener("resize", resizeCanvas);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) $("speed").value = "100";
  updateAlgorithm();
  refreshTranslations();
  loadDemo();
})();
