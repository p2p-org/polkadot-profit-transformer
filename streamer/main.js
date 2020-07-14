// Import
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Kafka } = require('kafkajs');
const config = require('./config.json');
const util = require('util');
const { Client } = require('pg');


const kafka = new Kafka({
    clientId: 'polkadot-streamer',
    brokers: [config.kafka_uri]
})

async function main() {
    // Construct
    const wsProvider = new WsProvider(config.substrate_uri);
    const api = await ApiPromise.create({ provider: wsProvider });
    const producer = kafka.producer()
    await producer.connect()

    //TODO: configurable
    const client = new Client({
        user: config.db.user,
        host: config.db.host,
        database: config.db.database,
        password: config.db.password,
        port: config.db.port,
    });

    client.connect();

    let currentSpecVersion = api.createType('u32', -1);

    async function updateMetaData(blockHash){
        const runtimeVersion = await api.rpc.state.getRuntimeVersion(blockHash);
        const newSpecVersion = runtimeVersion.specVersion;
      
        if (newSpecVersion.gt(currentSpecVersion)) {
          console.log(`bumped spec version to ${newSpecVersion}, fetching new metadata`);
          const rpcMeta = await api.rpc.state.getMetadata(blockHash);
          currentSpecVersion = newSpecVersion;
          api.registry.setMetadata(rpcMeta);
        }
      }

    async function process_block(height, blockHash = null) {
        if (!blockHash) {
            blockHash = await api.rpc.chain.getBlockHash(height);
        }

        await updateMetaData(blockHash);

        block_events = [];

        const events = await api.query.system.events.at(blockHash);
        events.forEach((record) => {
            const { event, phase } = record;
            const types = event.typeDef;

            block_event = {
                "section": event.section,
                "method": event.method,
                "phase": phase.toJSON(),
                "meta": event.meta.toJSON(),
            }

            event_data = new Map();
            event.data.forEach((data, index) => {
                event_data[types[index].type] = data.toString();
            });

            block_event["data"] = event_data;
            block_events.push(block_event);
        });

        const signedBlock = await api.rpc.chain.getBlock(blockHash);
        extrinsics = []
        signedBlock.block.extrinsics.forEach((ex, index) => {
            extrinsics.push(ex.toString());
        });
        block_data = {
            'block': {
                'header': {
                    'number': signedBlock.block.header.number.toNumber(),
                    'hash': signedBlock.block.header.hash.toHex(),
                    'stateRoot': signedBlock.block.header.stateRoot.toHex(),
                    'extrinsicsRoot': signedBlock.block.header.extrinsicsRoot.toHex(),
                    'parentHash': signedBlock.block.header.parentHash.toHex(),
                    'digest': signedBlock.block.header.digest.toString()
                }
            },
            'extrinsics': [...extrinsics],
            'events': block_events
        }
        console.log(block_data.block.header.number, block_data.block.header.hash);

        await producer.send({
            topic: 'block_data',
            messages: [
                {
                    'value': JSON.stringify(block_data)
                },
            ],
        });
    }

    var blockNumberFromDB = 0;

    await client
        .query('SELECT max("NUMBER") as last_number FROM block')
        .then(res => {
            blockNumberFromDB = res.rows[0].last_number;
        })
        .catch(err => {
            console.error(err);
        })
        .finally(() => {
            client.end();
        });

    var lastHdr = await api.rpc.chain.getHeader()
    var lastBlockNumber = lastHdr.number.toNumber()

    for (var i = blockNumberFromDB+1; i <= lastHdr.number.toNumber(); i++) {
        await process_block(i).catch((error) => {
            console.log(`failed to process block #${i}:`, error);
        });
        if (i == lastBlockNumber) {
            lastHdr = await api.rpc.chain.getHeader()
            lastBlockNumber = lastHdr.number.toNumber()
        }
    }

    await api.rpc.chain.subscribeNewHeads((lastHeader) => {
        if (lastHeader.number.toNumber() == lastBlockNumber) {
            return
        }
        process_block(lastHeader.number.toNumber()).catch((error) => {
            console.log(`failed to process block #${lastHeader}:`, error);
        });
    });

}

process.on('unhandledRejection', up => { throw up })

main()