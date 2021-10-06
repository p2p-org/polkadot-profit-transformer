import { Logger } from './../../apps/common/infra/logger/logger'
/* eslint-disable @typescript-eslint/ban-types */
export interface Registry {
  unregister: () => void
}

export interface Callable {
  [key: string]: Function
}

export interface Subscriber {
  [key: string]: Callable
}

export type EventBus = ReturnType<typeof EventBus>

export const EventBus = (deps: { logger: Logger }) => {
  const { logger } = deps
  let nextId = 0
  const subscribers: Subscriber = {}
  const getNextId = (): number => {
    return nextId++
  }
  return {
    dispatch<T>(event: string, arg?: T): void {
      const subscriber = subscribers[event]

      if (subscriber === undefined) {
        return
      }

      Object.keys(subscriber).forEach((key) => subscriber[key](<T>arg))
    },

    register(event: string, callback: Function): Registry {
      const id = getNextId()
      if (!subscribers[event]) subscribers[event] = {}

      subscribers[event][id] = callback

      return {
        unregister: () => {
          delete subscribers[event][id]
          if (Object.keys(subscribers[event]).length === 0) delete subscribers[event]
        },
      }
    },
  }
}
