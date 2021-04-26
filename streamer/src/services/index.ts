import { Mutex } from 'async-mutex'

/** @type {Mutex} */
const SyncStatus = new Mutex()

/**
 * Provides access to lock synchronization mutex
 *
 * @type {{SyncStatus: Mutex}}
 */
export { SyncStatus }
