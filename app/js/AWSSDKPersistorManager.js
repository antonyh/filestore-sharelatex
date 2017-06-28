const logger = require('logger-sharelatex')
const aws = require('aws-sdk')
const _ = require('underscore')
const fs = require('fs')
const Errors = require('./Errors')

const s3 = new aws.S3()

module.exports = {
  sendFile (bucketName, key, fsPath, callback) {
    logger.log({ bucketName, key }, 'send file data to s3')
    const stream = fs.createReadStream(fsPath)
    return s3.upload({ Bucket: bucketName, Key: key, Body: stream }, (err, data) => {
      if (err != null) {
        logger.err({ err, Bucket: bucketName, Key: key }, 'error sending file data to s3')
      }
      return callback(err)
    })
  },

  sendStream (bucketName, key, stream, callback) {
    logger.log({ bucketName, key }, 'send file stream to s3')
    return s3.upload({ Bucket: bucketName, Key: key, Body: stream }, (err, data) => {
      if (err != null) {
        logger.err({ err, Bucket: bucketName, Key: key }, 'error sending file stream to s3')
      }
      return callback(err)
    })
  },

  getFileStream (bucketName, key, { start, end }, callback = (err, res) => {}) {
    logger.log({ bucketName, key }, 'get file stream from s3')
    callback = _.once(callback)
    const params = {
      Bucket: bucketName,
      Key   : key,
    }
    if (start != null && end != null) {
      params['Range'] = `bytes=${start}-${end}`
    }
    const request = s3.getObject(params)
    const stream = request.createReadStream()
    stream.on('readable', () => callback(null, stream))
    return stream.on('error', err => {
      logger.err({ err, bucketName, key }, 'error getting file stream from s3')
      if (err.code === 'NoSuchKey') {
        return callback(new Errors.NotFoundError(`File not found in S3: ${bucketName}:${key}`))
      }
      return callback(err)
    })
  },

  copyFile (bucketName, sourceKey, destKey, callback) {
    logger.log({ bucketName, sourceKey, destKey }, 'copying file in s3')
    const source = `${bucketName}/${sourceKey}`
    return s3.copyObject({ Bucket: bucketName, Key: destKey, CopySource: source }, err => {
      if (err != null) {
        logger.err({ err, bucketName, sourceKey, destKey }, 'something went wrong copying file in s3')
      }
      return callback(err)
    })
  },

  deleteFile (bucketName, key, callback) {
    logger.log({ bucketName, key }, 'delete file in s3')
    return s3.deleteObject({ Bucket: bucketName, Key: key }, err => {
      if (err != null) {
        logger.err({ err, bucketName, key }, 'something went wrong deleting file in s3')
      }
      return callback(err)
    })
  },

  deleteDirectory (bucketName, key, callback) {
    logger.log({ bucketName, key }, 'delete directory in s3')
    return s3.listObjects({ Bucket: bucketName, Prefix: key }, (err, { Contents }) => {
      if (err != null) {
        logger.err({ err, bucketName, key }, 'something went wrong listing prefix in s3')
        return callback(err)
      }
      if (Contents.length === 0) {
        logger.log({ bucketName, key }, 'the directory is empty')
        return callback()
      }
      const keys = _.map(Contents, ({ Key }) => ({
        Key: Key,
      }))
      return s3.deleteObjects(
        {
          Bucket: bucketName,
          Delete: {
            Objects: keys,
            Quiet  : true,
          },
        },
        err => {
          if (err != null) {
            logger.err({ err, bucketName, key: keys }, 'something went wrong deleting directory in s3')
          }
          return callback(err)
        }
      )
    })
  },

  checkIfFileExists (bucketName, key, callback) {
    logger.log({ bucketName, key }, 'check file existence in s3')
    return s3.headObject({ Bucket: bucketName, Key: key }, (err, { ETag }) => {
      if (err != null) {
        if (err.code === 'NotFound') {
          return callback(null, false)
        }
        logger.err({ err, bucketName, key }, 'something went wrong checking head in s3')
        return callback(err)
      }
      return callback(null, ETag != null)
    })
  },

  directorySize (bucketName, key, callback) {
    logger.log({ bucketName, key }, 'get project size in s3')
    return s3.listObjects({ Bucket: bucketName, Prefix: key }, (err, { Contents }) => {
      if (err != null) {
        logger.err({ err, bucketName, key }, 'something went wrong listing prefix in s3')
        return callback(err)
      }
      if (Contents.length === 0) {
        logger.log({ bucketName, key }, 'the directory is empty')
        return callback()
      }
      let totalSize = 0
      _.each(Contents, ({ Size }) => (totalSize += Size))
      return callback(null, totalSize)
    })
  },
}
