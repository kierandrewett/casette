import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

// Per-user preference flags. Kept in a separate table rather than a JSONB
// column on `user` so we can add columns without a `user` schema migration.
export const userPreferences = pgTable("user_preferences", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    signInAlerts: boolean("sign_in_alerts").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
