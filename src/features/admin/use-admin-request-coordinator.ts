'use client'

import { CancelledError } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

export function useAdminRequestCoordinator() {
  const runningRef = useRef(false)
  const queryGenerationRef = useRef(0)
  const revisionRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    revisionRef.current += 1
    queryGenerationRef.current += 1
    controllerRef.current?.abort()
  }, [])

  async function runGuardedQuery<T>(request: () => Promise<T>) {
    const generation = queryGenerationRef.current
    const startedDuringOperation = runningRef.current
    const isStale = () =>
      startedDuringOperation || queryGenerationRef.current !== generation

    try {
      const data = await request()
      if (isStale()) throw new CancelledError()
      return data
    } catch (error) {
      if (isStale()) throw new CancelledError()
      throw error
    }
  }

  function beginOperation() {
    const revision = revisionRef.current + 1
    revisionRef.current = revision
    runningRef.current = true
    queryGenerationRef.current += 1
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    return { revision, signal: controller.signal }
  }

  function isOperationRunning() {
    return runningRef.current
  }

  function isCurrentOperation(revision: number) {
    return revisionRef.current === revision
  }

  function nextOperationSignal(revision: number) {
    if (!isCurrentOperation(revision)) return null
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    return controller.signal
  }

  function finishOperation(revision: number) {
    if (!isCurrentOperation(revision)) return false
    runningRef.current = false
    return true
  }

  return {
    beginOperation,
    finishOperation,
    isCurrentOperation,
    isOperationRunning,
    nextOperationSignal,
    runGuardedQuery,
  }
}
