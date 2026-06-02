import fs from 'fs-extra'
import type { RunFunction } from '@data-fair/lib-common-types/processings.js'
import type { ProcessingConfig } from '#types/processingConfig/index.ts'
import { download } from './download.ts'
import { processData } from './process.ts'
import { upload } from './upload.ts'

let shouldStop = false

export const stop = async (): Promise<void> => { shouldStop = true }

/**
 * Main entry point: download the latest V4-1 export, flatten it to CSV (streaming), then create
 * or update the corresponding data-fair file dataset.
 */
export const run: RunFunction<ProcessingConfig> = async (context) => {
  shouldStop = false
  const { processingConfig, tmpDir, log } = context

  const xmlPath = await download(context)
  if (shouldStop) return

  const { csvPath } = await processData(context, xmlPath)
  if (shouldStop) return

  await upload(context, csvPath)

  if (processingConfig.clearFiles) {
    await log.info('Suppression des fichiers téléchargés')
    await fs.emptyDir(tmpDir)
  }
}
