const Fastify = require('fastify');
const {RunnerService} = require('./services/runner');

const argv = require('yargs')
    .option('sync', {
        type: 'boolean',
        default: false,
        description: 'Run synchronization blocks, fetched with db'
    })
    .option('sync-force', {
        type: 'boolean',
        default: false,
        description: 'Run synchronization all blocks'
    })
    .option('sub-fin-head', {
        type: 'boolean',
        default: false,
        description: 'Subscribe to capture finalized heads'
    })
    .option('disable-rpc', {
        alias: 'disable-rpc',
        type: 'boolean',
        default: false,
        description: 'Disable api'
    })
    .help()
    .argv;

const build = async () => {
    const fastify = Fastify({
        bodyLimit: 1048576 * 2,
        logger: {prettyPrint: true}
    });

    // plugins
    await require('./plugins/postgres-connector')(fastify);

    await require('./plugins/kafka-connector')(fastify);

    await require('./plugins/polkadot-connector')(fastify);

    if (!argv['disable-rpc']) {
        await fastify.register(require('./routes'), {prefix: 'api'});
    }

    // hooks
    fastify.addHook('onClose', (instance, done) => {

        //  stop sync, disconnect
        const {postgresConnector} = instance;
        postgresConnector.end()

        const {polkadotConnector} = instance
        polkadotConnector.disconnect()
    });

    fastify.ready(err => {
        const runner = new RunnerService(fastify)
        runner.sync({
            optionSync: argv['sync-force'] ? false : argv.sync,
            optionSyncForce: argv['sync-force'],
            optionSubscribeFinHead: argv['sub-fin-head']
        }, argv['sub-fin-head'])
    })

    return fastify;
};

module.exports = {
    build
};
