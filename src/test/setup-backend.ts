import { afterAll, beforeEach } from 'vitest'

import { truncateApplicationTables } from '@/server/db/test-lifecycle'

import {
  backendDatabase,
  developmentDatabaseUrl,
  testDatabaseUrl,
} from './backend/database'

beforeEach(async () => {
  await truncateApplicationTables(backendDatabase.pool, {
    developmentDatabaseUrl,
    nodeEnv: process.env.NODE_ENV,
    testDatabaseUrl,
  })
})

afterAll(async () => {
  await backendDatabase.close()
})
