const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');

/**
 * Check if a directory is a git repository
 * @param {string} workspacePath - Path to the workspace
 * @returns {Promise<boolean>}
 */
async function isGitRepository(workspacePath) {
  try {
    const gitDir = path.join(workspacePath, '.git');
    return fs.existsSync(gitDir);
  } catch (error) {
    return false;
  }
}

/**
 * Get git status for a workspace
 * @param {string} workspacePath - Path to the workspace
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function getStatus(workspacePath) {
  try {
    if (!workspacePath) {
      return { success: false, error: 'No workspace path provided' };
    }

    const isRepo = await isGitRepository(workspacePath);
    if (!isRepo) {
      return { success: false, error: 'Not a git repository' };
    }

    const git = simpleGit(workspacePath);
    const status = await git.status();

    return {
      success: true,
      data: {
        branch: status.current,
        ahead: status.ahead,
        behind: status.behind,
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        renamed: status.renamed,
        conflicted: status.conflicted,
        not_added: status.not_added,
        staged: status.staged,
        files: status.files.map(file => ({
          path: file.path,
          working_dir: file.working_dir,
          index: file.index
        }))
      }
    };
  } catch (error) {
    console.error('Git status error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get git status'
    };
  }
}

/**
 * Get current branch name
 * @param {string} workspacePath - Path to the workspace
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
async function getCurrentBranch(workspacePath) {
  try {
    if (!workspacePath) {
      return { success: false, error: 'No workspace path provided' };
    }

    const isRepo = await isGitRepository(workspacePath);
    if (!isRepo) {
      return { success: false, error: 'Not a git repository' };
    }

    const git = simpleGit(workspacePath);
    const status = await git.status();

    return {
      success: true,
      data: status.current
    };
  } catch (error) {
    console.error('Get branch error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get current branch'
    };
  }
}

/**
 * Get git log
 * @param {string} workspacePath - Path to the workspace
 * @param {number} limit - Number of commits to retrieve (default: 10)
 * @returns {Promise<{success: boolean, data?: object[], error?: string}>}
 */
async function getLog(workspacePath, limit = 10) {
  try {
    if (!workspacePath) {
      return { success: false, error: 'No workspace path provided' };
    }

    const isRepo = await isGitRepository(workspacePath);
    if (!isRepo) {
      return { success: false, error: 'Not a git repository' };
    }

    const git = simpleGit(workspacePath);
    const log = await git.log({ maxCount: limit });

    return {
      success: true,
      data: log.all.map(commit => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author_name: commit.author_name,
        author_email: commit.author_email
      }))
    };
  } catch (error) {
    console.error('Git log error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get git log'
    };
  }
}

/**
 * Get file diff
 * @param {string} workspacePath - Path to the workspace
 * @param {string} filePath - Relative path to the file
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
async function getFileDiff(workspacePath, filePath) {
  try {
    if (!workspacePath || !filePath) {
      return { success: false, error: 'Workspace path and file path required' };
    }

    const isRepo = await isGitRepository(workspacePath);
    if (!isRepo) {
      return { success: false, error: 'Not a git repository' };
    }

    const git = simpleGit(workspacePath);
    const diff = await git.diff([filePath]);

    return {
      success: true,
      data: diff
    };
  } catch (error) {
    console.error('Git diff error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get file diff'
    };
  }
}

/**
 * Get original file content from git HEAD
 * @param {string} workspacePath - Path to the workspace
 * @param {string} filePath - Relative path to the file
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
async function getOriginalContent(workspacePath, filePath) {
  try {
    if (!workspacePath || !filePath) {
      return { success: false, error: 'Workspace path and file path required' };
    }

    const isRepo = await isGitRepository(workspacePath);
    if (!isRepo) {
      return { success: false, error: 'Not a git repository' };
    }

    const git = simpleGit(workspacePath);

    try {
      // Try to get content from HEAD
      const content = await git.show([`HEAD:${filePath}`]);
      return {
        success: true,
        data: content
      };
    } catch (error) {
      // File might be new (not in HEAD)
      return {
        success: true,
        data: '' // Empty for new files
      };
    }
  } catch (error) {
    console.error('Git show error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get original content'
    };
  }
}

module.exports = {
  isGitRepository,
  getStatus,
  getCurrentBranch,
  getLog,
  getFileDiff,
  getOriginalContent
};
