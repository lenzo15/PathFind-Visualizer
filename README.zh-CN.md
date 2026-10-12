# PathFind Visualizer

**共同开发者：** gpt-6.1-sol

[English](README.md) | [简体中文](README.zh-CN.md)

基于 HTML、CSS 和 JavaScript 的交互式寻路与迷宫生成可视化工具。完全在浏览器中运行，无运行时依赖，无需构建。

## 功能

- **寻路算法：** A*、Dijkstra、广度优先搜索（BFS）和深度优先搜索（DFS）。
- **迷宫生成：** DFS 回溯、随机 Prim、随机 Kruskal 和递归分割，支持随机种子复现。
- **地图编辑：** 绘制与擦除墙体、移动起终点、调整网格尺寸和缩放。
- **可视化：** 调速、暂停、单步和停止，以及访问节点数、路径长度和计算用时统计。
- **多语言：** 英语与简体中文切换，保存语言偏好。
- **交互适配：** 响应式布局，支持鼠标、触屏和键盘操作。

仅支持上下左右四向移动，每步代价相同。A*、Dijkstra 和 BFS 保证最短路径，DFS 不保证。

## 使用

使用现代浏览器打开 `index.html` 即可，无需安装依赖。

也可使用 **Node.js 18+** 启动本地服务：

```bash
npm start
```

访问 <http://127.0.0.1:5173>。

## 测试

使用 Node.js 18+ 运行算法与本地化测试：

```bash
npm test
```

可选的浏览器测试需要 Playwright：

```bash
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

## 许可证

[MIT](LICENSE)
