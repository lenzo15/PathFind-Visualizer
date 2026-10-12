"use strict";
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 5173);
const files = new Map([
  ["/index.html", "text/html; charset=utf-8"],
  ["/styles.css", "text/css; charset=utf-8"],
  ["/favicon.svg", "image/svg+xml"],
  ["/js/i18n.js", "text/javascript; charset=utf-8"],
  ["/js/algorithms.js", "text/javascript; charset=utf-8"],
  ["/js/app.js", "text/javascript; charset=utf-8"]
]);
const server = http.createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = pathname === "/" ? "/index.html" : pathname;
    if (!files.has(file)) { response.writeHead(404); response.end("Not found"); return; }
    const contents = await fs.readFile(path.join(root, file));
    response.writeHead(200, { "Content-Type": files.get(file), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch (error) {
    response.writeHead(error instanceof TypeError ? 400 : 500);
    response.end("Unable to serve request");
  }
});
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`PathFind: http://127.0.0.1:${server.address().port}\nPress Ctrl+C to stop.`));
