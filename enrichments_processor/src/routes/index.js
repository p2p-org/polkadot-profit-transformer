const apiRoutes = async (app, options) => {
  app.get('/', async (request, reply) => {
    return { api: 'v1.0' }
  })
}

module.exports = apiRoutes
