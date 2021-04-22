const {
  environment: { API_PORT }
} = require('../../environment');

module.exports = {
  routePrefix: '/swagger',
  exposeRoute: true,
  swagger: {
    info: {
      title: 'Polkadot streamer',
      description: 'Swagger api description',
      version: '0.1.0'
    },
    externalDocs: {
      url: 'https://wiki.polkadot.network/docs/en/build-build-with-polkadot',
      description: 'Polkadot additional documentation'
    },
    servers: [
      { url: `http://localhost:${API_PORT}`, description: 'development' },
      { url: 'https://localhost', description: 'production' }
    ],
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [{ name: 'block', description: 'Chain block' }]
  }
};
