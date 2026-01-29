const EventEmitter = require('events');

/**
 * Event types for progress streaming
 */
const EventTypes = {
  // Task lifecycle
  TASK_START: 'task_start',
  TASK_PROGRESS: 'task_progress',
  TASK_COMPLETE: 'task_complete',
  TASK_ERROR: 'task_error',

  // Agent operations
  AGENT_THINKING: 'agent_thinking',
  AGENT_ACTION: 'agent_action',
  AGENT_OBSERVATION: 'agent_observation',

  // Code generation
  CODE_ANALYZING: 'code_analyzing',
  CODE_PLANNING: 'code_planning',
  CODE_GENERATING: 'code_generating',
  CODE_VALIDATING: 'code_validating',

  // Tool execution (agentic mode)
  TOOL_START: 'tool_start',
  TOOL_PROGRESS: 'tool_progress',
  TOOL_COMPLETE: 'tool_complete',
  TOOL_ERROR: 'tool_error',

  // Budget tracking
  BUDGET_WARNING: 'budget_warning',
  BUDGET_EXCEEDED: 'budget_exceeded',

  // General
  LOG: 'log',
  WARNING: 'warning',
  ERROR: 'error'
};

/**
 * Event Bus for real-time progress streaming
 * Extends EventEmitter with WebSocket support and event history
 */
class EventBus extends EventEmitter {
  /**
   * Create a new Event Bus
   * @param {Object} options - Configuration options
   * @param {number} options.maxHistory - Maximum events to keep in history (default: 1000)
   * @param {Object} options.logger - Logger instance (default: console)
   */
  constructor(options = {}) {
    super();

    this.maxHistory = options.maxHistory || 1000;
    this.logger = options.logger || console;

    // Event history for reconnection
    this.eventHistory = [];

    // WebSocket subscribers: Map<clientId, websocket>
    this.subscribers = new Map();

    // Event counter for unique IDs
    this.eventCounter = 0;
  }

  /**
   * Emit an event and add to history
   * @param {string} type - Event type from EventTypes
   * @param {Object} data - Event data
   * @param {string} taskId - Current task ID (optional)
   * @returns {Object} The created event
   */
  emitEvent(type, data = {}, taskId = null) {
    // Create event object
    const event = {
      id: `evt_${++this.eventCounter}_${Date.now()}`,
      type,
      timestamp: new Date().toISOString(),
      taskId,
      data
    };

    // Add to history
    this._addToHistory(event);

    // Emit to local listeners
    super.emit(type, event);
    super.emit('*', event); // Wildcard for all events

    // Broadcast to WebSocket subscribers
    this.broadcast(event);

    return event;
  }

  /**
   * Subscribe a WebSocket client to events
   * @param {string} clientId - Unique client identifier
   * @param {WebSocket} websocket - WebSocket connection
   */
  subscribe(clientId, websocket) {
    this.logger.info(`Client ${clientId} subscribed to event bus`);

    // Store subscriber
    this.subscribers.set(clientId, websocket);

    // Handle websocket close
    websocket.on('close', () => {
      this.unsubscribe(clientId);
    });

    websocket.on('error', (error) => {
      this.logger.error(`WebSocket error for client ${clientId}:`, error);
      this.unsubscribe(clientId);
    });

    // Send subscription confirmation
    this._sendToClient(websocket, {
      type: 'subscribed',
      clientId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Unsubscribe a WebSocket client
   * @param {string} clientId - Client identifier to remove
   */
  unsubscribe(clientId) {
    if (this.subscribers.has(clientId)) {
      this.logger.info(`Client ${clientId} unsubscribed from event bus`);
      this.subscribers.delete(clientId);
    }
  }

  /**
   * Broadcast event to all WebSocket subscribers
   * @param {Object} event - Event object to broadcast
   */
  broadcast(event) {
    const message = {
      type: 'event',
      event
    };

    // Send to all subscribers
    for (const [clientId, websocket] of this.subscribers.entries()) {
      this._sendToClient(websocket, message);
    }
  }

  /**
   * Get event history since a timestamp
   * @param {string|Date} since - ISO timestamp or Date object
   * @returns {Array<Object>} Events after the given timestamp
   */
  getHistory(since = null) {
    if (!since) {
      return [...this.eventHistory];
    }

    const sinceTime = new Date(since).getTime();

    return this.eventHistory.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      return eventTime > sinceTime;
    });
  }

  /**
   * Get event history for a specific task
   * @param {string} taskId - Task ID to filter by
   * @returns {Array<Object>} Events for the given task
   */
  getTaskHistory(taskId) {
    return this.eventHistory.filter(event => event.taskId === taskId);
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
    this.logger.info('Event history cleared');
  }

  /**
   * Get subscriber count
   * @returns {number} Number of active subscribers
   */
  getSubscriberCount() {
    return this.subscribers.size;
  }

  /**
   * Get event types constants
   * @static
   */
  static get EventTypes() {
    return EventTypes;
  }

  /**
   * Add event to history with auto-cleanup
   * @param {Object} event - Event to add
   * @private
   */
  _addToHistory(event) {
    this.eventHistory.push(event);

    // Auto-cleanup: remove oldest events if over limit
    if (this.eventHistory.length > this.maxHistory) {
      const toRemove = this.eventHistory.length - this.maxHistory;
      this.eventHistory.splice(0, toRemove);
      this.logger.debug(`Removed ${toRemove} old events from history`);
    }
  }

  /**
   * Send message to WebSocket client
   * @param {WebSocket} websocket - WebSocket connection
   * @param {Object} message - Message to send
   * @private
   */
  _sendToClient(websocket, message) {
    try {
      // Check if websocket is open
      if (websocket.readyState === 1) { // 1 = OPEN
        websocket.send(JSON.stringify(message));
      }
    } catch (error) {
      this.logger.error('Failed to send message to client:', error);
    }
  }
}

// Export both class and EventTypes
module.exports = EventBus;
module.exports.EventTypes = EventTypes;
