// Local dev / any host that runs a persistent Node process (Railway,
// Render, a VPS). For Vercel, see api/handler.js — same request logic,
// different entry point, shared via requestHandler.js.
import http from "node:http";
import { PORT, SERVICE_ID } from "./config.js";
import { handleServerlessRequest } from "./requestHandler.js";

http.createServer(handleServerlessRequest).listen(PORT, () => {
  console.log(`${SERVICE_ID} listening on http://127.0.0.1:${PORT}`);
});
