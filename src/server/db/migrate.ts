import { fileURLToPath } from 'node:url'

import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

export const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url))

export function migrateDatabase(db: NodePgDatabase) {
  return migrate(db, { migrationsFolder })
}
