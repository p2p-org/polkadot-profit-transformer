// Import
const { ApiPromise, WsProvider} = require('@polkadot/api');
const { Kafka } = require('kafkajs');
const config = require('./config.json');
const util = require('util')

const { GenericEvent } = require('@polkadot/types');


function hex_to_string(metadata) {
    return metadata.match(/.{1,2}/g).map(function(v){
      return String.fromCharCode(parseInt(v, 16));
    }).join('');
  }


// const kafka = new Kafka({
//     clientId: 'polkadot-streamer',
//     brokers: [config.kafka_uri]
//   })

async function main () {
    // Construct
    const wsProvider = new WsProvider(config.substrate_uri);
    const api = await ApiPromise.create({ provider: wsProvider });
    // const producer = kafka.producer()
    // await producer.connect()

    async function process_block(height, blockHash=null) {
        if (!blockHash) {
            blockHash = await api.rpc.chain.getBlockHash(height);
        }

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

            event_data = [];
            event.data.forEach((data, index) => {
                event_data.push(
                    {
                        "type": types[index].type,
                        "data": data.toString()
                    }
                    );
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
            'block' : {
                'header' : {
                    'number' : signedBlock.block.header.number.toNumber(),
                    'hash' : signedBlock.block.header.hash.toHex(),
                    'stateRoot' : signedBlock.block.header.stateRoot.toHex(),
                    'extrinsicsRoot' : signedBlock.block.header.extrinsicsRoot.toHex(),
                    'parentHash' : signedBlock.block.header.parentHash.toHex(),
                    'digest' : signedBlock.block.header.digest.toString()
                }
            },
            'extrinsics' : [...extrinsics],
            'events': block_events
        }
        console.log(util.inspect(block_data, false, null, true));
        // await producer.send({
        //     topic: 'event',
        //     messages: [
        //     {  'value': JSON.stringify(block_data) 
        //     },
        //     ],
        // })
    }

    var lastHdr = await api.rpc.chain.getHeader()
    var lastBlockNumber = lastHdr.number.toNumber()

    for (var i=1; i <= lastHdr.number.toNumber(); i++) {
        await process_block(i);
        if (i == lastBlockNumber) {
            lastHdr = await api.rpc.chain.getHeader()
            lastBlockNumber = lastHdr.number.toNumber()
        }
    }

    await api.rpc.chain.subscribeNewHeads((lastHeader) => {
        if (lastHeader.number.toNumber() == lastBlockNumber) {
            return
        }
        process_block(i, lastHeader.hash)
      });

}

process.on('unhandledRejection', up => { throw up })

main()