/**
 * Tools Module
 * Auto-registers all tools and exports registry
 */

const toolRegistry = require('./ToolRegistry');
const BaseTool = require('./BaseTool');

// Import all tool classes
const ViewFileTool = require('./ViewFileTool');
const ViewDirectoryTool = require('./ViewDirectoryTool');
const GrepSearchTool = require('./GrepSearchTool');
const WriteFileTool = require('./WriteFileTool');
const EditFileTool = require('./EditFileTool');
const CreateFileTool = require('./CreateFileTool');
const DeleteFileTool = require('./DeleteFileTool');
const RunCommandTool = require('./RunCommandTool');
const RunTestsTool = require('./RunTestsTool');
const InstallPackageTool = require('./InstallPackageTool');
const AskUserTool = require('./AskUserTool');
const ThinkTool = require('./ThinkTool');
const PlanTool = require('./PlanTool');
const CompleteTool = require('./CompleteTool');

// Auto-register all tools
function registerAllTools() {
  const tools = [
    // File operations (read-only, no approval needed)
    new ViewFileTool(),
    new ViewDirectoryTool(),
    new GrepSearchTool(),
    new RunTestsTool(),

    // File modifications (require approval)
    new WriteFileTool(),
    new EditFileTool(),
    new CreateFileTool(),
    new DeleteFileTool(),

    // Command execution (require approval)
    new RunCommandTool(),
    new InstallPackageTool(),

    // User interaction and AI organization
    new AskUserTool(),
    new ThinkTool(),
    new PlanTool(),
    new CompleteTool()
  ];

  tools.forEach(tool => {
    try {
      toolRegistry.register(tool);
    } catch (error) {
      console.error(`Failed to register tool ${tool.name}:`, error.message);
    }
  });

  console.log(`Registered ${toolRegistry.count()} tools`);
}

// Auto-register on import
registerAllTools();

// Export registry and base class
module.exports = {
  toolRegistry,
  BaseTool,

  // Export individual tool classes for testing/extension
  ViewFileTool,
  ViewDirectoryTool,
  GrepSearchTool,
  WriteFileTool,
  EditFileTool,
  CreateFileTool,
  DeleteFileTool,
  RunCommandTool,
  RunTestsTool,
  InstallPackageTool,
  AskUserTool,
  ThinkTool,
  PlanTool,
  CompleteTool
};
