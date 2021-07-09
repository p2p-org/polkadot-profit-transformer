import pc from 'prom-client'

export const counter = new pc.Counter({
  name: 'blocks_service',
  labelNames: ['processBlocks', 'getLastProcessedBlock', 'getBlocksStatus'],
  help: 'blocks_service_desc'
})
