const fs = require('fs-extra')
const path = require('path')
const util = require('util')
const pump = util.promisify(require('pump'))
const exec = util.promisify(require('child_process').exec)

const withStreamableFile = async (filePath, fn) => {
  // creating empty file before streaming seems to fix some weird bugs with NFS
  await fs.ensureFile(filePath + '.tmp')
  await fn(fs.createWriteStream(filePath + '.tmp'))
  // Try to prevent weird bug with NFS by forcing syncing file before reading it
  const fd = await fs.open(filePath + '.tmp', 'r')
  await fs.fsync(fd)
  await fs.close(fd)
  // write in tmp file then move it for a safer operation that doesn't create partial files
  await fs.move(filePath + '.tmp', filePath, { overwrite: true })
}

module.exports = async (processingConfig, dir = 'data', axios, log) => {
  const datasetId = '5eebbc067a14b6fecc9c9976' // the id of the dataset in data.gouv
  const res = await axios.get('https://www.data.gouv.fr/api/1/datasets/' + datasetId + '/')

  const processFile = processingConfig.processFile.toUpperCase()
  const ressources = res.data.resources
  await log.step('Téléchargement')
  for (const file of ressources) {
    if (file.type === 'update' && file.title.toUpperCase().includes(processFile) && file.title.toUpperCase().includes('V2-0')) {
      const url = new URL(file.url)
      const filePath = `${dir}/${path.parse(url.pathname).base}`

      await log.info(`téléchargement du fichier ${file.title}, écriture dans ${filePath}`)
      try {
        await withStreamableFile(filePath, async (writeStream) => {
          const res = await axios({ url: url.href, method: 'GET', responseType: 'stream' })
          await pump(res.data, writeStream)
        })
      } catch (err) {
        if (err.status === 404) {
          await fs.remove(filePath)
          return
        }
        throw err
      }

      if (filePath.endsWith('.zip')) {
        await log.info(`extraction de l'archive ${filePath}`, '')
        const { stderr } = await exec(`unzip -o ${filePath} -d ${dir}`)
        if (stderr) throw new Error(`échec à l'extraction de l'archive ${filePath} : ${stderr}`)
        await fs.remove(filePath)
      }
      // only download the latest one
      break
    }
  }
}
