import { Service, Inject } from 'typedi'
import express from 'express'
import { Logger } from 'pino'

import { ENTITY } from '@/models/processing_task.model'
import { BlockListenerService } from './service'

@Service()
export class BlockListenerController {
  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('expressApp') private readonly expressApp: express.Application,
    private listnerService: BlockListenerService
  ) {
    this.init()
  }

  init(): void {
    this.expressApp.get('/pause', (req, res) => {
      this.listnerService.pause()
      res.send('paused')
    })

    this.expressApp.get('/resume', (req, res) => {
      this.listnerService.resume()
      res.send('paused')
    })

    this.expressApp.get('/preload', (req, res) => {
      this.listnerService.preload()
      res.send('preloaded')
    })

    this.expressApp.get('/restart-unprocessed-blocks', (req, res) => {
      this.listnerService.restartUnprocessedTasks(ENTITY.BLOCK)
      res.send('restarted unprocessed')
    })
    this.expressApp.get('/process-block/:blockId', async (req, res) => {
      if (isNaN(Number(req.params.blockId))) return res.json({ error: 'blockId must be a number' })
      await this.listnerService.preloadOneBlock(Number(req.params.blockId))
      return res.json({ result: 'ok' })
    })


    this.expressApp.get('/restart-unprocessed-eras', (req, res) => {
      this.listnerService.restartUnprocessedTasks(ENTITY.ERA)
      res.send('restarted unprocessed eras')
    })

    this.expressApp.get('/restart-unprocessed-rounds', (req, res) => {
      this.listnerService.restartUnprocessedTasks(ENTITY.ROUND)
      res.send('restarted unprocessed rounds')
    })

    this.expressApp.get('/restart-unprocessed-blocks-metadata/:startBlockId/:endBlockId', (req, res) => {
      this.listnerService.restartUnprocessedBlocksMetadata(parseInt(req.params.startBlockId), parseInt(req.params.endBlockId))
      res.send('restarted unprocessed blocks metadata')
    })

    this.expressApp.get('/restart-unprocessed-blocks-metadata-tasks', (req, res) => {
      this.listnerService.restartUnprocessedTasks(ENTITY.BLOCK_METADATA)
      res.send('restarted unprocessed block metadata tasks')
    })

    this.expressApp.get('/restart-era/:eraId', (req, res) => {
      this.listnerService.restartUnprocessedTask(ENTITY.ROUND, Number(req.params.eraId))
      res.send('restarted unprocessed era')
    })

    this.expressApp.get('/restart-round/:roundId', (req, res) => {
      this.listnerService.restartUnprocessedTask(ENTITY.ROUND, Number(req.params.roundId))
      res.send('restarted unprocessed round')
    })


    this.expressApp.get('/restart-balances', (req, res) => {
      this.listnerService.restartUnprocessedTasks(ENTITY.BLOCK_BALANCE)
      res.send('restarted unprocessed balances')
    })

    this.expressApp.get('/restart-balances/:startBlockId/:endBlockId', (req, res) => {
      res.send('restarted unprocessed blocks balances')
      this.listnerService.restartUnprocessedBalances(parseInt(req.params.startBlockId), parseInt(req.params.endBlockId))
    })

    this.expressApp.get('/restart-balances/:blockId', (req, res) => {
      this.listnerService.restartUnprocessedTask(ENTITY.BLOCK_BALANCE, Number(req.params.blockId))
      res.send('restarted balance with specified id')
    })
  }
}
