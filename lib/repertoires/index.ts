import type { ProcessFile } from '#types/processingConfig/index.ts'
import type { Repertoire } from './common.ts'
import { rncp } from './rncp.ts'
import { rs } from './rs.ts'

export const repertoires: Record<ProcessFile, Repertoire> = { rncp, rs }

export const getRepertoire = (processFile: ProcessFile): Repertoire => {
  const repertoire = repertoires[processFile]
  if (!repertoire) throw new Error(`Répertoire inconnu : ${processFile}`)
  return repertoire
}

export type { Repertoire, Field } from './common.ts'
