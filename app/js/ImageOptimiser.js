const { exec } = require('child_process')
const logger = require('logger-sharelatex')

module.exports = {
  compressPng (localPath, callback) {
    const startTime = new Date()
    logger.log({ localPath }, 'optimising png path')
    const args = `optipng ${localPath}`
    const opts = {
      timeout   : 30 * 1000,
      killSignal: 'SIGKILL',
    }
    return exec(args, opts, (err, stdout, stderr) => {
      if (err != null) {
        logger.err({ err, stderr, localPath }, 'something went wrong converting compressPng')
      } else {
        logger.log({ localPath }, 'finished compressPng file')
      }
      return callback(err)
    })
  },
}
