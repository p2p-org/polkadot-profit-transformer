import 'reflect-metadata'
import { build, runner } from './app'

import { environment } from './environment'
const { API_PORT, API_ADDR } = environment

;(async () => {
  const app = await build()

  process.on('SIGINT', () => {
    app.close()
    process.exit(1)
  })
  process.on('SIGTERM', () => {
    app.close()
    process.exit(1)
  })

  try {
    await app.listen(API_PORT, API_ADDR)
    await runner()
  } catch (err) {
    app.log.error(`Global app error: ${err}`)
    process.exit(1)
  }
})()
