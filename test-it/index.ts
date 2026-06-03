import config from '#config'
import { strict as assert } from 'node:assert'
import { it, describe, beforeEach } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import testUtils from '@data-fair/lib-processing-dev/tests-utils.js'

import { processData } from '../lib/process.ts'
import { getRepertoire } from '../lib/repertoires/index.ts'
import { buildDataFairSchema } from '../lib/upload.ts'
import processingConfigSchema from '../processing-config-schema.json' with { type: 'json' }

const dir = path.dirname(fileURLToPath(import.meta.url))
const tmpDir = path.join(dir, '../data')

/** Run processData against a fixture and return the produced CSV content. */
const runOn = async (processFile: 'rncp' | 'rs') => {
  await fs.ensureDir(tmpDir)
  const xmlPath = path.join(tmpDir, `fixture-${processFile}.xml`)
  await fs.copy(path.join(dir, `fixtures/${processFile}.xml`), xmlPath)
  const context = testUtils.context({
    pluginConfig: {},
    processingConfig: { datasetMode: 'create', processFile, dataset: { title: 'test' } },
    tmpDir
    // `config as any`: the published @data-fair/lib-processing-dev@0.2.0 still types
    // ProcessingTestConfig with required adminMode/account. Drop the cast once the fixed
    // version (already in lib/packages/processing-dev locally) is published.
  }, config as any, false)
  const { csvPath, count } = await processData(context as any, xmlPath)
  const csv = await fs.readFile(csvPath, 'utf8')
  return { csv, count }
}

