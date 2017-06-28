const util = require('util')

let Errors
const NotFoundError = function(message) {
  const error = new Error(message)
  error.name = 'NotFoundError'
  return error
}
util.inherits(NotFoundError, Error)

module.exports = Errors = { NotFoundError }
