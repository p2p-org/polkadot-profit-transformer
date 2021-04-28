import { FastifyInstance } from 'fastify'
import { collectDefaultMetrics, register } from 'prom-client'

collectDefaultMetrics({
	gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
})

export default async (app: FastifyInstance): Promise<void> => {
	app.get('/metrics', async () => {
		return register.metrics()
	})
}
