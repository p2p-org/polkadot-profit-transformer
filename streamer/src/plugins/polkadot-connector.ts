import { ApiPromise, WsProvider } from '@polkadot/api'
import fastifyPlugin from 'fastify-plugin'
import { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    polkadotConnector: ApiPromise;
  }
}

const {
  environment: { SUBSTRATE_URI }
} = require('../environment')

const polkadotConnector = async (server: FastifyInstance) => {
  server.log.info(`Init "polkadotConnector"`)

  const wsProvider = new WsProvider(SUBSTRATE_URI)
  const api = await ApiPromise.create({ provider: wsProvider })
  server.decorate('polkadotConnector', api)
}

export const registerPolkadotPlugin = fastifyPlugin(polkadotConnector);

