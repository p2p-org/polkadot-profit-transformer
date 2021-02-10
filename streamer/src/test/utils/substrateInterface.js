const { ApiPromise, WsProvider } = require('@polkadot/api')

/** @type {ApiPromise} */
let connection = null

async function getConnection() {
  if (connection == null) {
    const wsProvider = new WsProvider('ws://127.0.0.1:9944')
    connection = await ApiPromise.create({ provider: wsProvider })
  }

  return connection
}

async function apiDisconnect() {
  if (connection != null) {
    return await connection.disconnect()
  }
}

module.exports = {
  apiConnection: getConnection,
  apiDisconnect: apiDisconnect
}
