import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const integrations = sqliteTable("integrations", {
 userId: text("user_id").primaryKey(), encrypted: text("encrypted").notNull(), updated: text("updated").notNull(),
});
export const snapshots = sqliteTable("snapshots", {
 id: text("id").primaryKey(), userId: text("user_id").notNull(), fetchedAt: text("fetched_at").notNull(), payload: text("payload").notNull(),
}, t=>[index("snapshot_user_date").on(t.userId,t.fetchedAt)]);
export const locks = sqliteTable("refresh_locks",{userId:text("user_id").primaryKey(),until:integer("until_ms").notNull()});
export const preferences = sqliteTable('preferences',{userId:text('user_id').primaryKey(),payload:text('payload').notNull(),revision:integer('revision').notNull().default(1),updated:text('updated').notNull()});
export const reportRuns=sqliteTable('report_runs',{id:text('id').primaryKey(),userId:text('user_id').notNull(),slot:text('slot').notNull(),status:text('status').notNull(),updated:text('updated').notNull(),detail:text('detail')});
export const reportArtifacts=sqliteTable('report_artifacts',{userId:text('user_id').primaryKey(),snapshotId:text('snapshot_id').notNull(),payload:text('payload').notNull(),updated:text('updated').notNull()});
