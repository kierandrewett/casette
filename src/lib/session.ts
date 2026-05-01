import { cache } from "react";
import { headers as nextHeaders } from "next/headers";

import { auth } from "@/lib/auth";

// Per-request memoised session lookup.
//
// Better-Auth's getSession is called from nearly every server component
// (root layout, AppShell, page, nested layouts) and route handler in the
// project. Without React's request-scoped cache, each call re-hits the
// underlying validation pipeline (DB row fetch + plugin pre/post hooks);
// a typical /studio render took ~3s in dev mode end-to-end, almost all
// of it queued auth work.
//
// React's `cache()` is request-scoped on the server: calling it multiple
// times within one render returns the same promise. Combined with the
// cookieCache the auth config now enables, the steady-state cost of a
// session lookup drops from N round trips to one signed-cookie verify.
//
// Use this from server components / actions that already have the request
// headers available via next/headers. Routes that have a Request object
// (route handlers) should pass req.headers directly to auth.api.getSession
// because they live outside the RSC render context.
export const getSession = cache(async () => {
    return auth.api.getSession({ headers: await nextHeaders() });
});
