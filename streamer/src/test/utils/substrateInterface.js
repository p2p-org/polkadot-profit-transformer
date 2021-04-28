const { ApiPromise, WsProvider } = require('@polkadot/api')
const { environment } = require('../../environment')

/** @type {ApiPromise} */
let connection = null

async function getConnection() {
    if (connection == null) {
        const wsProvider = new WsProvider(environment.SUBSTRATE_URI)
        connection = await ApiPromise.create({provider: wsProvider})
    }

    return connection
}

function apiDisconnect() {
    if (connection != null) {
        return connection.disconnect()
    }
}

module.exports = {
    apiConnection: getConnection,
    apiDisconnect: apiDisconnect
}
