/**
 * Lightweight error-monitoring wrapper.
 *
 * When `SENTRY_DSN` is set in the environment, this module dynamically imports
 * `@sentry/nextjs` and initialises it. Otherwise every exported function is a
 * no-op so the application works without the package installed.
 *
 * Operator setup: `yarn add @sentry/nextjs` then set `SENTRY_DSN=<your-dsn>`.
 * See docs/operator-api.md § Observability for details.
 */

import { env } from "@/env";
import { logger } from "@/lib/log";

const log = logger("sentry");

let _initialised = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentry: any = null;

const init = async (): Promise<void> => {
    if (_initialised) return;
    _initialised = true;

    if (!env.SENTRY_DSN) return;

    try {
        // Webpack's static analyser would otherwise resolve "@sentry/nextjs"
        // at build time and fail when the package is absent. The
        // webpackIgnore comment tells webpack to leave the import alone so
        // it becomes a true runtime resolution, which catches cleanly when
        // the operator has not installed Sentry.
        // The @ts-expect-error guards the typecheck; Sentry's types are
        // optional at this layer, the dynamic shape is fine.
        // @ts-expect-error - optional dependency, only loaded when SENTRY_DSN is set
        const Sentry = await import(/* webpackIgnore: true */ "@sentry/nextjs");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        Sentry.init({ dsn: env.SENTRY_DSN });
        _sentry = Sentry;
        log.info("Sentry initialised");
    } catch (err: unknown) {
        // ERR_MODULE_NOT_FOUND or any other import failure — safe to ignore.
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("Cannot find module") && !msg.includes("ERR_MODULE_NOT_FOUND")) {
            log.warn("Sentry init failed", { error: msg });
        }
    }
};

// Fire-and-forget on module load so it is ready by the time the first error occurs.
void init();

/**
 * Capture an exception in Sentry. Best-effort: never throws.
 */
export const captureException = (err: unknown): void => {
    if (!_sentry) return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        _sentry.captureException(err);
    } catch {
        // Intentionally swallowed — monitoring must never affect the application.
    }
};
