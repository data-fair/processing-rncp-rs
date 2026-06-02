import type { RunFunction } from '@data-fair/lib-common-types/processings.js'
import type { ProcessingConfig } from './types/processingConfig/index.ts'

/**
 * Function to execute the processing (triggered when the processing is started).
 */
export const run: RunFunction<ProcessingConfig> = async (context) => {
  const { run } = await import('./lib/execute.ts')
  return run(context)
}

/**
 * Function to stop the processing (triggered when the processing is stopped).
 */
export const stop = async () => {
  const { stop } = await import('./lib/execute.ts')
  return stop()
}
