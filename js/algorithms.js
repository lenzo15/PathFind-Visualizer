/* Shared, DOM-free algorithms. Classic script support keeps file:// usable. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PathFind = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MIN_SIZE = 3;
  const MAX_SIZE = 101;
  const searchAlgorithms = Object.freeze({
    astar: { name: "A*", shortest: true },
    dijkstra: { name: "Dijkstra", shortest: true },
    bfs: { name: "BFS", shortest: true },
    dfs: { name: "DFS", shortest: false }
  });
  const mazeAlgorithms = Object.freeze({
    dfs: { name: "DFS 回溯" },
    prim: { name: "随机 Prim" },
    kruskal: { name: "随机 Kruskal" },
    division: { name: "递归分割" }
  });

  // Keep the algorithms DOM-free while exposing stable codes for translated UI errors.
  function validationError(code, message, params = {}) {
    const error = new RangeError(message);
    error.code = code;
    error.params = params;
    return error;
  }

  function validateDimensions(width, height) {
    if (![width, height].every(n => Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE)) {
      throw validationError("dimensions", `网格尺寸必须是 ${MIN_SIZE}–${MAX_SIZE} 之间的整数。`, { min: MIN_SIZE, max: MAX_SIZE });
    }
  }

  function normalizeMazeDimensions(width, height) {
    validateDimensions(width, height);
    return { width: width + (width % 2 === 0 ? 1 : 0), height: height + (height % 2 === 0 ? 1 : 0) };
  }

  function createGrid(width, height) {
    validateDimensions(width, height);
    const row = Math.floor(height / 2) * width;
    return {
      width, height,
      walls: new Uint8Array(width * height),
      start: row + Math.floor(width * 0.2),
      end: row + Math.floor(width * 0.8)
    };
  }

  function neighbors(index, width, height, stride = 1) {
    const x = index % width;
    const y = Math.floor(index / width);
    const result = [];
    if (y >= stride) result.push(index - width * stride);
    if (x + stride < width) result.push(index + stride);
    if (y + stride < height) result.push(index + width * stride);
    if (x >= stride) result.push(index - stride);
    return result;
  }

  // FNV-1a seed hashing + Mulberry32. Stable across Node and modern browsers.
  function createRandom(seed) {
    let state = 2166136261;
    for (const char of String(seed)) state = Math.imul(state ^ char.codePointAt(0), 16777619) >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  class MinHeap {
    constructor() { this.items = []; this.order = 0; }
    push(index, priority, distance) {
      const item = { index, priority, distance, order: this.order++ };
      this.items.push(item);
      let i = this.items.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (!this.less(item, this.items[parent])) break;
        this.items[i] = this.items[parent];
        i = parent;
      }
      this.items[i] = item;
    }
    less(a, b) { return a.priority < b.priority || (a.priority === b.priority && a.order < b.order); }
    pop() {
      if (!this.items.length) return null;
      const first = this.items[0];
      const last = this.items.pop();
      if (this.items.length) {
        let i = 0;
        while (i * 2 + 1 < this.items.length) {
          let child = i * 2 + 1;
          if (child + 1 < this.items.length && this.less(this.items[child + 1], this.items[child])) child++;
          if (!this.less(this.items[child], last)) break;
          this.items[i] = this.items[child];
          i = child;
        }
        this.items[i] = last;
      }
      return first;
    }
    get size() { return this.items.length; }
  }

  function findPath(grid, algorithm = "astar") {
    if (!Object.hasOwn(searchAlgorithms, algorithm)) throw validationError("searchAlgorithm", "未知寻路算法。");
    const { width, height, walls, start, end } = grid;
    validateDimensions(width, height);
    const count = width * height;
    if (!walls || walls.length !== count || ![start, end].every(n => Number.isInteger(n) && n >= 0 && n < count)) {
      throw validationError("grid", "网格数据或起终点无效。");
    }
    if (walls[start] || walls[end]) throw validationError("endpoints", "起点和终点不能位于墙体上。");

    const previous = new Int32Array(count).fill(-1);
    const distances = new Float64Array(count).fill(Infinity);
    const closed = new Uint8Array(count);
    const events = [];
    const weighted = algorithm === "astar" || algorithm === "dijkstra";
    const heap = new MinHeap();
    const queue = [start];
    let head = 0;
    let visitedCount = 0;
    let found = false;
    const heuristic = index => algorithm === "astar"
      ? Math.abs(index % width - end % width) + Math.abs(Math.floor(index / width) - Math.floor(end / width))
      : 0;
    distances[start] = 0;
    if (weighted) heap.push(start, heuristic(start), 0);
    events.push({ type: "frontier", cells: [start] });

    while (weighted ? heap.size : algorithm === "dfs" ? queue.length : head < queue.length) {
      let current;
      if (weighted) {
        const item = heap.pop();
        current = item.index;
        if (closed[current] || item.distance !== distances[current]) continue;
      } else current = algorithm === "dfs" ? queue.pop() : queue[head++];
      closed[current] = 1;
      visitedCount++;
      const frontier = [];
      events.push({ type: "visit", cell: current, frontier });
      if (current === end) { found = true; break; }

      const adjacent = neighbors(current, width, height);
      if (algorithm === "dfs") adjacent.reverse();
      for (const next of adjacent) {
        if (walls[next] || closed[next]) continue;
        const distance = distances[current] + 1;
        if (weighted ? distance >= distances[next] : distances[next] !== Infinity) continue;
        distances[next] = distance;
        previous[next] = current;
        frontier.push(next);
        if (weighted) heap.push(next, distance + heuristic(next), distance);
        else queue.push(next);
      }
    }

    const path = [];
    if (found) {
      for (let current = end; current !== -1; current = previous[current]) path.push(current);
      path.reverse();
    }
    return { found, path, events, visitedCount, cost: found ? path.length - 1 : null };
  }

  function generateMaze(width, height, algorithm = "dfs", seed = "pathfind") {
    if (!Object.hasOwn(mazeAlgorithms, algorithm)) throw validationError("mazeAlgorithm", "未知迷宫算法。");
    ({ width, height } = normalizeMazeDimensions(width, height));
    const random = createRandom(seed);
    const pick = items => items[Math.floor(random() * items.length)];
    const walls = new Uint8Array(width * height).fill(algorithm === "division" ? 0 : 1);
    const initialWalls = walls.slice();
    const steps = [];
    const rooms = [];
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) rooms.push(y * width + x);
    }
    const carve = (cells, current = cells[cells.length - 1]) => {
      cells.forEach(cell => { walls[cell] = 0; });
      steps.push({ type: "carve", cells, current });
    };
    const between = (a, b) => (a + b) / 2;
    const visited = new Set([0]);

    if (algorithm === "dfs") {
      const stack = [0];
      carve([0]);
      while (stack.length) {
        const current = stack[stack.length - 1];
        const candidates = neighbors(current, width, height, 2).filter(next => !visited.has(next));
        if (candidates.length) {
          const next = pick(candidates);
          visited.add(next);
          carve([between(current, next), next], next);
          stack.push(next);
        } else {
          stack.pop();
          if (stack.length) steps.push({ type: "focus", cells: [], current: stack[stack.length - 1] });
        }
      }
    } else if (algorithm === "prim") {
      const frontier = [];
      const addEdges = current => {
        for (const next of neighbors(current, width, height, 2)) {
          if (!visited.has(next)) frontier.push([current, next]);
        }
      };
      carve([0]);
      addEdges(0);
      while (frontier.length) {
        const i = Math.floor(random() * frontier.length);
        const [current, next] = frontier[i];
        frontier[i] = frontier[frontier.length - 1];
        frontier.pop();
        if (visited.has(next)) continue;
        visited.add(next);
        carve([between(current, next), next], next);
        addEdges(next);
      }
    } else if (algorithm === "kruskal") {
      carve(rooms, 0);
      const edges = [];
      const parents = new Int32Array(width * height).fill(-1);
      const find = cell => {
        let root = cell;
        while (parents[root] >= 0) root = parents[root];
        while (cell !== root) {
          const parent = parents[cell];
          parents[cell] = root;
          cell = parent;
        }
        return root;
      };
      for (const room of rooms) {
        const x = room % width;
        const y = Math.floor(room / width);
        if (x + 2 < width) edges.push([room, room + 2]);
        if (y + 2 < height) edges.push([room, room + width * 2]);
      }
      for (let i = edges.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [edges[i], edges[j]] = [edges[j], edges[i]];
      }
      for (const [a, b] of edges) {
        let rootA = find(a);
        let rootB = find(b);
        if (rootA === rootB) continue;
        if (parents[rootA] > parents[rootB]) [rootA, rootB] = [rootB, rootA];
        parents[rootA] += parents[rootB];
        parents[rootB] = rootA;
        carve([between(a, b)], b);
      }
    } else {
      // Odd-sized regions: add a cross and open three of its four arms.
      // This connects all four subregions without introducing a cycle.
      const divide = (x, y, w, h) => {
        if (w < 3 || h < 3) return;
        const wallX = x + 1 + Math.floor(random() * ((w - 1) / 2)) * 2;
        const wallY = y + 1 + Math.floor(random() * ((h - 1) / 2)) * 2;
        const evenBetween = (min, max) => min + Math.floor(random() * ((max - min) / 2 + 1)) * 2;
        const doors = [
          wallY * width + evenBetween(x, wallX - 1),
          wallY * width + evenBetween(wallX + 1, x + w - 1),
          evenBetween(y, wallY - 1) * width + wallX,
          evenBetween(wallY + 1, y + h - 1) * width + wallX
        ];
        doors.splice(Math.floor(random() * 4), 1);
        const cells = [];
        for (let cx = x; cx < x + w; cx++) cells.push(wallY * width + cx);
        for (let cy = y; cy < y + h; cy++) if (cy !== wallY) cells.push(cy * width + wallX);
        const solid = cells.filter(cell => !doors.includes(cell));
        solid.forEach(cell => { walls[cell] = 1; });
        steps.push({ type: "wall", cells: solid, current: wallY * width + wallX });
        divide(x, y, wallX - x, wallY - y);
        divide(wallX + 1, y, x + w - wallX - 1, wallY - y);
        divide(x, wallY + 1, wallX - x, y + h - wallY - 1);
        divide(wallX + 1, wallY + 1, x + w - wallX - 1, y + h - wallY - 1);
      };
      divide(0, 0, width, height);
    }
    return { width, height, walls, initialWalls, steps, seed: String(seed), start: 0, end: width * height - 1 };
  }

  return Object.freeze({ MIN_SIZE, MAX_SIZE, createGrid, neighbors, createRandom, normalizeMazeDimensions, findPath, generateMaze, searchAlgorithms, mazeAlgorithms });
});
