"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const PF = require("../js/algorithms.js");
const searchNames = Object.keys(PF.searchAlgorithms);
const mazeNames = Object.keys(PF.mazeAlgorithms);

// Independent four-direction BFS oracle, not the production neighbor helper.
function reachable(grid, start = grid.start) {
  const distances = new Map([[start, 0]]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const x = cell % grid.width;
    const y = Math.floor(cell / grid.width);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height) continue;
      const next = ny * grid.width + nx;
      if (grid.walls[next] || distances.has(next)) continue;
      distances.set(next, distances.get(cell) + 1);
      queue.push(next);
    }
  }
  return distances;
}

function assertPath(grid, result) {
  assert.equal(result.found, result.path.length > 0);
  const visits = result.events.filter(event => event.type === "visit").map(event => event.cell);
  assert.equal(visits.length, result.visitedCount);
  assert.equal(new Set(visits).size, visits.length, "each cell is expanded once");
  visits.forEach(cell => assert.equal(grid.walls[cell], 0));
  if (!result.found) { assert.equal(result.cost, null); return; }
  assert.equal(result.path[0], grid.start);
  assert.equal(result.path.at(-1), grid.end);
  assert.equal(result.cost, result.path.length - 1);
  assert.equal(new Set(result.path).size, result.path.length);
  for (let i = 0; i < result.path.length; i++) {
    const cell = result.path[i];
    assert.equal(grid.walls[cell], 0);
    if (i === 0) continue;
    const prev = result.path[i - 1];
    const distance = Math.abs(cell % grid.width - prev % grid.width) + Math.abs(Math.floor(cell / grid.width) - Math.floor(prev / grid.width));
    assert.equal(distance, 1, "path is four-directionally adjacent, without row wrapping");
  }
}

test("dimension and strategy validation", () => {
  for (const dimensions of [[0, 5], [5, -1], [102, 5], [5.2, 5], [NaN, 5], [Infinity, 5]]) {
    assert.throws(() => PF.createGrid(...dimensions), RangeError);
    assert.throws(() => PF.generateMaze(...dimensions), RangeError);
  }
  assert.deepEqual(PF.normalizeMazeDimensions(20, 24), { width: 21, height: 25 });
  assert.deepEqual(PF.normalizeMazeDimensions(101, 101), { width: 101, height: 101 });
  const grid = PF.createGrid(5, 5);
  for (const name of ["unknown", "__proto__", "constructor"]) {
    assert.throws(() => PF.findPath(grid, name), RangeError);
    assert.throws(() => PF.generateMaze(5, 5, name), RangeError);
  }
  assert.throws(() => PF.findPath({ ...grid, start: -1 }), RangeError);
  assert.throws(() => PF.findPath({ ...grid, walls: [] }), RangeError);
  grid.walls[grid.end] = 1;
  assert.throws(() => PF.findPath(grid), RangeError);
});

for (const algorithm of searchNames) {
  test(`${algorithm}: open grid, same endpoint, and unreachable endpoint`, () => {
    const grid = PF.createGrid(17, 11);
    grid.start = 0;
    grid.end = grid.walls.length - 1;
    const original = grid.walls.slice();
    const result = PF.findPath(grid, algorithm);
    assertPath(grid, result);
    if (algorithm !== "dfs") assert.equal(result.cost, 26);
    assert.deepEqual(grid.walls, original, "search never mutates terrain");
    const same = PF.findPath({ ...grid, end: grid.start }, algorithm);
    assert.deepEqual(same.path, [grid.start]);
    assert.equal(same.cost, 0);
    for (let y = 0; y < grid.height; y++) grid.walls[y * grid.width + 8] = 1;
    const blocked = PF.findPath(grid, algorithm);
    assert.equal(blocked.found, false);
    assertPath(grid, blocked);
  });

  test(`${algorithm}: agrees with independent reachability oracle on 60 random grids`, () => {
    for (let seed = 0; seed < 60; seed++) {
      const grid = PF.createGrid(5 + seed % 11, 5 + seed % 7);
      const random = PF.createRandom(seed);
      for (let i = 0; i < grid.walls.length; i++) grid.walls[i] = random() < .32 ? 1 : 0;
      grid.start = Math.floor(random() * grid.walls.length);
      grid.end = Math.floor(random() * grid.walls.length);
      grid.walls[grid.start] = grid.walls[grid.end] = 0;
      const expected = reachable(grid).get(grid.end);
      const result = PF.findPath(grid, algorithm);
      assert.equal(result.found, expected !== undefined);
      assertPath(grid, result);
      if (algorithm !== "dfs") assert.equal(result.cost, expected ?? null);
    }
  });
}

for (const algorithm of mazeNames) {
  test(`${algorithm}: connected perfect maze, valid room parity, and replayable animation`, () => {
    for (const [width, height] of [[3, 3], [3, 19], [19, 3], [5, 7], [20, 24], [41, 25]]) {
      for (let seed = 0; seed < 8; seed++) {
        const maze = PF.generateMaze(width, height, algorithm, seed);
        assert.equal(maze.width % 2, 1);
        assert.equal(maze.height % 2, 1);
        const openCount = maze.walls.reduce((sum, wall) => sum + (wall === 0 ? 1 : 0), 0);
        assert.equal(reachable(maze).size, openCount, "all passages are connected");
        assert.equal(maze.walls[maze.start], 0);
        assert.equal(maze.walls[maze.end], 0);
        let edgeCount = 0;
        for (let y = 0; y < maze.height; y++) {
          for (let x = 0; x < maze.width; x++) {
            const cell = y * maze.width + x;
            if (x % 2 === 0 && y % 2 === 0) assert.equal(maze.walls[cell], 0);
            if (maze.walls[cell]) continue;
            if (x + 1 < maze.width && !maze.walls[cell + 1]) edgeCount++;
            if (y + 1 < maze.height && !maze.walls[cell + maze.width]) edgeCount++;
          }
        }
        assert.equal(edgeCount, openCount - 1, "perfect maze has no cycles");
        const replay = maze.initialWalls.slice();
        for (const step of maze.steps) {
          assert.ok(step.current >= 0 && step.current < replay.length);
          for (const cell of step.cells) {
            assert.ok(Number.isInteger(cell) && cell >= 0 && cell < replay.length);
            if (step.type === "wall") replay[cell] = 1;
            if (step.type === "carve") replay[cell] = 0;
          }
        }
        assert.deepEqual(replay, maze.walls);
        assertPath(maze, PF.findPath(maze));
      }
    }
  });

  test(`${algorithm}: deterministic seeds and largest supported dimensions`, () => {
    const first = PF.generateMaze(25, 21, algorithm, "复现🌱");
    const second = PF.generateMaze(25, 21, algorithm, "复现🌱");
    assert.deepEqual(first.walls, second.walls);
    assert.deepEqual(first.steps, second.steps);
    assert.notDeepEqual(first.walls, PF.generateMaze(25, 21, algorithm, "another seed").walls);
    const large = PF.generateMaze(101, 101, algorithm, 42);
    assert.equal(reachable(large).size, large.walls.reduce((sum, wall) => sum + (wall === 0 ? 1 : 0), 0));
    assertPath(large, PF.findPath(large, "astar"));
  });
}

test("neighbor helper never wraps across rows", () => {
  assert.deepEqual(PF.neighbors(4, 5, 5), [9, 3]);
  assert.deepEqual(PF.neighbors(5, 5, 5), [0, 6, 10]);
  assert.deepEqual(PF.neighbors(0, 5, 5, 2), [2, 10]);
});
