declare module "drizzle-orm/node-postgres/migrator" {
  export function migrate(db: any, opts?: { migrationsFolder?: string }): Promise<void>;
}
