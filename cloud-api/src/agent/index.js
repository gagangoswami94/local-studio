/**
 * Agent Module Exports
 * Day 8: Bundle Mode Foundation
 */

const AgentOrchestrator = require('./AgentOrchestrator');
const TokenBudgetManager = require('./TokenBudgetManager');
const ErrorHandler = require('./ErrorHandler');
const EventBus = require('./EventBus');
const StateManager = require('./StateManager');

// Export errors
const BudgetErrors = require('./errors/BudgetErrors');

// Export event types and status constants
const { EventTypes } = EventBus;
const { TaskStatus, PhaseStatus } = StateManager;
const { ErrorTypes } = ErrorHandler;

module.exports = {
  // Main orchestrator
  AgentOrchestrator,

  // Core components
  TokenBudgetManager,
  ErrorHandler,
  EventBus,
  StateManager,

  // Constants and types
  EventTypes,
  TaskStatus,
  PhaseStatus,
  ErrorTypes,

  // Errors
  BudgetErrors
};
