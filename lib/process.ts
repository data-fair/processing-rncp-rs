import fs from 'fs-extra'
import path from 'node:path'
import { stringify } from 'csv-stringify'
import type { RncpRsProcessingContext } from './context.ts'
import { getRepertoire } from './repertoires/index.ts'
import { streamFiches, type FicheNode } from './xml-stream.ts'
import { EXPECTED_FLUX_VERSION } from './download.ts'

export interface ProcessResult {
  csvPath: string
  count: number
}

/**
 * Stream the XML export fiche by fiche and write the flattened CSV, keeping memory bounded
 * regardless of the file size (the RNCP V4-1 export is several hundred MB uncompressed).
 */
export const processData = async ({ processingConfig, log }: RncpRsProcessingContext, xmlPath: string): Promise<ProcessResult> => {
  await log.step('Traitement du fichier')
  const repertoire = getRepertoire(processingConfig.processFile)
  const columns = repertoire.schema.map((field) => field.key)
  const csvPath = path.join(path.dirname(xmlPath), `competences-${repertoire.code.toLowerCase()}.csv`)

  await log.info(`Lecture du fichier ${path.basename(xmlPath)}`)

  const readStream = fs.createReadStream(xmlPath, { encoding: 'utf8' })
  const writeStream = fs.createWriteStream(csvPath)
  const stringifier = stringify({ header: true, columns, quoted_string: true })
  stringifier.pipe(writeStream)
  // resume the source once the CSV writer has drained (back-pressure handled in streamFiches)
  stringifier.on('drain', () => readStream.resume())

  const writeComplete = new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
    stringifier.on('error', reject)
  })

  let count = 0
  let fluxVersion = ''

  await streamFiches(readStream, {
    onVersion: (version) => { fluxVersion = version },
    onFiche: (fiche: FicheNode) => {
      const row = repertoire.schema.map((field) => field.extract(fiche))
      count++
      return stringifier.write(row)
    }
  })

  stringifier.end()
  await writeComplete

  if (fluxVersion !== EXPECTED_FLUX_VERSION) {
    await log.warning(`La version du flux téléchargé (${fluxVersion || 'inconnue'}) diffère de la version attendue (${EXPECTED_FLUX_VERSION}). Le résultat peut être incomplet : le traitement doit probablement être mis à jour.`)
  }

  await log.info(`${count} fiches traitées, écriture de ${path.basename(csvPath)}`)
  return { csvPath, count }
}
