# PROJECT RULES (DO NOT IGNORE)

1. **Tech Stack:** React, TypeScript, Express, SQLite.
2. **Database (CRITICAL):** - Use **Drizzle ORM** ONLY.
   - NEVER use JSON file storage or KV store logic.
   - All DB operations must go through `server/storage.ts`.
3. **Architecture:**
   - Frontend components must use `shadcn/ui`.
   - Backend routes must NOT contain business logic; move logic to `storage.ts`.
   - Always use Zod for validation.
4. **Refactoring:**
   - If you see `readCollection` or `writeCollection` code, DELETE IT. Do not use it.