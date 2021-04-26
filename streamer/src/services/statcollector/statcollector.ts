import pc from 'prom-client'

const counter = new pc.Counter({
	name: 'blocks_service',
	labelNames: ['processBlocks', 'getLastProcessedBlock', 'getBlocksStatus'],
	help: 'blocks_service_desc'
})
