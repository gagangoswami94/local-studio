const fs = require('fs');
const path = require('path');
const tar = require('tar-fs');
const { createGzip } = require('zlib');
const { promisify } = require('util');

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

/**
 * Get snapshots directory for a workspace
 * @param {string} workspacePath - Path to the workspace
 * @returns {string} Path to snapshots directory
 */
function getSnapshotsDir(workspacePath) {
  return path.join(workspacePath, '.local-studio', 'snapshots');
}

/**
 * Ensure snapshots directory exists
 * @param {string} workspacePath - Path to the workspace
 */
async function ensureSnapshotsDir(workspacePath) {
  const snapshotsDir = getSnapshotsDir(workspacePath);
  const localStudioDir = path.join(workspacePath, '.local-studio');

  try {
    if (!fs.existsSync(localStudioDir)) {
      await mkdir(localStudioDir, { recursive: true });
    }
    if (!fs.existsSync(snapshotsDir)) {
      await mkdir(snapshotsDir, { recursive: true });
    }
  } catch (error) {
    console.error('Error creating snapshots directory:', error);
    throw error;
  }
}

/**
 * Get size of a directory recursively
 * @param {string} dirPath - Path to directory
 * @returns {Promise<number>} Size in bytes
 */
async function getDirectorySize(dirPath) {
  let size = 0;

  try {
    const files = await readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await stat(filePath);

      if (stats.isDirectory()) {
        // Skip .local-studio directory to avoid counting snapshots
        if (file === '.local-studio') continue;
        size += await getDirectorySize(filePath);
      } else {
        size += stats.size;
      }
    }
  } catch (error) {
    console.error('Error getting directory size:', error);
  }

  return size;
}

/**
 * Format bytes to human readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Create a snapshot of the workspace
 * @param {string} workspacePath - Path to the workspace
 * @param {string} description - Description of the snapshot
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function createSnapshot(workspacePath, description = '') {
  try {
    if (!workspacePath) {
      return { success: false, error: 'No workspace path provided' };
    }

    if (!fs.existsSync(workspacePath)) {
      return { success: false, error: 'Workspace path does not exist' };
    }

    await ensureSnapshotsDir(workspacePath);

    const timestamp = Date.now();
    const snapshotId = `snapshot-${timestamp}`;
    const snapshotsDir = getSnapshotsDir(workspacePath);
    const archivePath = path.join(snapshotsDir, `${snapshotId}.tar.gz`);
    const metadataPath = path.join(snapshotsDir, `${snapshotId}.json`);

    // Get workspace size
    const workspaceSize = await getDirectorySize(workspacePath);

    // Create tar.gz archive
    await new Promise((resolve, reject) => {
      const gzip = createGzip();
      const output = fs.createWriteStream(archivePath);

      output.on('finish', resolve);
      output.on('error', reject);
      gzip.on('error', reject);

      tar.pack(workspacePath, {
        ignore: (name) => {
          // Ignore .local-studio and .git directories
          const relativePath = path.relative(workspacePath, name);
          return relativePath.startsWith('.local-studio') ||
                 relativePath.startsWith('.git') ||
                 relativePath === '.git';
        }
      })
        .pipe(gzip)
        .pipe(output);
    });

    // Get archive size
    const archiveStats = await stat(archivePath);
    const archiveSize = archiveStats.size;

    // Create metadata
    const metadata = {
      id: snapshotId,
      timestamp,
      date: new Date(timestamp).toISOString(),
      description: description || 'Manual snapshot',
      workspacePath,
      workspaceName: path.basename(workspacePath),
      archivePath,
      archiveSize,
      archiveSizeFormatted: formatBytes(archiveSize),
      workspaceSize,
      workspaceSizeFormatted: formatBytes(workspaceSize)
    };

    // Save metadata
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    console.log('Snapshot created:', snapshotId);

    return {
      success: true,
      data: metadata
    };
  } catch (error) {
    console.error('Error creating snapshot:', error);
    return {
      success: false,
      error: error.message || 'Failed to create snapshot'
    };
  }
}

/**
 * List all snapshots for a workspace
 * @param {string} workspacePath - Path to the workspace
 * @returns {Promise<{success: boolean, data?: array, error?: string}>}
 */
