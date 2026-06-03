import fs from 'fs-extra'
import path from 'node:path'
import util from 'node:util'
import FormData from 'form-data'
import { formatBytes } from '@data-fair/lib-utils/format/bytes.js'
import type { RncpRsProcessingContext } from './context.ts'
import { getRepertoire, type Field } from './repertoires/index.ts'
import { DATASET_CREATOR, DATASET_FREQUENCY, DATASET_LICENSE, DATASET_ORIGIN } from './repertoires/common.ts'

/**
 * Force data-fair's legacy key-escaping algorithm so CSV headers become dataset keys verbatim
 * (case preserved), instead of the current default that slugifies them to lower-case
 * (`ID_FICHE` -> `id_fiche`). The legacy datasets (koumoul.com/.../competences-rncp & competences-rs)
 * were created this way, so the historical columns keep their exact upper-case keys and the
 * recreated datasets stay 100 % compatible. New columns are authored with lower-case keys in the
 * répertoire schemas, so legacy escaping leaves them lower-case.
 */
export const ANALYSIS = { escapeKeyAlgorithm: 'legacy' as const }

/**
 * Strip the `extract` function: under the legacy escaping algorithm the column `key` is already the
 * exact data-fair key (= the CSV header), so the curated metadata merges onto the analysed file
 * schema by an exact key match. `x-originalName` mirrors the header, as data-fair stores it.
 */
export const buildDataFairSchema = (fields: Field[]) => fields.map(({ extract, ...meta }) => ({
  ...meta,
  'x-originalName': meta.key
}))

/**
 * Send the generated CSV to data-fair, then (conditionally) apply the curated schema (titles,
 * descriptions, concepts, separators, enums) in a second step.
 *
 * Descriptive metadata (title, description, summary, creator, license, origin, frequency) and the
 * escaping algorithm are sent **only on creation**: they initialise the dataset and must not
 * overwrite manual edits on subsequent updates. The source modification date (`modified`) is the
 * only metadata refreshed on every run, so the dataset always reflects the source date.
 *
 * The schema is NOT sent inline with the file: when a file is imported, data-fair rebuilds the
 * schema from the CSV headers, and a schema provided alongside the file is discarded (only the raw
 * column names survive). Pushing it as a separate PATCH once the dataset is finalised works,
 * because data-fair then merges the curated metadata onto the existing columns by key
 * (see `ANALYSIS` / `buildDataFairSchema`). On update the PATCH only happens when the
 * `updateSchema` option (case « Mettre à jour le schéma ») is checked; on create it is always done.
 *
 * The dataset stays a file dataset; its id and type are preserved on update. `topics` (thématiques)
 * et `relatedDatasets` ne sont pas gérés ici : ils référencent des identifiants propres à l'instance
 * data-fair et restent à renseigner manuellement.
 *
 * @param sourceModified modification date of the source export on data.gouv.fr (YYYY-MM-DD).
 */
export const upload = async (context: RncpRsProcessingContext, csvPath: string, sourceModified?: string): Promise<void> => {
  const { processingConfig, axios, log, patchConfig, ws } = context
  const repertoire = getRepertoire(processingConfig.processFile)
  const schema = buildDataFairSchema(repertoire.schema)
  const isUpdate = processingConfig.datasetMode === 'update'

  await log.step(isUpdate ? 'Mise à jour du jeu de données' : 'Création du jeu de données')

  const formData = new FormData()
  // Always refresh the source modification date so the dataset reflects the data.gouv export date.
  if (sourceModified) formData.append('modified', sourceModified)
  // Descriptive metadata and the escaping algorithm only initialise the dataset, never overwrite it.
  if (!isUpdate) {
    formData.append('title', processingConfig.dataset?.title || repertoire.datasetTitle)
    formData.append('description', repertoire.datasetDescription)
    formData.append('summary', repertoire.datasetSummary)
    formData.append('creator', DATASET_CREATOR)
    formData.append('frequency', DATASET_FREQUENCY)
    formData.append('license', JSON.stringify(DATASET_LICENSE))
    formData.append('origin', DATASET_ORIGIN)
    // Pin the legacy escaping algorithm so the file analysis keeps CSV headers as keys verbatim.
    formData.append('analysis', JSON.stringify(ANALYSIS))
  }
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

  // Wait for the file import to finalise before doing anything else (and so the run ends clean).
  if (dataset.status !== 'finalized') await ws.waitForJournal(dataset.id, 'finalize-end')

  // The file import discards an inline schema, so apply the curated schema as a separate PATCH:
  // data-fair then merges titles/descriptions/concepts onto the analysed columns by key. On update
  // this only runs when the « Mettre à jour le schéma » option is checked, to preserve manual edits.
  if (!isUpdate || processingConfig.updateSchema) {
    await log.step('Application du schéma')
    await axios.patch(`api/v1/datasets/${dataset.id}`, { schema })
    await ws.waitForJournal(dataset.id, 'finalize-end')
    await log.info(`Schéma appliqué (${schema.length} colonnes)`)
  } else {
    await log.info('Schéma inchangé (case « Mettre à jour le schéma » décochée)')
  }
}
