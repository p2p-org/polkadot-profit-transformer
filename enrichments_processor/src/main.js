const { build } = require('./app')

const {
  environment: { API_ADDR, API_PORT }
} = require('./environment')

build().then((app) => {
  // run the server!
  app.listen(API_PORT, API_ADDR, (err) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }

    process.on('SIGINT', () => {
      app.close()
      process.exit(1)
    })
    process.on('SIGTERM', () => app.close())
  })
})
