/**
 * Eventbus Module
 *
 * Event-driven integration between brain components.
 */

export {
  IntegrationEventBus,
  getIntegrationEventBus,
  type Event,
  type EventHandler,
  type EventType,
  type Subscription,
  type EventBusStats,
  type BusConfig,
} from './integration-event-bus.js';

export { EVENTBUS_DIR } from './integration-event-bus.js';