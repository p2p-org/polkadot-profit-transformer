import 'reflect-metadata';
import { build } from './app';

import {
  environment
} from './environment';

const { API_ADDR, API_PORT } = environment;

(async () => {
  const app = await build();
  try {
    await app.listen(API_PORT, API_ADDR);
    process.on('SIGINT', () => app.close())
    process.on('SIGTERM', () => app.close())

  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
})();
