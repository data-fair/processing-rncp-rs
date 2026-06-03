import { htmlToText } from 'html-to-text'
import type { FicheNode, FicheValue } from '../xml-stream.ts'

/** Separator used to flatten multi-valued (one-to-many) source fields into a single cell. */
export const SEP = '; '

/** A single output column: its data-fair schema metadata + how to extract its value from a fiche. */
export interface Field {
  key: string
  type: 'string' | 'integer' | 'number' | 'boolean'
  format?: string
  title: string
  description?: string
  'x-refersTo'?: string
  'x-display'?: string
  separator?: string
  enum?: string[]
  /** Build the (string) cell value for this column from a fiche. */
  extract: (fiche: FicheNode) => string
}

export interface Repertoire {
  /** Upper-case code used to match the data.gouv resource and the XML filename (RNCP / RS). */
  code: 'RNCP' | 'RS'
  datasetTitle: string
  datasetDescription: string
  /** Short description shown in dataset cards / catalogs. */
  datasetSummary: string
  schema: Field[]
}

/**
 * Metadata shared by every répertoire (RNCP & RS come from the same data.gouv dataset and producer).
 * Thématiques (`topics`) et jeux de données liés (`relatedDatasets`) ne sont pas inclus : ils
 * référencent des identifiants propres à l'instance data-fair, à renseigner manuellement.
 */
export const DATASET_CREATOR = 'France compétences'
export const DATASET_FREQUENCY = 'weekly'
export const DATASET_LICENSE = {
  title: 'Licence Ouverte / Open Licence',
  href: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence'
}
export const DATASET_ORIGIN = 'https://www.data.gouv.fr/fr/datasets/repertoire-national-des-certifications-professionnelles-et-repertoire-specifique/'

/**
 * Description éditoriale (Markdown) commune aux deux jeux, reprise telle quelle de la prod
 * (koumoul.com/.../competences-rncp & competences-rs), simplement adaptée pour préciser que la
 * source est désormais le flux XML V4-1. Identique pour RNCP et RS (elle présente les deux
 * répertoires), comme en prod. Utilisée uniquement à la création du jeu de données.
 */
export const DATASET_DESCRIPTION = `**France compétences** a la responsabilité confiée par le législateur d’enregistrer, de mettre à jour et de rendre accessible les certifications inscrites au Répertoire national des certifications professionnelles (RNCP) et au Répertoire spécifique (RS) des certifications et des habilitations.

Les certifications enregistrées au **RNCP** (classées par niveau de qualification et domaine d’activité) permettent de valider des compétences et des connaissances acquises, nécessaires à l’exercice d’activités professionnelles. Elles sont constituées de blocs de compétences : ensembles homogènes et cohérents de compétences, pouvant être évaluées et validées, qui doivent permettre l’exercice autonome d’une activité professionnelle.

Les certifications enregistrées au **RS** correspondent à des compétences complémentaires : habilitations sécurité, certifications professionnalisantes, compétences transversales.

Ce jeu de données a été retravaillé à partir du flux XML V4-1 publié sur [data.gouv.fr](${DATASET_ORIGIN}) pour être plus facilement exploitable.`

const isNode = (v: FicheValue | undefined): v is FicheNode =>
  v != null && typeof v === 'object' && !Array.isArray(v)

const asArray = (v: FicheValue | undefined): (string | FicheNode)[] =>
  v == null ? [] : (Array.isArray(v) ? v : [v])

/** Trimmed text of a (possibly missing) leaf value. */
export const str = (v: FicheValue | undefined): string => (typeof v === 'string' ? v.trim() : '')

/** Text of a direct leaf child of the fiche. */
export const text = (fiche: FicheNode, key: string): string => str(fiche[key])

/** Rich text leaf, converted from any residual HTML to plain text. */
export const richText = (fiche: FicheNode, key: string): string => {
  const raw = str(fiche[key])
  if (!raw) return ''
  return htmlToText(raw, { wordwrap: false }).trim()
}

/**
 * Collect a sub-value from every item of a list container and join them.
 * e.g. itemsJoin(fiche, 'CODES_ROME', 'ROME', 'CODE') → "M1234;K5678".
 * `subKeys` are tried in order (handles V2→V4 renames like INTITULE→LIBELLE).
 */
export const itemsJoin = (fiche: FicheNode, container: string, item: string, subKeys: string | string[], sep = SEP): string => {
  const keys = Array.isArray(subKeys) ? subKeys : [subKeys]
  const items = asArray(fiche[container])
    .filter(isNode)
    .flatMap((c) => asArray(c[item]))
    .filter(isNode)
  return items
    .map((node) => {
      for (const k of keys) { const v = str(node[k]); if (v) return v }
      return ''
    })
    .filter(Boolean)
    .join(sep)
}

