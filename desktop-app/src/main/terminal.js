const pty = require('node-pty');
const os = require('os');
const fs = require('fs');

// Store active terminals
const terminals = new Map();
let terminalIdCounter = 0;

/**
 * Get default shell based on platform
 */
function getDefaultShell() {
  const platform = os.platform();

  if (platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  } else if (platform === 'darwin') {
    // Check common shell locations on macOS
    const shells = [
      process.env.SHELL,
      '/bin/zsh',
      '/usr/bin/zsh',
      '/bin/bash',
      '/usr/bin/bash'
    ].filter(Boolean);

    for (const shell of shells) {
      if (fs.existsSync(shell)) {
        return shell;
      }
    }

    return '/bin/bash'; // Fallback
  } else {
    // Linux
    const shells = [
      process.env.SHELL,
      '/bin/bash',
      '/usr/bin/bash',
      '/bin/sh'
    ].filter(Boolean);

    for (const shell of shells) {
      if (fs.existsSync(shell)) {
        return shell;
      }
    }

    return '/bin/sh'; // Fallback
  }
}

/**
 * Create a new terminal instance
 * @param {Object} options - Terminal options
 * @returns {Object} Terminal info with id
 */
function createTerminal(options = {}) {
  try {
    const terminalId = `terminal-${++terminalIdCounter}`;
    const shell = options.shell || getDefaultShell();
    const cwd = options.cwd || os.homedir();

    console.log(`Creating terminal ${terminalId} with shell: ${shell}, cwd: ${cwd}`);

    // Spawn the shell
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: cwd,
      env: process.env
    });

    // Store terminal reference
    terminals.set(terminalId, {
      id: terminalId,
      pty: ptyProcess,
      shell: shell,
      cwd: cwd
    });

    console.log(`Terminal ${terminalId} created successfully`);

    return {
      success: true,
      data: {
        id: terminalId,
        shell: shell,
        cwd: cwd
      }
    };
  } catch (error) {
    console.error('Failed to create terminal:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Write data to terminal
 * @param {string} terminalId - Terminal ID
 * @param {string} data - Data to write
 */
function writeToTerminal(terminalId, data) {
  try {
    const terminal = terminals.get(terminalId);

    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    terminal.pty.write(data);
    return { success: true };
  } catch (error) {
    console.error('Failed to write to terminal:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Resize terminal
 * @param {string} terminalId - Terminal ID
 * @param {number} cols - Columns
 * @param {number} rows - Rows
 */
function resizeTerminal(terminalId, cols, rows) {
  try {
    const terminal = terminals.get(terminalId);

    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    terminal.pty.resize(cols, rows);
    return { success: true };
  } catch (error) {
    console.error('Failed to resize terminal:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Destroy terminal
 * @param {string} terminalId - Terminal ID
 */
function destroyTerminal(terminalId) {
  try {
    const terminal = terminals.get(terminalId);

    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    terminal.pty.kill();
    terminals.delete(terminalId);

    console.log(`Terminal ${terminalId} destroyed`);
    return { success: true };
  } catch (error) {
    console.error('Failed to destroy terminal:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get terminal instance (for attaching data listeners)
 * @param {string} terminalId - Terminal ID
 */
function getTerminal(terminalId) {
  return terminals.get(terminalId);
}

/**
 * Cleanup all terminals
 */
function cleanupAllTerminals() {
  console.log('Cleaning up all terminals');
  for (const [id, terminal] of terminals) {
    try {
      terminal.pty.kill();
    } catch (error) {
      console.error(`Error killing terminal ${id}:`, error);
    }
  }
  terminals.clear();
}

module.exports = {
  createTerminal,
  writeToTerminal,
  resizeTerminal,
  destroyTerminal,
  getTerminal,
  cleanupAllTerminals
};
