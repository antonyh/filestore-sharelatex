const settings = require('settings-sharelatex')
const PersistorManager = require('./PersistorManager')
const LocalFileWriter = require('./LocalFileWriter')
const logger = require('logger-sharelatex')
const FileConverter = require('./FileConverter')
const KeyBuilder = require('./KeyBuilder')
const async = require('async')
const ImageOptimiser = require('./ImageOptimiser')

module.exports = {
  insertFile (bucket, key, stream, callback) {
    const convertedKey = KeyBuilder.getConvertedFolderKey(key)
    return PersistorManager.deleteDirectory(bucket, convertedKey, error => {
      if (error != null) {
        return callback(error)
      }
      return PersistorManager.sendStream(bucket, key, stream, callback)
    })
  },

  deleteFile (bucket, key, callback) {
    const convertedKey = KeyBuilder.getConvertedFolderKey(key)
    return async.parallel([done => PersistorManager.deleteFile(bucket, key, done), done => PersistorManager.deleteDirectory(bucket, convertedKey, done)], callback)
  },

  getFile (bucket, key, opts = {}, callback) {
    logger.log({ bucket, key, opts }, 'getting file')
    if (opts.format == null && opts.style == null) {
      return this._getStandardFile(bucket, key, opts, callback)
    } else {
      return this._getConvertedFile(bucket, key, opts, callback)
    }
  },

  _getStandardFile (bucket, key, opts, callback) {
    return PersistorManager.getFileStream(bucket, key, opts, (err, fileStream) => {
      if (err != null) {
        logger.err({ bucket, key, opts }, 'error getting fileStream')
      }
      return callback(err, fileStream)
    })
  },

  _getConvertedFile (bucket, key, opts, callback) {
    const convertedKey = KeyBuilder.addCachingToKey(key, opts)
    return PersistorManager.checkIfFileExists(bucket, convertedKey, (err, exists) => {
      if (err != null) {
        return callback(err)
      }
      if (exists) {
        return PersistorManager.getFileStream(bucket, convertedKey, opts, callback)
      } else {
        return this._getConvertedFileAndCache(bucket, key, convertedKey, opts, callback)
      }
    })
  },

  _getConvertedFileAndCache (bucket, key, convertedKey, opts, callback) {
    let convertedFsPath = ''
    const originalFsPath = ''
    return async.series(
      [
        cb => {
          return this._convertFile(bucket, key, opts, (err, fileSystemPath, originalFsPath) => {
            convertedFsPath = fileSystemPath
            originalFsPath = originalFsPath
            return cb(err)
          })
        },
        cb => ImageOptimiser.compressPng(convertedFsPath, cb),
        cb => PersistorManager.sendFile(bucket, convertedKey, convertedFsPath, cb),
      ],
      err => {
        if (err != null) {
          LocalFileWriter.deleteFile(convertedFsPath, () => {})
          LocalFileWriter.deleteFile(originalFsPath, () => {})
          return callback(err)
        }
        return PersistorManager.getFileStream(bucket, convertedKey, opts, callback)
      }
    )
  },

  _convertFile (bucket, originalKey, opts, callback) {
    return this._writeS3FileToDisk(bucket, originalKey, opts, (err, originalFsPath) => {
      if (err != null) {
        return callback(err)
      }
      const done = (err, destPath) => {
        if (err != null) {
          logger.err({ err, bucket, originalKey, opts }, 'error converting file')
          return callback(err)
        }
        LocalFileWriter.deleteFile(originalFsPath, () => {})
        return callback(err, destPath, originalFsPath)
      }

      if (opts.format != null) {
        return FileConverter.convert(originalFsPath, opts.format, done)
      } else if (opts.style === 'thumbnail') {
        return FileConverter.thumbnail(originalFsPath, done)
      } else if (opts.style === 'preview') {
        return FileConverter.preview(originalFsPath, done)
      } else {
        return callback(new Error(`should have specified opts to convert file with ${JSON.stringify(opts)}`))
      }
    })
  },

  _writeS3FileToDisk (bucket, key, opts, callback) {
    return PersistorManager.getFileStream(bucket, key, opts, (err, fileStream) => {
      if (err != null) {
        return callback(err)
      }
      return LocalFileWriter.writeStream(fileStream, key, callback)
    })
  },

  getDirectorySize (bucket, project_id, callback) {
    logger.log({ bucket, project_id }, 'getting project size')
    return PersistorManager.directorySize(bucket, project_id, (err, size) => {
      if (err != null) {
        logger.err({ bucket, project_id }, 'error getting size')
      }
      return callback(err, size)
    })
  },
}
