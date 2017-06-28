const _ = require('underscore')
const logger = require('logger-sharelatex')
const child_process = require('child_process')

// execute a command in the same way as 'exec' but with a timeout that
// kills all child processes
//
// we spawn the command with 'detached:true' to make a new process
// group, then we can kill everything in that process group.

module.exports = (command, { timeout, killSignal }, callback = (err, stdout, stderr) => {}) => {
  // options are {timeout:  number-of-milliseconds, killSignal: signal-name}
  const [cmd, ...args] = Array.from(command)

  const child = child_process.spawn(cmd, args, { detached: true })
  let stdout = ''
  let stderr = ''

  const cleanup = _.once(err => {
    if (killTimer != null) {
      clearTimeout(killTimer)
    }
    return callback(err, stdout, stderr)
  })

  if (timeout != null) {
    var killTimer = setTimeout(() => {
      try {
        // use negative process id to kill process group
        return process.kill(-child.pid, killSignal || 'SIGTERM')
      } catch (error) {
        return logger.log({ process: child.pid, kill_error: error }, 'error killing process')
      }
    }, timeout)
  }

  child.on('close', (code, signal) => {
    const err = code ? new Error(`exit status ${code}`) : signal
    return cleanup(err)
  })

  child.on('error', err => cleanup(err))

  child.stdout.on('data', chunk => (stdout += chunk))

  return child.stderr.on('data', chunk => (stderr += chunk))
}
