import { Service, Inject } from 'typedi'
import express from 'express'

import { BlockMetadataProcessorService } from './service'

@Service()
export class BlockMetadataProcessorConroller {
  constructor(
    @Inject('expressApp') private readonly expressApp: express.Application,
    private blockMetadataService: BlockMetadataProcessorService
  ) {
    this.init()
  }

  init(): void {
    this.expressApp.get('/restart-unprocessed-blocks-metadata/:startBlockId/:endBlockId', (req, res) => {
      this.blockMetadataService.restartUnprocessedBlocks(req.params.startBlockId, req.params.endBlockId)
      res.send('restarted unprocessed blocks metadata')
    })
  }
}
