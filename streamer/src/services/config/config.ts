import { environment } from '../../environment';
import { IConfigService } from './config.types';
import { FastifyInstance } from 'fastify';

const { DB_SCHEMA } = environment;
/**
 * Provides config operations
 * @class
 */
class ConfigService implements IConfigService {
  private readonly app: FastifyInstance;
  /**
   * Creates an instance of ConfigsService.
   * @param {object} app fastify app
   */
  constructor(app: FastifyInstance) {
    if (!app.ready) throw new Error(`can't get .ready from fastify app.`);

    /** @private */
    this.app = app;

    const { polkadotConnector } = this.app;

    if (!polkadotConnector) {
      throw new Error('cant get .polkadotConnector from fastify app.');
    }

    const { postgresConnector } = this.app;

    if (!postgresConnector) {
      throw new Error('cant get .postgresConnector from fastify app.');
    }
  }

  async bootstrapConfig(): Promise<true | undefined> {
    const { polkadotConnector } = this.app;

    const [currentChainRaw, currentChainTypeRaw] = await Promise.all([
      await polkadotConnector.rpc.system.chain(), // Polkadot
      await polkadotConnector.rpc.system.chainType() // Live
    ]);

    const currentChain = currentChainRaw.toString().trim();
    const currentChainType = currentChainTypeRaw.toString().trim();

    if (!currentChain.length) {
      throw new Error('Node returns empty "system.chain" value');
    }

    if (!currentChainType.length) {
      throw new Error('Node returns empty "system.chainType" value');
    }

    const [dbChain, dbChainType] = await Promise.all([
      await this.getConfigValueFromDB('chain'),
      await this.getConfigValueFromDB('chain_type')
    ]);

    if (!dbChain.length && !dbChainType.length) {
      this.app.log.info(`Init new chain config: chain="${currentChain}", chain_type="${currentChainType}"`);
      await Promise.all([
        await this.setConfigValueToDB('chain', currentChain),
        await this.setConfigValueToDB('chain_type', currentChainType)
      ]);
      return true;
    }

    if (dbChain !== currentChain) {
      throw new Error(`Node "system.chain" not compare to saved type: "${currentChain}" and "${dbChain}"`);
    }

    if (dbChainType !== currentChainType) {
      throw new Error(`Node "system.chainType" not compare to saved type: "${currentChainType}" and "${dbChainType}"`);
    }
  }

  private async setConfigValueToDB(key: string, value: string) {
    const { postgresConnector } = this.app;

    if (!key.length) {
      throw new Error('"key" is empty');
    }

    if (!value.length) {
      throw new Error('"value" is empty');
    }

    try {
      await postgresConnector
          .query({
            text: `INSERT INTO  ${DB_SCHEMA}._config VALUES ($1, $2)`,
            values: [key, value]
          });
    } catch (err) {
      this.app.log.error(`failed to set config key "${err}"`);
      throw new Error('cannot set config value');
    }

    return true;
  }

  private async getConfigValueFromDB(key: string) {
    const { postgresConnector } = this.app;
    let value = '';

    if (!key.length) {
      throw new Error('"key" is empty');
    }

    try {
      const { rows } = await postgresConnector.query({
        text: `SELECT "value" FROM ${DB_SCHEMA}._config WHERE "key" = $1 LIMIT 1`,
        values: [key]
      });

      if (rows.length) {
        value = rows[0].value;
      }
    } catch (err) {
      this.app.log.error(`failed to get config key "${err}"`);
      throw new Error('cannot get config value');
    }

    return value;
  }
}

/**
 *
 * @type {{ConfigService: ConfigService}}
 */
export {
  ConfigService
};
