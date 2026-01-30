const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const FileStructureAnalyzer = require('../../src/agent/context/FileStructureAnalyzer');
const PatternDetector = require('../../src/agent/context/PatternDetector');
const ContextGatherer = require('../../src/agent/context/ContextGatherer');

/**
 * Test Context System
 */

// Test workspace path (using cloud-api itself as test workspace)
const testWorkspace = path.join(__dirname, '../../');

console.log('Testing Context System...\n');

// Test 1: FileStructureAnalyzer - Get Structure
console.log('Test 1: FileStructureAnalyzer - Get Structure');
(async () => {
  try {
    const analyzer = new FileStructureAnalyzer(testWorkspace, {
      maxDepth: 3 // Limit depth for testing
    });

    const structure = await analyzer.getStructure();

    assert(structure.root, 'Structure should have root');
    assert(structure.tree, 'Structure should have tree');
    assert(structure.stats, 'Structure should have stats');
    assert(structure.stats.totalFiles > 0, 'Should have found files');
    assert(structure.stats.totalDirectories > 0, 'Should have found directories');
    assert(structure.stats.languageBreakdown, 'Should have language breakdown');

    console.log(`✓ Found ${structure.stats.totalFiles} files in ${structure.stats.totalDirectories} directories`);
    console.log(`✓ Language breakdown:`, JSON.stringify(structure.stats.languageBreakdown, null, 2));
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: FileStructureAnalyzer - Get File List
console.log('Test 2: FileStructureAnalyzer - Get File List');
(async () => {
  try {
    const analyzer = new FileStructureAnalyzer(testWorkspace);
    const files = await analyzer.getFileList();

    assert(Array.isArray(files), 'Should return array of files');
    assert(files.length > 0, 'Should have found files');
    assert(files[0].name, 'Files should have name');
    assert(files[0].path, 'Files should have path');
    assert(files[0].language, 'Files should have language');

    console.log(`✓ Found ${files.length} files`);
    console.log(`✓ Sample file:`, JSON.stringify(files[0], null, 2));
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: FileStructureAnalyzer - Find Files
console.log('Test 3: FileStructureAnalyzer - Find Files');
(async () => {
  try {
    const analyzer = new FileStructureAnalyzer(testWorkspace);

    // Find all JavaScript files
    const jsFiles = await analyzer.findFiles('.js');
    assert(jsFiles.length > 0, 'Should find JavaScript files');

    // Find using regex
    const testFiles = await analyzer.findFiles(/test.*\.js$/);
    console.log(`✓ Found ${jsFiles.length} JavaScript files`);
    console.log(`✓ Found ${testFiles.length} test files`);
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: FileStructureAnalyzer - Get Files By Language
console.log('Test 4: FileStructureAnalyzer - Get Files By Language');
(async () => {
  try {
    const analyzer = new FileStructureAnalyzer(testWorkspace);

    const jsFiles = await analyzer.getFilesByLanguage('javascript');
    const jsonFiles = await analyzer.getFilesByLanguage('json');

    assert(jsFiles.length > 0, 'Should find JavaScript files');
    assert(jsonFiles.length > 0, 'Should find JSON files');

    console.log(`✓ Found ${jsFiles.length} JavaScript files`);
    console.log(`✓ Found ${jsonFiles.length} JSON files`);
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: PatternDetector - Detect Frameworks
console.log('Test 5: PatternDetector - Detect Frameworks');
(async () => {
  try {
    const detector = new PatternDetector(testWorkspace);
    const frameworks = await detector.detectFrameworks();

    assert(frameworks, 'Should return frameworks object');
    assert(frameworks.frontend, 'Should have frontend frameworks');
    assert(frameworks.backend, 'Should have backend frameworks');
    assert(frameworks.fullstack, 'Should have fullstack frameworks');

    console.log('✓ Detected frameworks:');
    console.log('  Frontend:', frameworks.frontend.map(f => f.name).join(', ') || 'None');
    console.log('  Backend:', frameworks.backend.map(f => f.name).join(', ') || 'None');
    console.log('  Fullstack:', frameworks.fullstack.map(f => f.name).join(', ') || 'None');
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: PatternDetector - Detect State Management
console.log('Test 6: PatternDetector - Detect State Management');
(async () => {
  try {
    const detector = new PatternDetector(testWorkspace);
    const stateManagement = await detector.detectStateManagement();

    assert(Array.isArray(stateManagement), 'Should return array');

    console.log('✓ Detected state management:');
    if (stateManagement.length > 0) {
      stateManagement.forEach(sm => {
        console.log(`  - ${sm.name} (${sm.type || 'N/A'})`);
      });
    } else {
      console.log('  - None detected');
    }
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    process.exit(1);
  }
})();

// Test 7: PatternDetector - Detect API Patterns
console.log('Test 7: PatternDetector - Detect API Patterns');
(async () => {
  try {
    const detector = new PatternDetector(testWorkspace);
    const apiPatterns = await detector.detectAPIPatterns();

    assert(apiPatterns, 'Should return API patterns object');
    assert(typeof apiPatterns.rest === 'boolean', 'Should have REST flag');
    assert(typeof apiPatterns.graphql === 'boolean', 'Should have GraphQL flag');
    assert(Array.isArray(apiPatterns.details), 'Should have details array');

    console.log('✓ Detected API patterns:');
    console.log('  REST:', apiPatterns.rest ? 'Yes' : 'No');
    console.log('  GraphQL:', apiPatterns.graphql ? 'Yes' : 'No');
    console.log('  tRPC:', apiPatterns.trpc ? 'Yes' : 'No');
    console.log('  gRPC:', apiPatterns.grpc ? 'Yes' : 'No');
    console.log('  WebSockets:', apiPatterns.websockets ? 'Yes' : 'No');
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: PatternDetector - Detect All Patterns
console.log('Test 8: PatternDetector - Detect All Patterns');
(async () => {
  try {
    const detector = new PatternDetector(testWorkspace);
    const patterns = await detector.detectAll();

    assert(patterns.frameworks, 'Should have frameworks');
    assert(patterns.stateManagement, 'Should have state management');
    assert(patterns.apiPatterns, 'Should have API patterns');
    assert(patterns.buildTools, 'Should have build tools');
    assert(patterns.testingFrameworks, 'Should have testing frameworks');
    assert(patterns.summary, 'Should have summary');

    console.log('✓ Pattern summary:', patterns.summary);
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: ContextGatherer - Gather Context
console.log('Test 9: ContextGatherer - Gather Context');
(async () => {
  try {
    const gatherer = new ContextGatherer(testWorkspace, {
      maxDepth: 3,
      tokenBudget: 10000 // Small budget for testing
    });

    const context = await gatherer.gather('test API routes', 10000);

    assert(context.structure, 'Should have structure');
    assert(context.patterns, 'Should have patterns');
    assert(context.dependencies, 'Should have dependencies');
    assert(Array.isArray(context.files), 'Should have files array');
    assert(context.tokenUsage, 'Should have token usage');
    assert(context.summary, 'Should have summary');

    console.log('✓ Context gathered successfully');
    console.log('✓ Token usage:', JSON.stringify(context.tokenUsage, null, 2));
    console.log('✓ Files loaded:', context.files.length);
    console.log('✓ Summary:', context.summary);
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: ContextGatherer - Token Budget Respected
console.log('Test 10: ContextGatherer - Token Budget Respected');
(async () => {
  try {
    const gatherer = new ContextGatherer(testWorkspace);
    const budget = 5000;
    const context = await gatherer.gather('', budget);

    assert(context.tokenUsage.total <= budget, 'Should respect token budget');

    console.log(`✓ Token budget: ${budget}`);
    console.log(`✓ Tokens used: ${context.tokenUsage.total}`);
    console.log(`✓ Within budget: ${context.tokenUsage.total <= budget}`);
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    process.exit(1);
  }
})();

// Test 11: ContextGatherer - Find Files
console.log('Test 11: ContextGatherer - Find Files');
(async () => {
  try {
    const gatherer = new ContextGatherer(testWorkspace);
    const files = await gatherer.findFiles('routes');

    assert(Array.isArray(files), 'Should return array');
    console.log(`✓ Found ${files.length} files matching "routes"`);
    console.log('✓ Test 11 passed\n');
  } catch (error) {
    console.error('✗ Test 11 failed:', error.message);
    process.exit(1);
  }
})();

// Test 12: ContextGatherer - Get Detailed Tree
console.log('Test 12: ContextGatherer - Get Detailed Tree');
(async () => {
  try {
    const gatherer = new ContextGatherer(testWorkspace, { maxDepth: 2 });
    const tree = await gatherer.getDetailedTree();

    assert(tree.root, 'Should have root');
    assert(tree.tree, 'Should have tree');
    assert(tree.stats, 'Should have stats');

    console.log('✓ Got detailed tree');
    console.log(`✓ Total files: ${tree.stats.totalFiles}`);
    console.log('✓ Test 12 passed\n');
  } catch (error) {
    console.error('✗ Test 12 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests to complete
setTimeout(() => {
  console.log('\n========================================');
  console.log('All Context System tests passed! ✓');
  console.log('========================================\n');
}, 5000);
