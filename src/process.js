const fs = require('fs-extra')
const path = require('path')
const xml2js = require('xml2js')
const { htmlToText } = require('html-to-text')
const endOfLine = require('os').EOL
const csvSync = require('csv/sync')

module.exports = async (processingConfig, tmpDir, axios, log) => {
  await log.step('Traitement du fichier')
  const processFile = processingConfig.processFile.toUpperCase()

  let files = await fs.readdir(tmpDir)
  files = files.filter(file => file.endsWith('.xml') && file.includes(processFile))

  const filePath = files[0] && path.join(tmpDir, files[0])
  await log.info(`Lecture du fichier ${filePath}`)
  const content = fs.readFileSync(filePath, 'utf-8')
  const fileParse = (await xml2js.parseStringPromise(content)).FICHES

  // check if the current file version match the version needed for the script
  if (fileParse.VERSION_FLUX.pop() !== '2.0') await log.info(`La version du jeu de donnée est différente de celle prévue par ce script ${fileParse.VERSION_FLUX} : 2.0`)
  // fiches contains all of the lists
  const fiches = fileParse.FICHE

  const header = require(`./schema-${processFile}.json`).map((elem) => elem.key)
  const writeStream = fs.createWriteStream(path.join(tmpDir, `Compétences-${processFile}.csv`))
  // write the header using the schema file
  writeStream.write(header.map((elem) => `"${elem}"`).join(',') + endOfLine)

  await log.info(`Traitement des ${fiches.length} listes présentes dans le fichier`)

  for (const fiche of fiches) {
    let line = {}
    // RNCP
    if (processingConfig.processFile === 'rncp') {
      let abregeCodes, abregeLibelles
      let nomenclatureEuropeNiveau, nomenclatureEuropeIntitule
      let codesRome, libellesRome
      let codesNsf, intituleNsf
      let certificateurs

      if (fiche.ABREGE) {
        const codes = fiche.ABREGE
        abregeCodes = codes.map(c => c.CODE).join(';')
        abregeLibelles = codes.map(c => c.LIBELLE).join(';')
      }
      if (fiche.NOMENCLATURE_EUROPE) {
        const codes = fiche.NOMENCLATURE_EUROPE
        nomenclatureEuropeNiveau = codes.map(c => c.NIVEAU).join(';')
        nomenclatureEuropeIntitule = codes.map(c => c.INTITULE).join(';')
      }
      if (fiche.CODES_ROME) {
        const codes = fiche.CODES_ROME.pop().ROME
        codesRome = codes.map(c => c.CODE).join(';')
        libellesRome = codes.map(c => c.LIBELLE).join(';')
      }
      if (fiche.CODES_NSF) {
        const codes = fiche.CODES_NSF.pop().NSF
        codesNsf = codes.map(c => c.CODE).join(';')
        intituleNsf = codes.map(c => c.INTITULE).join(';')
      }
      if (fiche.CERTIFICATEURS) {
        certificateurs = fiche.CERTIFICATEURS.pop().CERTIFICATEUR.map(c => c.NOM_CERTIFICATEUR).join(';')
      }

      line = {
        ID_FICHE: fiche.ID_FICHE.pop(),
        NUMERO_FICHE: fiche.NUMERO_FICHE.pop(),
        INTITULE: fiche.INTITULE && fiche.INTITULE.pop(),
        ABREGE_CODES: abregeCodes,
        ABREGE_LIBELLES: abregeLibelles,
        ETAT_FICHE: fiche.ETAT_FICHE.pop(),
        NOMENCLATURE_EUROPE_NIVEAU: nomenclatureEuropeNiveau,
        NOMENCLATURE_EUROPE_INTITULE: nomenclatureEuropeIntitule,
        TYPE_EMPLOI_ACCESSIBLES: htmlToText(fiche.TYPE_EMPLOI_ACCESSIBLES.pop()),
        CODES_ROME: codesRome,
        LIBELLES_ROME: libellesRome,
        CODES_NSF: codesNsf,
        INTITULE_NSF: intituleNsf,
        CERTIFICATEURS: certificateurs,
        ACTIVITES_VISEES: fiche.ACTIVITES_VISEES && htmlToText(fiche.ACTIVITES_VISEES.pop()),
        CAPACITES_ATTESTEES: fiche.CAPACITES_ATTESTEES && htmlToText(fiche.CAPACITES_ATTESTEES.pop()).replaceAll('\n', ' '),
        LIEN_URL_DESCRIPTION: fiche.LIEN_URL_DESCRIPTION && htmlToText(fiche.LIEN_URL_DESCRIPTION.pop()),
        REGLEMENTATIONS_ACTIVITES: fiche.REGLEMENTATIONS_ACTIVITES && htmlToText(fiche.REGLEMENTATIONS_ACTIVITES.pop()),
        OBJECTIFS_CONTEXTE: fiche.OBJECTIFS_CONTEXTE && htmlToText(fiche.OBJECTIFS_CONTEXTE.pop()),
        SI_JURY_FI: fiche.SI_JURY_FI && fiche.SI_JURY_FI.pop(),
        JURY_FI: fiche.JURY_FI && htmlToText(fiche.JURY_FI.pop()),
        SI_JURY_CA: fiche.SI_JURY_CA && fiche.SI_JURY_CA.pop(),
        JURY_CA: fiche.JURY_CA && htmlToText(fiche.JURY_CA.pop()),
        SI_JURY_FC: fiche.SI_JURY_FC && fiche.SI_JURY_FC.pop(),
        SI_JURY_CQ: fiche.SI_JURY_CQ && fiche.SI_JURY_CQ.pop(),
        SI_JURY_CL: fiche.SI_JURY_CL && fiche.SI_JURY_CL.pop(),
        JURY_CL: fiche.JURY_CL && htmlToText(fiche.JURY_CL.pop()),
        SI_JURY_VAE: fiche.SI_JURY_VAE && fiche.SI_JURY_VAE.pop(),
        ACTIF: fiche.ACTIF.pop()
      }
    }
    // RS
    if (processingConfig.processFile === 'rs') {
      let formacodes, formalibelles
      let codesNsf, intituleNsf
      let certificateurs
      if (fiche.FORMACODES) {
        const codes = fiche.FORMACODES.pop().FORMACODE
        formacodes = codes.map(c => c.CODE).join(';')
        formalibelles = codes.map(c => c.LIBELLE).join(';')
      }
      if (fiche.CODES_NSF) {
        const codes = fiche.CODES_NSF.pop().NSF
        codesNsf = codes.map(c => c.CODE).join(';')
        intituleNsf = codes.map(c => c.INTITULE).join(';')
      }
      if (fiche.CERTIFICATEURS) {
        certificateurs = fiche.CERTIFICATEURS.pop().CERTIFICATEUR.map(c => c.NOM_CERTIFICATEUR).join(';')
      }
      line = {
        ID_FICHE: fiche.ID_FICHE.pop(),
        NUMERO_FICHE: fiche.NUMERO_FICHE.pop(),
        INTITULE: fiche.INTITULE && fiche.INTITULE.pop(),
        ETAT_FICHE: fiche.ETAT_FICHE.pop(),
        FORMACODES: formacodes,
        FORMALIBELLES: formalibelles,
        CODES_NSF: codesNsf,
        INTITULE_NSF: intituleNsf,
        CERTIFICATEURS: certificateurs,
        CAPACITES_ATTESTEES: fiche.CAPACITES_ATTESTEES && htmlToText(fiche.CAPACITES_ATTESTEES.pop()),
        LIEN_URL_DESCRIPTION: fiche.LIEN_URL_DESCRIPTION && htmlToText(fiche.LIEN_URL_DESCRIPTION.pop()),
        REGLEMENTATIONS_ACTIVITES: fiche.REGLEMENTATIONS_ACTIVITES && htmlToText(fiche.REGLEMENTATIONS_ACTIVITES.pop()),
        DATE_FIN_ENREGISTREMENT: fiche.DATE_FIN_ENREGISTREMENT.pop(),
        TYPE_ENREGISTREMENT: fiche.TYPE_ENREGISTREMENT.pop(),
        OBJECTIFS_CONTEXTE: fiche.OBJECTIFS_CONTEXTE && htmlToText(fiche.OBJECTIFS_CONTEXTE.pop()),
        NIVEAU_MAITRISE_COMPETENCES: fiche.NIVEAU_MAITRISE_COMPETENCES && htmlToText(fiche.NIVEAU_MAITRISE_COMPETENCES.pop()),
        MODALITES_RENOUVELLEMENT: fiche.MODALITES_RENOUVELLEMENT && htmlToText(fiche.MODALITES_RENOUVELLEMENT.pop()),
        VALIDATION_PARTIELLE: fiche.VALIDATION_PARTIELLE && fiche.VALIDATION_PARTIELLE.pop(),
        ACTIF: fiche.ACTIF.pop()
      }
    }
    // write the current line to the outfile
    writeStream.write(csvSync.stringify([line], { quoted_string: true }))
  }

  // wait for the stream to close before doing the upload
  async function waitForStreamClose (stream) {
    stream.close()
    return new Promise((resolve, reject) => {
      stream.once('close', () => {
        resolve()
      })
    })
  }
  await waitForStreamClose(writeStream)
}
