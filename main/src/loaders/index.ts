import express from 'express'
import { Container } from 'typedi'

import { environment } from '@/environment'

import { KnexPG } from '@/loaders/database'
import { RabbitMQ } from '@/loaders/rabbitmq'
import { logger } from '@/loaders/logger'
import { PolkadotApi } from '@/loaders/polkadotapi'
import { ExpressLoader } from '@/loaders/express'
import { ModulesLoader } from '@/modules'
import { SliMetrics } from '@/loaders/sli_metrics'

export default async (): Promise<void> => {
  //console.log({ environment })

  logger.info('✌️ Main app started')

  Container.set('logger', logger)
  logger.info('✌️ Logger loaded')

  const knex = await KnexPG(environment)
  Container.set('knex', knex)
  logger.info('✌️ Database loaded')

  const rabbitMQ = await RabbitMQ(environment.RABBITMQ!)
  Container.set('rabbitMQ', rabbitMQ)
  logger.info('✌️ RabbitMQ loaded')

  const sliMetrics = new SliMetrics(knex, logger)
  Container.set('sliMetrics', sliMetrics)
  logger.info('✌️ SliMetrics loaded')

  const polkadotApi = await PolkadotApi(environment.SUBSTRATE_URI)()
  Container.set('polkadotApi', polkadotApi)
  logger.info('✌️ PolkadotAPI loaded')

  const expressApp = await ExpressLoader()
  Container.set('expressApp', expressApp)
  logger.info('✌️ Express loaded')

  ModulesLoader()
  logger.info('✌️ Modules loaded')
}
