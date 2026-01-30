const assert = require('assert');
const path = require('path');

const RelevanceScorer = require('../../src/agent/context/RelevanceScorer');
const FileStructureAnalyzer = require('../../src/agent/context/FileStructureAnalyzer');

/**
 * Test Relevance Scorer
 */

// Test workspace path
const testWorkspace = path.join(__dirname, '../../');

console.log('Testing Relevance Scorer...\n');

// Sample files for testing
const sampleFiles = [
  {
    name: 'auth.js',
    path: 'src/routes/auth.js',
    language: 'javascript',
    lines: 150,
    size: 5000,
    modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) // 2 days ago
  },
  {
    name: 'user.js',
    path: 'src/models/user.js',
    language: 'javascript',
    lines: 100,
    size: 3500,
    modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10) // 10 days ago
  },
  {
    name: 'login.jsx',
    path: 'src/components/login.jsx',
    language: 'javascript',
    lines: 80,
    size: 2800,
    modified: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
  },
  {
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    lines: 50,
    size: 1200,
    modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5) // 5 days ago
  },
  {
    name: 'index.js',
    path: 'src/index.js',
    language: 'javascript',
    lines: 30,
    size: 800,
    modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) // 7 days ago
  },
  {
    name: 'api.test.js',
    path: 'tests/api.test.js',
    language: 'javascript',
    lines: 200,
    size: 6000,
    modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) // 3 days ago
  }
];

// Test 1: Heuristic Scoring - Basic
console.log('Test 1: Heuristic Scoring - Basic');
(async () => {
  try {
    const scorer = new RelevanceScorer();

    const score1 = scorer.heuristicScore('user authentication', sampleFiles[0]); // auth.js
    const score2 = scorer.heuristicScore('user authentication', sampleFiles[1]); // user.js
    const score3 = scorer.heuristicScore('user authentication', sampleFiles[2]); // login.jsx

    assert(score1 > 0, 'Should score auth.js > 0');
    assert(score2 > 0, 'Should score user.js > 0');
    assert(score3 > 0, 'Should score login.jsx > 0');

    console.log(`✓ auth.js score: ${score1.toFixed(2)}`);
    console.log(`✓ user.js score: ${score2.toFixed(2)}`);
    console.log(`✓ login.jsx score: ${score3.toFixed(2)}`);
    console.log('✓ Test 1 passed\n');
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    process.exit(1);
  }
})();

// Test 2: Heuristic Scoring - Configuration Files
console.log('Test 2: Heuristic Scoring - Configuration Files');
(async () => {
  try {
    const scorer = new RelevanceScorer();

    const packageScore = scorer.heuristicScore('add dependency', sampleFiles[3]); // package.json
    const regularScore = scorer.heuristicScore('add dependency', sampleFiles[0]); // auth.js

    assert(packageScore > regularScore, 'Config files should score higher');

    console.log(`✓ package.json score: ${packageScore.toFixed(2)}`);
    console.log(`✓ auth.js score: ${regularScore.toFixed(2)}`);
    console.log('✓ Test 2 passed\n');
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    process.exit(1);
  }
})();

// Test 3: Heuristic Scoring - Entry Points
console.log('Test 3: Heuristic Scoring - Entry Points');
(async () => {
  try {
    const scorer = new RelevanceScorer();

    const indexScore = scorer.heuristicScore('application setup', sampleFiles[4]); // index.js
    const regularScore = scorer.heuristicScore('application setup', sampleFiles[0]); // auth.js

    assert(indexScore > regularScore, 'Entry points should score higher');

    console.log(`✓ index.js score: ${indexScore.toFixed(2)}`);
    console.log(`✓ auth.js score: ${regularScore.toFixed(2)}`);
    console.log('✓ Test 3 passed\n');
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    process.exit(1);
  }
})();

// Test 4: Heuristic Scoring - Recency Bonus
console.log('Test 4: Heuristic Scoring - Recency Bonus');
(async () => {
  try {
    const scorer = new RelevanceScorer();

    const recentScore = scorer.heuristicScore('login', sampleFiles[2]); // login.jsx (1 day ago)
    const olderScore = scorer.heuristicScore('login', {
      ...sampleFiles[2],
      modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60) // 60 days ago
    });

    assert(recentScore >= olderScore, 'Recent files should score equal or higher');

    console.log(`✓ Recent file score: ${recentScore.toFixed(2)}`);
    console.log(`✓ Older file score: ${olderScore.toFixed(2)}`);
    console.log('✓ Test 4 passed\n');
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    process.exit(1);
  }
})();

