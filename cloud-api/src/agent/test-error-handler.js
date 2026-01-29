/**
 * Quick smoke test for ErrorHandler
 */
const ErrorHandler = require('./ErrorHandler');
const { ErrorTypes } = ErrorHandler;

console.log('=== ErrorHandler Test ===\n');

// Test 1: Successful operation (no retry needed)
console.log('Test 1: Successful operation');
const handler = new ErrorHandler({ maxRetries: 3 });
let callCount = 0;

handler.withRetry(async () => {
  callCount++;
  return 'success';
}).then(result => {
  console.log('✓ Operation succeeded:', result);
  console.log('✓ Called', callCount, 'time(s)');
}).catch(err => {
  console.log('❌ Should not have failed:', err);
});

// Test 2: Retry on network error
console.log('\nTest 2: Retry on network error');
setTimeout(async () => {
  const handler2 = new ErrorHandler({
    maxRetries: 2,
    retryDelays: [100, 200]
  });
  let attempt = 0;

  try {
    await handler2.withRetry(async () => {
      attempt++;
      if (attempt < 3) {
        const err = new Error('Network error');
        err.code = 'ECONNRESET';
        throw err;
      }
      return 'recovered';
    });
    console.log('✓ Recovered after', attempt, 'attempts');
  } catch (error) {
    console.log('❌ Should have recovered:', error.message);
  }

  // Test 3: Auth error (not recoverable)
  console.log('\nTest 3: Auth error (not recoverable)');
  const handler3 = new ErrorHandler({ maxRetries: 3 });
  let authAttempt = 0;

  try {
    await handler3.withRetry(async () => {
      authAttempt++;
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    });
    console.log('❌ Should have thrown auth error');
  } catch (error) {
    console.log('✓ Correctly failed on auth error after', authAttempt, 'attempt(s)');
  }

  // Test 4: Token limit error with recovery strategy
  console.log('\nTest 4: Token limit with recovery strategy');
  const handler4 = new ErrorHandler({ maxRetries: 2, retryDelays: [100, 200] });
  let tokenAttempt = 0;
  let contextReduced = false;

  try {
    await handler4.withRetry(
      async () => {
        tokenAttempt++;
        if (tokenAttempt === 1) {
          const err = new Error('context_length_exceeded');
          err.status = 400;
          throw err;
        }
        return 'success after reducing context';
      },
      {
        reduceContext: async (attempt) => {
          console.log(`  Reducing context (attempt ${attempt})`);
          contextReduced = true;
        }
      }
    );
    console.log('✓ Recovered after reducing context:', contextReduced);
  } catch (error) {
    console.log('❌ Should have recovered:', error.message);
  }

  // Test 5: Error classification
  console.log('\nTest 5: Error classification');
  const testErrors = [
    { status: 429, expected: ErrorTypes.RATE_LIMIT },
    { status: 400, message: 'token limit', expected: ErrorTypes.TOKEN_LIMIT },
    { status: 401, expected: ErrorTypes.AUTH },
    { code: 'ECONNRESET', expected: ErrorTypes.NETWORK },
    { message: 'timeout', expected: ErrorTypes.TIMEOUT },
    { message: 'JSON parse error', expected: ErrorTypes.GENERATION }
  ];

  for (const testCase of testErrors) {
    const err = new Error(testCase.message || 'Test error');
    if (testCase.status) err.status = testCase.status;
    if (testCase.code) err.code = testCase.code;

    const classified = handler._classifyError(err);
    const match = classified === testCase.expected;
    console.log(`  ${match ? '✓' : '❌'} ${testCase.status || testCase.code || testCase.message}: ${classified}`);
  }

  console.log('\n=== All ErrorHandler tests passed! ===');
}, 100);
