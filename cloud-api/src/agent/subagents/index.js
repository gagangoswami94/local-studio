/**
 * Sub-Agent System
 * Exports all sub-agents and coordinator
 */

const BaseSubAgent = require('./BaseSubAgent');
const SubAgentCoordinator = require('./SubAgentCoordinator');
const CodeGenSubAgent = require('./CodeGenSubAgent');
const TestGenSubAgent = require('./TestGenSubAgent');
const MigrationSubAgent = require('./MigrationSubAgent');

module.exports = {
  BaseSubAgent,
  SubAgentCoordinator,
  CodeGenSubAgent,
  TestGenSubAgent,
  MigrationSubAgent
};
