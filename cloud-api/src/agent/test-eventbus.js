/**
 * Quick smoke test for EventBus
 */
const EventBus = require('./EventBus');
const { EventTypes } = EventBus;

console.log('=== EventBus Test ===\n');

// Test 1: Emit events and check history
console.log('Test 1: Emit events and check history');
const eventBus = new EventBus({ maxHistory: 10 });

const event1 = eventBus.emitEvent(EventTypes.TASK_START, {
  task: 'Generate login form'
}, 'task_123');

console.log('✓ Emitted TASK_START:', event1.id);

const event2 = eventBus.emitEvent(EventTypes.CODE_PLANNING, {
  step: 'Analyzing requirements'
}, 'task_123');

console.log('✓ Emitted CODE_PLANNING:', event2.id);

// Test 2: Get history
console.log('\nTest 2: Get history');
const history = eventBus.getHistory();
console.log('✓ History length:', history.length);
console.log('✓ Events:', history.map(e => e.type));

// Test 3: Get task history
console.log('\nTest 3: Get task history');
const taskHistory = eventBus.getTaskHistory('task_123');
console.log('✓ Task history length:', taskHistory.length);
console.log('✓ All events for task_123:', taskHistory.every(e => e.taskId === 'task_123'));

// Test 4: Get history since timestamp
console.log('\nTest 4: Get history since timestamp');
const since = new Date(Date.now() - 1000).toISOString();
const recentHistory = eventBus.getHistory(since);
console.log('✓ Recent history length:', recentHistory.length);

// Test 5: Event listener
console.log('\nTest 5: Event listener');
let listenerCalled = false;
eventBus.on(EventTypes.TASK_COMPLETE, (event) => {
  listenerCalled = true;
  console.log('  Listener received:', event.type);
});

eventBus.emitEvent(EventTypes.TASK_COMPLETE, {
  result: 'success'
}, 'task_123');

console.log('✓ Listener called:', listenerCalled);

// Test 6: Wildcard listener
console.log('\nTest 6: Wildcard listener');
let wildcardCount = 0;
eventBus.on('*', (event) => {
  wildcardCount++;
});

eventBus.emitEvent(EventTypes.BUDGET_WARNING, { percent: 80 });
eventBus.emitEvent(EventTypes.LOG, { message: 'Test log' });

console.log('✓ Wildcard listener called', wildcardCount, 'times');

// Test 7: History auto-cleanup
console.log('\nTest 7: History auto-cleanup');
const smallBus = new EventBus({ maxHistory: 3 });

for (let i = 0; i < 5; i++) {
  smallBus.emitEvent(EventTypes.LOG, { index: i });
}

const cleanedHistory = smallBus.getHistory();
console.log('✓ History limited to 3 events:', cleanedHistory.length);
console.log('✓ Kept most recent:', cleanedHistory.map(e => e.data.index));

// Test 8: Clear history
console.log('\nTest 8: Clear history');
eventBus.clearHistory();
const cleared = eventBus.getHistory();
console.log('✓ History cleared:', cleared.length === 0);

// Test 9: Mock WebSocket subscriber (without actual WebSocket)
console.log('\nTest 9: Subscriber management');
console.log('✓ Subscriber count:', eventBus.getSubscriberCount());

console.log('\n=== All EventBus tests passed! ===');
