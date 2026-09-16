// Production deployment: this backend also serves the built SPA (`dist/`),
// exactly the BFF shape MICROAPP_AUTH.md assumes — one PUBLIC_URL serving
// both the page and the API behind it. In dev, `dist/` won't exist yet
// (run `npm run build` first to exercise the full authenticated flow) —
// `npm run dev` (Vite) stays the fast path for pure UI iteration.
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST_DIR = path.resolve(fileURLToPath(new URL("../../dist", import.meta.url)));
const INDEX_HTML = path.join(DIST_DIR, "index.html");

export function distExists() {
  return existsSync(INDEX_HTML);
}

export function serveIndexHtml(res, extraHeaders = {}) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...extraHeaders });
  createReadStream(INDEX_HTML).pipe(res);
}

export function serveStaticAsset(pathname, res) {
  const filePath = path.join(DIST_DIR, pathname.replace(/^\/+/, ""));
  if (!filePath.startsWith(DIST_DIR)) return false; // no path traversal out of dist/
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
  res.writeHead(200);
  createReadStream(filePath).pipe(res);
  return true;
}
