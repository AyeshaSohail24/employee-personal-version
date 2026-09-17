// SS-4 requires forwarding the caller's X-Correlation-ID on outbound calls
// (server/clients/*), but the id is only known at the HTTP entry point
// (index.js) while the calls happen many layers deeper (routes -> db ->
// clients). AsyncLocalStorage carries it through that chain implicitly, so
// client call() functions can read it without every function in between
// taking and passing a `cid` parameter it has no other use for.
import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

export function runWithCorrelationId(cid, fn) {
  return storage.run({ cid }, fn);
}

export function getCorrelationId() {
  return storage.getStore()?.cid;
}
