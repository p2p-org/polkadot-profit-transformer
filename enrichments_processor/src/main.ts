import { build, runner } from './app'
import { environment } from './environment'

const { API_ADDR, API_PORT } = environment

;(async () => {
  const app = await build()

  try {
    await app.listen(API_PORT, API_ADDR)
    await runner()
    process.on('SIGINT', () => {
      app.close()
      process.exit(1)
    })
    process.on('SIGTERM', () => {
      app.close()
      process.exit(1)
    })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
})()
