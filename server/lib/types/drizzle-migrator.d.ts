declare module "drizzle-orm/better-sqlite3/migrator" {
  export function migrate(db: any, opts?: { migrationsFolder?: string }): Promise<void>;
}
