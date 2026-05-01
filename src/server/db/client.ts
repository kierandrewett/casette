import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";

import * as schema from "./schema";

const globalForPg = globalThis as unknown as {
    __cassettePg?: postgres.Sql;
};

// One pooled postgres-js instance per process. Re-used across HMR reloads in
// dev so we don't exhaust connections.
const sql =
    globalForPg.__cassettePg ??
    postgres(env.DATABASE_URL, {
        max: 20,
        idle_timeout: 20,
        max_lifetime: 60 * 30,
        prepare: false,
    });

if (env.NODE_ENV !== "production") {
    globalForPg.__cassettePg = sql;
}

export const db = drizzle(sql, { schema, casing: "snake_case" });

export type Database = typeof db;
export { sql as pgSql };
