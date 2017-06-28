const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

// assume s3 if none specified
if (!settings.filestore.backend) {
  settings.filestore.backend = 's3'
}

logger.log({ backend: settings.filestore.backend }, 'Loading backend')
module.exports = (() => {
  switch (settings.filestore.backend) {
    case 'aws-sdk':
      return require('./AWSSDKPersistorManager')
    case 's3':
      return require('./S3PersistorManager')
    case 'fs':
      return require('./FSPersistorManager')
    default:
      throw new Error(`Unknown filestore backend: ${settings.filestore.backend}`)
  }
})()
