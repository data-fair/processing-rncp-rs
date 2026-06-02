import config from '#config'
import { strict as assert } from 'node:assert'
import { it, describe, before } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import testUtils from '@data-fair/lib-processing-dev/tests-utils.js'

import { processData } from '../lib/process.ts'
import { getRepertoire } from '../lib/repertoires/index.ts'
import processingConfigSchema from '../processing-config-schema.json' with { type: 'json' }

const dir = path.dirname(fileURLToPath(import.meta.url))
const tmpDir = path.join(dir, '../test-data')

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
  before(async () => { await fs.remove(tmpDir) })

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
    // a few additions
    for (const added of ['SIRET_CERTIFICATEURS', 'STATISTIQUES_PROMOTIONS', 'NOUVELLES_CERTIFICATIONS', 'FORMACODES']) {
      assert.ok(keys.includes(added), `colonne ajoutée manquante : ${added}`)
    }
    // no duplicate keys
    assert.equal(new Set(keys).size, keys.length, 'clés de colonnes dupliquées')
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
