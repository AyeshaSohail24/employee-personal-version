// Vercel's Node.js runtime invokes this per-request with standard
// Node req/res objects — handleServerlessRequest() doesn't know or care
// that it's not a persistent http.createServer this time.
import { handleServerlessRequest } from "../requestHandler.js";

export default async function handler(req, res) {
  await handleServerlessRequest(req, res);
}
