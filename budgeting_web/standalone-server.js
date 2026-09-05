const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const ROOT = path.resolve(__dirname, ".next");

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".jsx": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
};

function readFileSafe(reqPath, fallbackToIndex = false) {
  const candidates = [
    path.join(ROOT, reqPath),
    path.join(ROOT, "server", reqPath),
    path.join(ROOT, "server", "app", reqPath),
  ];
  if (fallbackToIndex) {
    candidates.push(path.join(ROOT, "server", "app", "index.html"));
    candidates.push(path.join(ROOT, "server", "index.html"));
  }
  for (const cand of candidates) {
    try {
      const stat = fs.statSync(cand);
      if (stat.isFile()) return cand;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = decodeURIComponent(url.pathname).split("?")[0];
  const publicFile = path.join(__dirname, "public", filePath);
  fs.stat(publicFile, (pubErr, pubStat) => {
    if (!pubErr && pubStat.isFile()) {
      serveFile(res, publicFile);
      return;
    }
    serveAppFile(req, res, filePath);
  });
});

function serveAppFile(req, res, filePath) {
  if (filePath === "/api/" || filePath.startsWith("/api/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ offline: true, message: "API server not bundled; run budgeting_api/manage.py runserver on port 8000." }));
    return;
  }
  const found = readFileSafe(filePath, true);
  if (!found) {
    const notFound = readFileSafe("/404.html") ?? readFileSafe("/index.html");
    if (notFound) {
      serveFile(res, notFound);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }
  serveFile(res, found);
}

function serveFile(res, fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  fs.createReadStream(fullPath).pipe(res);
}

server.listen(PORT, () => {
  console.log(`PWA bundle serving on http://localhost:${PORT}`);
  console.log("API bundle (budgeting_api) must be running on port 8000 for live data, or the app works offline from cache.");
});