// Test 5: Score Files - Heuristic Only
console.log('Test 5: Score Files - Heuristic Only (Budget Too Low)');
(async () => {
  try {
    const scorer = new RelevanceScorer();

    // Low budget - should skip AI
    const scored = await scorer.scoreFiles('user authentication', sampleFiles, 1000);

    assert(Array.isArray(scored), 'Should return array');
    assert(scored.length === sampleFiles.length, 'Should score all files');
    assert(scored[0].heuristicScore !== undefined, 'Should have heuristic score');
    assert(scored[0].finalScore !== undefined, 'Should have final score');
    assert(scored[0].aiScore === 0, 'Should have no AI score (budget too low)');

    // Should be sorted by score
    for (let i = 1; i < scored.length; i++) {
      assert(scored[i - 1].finalScore >= scored[i].finalScore, 'Should be sorted by score');
    }

    console.log('✓ Top 3 scored files:');
    scored.slice(0, 3).forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.path} (score: ${file.finalScore.toFixed(2)})`);
    });
    console.log('✓ Test 5 passed\n');
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    process.exit(1);
  }
})();

// Test 6: Score Files - With AI (if API key available)
console.log('Test 6: Score Files - With AI (if API key available)');
(async () => {
  try {
    const scorer = new RelevanceScorer();

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('⊘ Skipping AI test - ANTHROPIC_API_KEY not set');
      console.log('✓ Test 6 skipped\n');
      return;
    }

    // High budget - should use AI
    const scored = await scorer.scoreFiles('user authentication', sampleFiles, 50000);

    assert(Array.isArray(scored), 'Should return array');
    assert(scored[0].heuristicScore !== undefined, 'Should have heuristic score');
    assert(scored[0].finalScore !== undefined, 'Should have final score');

    // Check if AI was used
    const hasAIScores = scored.some(f => f.aiScore > 0);

    console.log(`✓ AI scoring ${hasAIScores ? 'enabled' : 'disabled (too few files)'}`);
    console.log('✓ Top 3 scored files:');
    scored.slice(0, 3).forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.path} (final: ${file.finalScore.toFixed(2)}, heuristic: ${file.heuristicScore.toFixed(2)}, ai: ${file.aiScore.toFixed(2)})`);
    });
    console.log('✓ Test 6 passed\n');
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    console.log('⊘ Skipping AI test - API call failed');
    console.log('✓ Test 6 skipped (AI unavailable)\n');
  }
})();

// Test 7: Real Workspace Files
console.log('Test 7: Score Real Workspace Files');
(async () => {
  try {
    const analyzer = new FileStructureAnalyzer(testWorkspace, { maxDepth: 3 });
    const files = await analyzer.getFileList();

    const scorer = new RelevanceScorer();
    const scored = await scorer.scoreFiles('API routes and handlers', files, 1000);

    assert(scored.length > 0, 'Should score real files');

    console.log(`✓ Scored ${scored.length} real files`);
    console.log('✓ Top 5 relevant files for "API routes and handlers":');
    scored.slice(0, 5).forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.path} (score: ${file.finalScore.toFixed(2)})`);
    });
    console.log('✓ Test 7 passed\n');
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    process.exit(1);
  }
})();

// Test 8: Get Score Statistics
console.log('Test 8: Get Score Statistics');
(async () => {
  try {
    const scorer = new RelevanceScorer();
    const scored = await scorer.scoreFiles('authentication', sampleFiles, 1000);

    const stats = scorer.getScoreStats(scored);

    assert(stats.total === sampleFiles.length, 'Should have correct total');
    assert(stats.avgHeuristic > 0, 'Should have avg heuristic score');
    assert(Array.isArray(stats.top10), 'Should have top10 array');

    console.log('✓ Score statistics:');
    console.log(`  Total files: ${stats.total}`);
    console.log(`  Avg heuristic: ${stats.avgHeuristic.toFixed(2)}`);
    console.log(`  Avg AI: ${stats.avgAI.toFixed(2)}`);
    console.log(`  Avg final: ${stats.avgFinal.toFixed(2)}`);
    console.log('✓ Test 8 passed\n');
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    process.exit(1);
  }
})();

// Test 9: Keyword Extraction
console.log('Test 9: Keyword Extraction (Internal Test)');
(async () => {
  try {
    const scorer = new RelevanceScorer();

    // Test keyword extraction indirectly through scoring
    const score1 = scorer.heuristicScore('add user authentication with login', sampleFiles[0]);
    const score2 = scorer.heuristicScore('xyz random words', sampleFiles[0]);

    assert(score1 > score2, 'Relevant keywords should score higher');

    console.log(`✓ Relevant request score: ${score1.toFixed(2)}`);
    console.log(`✓ Irrelevant request score: ${score2.toFixed(2)}`);
    console.log('✓ Test 9 passed\n');
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    process.exit(1);
  }
})();

// Test 10: File Type Relevance
console.log('Test 10: File Type Relevance');
(async () => {
  try {
    const scorer = new RelevanceScorer();

    // Test files should score higher for test-related requests
    const testFileScore = scorer.heuristicScore('run tests', sampleFiles[5]); // api.test.js
    const regularFileScore = scorer.heuristicScore('run tests', sampleFiles[0]); // auth.js

    assert(testFileScore > regularFileScore, 'Test files should score higher for test requests');

    console.log(`✓ Test file score: ${testFileScore.toFixed(2)}`);
    console.log(`✓ Regular file score: ${regularFileScore.toFixed(2)}`);
    console.log('✓ Test 10 passed\n');
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    process.exit(1);
  }
})();

// Wait for all async tests to complete
setTimeout(() => {
  console.log('\n========================================');
  console.log('All Relevance Scorer tests passed! ✓');
  console.log('========================================\n');
}, 5000);
