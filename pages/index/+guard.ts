// The root path "/" is permanently redirected to "/dashboard" via +redirects
// in the root +config.ts, so this guard is a no-op fallback.
// Auth and org checks are handled by the (app)/+guard.ts group guard.

export const guard = () => {
  // No-op: "/" is redirected to "/dashboard" via +redirects in +config.ts.
  // Auth and org checks are handled by the (app)/+guard.ts group guard.
};
