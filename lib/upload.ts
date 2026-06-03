import fs from 'fs-extra'
import path from 'node:path'
import util from 'node:util'
import FormData from 'form-data'
import slug from 'slugify'
import { formatBytes } from '@data-fair/lib-utils/format/bytes.js'
import type { RncpRsProcessingContext } from './context.ts'
import { getRepertoire, type Field } from './repertoires/index.ts'
import { DATASET_CREATOR, DATASET_FREQUENCY, DATASET_LICENSE, DATASET_ORIGIN } from './repertoires/common.ts'

/**
 * Reproduce data-fair's default column-key escaping (api `escapeKey`, slugify with these exact
 * options). data-fair slugifies CSV headers to lower-case keys (`ID_FICHE` -> `id_fiche`), then
 * merges a provided schema onto the file schema by an exact, case-sensitive key match. So our
 * curated schema must use the escaped key, otherwise titles/descriptions/concepts are silently
 * dropped and the dataset shows the raw column names.
 */
export const escapeKey = (key: string): string => slug(key, { lower: true, strict: true, replacement: '_' })

/**
 * Strip the `extract` function and align each column to data-fair's escaped key, keeping the
 * original (upper-case) header as `x-originalName`, so the curated metadata actually merges onto
 * the analysed file schema instead of being ignored.
 */
export const buildDataFairSchema = (fields: Field[]) => fields.map(({ extract, key, ...meta }) => ({
  key: escapeKey(key),
  'x-originalName': key,
  ...meta
}))

/**
 * Send the generated CSV to data-fair, together with the curated schema (titles, descriptions,
 * concepts, separators, enums) and the dataset metadata (description, summary, producer, license,
 * origin, update frequency and source modification date), so the processing fully drives the
 * dataset metadata. The dataset stays a file dataset; its id and type are preserved on update.
 * `topics` (thématiques) et `relatedDatasets` ne sont pas gérés ici : ils référencent des
 * identifiants propres à l'instance data-fair et restent à renseigner manuellement.
 *
 * @param sourceModified modification date of the source export on data.gouv.fr (YYYY-MM-DD).
 */
export const upload = async (context: RncpRsProcessingContext, csvPath: string, sourceModified?: string): Promise<void> => {
  const { processingConfig, axios, log, patchConfig } = context
  const repertoire = getRepertoire(processingConfig.processFile)
  const schema = buildDataFairSchema(repertoire.schema)
  const isUpdate = processingConfig.datasetMode === 'update'

  await log.step(isUpdate ? 'Mise à jour du jeu de données' : 'Création du jeu de données')

  const formData = new FormData()
  formData.append('schema', JSON.stringify(schema))
  formData.append('description', repertoire.datasetDescription)
  formData.append('summary', repertoire.datasetSummary)
  formData.append('creator', DATASET_CREATOR)
  formData.append('frequency', DATASET_FREQUENCY)
  formData.append('license', JSON.stringify(DATASET_LICENSE))
  formData.append('origin', DATASET_ORIGIN)
  if (sourceModified) formData.append('modified', sourceModified)
  if (!isUpdate) formData.append('title', processingConfig.dataset?.title || repertoire.datasetTitle)
  formData.append('file', fs.createReadStream(csvPath), { filename: path.parse(csvPath).base })

  const getLength = util.promisify(formData.getLength.bind(formData))
  const contentLength = await getLength()
  await log.info(`Chargement de ${formatBytes(contentLength ?? 0)}`)

  const datasetId = processingConfig.dataset?.id
  const url = (isUpdate && datasetId) ? `api/v1/datasets/${datasetId}` : 'api/v1/datasets'

  const dataset = (await axios({
    method: 'post',
    url,
    data: formData,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: { ...formData.getHeaders(), 'content-length': contentLength }
  })).data

  if (isUpdate) {
    await log.info(`Jeu de données mis à jour, id="${dataset.id}", title="${dataset.title}"`)
  } else {
    await log.info(`Jeu de données créé, id="${dataset.id}", title="${dataset.title}"`)
    await patchConfig({ datasetMode: 'update', dataset: { id: dataset.id, title: dataset.title } })
  }
}
