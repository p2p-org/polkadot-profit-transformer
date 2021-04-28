import { ApiPromise } from '@polkadot/api'
import fastifyPlugin from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { PolkadotModule } from '../modules/polkadot.module'

declare module 'fastify' {
  interface FastifyInstance {
    polkadotConnector: ApiPromise;
  }
}

const polkadotConnector = async (server: FastifyInstance) => {
  server.log.info(`Init "polkadotConnector"`)
  server.decorate('polkadotConnector', PolkadotModule.inject())
}

export const registerPolkadotPlugin = fastifyPlugin(polkadotConnector)

