const {
  InsufficientBudgetError,
  ReservationExceededError,
  InvalidReservationError,
  BudgetExceededError
} = require('./errors/BudgetErrors');

/**
 * Token Budget Manager
 * Tracks and controls AI token usage across operations
 */
class TokenBudgetManager {
  /**
   * Valid token usage categories
   */
  static CATEGORIES = {
    ANALYZE: 'analyze',
    PLAN: 'plan',
    GENERATE: 'generate',
    VALIDATE: 'validate',
    AGENTIC: 'agentic'
  };

  /**
   * Warning threshold (80% of budget)
   */
  static WARNING_THRESHOLD = 0.8;

  /**
   * Create a new Token Budget Manager
   * @param {number} totalBudget - Total token budget (default: 100000)
   * @param {Object} options - Configuration options
   * @param {Function} options.onWarning - Callback when 80% budget reached
   * @param {Function} options.onExceeded - Callback when budget exceeded
   */
  constructor(totalBudget = 100000, options = {}) {
    this.totalBudget = totalBudget;
    this.usedTokens = 0;
    this.reservedTokens = 0;

    // Track usage by category
    this.breakdown = {
      [TokenBudgetManager.CATEGORIES.ANALYZE]: 0,
      [TokenBudgetManager.CATEGORIES.PLAN]: 0,
      [TokenBudgetManager.CATEGORIES.GENERATE]: 0,
      [TokenBudgetManager.CATEGORIES.VALIDATE]: 0,
      [TokenBudgetManager.CATEGORIES.AGENTIC]: 0
    };

    // Track active reservations
    this.reservations = new Map();
    this.nextReservationId = 1;

    // Callbacks
    this.onWarning = options.onWarning || null;
    this.onExceeded = options.onExceeded || null;
    this.warningTriggered = false;
  }

  /**
   * Reserve tokens for an operation
   * @param {string} category - Usage category
   * @param {number} amount - Tokens to reserve
   * @returns {Object} Reservation object with { id, category, amount }
   * @throws {InsufficientBudgetError} If not enough budget available
   */
  reserve(category, amount) {
    // Validate category
    if (!Object.values(TokenBudgetManager.CATEGORIES).includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }

    // Check if we can afford this
    if (!this.canAfford(amount)) {
      const available = this.getRemaining();
      throw new InsufficientBudgetError(amount, available, category);
    }

    // Create reservation
    const reservationId = `rsv_${this.nextReservationId++}`;
    const reservation = {
      id: reservationId,
      category,
      amount,
      consumed: 0,
      createdAt: new Date().toISOString()
    };

    this.reservations.set(reservationId, reservation);
    this.reservedTokens += amount;

    return {
      id: reservationId,
      category,
      amount
    };
  }

  /**
   * Consume tokens from a reservation
   * @param {string} reservationId - Reservation ID
   * @param {number} amount - Actual tokens consumed
   * @throws {InvalidReservationError} If reservation doesn't exist
   * @throws {ReservationExceededError} If consuming more than reserved
   */
  consume(reservationId, amount) {
    const reservation = this.reservations.get(reservationId);

    if (!reservation) {
      throw new InvalidReservationError(reservationId);
    }

    // Check if we're consuming more than reserved
    const totalConsumed = reservation.consumed + amount;
    if (totalConsumed > reservation.amount) {
      throw new ReservationExceededError(reservationId, totalConsumed, reservation.amount);
    }

    // Update reservation
    reservation.consumed += amount;

    // Update totals
    this.usedTokens += amount;
    this.reservedTokens -= amount; // Release the consumed amount from reserved
    this.breakdown[reservation.category] += amount;

    // Check for warnings
    this._checkThresholds();

    // If fully consumed, clean up reservation
    if (reservation.consumed === reservation.amount) {
      this.reservations.delete(reservationId);
    }
  }

  /**
   * Release an unused reservation
   * @param {string} reservationId - Reservation ID to release
   * @throws {InvalidReservationError} If reservation doesn't exist
   */
  release(reservationId) {
    const reservation = this.reservations.get(reservationId);

    if (!reservation) {
      throw new InvalidReservationError(reservationId);
    }

    // If some tokens were already consumed, we can't release
    // But we can release the remaining reserved amount
    const unconsumed = reservation.amount - reservation.consumed;
    this.reservedTokens -= unconsumed;
    this.reservations.delete(reservationId);
  }

  /**
   * Check if we can afford a given amount of tokens
   * @param {number} amount - Tokens to check
   * @returns {boolean} True if budget available
   */
  canAfford(amount) {
    const available = this.totalBudget - this.usedTokens - this.reservedTokens;
    return available >= amount;
  }

  /**
   * Get remaining available tokens
   * @returns {number} Available tokens
   */
  getRemaining() {
    return this.totalBudget - this.usedTokens - this.reservedTokens;
  }

  /**
   * Get detailed budget report
   * @returns {Object} Budget report with usage breakdown
   */
  getReport() {
    return {
      budget: {
        total: this.totalBudget,
        used: this.usedTokens,
        reserved: this.reservedTokens,
        available: this.getRemaining(),
        percentUsed: (this.usedTokens / this.totalBudget) * 100
      },
      breakdown: { ...this.breakdown },
      reservations: Array.from(this.reservations.values()).map(r => ({
        id: r.id,
        category: r.category,
        amount: r.amount,
        consumed: r.consumed,
        remaining: r.amount - r.consumed,
        createdAt: r.createdAt
      })),
      warnings: {
        warningThreshold: TokenBudgetManager.WARNING_THRESHOLD * this.totalBudget,
        warningTriggered: this.warningTriggered,
        exceeded: this.usedTokens > this.totalBudget
      }
    };
  }

  /**
   * Check budget thresholds and trigger callbacks
   * @private
   */
  _checkThresholds() {
    const percentUsed = this.usedTokens / this.totalBudget;

    // Check warning threshold (80%)
    if (!this.warningTriggered && percentUsed >= TokenBudgetManager.WARNING_THRESHOLD) {
      this.warningTriggered = true;
      if (this.onWarning) {
        this.onWarning({
          used: this.usedTokens,
          total: this.totalBudget,
          remaining: this.getRemaining(),
          percentUsed: percentUsed * 100
        });
      }
    }

    // Check if exceeded
    if (this.usedTokens > this.totalBudget) {
      if (this.onExceeded) {
        this.onExceeded({
          used: this.usedTokens,
          total: this.totalBudget,
          exceeded: this.usedTokens - this.totalBudget
        });
      }
    }
  }

  /**
   * Reset the budget manager
   * Clears all usage and reservations
   */
  reset() {
    this.usedTokens = 0;
    this.reservedTokens = 0;
    this.breakdown = {
      [TokenBudgetManager.CATEGORIES.ANALYZE]: 0,
      [TokenBudgetManager.CATEGORIES.PLAN]: 0,
      [TokenBudgetManager.CATEGORIES.GENERATE]: 0,
      [TokenBudgetManager.CATEGORIES.VALIDATE]: 0,
      [TokenBudgetManager.CATEGORIES.AGENTIC]: 0
    };
    this.reservations.clear();
    this.warningTriggered = false;
  }

  /**
   * Estimate token count from text content
   * Uses rough approximation: ~4 characters per token
   * @param {string} content - Text content to estimate
   * @returns {number} Estimated token count
   */
  static estimateTokens(content) {
    if (!content || typeof content !== 'string') {
      return 0;
    }
    return Math.ceil(content.length / 4);
  }
}

module.exports = TokenBudgetManager;
