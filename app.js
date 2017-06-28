const express = require('express')
let logger = require('logger-sharelatex')
logger.initialize('filestore')
const settings = require('settings-sharelatex')
const request = require('request')
const fileController = require('./app/js/FileController')
const keyBuilder = require('./app/js/KeyBuilder')
const healthCheckController = require('./app/js/HealthCheckController')
const domain = require('domain')
let appIsOk = true
const app = express()

const Metrics = require('metrics-sharelatex')
Metrics.initialize('filestore')
Metrics.open_sockets.monitor(logger)
if (Metrics.event_loop != null) {
  Metrics.event_loop.monitor(logger)
}
Metrics.memory.monitor(logger)

app.configure(() => app.use(Metrics.http.monitor(logger)))

app.configure('development', () => {
  console.log('Development Enviroment')
  return app.use(express.errorHandler({ dumpExceptions: true, showStack: true }))
})

app.configure('production', () => {
  console.log('Production Enviroment')
  return app.use(express.errorHandler())
})

Metrics.inc('startup')

app.use((req, res, next) => {
  Metrics.inc('http-request')
  return next()
})

app.use((req, res, next) => {
  const requestDomain = domain.create()
  requestDomain.add(req)
  requestDomain.add(res)
  requestDomain.on('error', function (err) {
    try {
      // request a shutdown to prevent memory leaks
      beginShutdown()
      if (!res.headerSent) {
        res.send(500, 'uncaught exception')
      }
      logger = require('logger-sharelatex')
      req = {
        body      : req.body,
        headers   : req.headers,
        url       : req.url,
        key       : req.key,
        statusCode: req.statusCode,
      }
      err = {
        message  : err.message,
        stack    : err.stack,
        name     : err.name,
        type     : err.type,
        arguments: err.arguments,
      }
      return logger.err({ err, req, res }, 'uncaught exception thrown on request')
    } catch (exception) {
      return logger.err({ err: exception }, 'exception in request domain handler')
    }
  })
  return requestDomain.run(next)
})

app.use((req, res, next) => {
  if (!appIsOk) {
    // when shutting down, close any HTTP keep-alive connections
    res.set('Connection', 'close')
  }
  return next()
})

app.get('/project/:project_id/file/:file_id', keyBuilder.userFileKey, fileController.getFile)
app.post('/project/:project_id/file/:file_id', keyBuilder.userFileKey, fileController.insertFile)

app.put('/project/:project_id/file/:file_id', keyBuilder.userFileKey, express.bodyParser(), fileController.copyFile)
app.del('/project/:project_id/file/:file_id', keyBuilder.userFileKey, fileController.deleteFile)

app.get('/template/:template_id/v/:version/:format', keyBuilder.templateFileKey, fileController.getFile)
app.get('/template/:template_id/v/:version/:format/:sub_type', keyBuilder.templateFileKey, fileController.getFile)
app.post('/template/:template_id/v/:version/:format', keyBuilder.templateFileKey, fileController.insertFile)

app.get('/project/:project_id/public/:public_file_id', keyBuilder.publicFileKey, fileController.getFile)
app.post('/project/:project_id/public/:public_file_id', keyBuilder.publicFileKey, fileController.insertFile)

app.put('/project/:project_id/public/:public_file_id', keyBuilder.publicFileKey, express.bodyParser(), fileController.copyFile)
app.del('/project/:project_id/public/:public_file_id', keyBuilder.publicFileKey, fileController.deleteFile)

app.get('/project/:project_id/size', keyBuilder.publicProjectKey, fileController.directorySize)

app.get('/heapdump', (req, res) => require('heapdump').writeSnapshot(`/tmp/${Date.now()}.filestore.heapsnapshot`, (err, filename) => res.send(filename)))

app.post('/shutdown', (req, res) => {
  appIsOk = false
  return res.send()
})

app.get('/status', (req, res) => {
  if (appIsOk) {
    return res.send('filestore sharelatex up')
  } else {
    logger.log('app is not ok - shutting down')
    return res.send('server is being shut down', 500)
  }
})

app.get('/health_check', healthCheckController.check)

app.get('*', (req, res) => res.send(404))

const server = require('http').createServer(app)
const port = settings.internal.filestore.port || 3009
const host = settings.internal.filestore.host || 'localhost'

var beginShutdown = () => {
  if (appIsOk) {
    appIsOk = false
    // hard-terminate this process if graceful shutdown fails
    const killTimer = setTimeout(() => process.exit(1), 120 * 1000)
    if (typeof killTimer.unref === 'function') {
      killTimer.unref()
    } // prevent timer from keeping process alive
    server.close(() => {
      logger.log('closed all connections')
      Metrics.close()
      return typeof process.disconnect === 'function' ? process.disconnect() : undefined
    })
    return logger.log('server will stop accepting connections')
  }
}

server.listen(port, host, () => logger.info(`Filestore starting up, listening on ${host}:${port}`))

process.on('SIGTERM', () => {
  logger.log('filestore got SIGTERM, shutting down gracefully')
  return beginShutdown()
})

if (global.gc != null) {
  let oneMinute
  const gcTimer = setInterval(() => {
    global.gc()
    return logger.log(process.memoryUsage(), 'global.gc')
  }, 3 * (oneMinute = 60 * 1000))
  gcTimer.unref()
}
