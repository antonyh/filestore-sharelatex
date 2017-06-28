const fs = require('fs')
const uuid = require('node-uuid')
const path = require('path')
const _ = require('underscore')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const Settings = require('settings-sharelatex')

module.exports = {
  writeStream (stream, key, callback) {
    const timer = new metrics.Timer('writingFile')
    callback = _.once(callback)
    const fsPath = this._getPath(key)
    logger.log({ fsPath }, 'writing file locally')
    const writeStream = fs.createWriteStream(fsPath)
    writeStream.on('finish', () => {
      timer.done()
      logger.log({ fsPath }, 'finished writing file locally')
      return callback(null, fsPath)
    })
    writeStream.on('error', err => {
      logger.err({ err, fsPath }, 'problem writing file locally, with write stream')
      return callback(err)
    })
    stream.on('error', err => {
      logger.log({ err, fsPath }, 'problem writing file locally, with read stream')
      return callback(err)
    })
    return stream.pipe(writeStream)
  },

  deleteFile (fsPath, callback) {
    if (fsPath == null || fsPath === '') {
      return callback()
    }
    logger.log({ fsPath }, 'removing local temp file')
    return fs.unlink(fsPath, callback)
  },

  _getPath (key) {
    if (key == null) {
      key = uuid.v1()
    }
    key = key.replace(/\//g, '-')
    console.log(Settings.path.uploadFolder, key)
    return path.join(Settings.path.uploadFolder, key)
  },
}
