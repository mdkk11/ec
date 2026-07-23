import { createDatabaseClient, type DatabaseClient } from './client'
import {
  loadDatabaseEnvironment,
  requireDatabaseEnvironment,
} from './environment'

let runtimeDatabase: DatabaseClient | undefined

function resolveRuntimeDatabaseUrl() {
  loadDatabaseEnvironment()

  if (process.env.NODE_ENV === 'test') {
    return requireDatabaseEnvironment('TEST_DATABASE_URL')
  }

  return requireDatabaseEnvironment('DATABASE_URL')
}

export function getRuntimeDatabase() {
  runtimeDatabase ??= createDatabaseClient(resolveRuntimeDatabaseUrl())
  return runtimeDatabase
}

export async function closeRuntimeDatabase() {
  const database = runtimeDatabase
  runtimeDatabase = undefined
  await database?.close()
}
