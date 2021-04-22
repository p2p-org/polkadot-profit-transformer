const { Mutex } = require('async-mutex');

/** @type {Mutex} */
const SyncStatus = new Mutex();

/**
 * Provides access to lock synchronization mutex
 *
 * @type {{SyncStatus: Mutex}}
 */
module.exports = {
  SyncStatus
};
