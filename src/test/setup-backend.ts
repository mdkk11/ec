import { afterAll, beforeEach } from 'vitest'

import { closeRuntimeDatabase } from '@/server/db/runtime'
import { truncateApplicationTables } from '@/server/db/test-lifecycle'

import { backendDatabase, developmentDatabaseUrl, testDatabaseUrl } from './backend/database'

beforeEach(async () => {
  await truncateApplicationTables(backendDatabase.pool, {
    developmentDatabaseUrl,
    expectedDatabase: 'mockshop_test',
    nodeEnv: process.env.NODE_ENV,
    targetDatabaseUrl: testDatabaseUrl,
  })
})

afterAll(async () => {
  await closeRuntimeDatabase()
  await backendDatabase.close()
})
