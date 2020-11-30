const { IdentityProcessorService } = require('./identity_processor')

/**
 * Provides cli operations
 * @class
 */
class RunnerService {
  constructor(app) {
    /** @private */
    this.app = app

    const { kafkaConsumer } = this.app

    if (!kafkaConsumer) {
      throw new Error('cant get .kafkaConsumer from fastify app.')
    }

    /** @private */
    this.identityProcessorService = new IdentityProcessorService(app)

  }

  async start() {
    const { kafkaConsumer } = this.app

    await kafkaConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const entry = JSON.parse(message.value)
          switch (topic) {
            case 'ENRICHMENT_ACCOUNT_CHANGES':
              await this.identityProcessorService.process(entry)
              break
            default:
              this.app.log.error(`failed to process topic message "${topic}"`)
          }
        } catch (err) {
          this.app.log.error(`cannot process topic message "${err}"`)
        }
      },
    })
  }
}

module.exports = {
  RunnerService: RunnerService
}
