import { customType } from "drizzle-orm/pg-core";

// citext is a Postgres extension giving case-insensitive text columns.
// We use it for channel handles so "@Kieran" and "@kieran" collide on insert
// but the original casing is preserved on display.
export const citext = customType<{ data: string }>({
    dataType() {
        return "citext";
    },
});

// tsvector is the indexed Postgres full-text-search column. We populate it
// via a trigger (see triggers.sql) rather than a generated column because
// the value depends on the joined channel name.
export const tsvector = customType<{ data: string }>({
    dataType() {
        return "tsvector";
    },
});
