import prom from 'prom-client'

const collectDefaultMetrics = prom.collectDefaultMetrics
collectDefaultMetrics({ prefix: 'forethought' })

export const counter = new prom.Counter({
  name: 'blocks_service',
  labelNames: ['processBlocks', 'getLastProcessedBlock', 'getBlocksStatus'],
  help: 'blocks_service_desc',
})

export const processedBlockGauge = new prom.Gauge({ name: 'processing_block_id', help: 'processing_block_id_help' })
