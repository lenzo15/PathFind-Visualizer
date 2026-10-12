# PathFind Visualizer

[English](README.md) | [简体中文](README.zh-CN.md)

An interactive pathfinding and maze generation visualizer built with HTML, CSS, and JavaScript. Runs entirely in the browser without runtime dependencies or a build step.

## Features

- **Pathfinding:** A*, Dijkstra, breadth-first search (BFS), and depth-first search (DFS).
- **Maze generation:** DFS backtracking, randomized Prim, randomized Kruskal, and recursive division, with reproducible random seeds.
- **Map editing:** Draw and erase walls, move endpoints, resize the grid, and zoom.
- **Visualization:** Adjustable speed, pause, single-step, and stop controls; visited-node, path-length, and computation-time statistics.
- **Localization:** English and Simplified Chinese with saved language preferences.
- **Accessibility:** Responsive layout with mouse, touch, and keyboard controls.

Movement is limited to four directions with equal step costs. A*, Dijkstra, and BFS guarantee the shortest path; DFS does not.

## Usage

Open `index.html` in a modern browser. No installation is required.

Alternatively, start a local server with **Node.js 18+**:

```bash
npm start
```

Visit <http://127.0.0.1:5173>.

## Tests

Run algorithm and localization tests with Node.js 18+:

```bash
npm test
```

Optional browser tests require Playwright:

```bash
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

## License

[MIT](LICENSE)
