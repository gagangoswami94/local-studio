const BaseTool = require('./BaseTool');

class CreateFileTool extends BaseTool {
  constructor() {
    super({
      name: 'create_file',
      description: 'Create a new file with content',
      parameters: {
        type: 'object',
        required: ['path', 'content'],
        properties: {
          path: { type: 'string', description: 'Relative path for the new file' },
          content: { type: 'string', description: 'Initial content for the file' }
        }
      },
      requiresApproval: true
    });
  }

  async execute(params, context) {
    this.logger.info(`[STUB] Creating file: ${params.path}`);
    return { data: { path: params.path, created: true } };
  }
}

module.exports = CreateFileTool;
