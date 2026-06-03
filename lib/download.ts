import fs from 'fs-extra'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { RncpRsProcessingContext } from './context.ts'
import { getRepertoire } from './repertoires/index.ts'
import { runCommand } from './spawn-process.ts'

/** data.gouv.fr dataset gathering all France Compétences exports (RNCP & RS). */
const DATA_GOUV_DATASET = '5eebbc067a14b6fecc9c9976'
/** Flux version this processing is written for. */
export const EXPECTED_FLUX_VERSION = '4.1'
const RESOURCE_VERSION = 'v4-1'

interface DataGouvResource {
  type: string
  title: string
  url: string
  /** ISO date-time of the last modification of this resource on data.gouv.fr. */
  last_modified?: string
}

export interface DownloadResult {
  /** Absolute path of the extracted .xml file to process. */
  xmlPath: string
  /** Modification date of the source export on data.gouv.fr (YYYY-MM-DD), if known. */
  sourceModified?: string
}

/** Extract a YYYY-MM-DD date from the resource (last_modified field, else the date suffix of its title). */
const resourceDate = (resource: DataGouvResource): string | undefined => {
  if (resource.last_modified) return resource.last_modified.slice(0, 10)
  return resource.title.match(/\d{4}-\d{2}-\d{2}/)?.[0]
}

/**
 * Download the latest V4-1 export for the configured répertoire, then unzip it.
 * @returns the path of the extracted .xml file and the source modification date.
 */
export const download = async ({ processingConfig, tmpDir, axios, log }: RncpRsProcessingContext): Promise<DownloadResult> => {
  await fs.ensureDir(tmpDir)
  const repertoire = getRepertoire(processingConfig.processFile)
  const token = `-${repertoire.code.toLowerCase()}-` // '-rncp-' or '-rs-'

  await log.step('Téléchargement')
  const { data } = await axios.get(`https://www.data.gouv.fr/api/1/datasets/${DATA_GOUV_DATASET}/`)
  const resources: DataGouvResource[] = data.resources || []

  const candidates = resources
    .filter((r) => r.type === 'update')
    .filter((r) => {
      const title = r.title.toLowerCase()
      return title.includes(token) && title.includes(RESOURCE_VERSION)
    })
    // titles end with a zero-padded YYYY-MM-DD date, so a lexicographic sort is chronological
    .sort((a, b) => b.title.localeCompare(a.title))

  if (candidates.length === 0) {
    throw new Error(`Aucune ressource ${repertoire.code} en ${RESOURCE_VERSION} trouvée sur data.gouv.fr (dataset ${DATA_GOUV_DATASET}). Le format source a peut-être changé.`)
  }

  const resource = candidates[0]
  const sourceModified = resourceDate(resource)
  const url = new URL(resource.url)
  const zipPath = path.join(tmpDir, path.parse(url.pathname).base)
  await log.info(`Téléchargement du fichier ${resource.title}`)

  // creating empty file before streaming seems to fix some weird bugs with NFS
  await fs.ensureFile(zipPath)
  const res = await axios({ url: url.href, method: 'GET', responseType: 'stream' })
  await pipeline(res.data, fs.createWriteStream(zipPath))

  // Try to prevent weird bug with NFS by forcing syncing file before reading it
  const fd = await fs.open(zipPath, 'r')
  await fs.fsync(fd)
  await fs.close(fd)

  await log.info('Extraction de l\'archive')
  await runCommand('unzip', ['-o', zipPath, '-d', tmpDir])
  await fs.remove(zipPath)

  const files = await fs.readdir(tmpDir)
  const xmlFile = files.find((file) => file.toLowerCase().endsWith('.xml') && file.toLowerCase().includes(repertoire.code.toLowerCase()))
  if (!xmlFile) throw new Error(`Aucun fichier XML ${repertoire.code} trouvé après extraction de l'archive.`)

  return { xmlPath: path.join(tmpDir, xmlFile), sourceModified }
}
