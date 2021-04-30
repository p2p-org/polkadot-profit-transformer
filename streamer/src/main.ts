import 'reflect-metadata'
import { build } from './app'

import { environment } from './environment'
const { API_PORT, API_ADDR } = environment

;(async () => {
  const app = await build()
  try {
    await app.listen(API_PORT, API_ADDR)
    process.on('SIGINT', () => {
      app.close()
      process.exit(1)
    })
    process.on('SIGTERM', () => {
      app.close()
      process.exit(1)
    })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
})()
 
