const BaseTool = require('./BaseTool');

class DeleteFileTool extends BaseTool {
  constructor() {
    super({
      name: 'delete_file',
      description: 'Delete a file from the workspace',
      parameters: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', description: 'Relative path to the file to delete' }
        }
      },
      requiresApproval: true
    });
  }

  async execute(params, context) {
    this.logger.info(`[STUB] Deleting file: ${params.path}`);
    return { data: { path: params.path, deleted: true } };
  }
}

module.exports = DeleteFileTool;
