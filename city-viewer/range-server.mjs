// Minimal static server WITH HTTP Range support — PMTiles reads archives via
// range requests, and python's http.server doesn't implement them.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const ROOT = process.argv[2] || "dist";
const PORT = Number(process.argv[3] || 8931);
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".pmtiles": "application/octet-stream",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = join(ROOT, normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));
  try {
    if (statSync(file).isDirectory()) file = join(file, "index.html");
  } catch {
    res.writeHead(404).end("not found");
    return;
  }

  let st;
  try {
    st = statSync(file);
  } catch {
    res.writeHead(404).end("not found");
    return;
  }

  const type = TYPES[extname(file)] || "application/octet-stream";
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m[1] ? parseInt(m[1], 10) : 0;
    // Clamp: clients routinely ask for a fixed-size window (e.g. bytes=0-16383)
    // that overruns a small file. Reporting the unclamped length makes the
    // browser abort with ERR_CONTENT_LENGTH_MISMATCH.
    const end = Math.min(m[2] ? parseInt(m[2], 10) : st.size - 1, st.size - 1);
    res.writeHead(206, {
      "Content-Type": type,
      "Content-Range": `bytes ${start}-${end}/${st.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Accept-Ranges": "bytes" });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`serving ${ROOT} on :${PORT} (range-capable)`));
