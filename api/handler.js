// Vercel's Node.js runtime invokes this per-request with standard
// Node req/res objects — handleServerlessRequest() doesn't know or care
// that it's not a persistent http.createServer this time.
//
// vercel.json routes here for everything EXCEPT requests whose Accept
// header prefers text/html (real browser page navigations, which go to
// index.html instead) — so this only ever sees API-style calls: curl,
// fetch(), another service's client_credentials call, the gateway's own
// conformance checker. That's what lets the frontend (page routes like
// /employees) and this API (resource routes also named /employees) share
// the same domain and the same path names without colliding.
import { handleServerlessRequest } from "../server/requestHandler.js";

export default async function handler(req, res) {
  await handleServerlessRequest(req, res);
}
