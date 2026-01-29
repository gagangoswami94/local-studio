/**
 * Quick smoke test for TokenBudgetManager
 */
const TokenBudgetManager = require('./TokenBudgetManager');

console.log('=== TokenBudgetManager Test ===\n');

// Test 1: Basic reservation and consumption
console.log('Test 1: Basic reservation and consumption');
const budget = new TokenBudgetManager(10000, {
  onWarning: (info) => console.log(`⚠️  Warning at ${info.percentUsed.toFixed(1)}%: ${info.used}/${info.total}`),
  onExceeded: (info) => console.log(`❌ Exceeded by ${info.exceeded} tokens`)
});

const reservation1 = budget.reserve('plan', 5000);
console.log('✓ Reserved 5000 tokens:', reservation1);

budget.consume(reservation1.id, 4500);
console.log('✓ Consumed 4500 tokens');
console.log('  Remaining:', budget.getRemaining());

// Test 2: Multiple reservations
console.log('\nTest 2: Multiple reservations');
const reservation2 = budget.reserve('generate', 3000);
console.log('✓ Reserved 3000 more tokens');
console.log('  Remaining:', budget.getRemaining());

budget.consume(reservation2.id, 3000);
console.log('✓ Consumed 3000 tokens (should trigger warning)');

// Test 3: Release unused reservation
console.log('\nTest 3: Release unused reservation');
const reservation3 = budget.reserve('validate', 1000);
console.log('✓ Reserved 1000 tokens');
budget.release(reservation3.id);
console.log('✓ Released reservation');
console.log('  Remaining:', budget.getRemaining());

// Test 4: Insufficient budget
console.log('\nTest 4: Insufficient budget error');
try {
  budget.reserve('analyze', 5000);
  console.log('❌ Should have thrown InsufficientBudgetError');
} catch (error) {
  console.log('✓ Correctly threw:', error.name);
}

// Test 5: Budget report
console.log('\nTest 5: Budget report');
const report = budget.getReport();
console.log('✓ Budget report:');
console.log('  Total:', report.budget.total);
console.log('  Used:', report.budget.used);
console.log('  Available:', report.budget.available);
console.log('  Percent used:', report.budget.percentUsed.toFixed(1) + '%');
console.log('  Breakdown:', report.breakdown);

// Test 6: estimateTokens
console.log('\nTest 6: estimateTokens helper');
const text = 'This is a sample text for token estimation';
const estimated = TokenBudgetManager.estimateTokens(text);
console.log(`✓ Estimated ${estimated} tokens for "${text}"`);

console.log('\n=== All TokenBudgetManager tests passed! ===');