/**
 * Collect a sub-value directly under a (possibly repeated) container and join them.
 * e.g. directJoin(fiche, 'NOMENCLATURE_EUROPE', 'NIVEAU') ; directJoin(fiche, 'CCN_1', 'LIBELLE').
 */
export const directJoin = (fiche: FicheNode, container: string, subKeys: string | string[], sep = SEP): string => {
  const keys = Array.isArray(subKeys) ? subKeys : [subKeys]
  return asArray(fiche[container])
    .filter(isNode)
    .map((node) => {
      for (const k of keys) { const v = str(node[k]); if (v) return v }
      return ''
    })
    .filter(Boolean)
    .join(sep)
}

/** First composite occurrence of a tag (e.g. the SI_JURY_FI node). */
const firstNode = (fiche: FicheNode, key: string): FicheNode | undefined =>
  asArray(fiche[key]).find(isNode)

/** In V4 a voie d'accès is `<SI_JURY_X><ACTIF>Oui/Non</ACTIF><COMPOSITION>…</COMPOSITION></SI_JURY_X>`. */
export const juryActif = (fiche: FicheNode, key: string): string => str(firstNode(fiche, key)?.ACTIF)
export const juryComposition = (fiche: FicheNode, key: string): string => {
  const compo = str(firstNode(fiche, key)?.COMPOSITION)
  return compo ? htmlToText(compo, { wordwrap: false }).trim() : ''
}

/** Readable flattening of <STATISTIQUES_PROMOTIONS> (one promotion per year). */
export const statistiquesPromotions = (fiche: FicheNode): string => {
  const promos = asArray(fiche.STATISTIQUES_PROMOTIONS)
    .filter(isNode)
    .flatMap((c) => asArray(c.STATISTIQUES_PROMOTION))
    .filter(isNode)
  return promos
    .map((p) => {
      const annee = str(p.ANNEE)
      const nb = str(p.NOMBRE_CERTIFIES)
      const nbVae = str(p.NOMBRE_CERTIFIES_VAE)
      const t6 = str(p.TAUX_INSERTION_GLOBAL_6MOIS)
      const t24 = str(p.TAUX_INSERTION_METIER_2ANS)
      const parts: string[] = []
      if (nb) parts.push(`${nb} certifiés`)
      if (nbVae) parts.push(`${nbVae} VAE`)
      if (t6) parts.push(`insertion 6 mois ${t6} %`)
      if (t24) parts.push(`insertion 2 ans ${t24} %`)
      return annee ? `${annee} : ${parts.join(', ')}` : parts.join(', ')
    })
    .filter(Boolean)
    .join(' ; ')
}

const firstObj = (v: FicheValue | undefined): FicheNode | undefined => asArray(v).find(isNode)

/** Code of the BLOC_COMPETENCES nested directly under a SOURCE/DESTINATION node. */
const blocCode = (v: FicheValue | undefined): string => str(firstObj(firstObj(v)?.BLOC_COMPETENCES)?.CODE)

/** Readable flattening of <CORRESPONDANCES> (equivalences between certifications / blocs). */
export const correspondances = (fiche: FicheNode): string => {
  const items = asArray(fiche.CORRESPONDANCES)
    .filter(isNode)
    .flatMap((c) => asArray(c.CORRESPONDANCE))
    .filter(isNode)
  return items
    .map((corr) => {
      const source = blocCode(corr.SOURCE)
      const destNode = firstObj(corr.DESTINATION)
      const destFiche = str(destNode?.NUMERO_FICHE)
      const destBloc = blocCode(corr.DESTINATION)
      const dest = destBloc ? `${destFiche} (${destBloc})`.trim() : destFiche
      return [source, dest].filter(Boolean).join(' → ')
    })
    .filter(Boolean)
    .join(' ; ')
}

/** Readable flattening of a <PUBLICATION_DECRET_*> container (list of <PUBLICATION_JO>). */
export const publicationDecret = (fiche: FicheNode, container: string): string => {
  const jos = asArray(fiche[container])
    .filter(isNode)
    .flatMap((c) => asArray(c.PUBLICATION_JO))
    .filter(isNode)
  return jos
    .map((jo) => {
      const date = str(jo.DATE_PUBLICATION_JO)
      const titre = str(jo.TITRE)
      return [date, titre].filter(Boolean).join(' - ')
    })
    .filter(Boolean)
    .join(' ; ')
}