describe('RNCP / RS processing', () => {
  beforeEach(async () => { await fs.remove(tmpDir) })

  it('exposes a processing config schema', () => {
    assert.equal(processingConfigSchema.type, 'object')
  })

  it('keeps every legacy column and adds the new ones (RNCP)', () => {
    const schema = getRepertoire('rncp').schema
    const keys = schema.map((f) => f.key)
    // legacy columns must all still be present
    for (const legacy of ['ID_FICHE', 'NUMERO_FICHE', 'INTITULE', 'ABREGE_CODES', 'ETAT_FICHE', 'SI_JURY_FI', 'JURY_FI', 'CERTIFICATEURS', 'ACTIF']) {
      assert.ok(keys.includes(legacy), `colonne legacy manquante : ${legacy}`)
    }
    // a few additions (added columns use lower-case keys)
    for (const added of ['siret_certificateurs', 'statistiques_promotions', 'nouvelles_certifications', 'formacodes']) {
      assert.ok(keys.includes(added), `colonne ajoutée manquante : ${added}`)
    }
    // no duplicate keys
    assert.equal(new Set(keys).size, keys.length, 'clés de colonnes dupliquées')
  })

  it('builds a data-fair schema whose keys merge by exact match (legacy escaping)', () => {
    for (const processFile of ['rncp', 'rs'] as const) {
      const repertoire = getRepertoire(processFile)
      const dfSchema = buildDataFairSchema(repertoire.schema)
      for (let i = 0; i < dfSchema.length; i++) {
        const field = dfSchema[i]
        const originalKey = repertoire.schema[i].key
        // Under the legacy escaping algorithm data-fair keeps the CSV header verbatim as the key,
        // so the curated key is unchanged and merges by exact match, with the header kept as x-originalName.
        assert.equal(field.key, originalKey, `clé modifiée : ${originalKey}`)
        assert.equal(field['x-originalName'], originalKey, `x-originalName perdu pour ${originalKey}`)
        assert.ok(field.title, `titre manquant pour ${originalKey}`)
      }
    }
  })

  it('keeps the legacy production keys byte-for-byte and lower-cases added columns', () => {
    // Keys of the legacy production datasets (koumoul.com/.../competences-rncp & competences-rs).
    // They must stay identical so the recreated datasets remain 100 % compatible.
    const legacyKeys = {
      rncp: ['ID_FICHE', 'NUMERO_FICHE', 'INTITULE', 'ABREGE_CODES', 'ABREGE_LIBELLES', 'ETAT_FICHE', 'NOMENCLATURE_EUROPE_NIVEAU', 'NOMENCLATURE_EUROPE_INTITULE', 'TYPE_EMPLOI_ACCESSIBLES', 'CODES_ROME', 'LIBELLES_ROME', 'CODES_NSF', 'INTITULE_NSF', 'CERTIFICATEURS', 'ACTIVITES_VISEES', 'CAPACITES_ATTESTEES', 'LIEN_URL_DESCRIPTION', 'REGLEMENTATIONS_ACTIVITES', 'OBJECTIFS_CONTEXTE', 'SI_JURY_FI', 'JURY_FI', 'SI_JURY_CA', 'JURY_CA', 'SI_JURY_FC', 'SI_JURY_CQ', 'SI_JURY_CL', 'JURY_CL', 'SI_JURY_VAE', 'ACTIF'],
      rs: ['ID_FICHE', 'NUMERO_FICHE', 'INTITULE', 'ETAT_FICHE', 'FORMACODES', 'FORMALIBELLES', 'CODES_NSF', 'INTITULE_NSF', 'CERTIFICATEURS', 'CAPACITES_ATTESTEES', 'LIEN_URL_DESCRIPTION', 'REGLEMENTATIONS_ACTIVITES', 'DATE_FIN_ENREGISTREMENT', 'TYPE_ENREGISTREMENT', 'OBJECTIFS_CONTEXTE', 'NIVEAU_MAITRISE_COMPETENCES', 'MODALITES_RENOUVELLEMENT', 'VALIDATION_PARTIELLE', 'ACTIF']
    }
    for (const processFile of ['rncp', 'rs'] as const) {
      const keys = getRepertoire(processFile).schema.map((f) => f.key)
      const legacy = legacyKeys[processFile]
      // historical columns: same keys, same order, at the front of the schema
      assert.deepEqual(keys.slice(0, legacy.length), legacy, `clés historiques modifiées (${processFile})`)
      // added columns: lower-case only
      for (const key of keys.slice(legacy.length)) {
        assert.equal(key, key.toLowerCase(), `colonne ajoutée non minuscule : ${key}`)
      }
    }
  })

  it('flattens RNCP fiches correctly', async () => {
    const { csv, count } = await runOn('rncp')
    assert.equal(count, 2)
    const header = csv.split('\n')[0]
    assert.ok(header.includes('JURY_FI') && header.includes('SI_JURY_FI'))
    // JURY restructure : SI_JURY_FI <- ACTIF, JURY_FI <- COMPOSITION
    assert.ok(csv.includes('Jury FI composition'), 'composition du jury non extraite')
    // multivalued certificateurs + sirets
    assert.ok(csv.includes('ORG A; ORG B'), 'noms certificateurs non joints')
    assert.ok(csv.includes('11111111100011; 22222222200022'), 'sirets certificateurs non joints')
    // NOMENCLATURE_EUROPE_INTITULE <- LIBELLE (renommé depuis INTITULE en V2)
    assert.ok(csv.includes('Niveau 5'), 'intitulé du niveau non extrait')
    // stats aplaties
    assert.ok(csv.includes('2020 : 10 certifiés'), 'statistiques non aplaties')
    // liens entre fiches
    assert.ok(csv.includes('RNCP99999'), 'nouvelle certification non extraite')
  })

  it('flattens RS fiches correctly', async () => {
    const { csv, count } = await runOn('rs')
    assert.equal(count, 1)
    assert.ok(csv.includes('OCTO-TECHNOLOGY'), 'certificateur RS non extrait')
    assert.ok(csv.includes('326; 326t'), 'codes NSF non joints')
    assert.ok(csv.includes('Jury VAE composition'), 'composition jury VAE non extraite')
  })
})
