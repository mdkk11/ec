import { createDatabaseClient } from '@/server/db/client'
import { loadDatabaseEnvironment, requireDatabaseEnvironment } from '@/server/db/environment'

loadDatabaseEnvironment()

export const testDatabaseUrl = requireDatabaseEnvironment('TEST_DATABASE_URL')
export const developmentDatabaseUrl = process.env.DATABASE_URL
export const backendDatabase = createDatabaseClient(testDatabaseUrl)