async function listSnapshots(workspacePath) {
  try {
    if (!workspacePath) {
      return { success: false, error: 'No workspace path provided' };
    }

    const snapshotsDir = getSnapshotsDir(workspacePath);

    if (!fs.existsSync(snapshotsDir)) {
      return { success: true, data: [] };
    }

    const files = await readdir(snapshotsDir);
    const metadataFiles = files.filter(f => f.endsWith('.json'));

    const snapshots = [];

    for (const file of metadataFiles) {
      try {
        const metadataPath = path.join(snapshotsDir, file);
        const content = await readFile(metadataPath, 'utf8');
        const metadata = JSON.parse(content);

        // Verify archive still exists
        if (fs.existsSync(metadata.archivePath)) {
          snapshots.push(metadata);
        }
      } catch (error) {
        console.error('Error reading snapshot metadata:', error);
      }
    }

    // Sort by timestamp (newest first)
    snapshots.sort((a, b) => b.timestamp - a.timestamp);

    return {
      success: true,
      data: snapshots
    };
  } catch (error) {
    console.error('Error listing snapshots:', error);
    return {
      success: false,
      error: error.message || 'Failed to list snapshots'
    };
  }
}

/**
 * Restore a snapshot
 * @param {string} workspacePath - Path to the workspace
 * @param {string} snapshotId - ID of the snapshot to restore
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function restoreSnapshot(workspacePath, snapshotId) {
  try {
    if (!workspacePath || !snapshotId) {
      return { success: false, error: 'Workspace path and snapshot ID required' };
    }

    const snapshotsDir = getSnapshotsDir(workspacePath);
    const archivePath = path.join(snapshotsDir, `${snapshotId}.tar.gz`);
    const metadataPath = path.join(snapshotsDir, `${snapshotId}.json`);

    if (!fs.existsSync(archivePath)) {
      return { success: false, error: 'Snapshot archive not found' };
    }

    if (!fs.existsSync(metadataPath)) {
      return { success: false, error: 'Snapshot metadata not found' };
    }

    // Create a backup of current state before restoring
    console.log('Creating backup before restore...');
    const backupResult = await createSnapshot(workspacePath, 'Auto-backup before restore');
    if (!backupResult.success) {
      console.warn('Failed to create backup before restore:', backupResult.error);
    }

    // Extract archive
    console.log('Starting snapshot restoration...');
    try {
      await new Promise((resolve, reject) => {
        const gunzip = require('zlib').createGunzip();
        const input = fs.createReadStream(archivePath);

        const extractStream = tar.extract(workspacePath, {
          ignore: (name) => {
            // Don't restore .local-studio directory
            // Name is the full path, not relative
            return name.includes('.local-studio');
          }
        });

        let finished = false;
        const cleanup = () => {
          if (!finished) {
            finished = true;
            input.destroy();
          }
        };

        input.on('error', (err) => {
          cleanup();
          reject(new Error(`Read error: ${err.message}`));
        });

        gunzip.on('error', (err) => {
          cleanup();
          reject(new Error(`Gunzip error: ${err.message}`));
        });

        extractStream.on('error', (err) => {
          cleanup();
          reject(new Error(`Extract error: ${err.message}`));
        });

        extractStream.on('finish', () => {
          console.log('Extraction finished');
          finished = true;
          resolve();
        });

        input.pipe(gunzip).pipe(extractStream);
      });

      console.log('Snapshot restored successfully:', snapshotId);
      return { success: true };
    } catch (extractError) {
      console.error('Extraction failed:', extractError);
      throw extractError;
    }
  } catch (error) {
    console.error('Error restoring snapshot:', error);
    return {
      success: false,
      error: error.message || 'Failed to restore snapshot'
    };
  }
}

/**
 * Delete a snapshot
 * @param {string} workspacePath - Path to the workspace
 * @param {string} snapshotId - ID of the snapshot to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteSnapshot(workspacePath, snapshotId) {
  try {
    if (!workspacePath || !snapshotId) {
      return { success: false, error: 'Workspace path and snapshot ID required' };
    }

    const snapshotsDir = getSnapshotsDir(workspacePath);
    const archivePath = path.join(snapshotsDir, `${snapshotId}.tar.gz`);
    const metadataPath = path.join(snapshotsDir, `${snapshotId}.json`);

    // Delete archive
    if (fs.existsSync(archivePath)) {
      await unlink(archivePath);
    }

    // Delete metadata
    if (fs.existsSync(metadataPath)) {
      await unlink(metadataPath);
    }

    console.log('Snapshot deleted:', snapshotId);

    return { success: true };
  } catch (error) {
    console.error('Error deleting snapshot:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete snapshot'
    };
  }
}

module.exports = {
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
  deleteSnapshot
};
