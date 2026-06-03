// Hand-written types for the processing config (form defined in processing-config-schema.json).
// Can be regenerated with `npm run build-types` (outputs to ./.type).

/** Which répertoire to process. */
export type ProcessFile = 'rncp' | 'rs'

export interface ProcessingConfig {
  /** 'create' to create the dataset, 'update' to refresh an existing one. */
  datasetMode: 'create' | 'update'
  /** Target dataset. On create only `title` is used; on update `id` (and `title`) identify it. */
  dataset?: {
    id?: string
    title?: string
  }
  /** Répertoire to process: RNCP or RS. */
  processFile: ProcessFile
}
