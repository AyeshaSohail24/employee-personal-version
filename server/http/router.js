// Matches a request path against the OpenAPI document's own `paths` keys, so
// the set of real routes and the set of documented routes can never drift
// apart — the document IS the router's route table.
export function buildRouteMatcher(openapi) {
  const staticPaths = new Map();
  const dynamicPaths = [];

  for (const key of Object.keys(openapi.paths)) {
    if (!key.includes("{")) {
      staticPaths.set(key, key);
      continue;
    }
    const paramNames = [];
    const pattern = key.replace(/\{([^}]+)\}/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    dynamicPaths.push({ regex: new RegExp(`^${pattern}$`), paramNames, key });
  }

  return function matchRoute(pathname) {
    if (staticPaths.has(pathname)) return { routeKey: staticPaths.get(pathname), params: {} };
    for (const { regex, paramNames, key } of dynamicPaths) {
      const match = regex.exec(pathname);
      if (!match) continue;
      const params = {};
      paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      return { routeKey: key, params };
    }
    return null;
  };
}
