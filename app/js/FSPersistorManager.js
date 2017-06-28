const logger = require('logger-sharelatex')
const fs = require('fs')
const LocalFileWriter = require('./LocalFileWriter')
const Errors = require('./Errors')
const rimraf = require('rimraf')
const _ = require('underscore')

const filterName = key => key.replace(/\//g, '_')

module.exports = {
  sendFile (location, target, source, callback = err => {}) {
    const filteredTarget = filterName(target)
    logger.log({ location, target: filteredTarget, source }, 'sending file')
    return fs.rename(source, `${location}/${filteredTarget}`, err => {
      if (err !== null) {
        logger.err({ err, location, target: filteredTarget, source }, 'Error on put of file')
      }
      return callback(err)
    })
  },

  sendStream (location, target, sourceStream, callback = err => {}) {
    logger.log({ location, target }, 'sending file stream')
    sourceStream.on('error', err => logger.err({ location, target, err: err('error on stream to send') }))
    return LocalFileWriter.writeStream(sourceStream, null, (err, fsPath) => {
      if (err != null) {
        logger.err({ location, target, fsPath, err }, 'something went wrong writing stream to disk')
        return callback(err)
      }
      return this.sendFile(location, target, fsPath, callback)
    })
  },

  // opts may be {start: Number, end: Number}
  getFileStream (location, name, opts, _callback = (err, res) => {}) {
    const callback = _.once(_callback)
    const filteredName = filterName(name)
    logger.log({ location, name: filteredName }, 'getting file')
    const sourceStream = fs.createReadStream(`${location}/${filteredName}`, opts)
    sourceStream.on('error', err => {
      logger.err({ err, location, name }, 'Error reading from file')
      if (err.code === 'ENOENT') {
        return callback(new Errors.NotFoundError(err.message), null)
      } else {
        return callback(err, null)
      }
    })
    return sourceStream.on('readable', () =>
      // This can be called multiple times, but the callback wrapper
      // ensures the callback is only called once
      callback(null, sourceStream)
    )
  },

  copyFile (location, fromName, toName, callback = err => {}) {
    const filteredFromName = filterName(fromName)
    const filteredToName = filterName(toName)
    logger.log({ location, fromName: filteredFromName, toName: filteredToName }, 'copying file')
    const sourceStream = fs.createReadStream(`${location}/${filteredFromName}`)
    sourceStream.on('error', err => {
      logger.err({ err, location, key: filteredFromName }, 'Error reading from file')
      return callback(err)
    })
    const targetStream = fs.createWriteStream(`${location}/${filteredToName}`)
    targetStream.on('error', err => {
      logger.err({ err, location, key: filteredToName }, 'Error writing to file')
      return callback(err)
    })
    targetStream.on('finish', () => callback(null))
    return sourceStream.pipe(targetStream)
  },

  deleteFile (location, name, callback) {
    const filteredName = filterName(name)
    logger.log({ location, name: filteredName }, 'delete file')
    return fs.unlink(`${location}/${filteredName}`, err => {
      if (err != null) {
        logger.err({ err, location, name: filteredName }, 'Error on delete.')
        return callback(err)
      } else {
        return callback()
      }
    })
  },

  deleteDirectory (location, name, callback = err => {}) {
    const filteredName = filterName(name.replace(/\/$/, ''))
    return rimraf(`${location}/${filteredName}`, err => {
      if (err != null) {
        logger.err({ err, location, name: filteredName }, 'Error on rimraf rmdir.')
        return callback(err)
      } else {
        return callback()
      }
    })
  },

  checkIfFileExists (location, name, callback = (err, exists) => {}) {
    const filteredName = filterName(name)
    logger.log({ location, name: filteredName }, 'checking if file exists')
    return fs.exists(`${location}/${filteredName}`, exists => {
      logger.log({ location, name: filteredName, exists }, 'checked if file exists')
      return callback(null, exists)
    })
  },

  directorySize (location, name, callback) {
    const filteredName = filterName(name.replace(/\/$/, ''))
    logger.log({ location, name: filteredName }, 'get project size in file system')
    return fs.readdir(`${location}/${filteredName}`, (err, files) => {
      if (err != null) {
        logger.err({ err, location, name: filteredName }, 'something went wrong listing prefix in aws')
        return callback(err)
      }
      let totalSize = 0
      _.each(files, entry => {
        const fd = fs.openSync(`${location}/${filteredName}/${entry}`, 'r')
        const fileStats = fs.fstatSync(fd)
        totalSize += fileStats.size
        return fs.closeSync(fd)
      })
      logger.log({ totalSize }, 'total size', { files })
      return callback(null, totalSize)
    })
  },
}
