/**
 * Context System
 * Analyzes workspace for AI context gathering
 */

const ContextGatherer = require('./ContextGatherer');
const FileStructureAnalyzer = require('./FileStructureAnalyzer');
const PatternDetector = require('./PatternDetector');
const RelevanceScorer = require('./RelevanceScorer');

module.exports = {
  ContextGatherer,
  FileStructureAnalyzer,
  PatternDetector,
  RelevanceScorer
};
