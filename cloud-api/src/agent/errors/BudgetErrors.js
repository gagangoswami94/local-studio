/**
 * Custom errors for Token Budget Manager
 */

/**
 * Thrown when there's insufficient budget to reserve tokens
 */
class InsufficientBudgetError extends Error {
  constructor(requested, available, category = null) {
    const categoryMsg = category ? ` for category '${category}'` : '';
    super(
      `Insufficient budget${categoryMsg}: requested ${requested} tokens, but only ${available} available`
    );
    this.name = 'InsufficientBudgetError';
    this.requested = requested;
    this.available = available;
    this.category = category;
  }
}

/**
 * Thrown when trying to consume more than reserved
 */
class ReservationExceededError extends Error {
  constructor(reservationId, consumed, reserved) {
    super(
      `Reservation ${reservationId} exceeded: trying to consume ${consumed} tokens, but only ${reserved} reserved`
    );
    this.name = 'ReservationExceededError';
    this.reservationId = reservationId;
    this.consumed = consumed;
    this.reserved = reserved;
  }
}

/**
 * Thrown when trying to operate on invalid reservation
 */
class InvalidReservationError extends Error {
  constructor(reservationId) {
    super(`Invalid reservation ID: ${reservationId}`);
    this.name = 'InvalidReservationError';
    this.reservationId = reservationId;
  }
}

/**
 * Thrown when budget is exceeded during operation
 */
class BudgetExceededError extends Error {
  constructor(used, total) {
    super(`Budget exceeded: used ${used} tokens out of ${total} total budget`);
    this.name = 'BudgetExceededError';
    this.used = used;
    this.total = total;
  }
}

module.exports = {
  InsufficientBudgetError,
  ReservationExceededError,
  InvalidReservationError,
  BudgetExceededError
};
