/**
 * Cloud API Service
 * Handles communication with the backend API
 */

const DEFAULT_API_URL = 'http://localhost:3001/api';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

// Get API URL from settings or use default
const getApiUrl = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('local-studio-settings') || '{}');
    return settings['api.url'] || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
};

// Get API key from settings (for future auth)
const getApiKey = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('local-studio-settings') || '{}');
    return settings['api.key'] || null;
  } catch {
    return null;
  }
};

/**
 * Sleep helper for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (url, options, timeout = DEFAULT_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - API took too long to respond');
    }
    throw error;
  }
};

/**
 * Check if error is retryable
 */
const isRetryableError = (error) => {
  // Network errors
  if (error.message.includes('Failed to fetch')) return true;
  if (error.message.includes('NetworkError')) return true;
  if (error.message.includes('timeout')) return false; // Don't retry timeouts

  // HTTP status codes
  if (error.status >= 500) return true; // Server errors
  if (error.status === 429) return false; // Rate limit - don't retry immediately

  return false;
};

/**
 * Make API request with retry logic
 */
const apiRequest = async (endpoint, options = {}, retries = MAX_RETRIES, timeout = DEFAULT_TIMEOUT) => {
  const apiUrl = getApiUrl();
  const apiKey = getApiKey();
  const url = `${apiUrl}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add API key if configured
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        ...options,
        headers
      }, timeout);

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || data.details || 'API request failed');
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;

    } catch (error) {
      lastError = error;

      // Log error
      console.error(`API request failed (attempt ${attempt + 1}/${retries + 1}):`, error);

      // Check if we should retry
      if (attempt < retries && isRetryableError(error)) {
        const delay = RETRY_DELAY * Math.pow(2, attempt); // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      // Don't retry, throw error
      break;
    }
  }

  // Format error message
  throw formatError(lastError);
};

/**
 * Format error for display
 */
const formatError = (error) => {
  const formatted = new Error();
  formatted.originalError = error;

  // Network errors
  if (error.message.includes('Failed to fetch')) {
    formatted.message = "Can't reach cloud API. Is it running?";
    formatted.userMessage = "⚠️ **Connection Error**\n\nCan't connect to the cloud API server. Make sure it's running:\n\n```bash\ncd cloud-api\nnpm run dev\n```\n\nAPI should be at: http://localhost:3001";
    formatted.type = 'network';
    return formatted;
  }

  if (error.message.includes('timeout')) {
    formatted.message = 'Request timeout - API took too long to respond';
    formatted.userMessage = '⏱️ **Request Timeout**\n\nThe API is taking too long to respond. This might be because:\n- The request is too complex\n- The API is under heavy load\n- Your internet connection is slow\n\nPlease try again with a simpler request.';
    formatted.type = 'timeout';
    return formatted;
  }

  // HTTP errors
  if (error.status === 429) {
    formatted.message = 'Rate limit exceeded';
    formatted.userMessage = '🚦 **Rate Limit**\n\nToo many requests. Please wait a minute and try again.\n\nThe API has limits to prevent abuse and ensure fair usage for everyone.';
    formatted.type = 'rate_limit';
    return formatted;
  }

  if (error.status === 400) {
    formatted.message = error.message || 'Bad request';
    formatted.userMessage = `❌ **Invalid Request**\n\n${error.message || 'The request was invalid.'}\n\nPlease check your input and try again.`;
    formatted.type = 'validation';
    return formatted;
  }

  if (error.status === 503) {
    formatted.message = 'API service unavailable';
    formatted.userMessage = '🔧 **Service Unavailable**\n\nThe API service is temporarily unavailable. This might be because:\n- The API key is not configured\n- The server is starting up\n- There\'s a temporary outage\n\nPlease wait a moment and try again.';
    formatted.type = 'service_unavailable';
    return formatted;
  }

  if (error.status >= 500) {
    formatted.message = 'API server error';
    formatted.userMessage = '🔥 **Server Error**\n\nThe API server encountered an error. This is not your fault.\n\nPlease try again in a few moments. If the problem persists, check the API server logs.';
    formatted.type = 'server_error';
    return formatted;
  }

  // Generic error
  formatted.message = error.message || 'Unknown error';
  formatted.userMessage = `❌ **Error**\n\n${error.message || 'An unexpected error occurred.'}\n\nPlease try again.`;
  formatted.type = 'unknown';
  return formatted;
};

/**
 * ASK Mode - Get code explanation or debugging help
 */
export const ask = async (message, context = []) => {
  return await apiRequest('/chat/ask', {
    method: 'POST',
    body: JSON.stringify({
      message,
      context
    })
  });
};

/**
 * PLAN Mode - Get implementation plan
 * Uses longer timeout (60 seconds) since plan generation needs time to analyze
 */
export const plan = async (message, context = [], workspaceFiles = []) => {
  return await apiRequest('/plan', {
    method: 'POST',
    body: JSON.stringify({
      message,
      context,
      workspace_files: workspaceFiles
    })
  }, MAX_RETRIES, 60000); // 60 second timeout for plan generation
};

/**
 * ACT Mode - Execute code changes
 * Uses longer timeout (2 minutes) since code generation takes time
 */
export const act = async (message, context = [], approvedPlan = null) => {
  return await apiRequest('/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      mode: 'act',
      context,
      plan: approvedPlan
    })
  }, MAX_RETRIES, 120000); // 2 minute timeout for code generation
};

/**
 * Health check - Test if API is reachable
 */
export const healthCheck = async () => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetchWithTimeout(`${apiUrl.replace('/api', '')}/health`, {
      method: 'GET'
    }, 5000); // 5 second timeout

    if (!response.ok) {
      return { status: 'unhealthy', message: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { status: 'healthy', data };
  } catch (error) {
    return { status: 'unreachable', message: error.message };
  }
};

/**
 * Get API info
 */
export const getApiInfo = async () => {
  try {
    return await apiRequest('/', { method: 'GET' });
  } catch (error) {
    throw error;
  }
};

/**
 * Generate Bundle - Full code generation with validation and signing
 * Uses longer timeout (5 minutes) and supports progress tracking via WebSocket
 *
 * @param {Object} request - Bundle generation request
 * @param {string} request.message - User's request message
 * @param {Array} request.context - Context files
 * @param {Array} request.workspaceFiles - Workspace file list
 * @param {Object} request.appSpec - Application specification (optional)
 * @param {boolean} request.requireApproval - Require approval for high-risk plans
 * @param {Function} onProgress - Progress callback (phase, data) => void
 * @returns {Promise<Object>} { success, taskId, bundle, validation, metrics }
 */
export const generateBundle = async (request, onProgress = null) => {
  // Connect to progress stream if callback provided
  let ws = null;

  try {
    // Start bundle generation
    const result = await apiRequest('/bundle/generate', {
      method: 'POST',
      body: JSON.stringify(request)
    }, MAX_RETRIES, 300000); // 5 minute timeout

    // Connect to WebSocket for progress updates
    if (onProgress && result.taskId) {
      ws = connectToProgress(result.taskId, onProgress);
    }

    return result;

  } catch (error) {
    // Close WebSocket on error
    if (ws) {
      ws.close();
    }
    throw formatBundleError(error);
  }
};

/**
 * Connect to WebSocket for real-time progress updates
 */
const connectToProgress = (taskId, onProgress) => {
  const apiUrl = getApiUrl();
  const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '');

  try {
    const ws = new WebSocket(`${wsUrl}/events?taskId=${taskId}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Filter events for this task
        if (data.taskId === taskId || !data.taskId) {
          onProgress(data.type, data.data);
        }
      } catch (error) {
        console.error('Failed to parse progress event:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Progress stream closed');
    };

    return ws;
  } catch (error) {
    console.error('Failed to connect to progress stream:', error);
    return null;
  }
};

/**
 * Download Bundle by ID
 * Fetches a previously generated bundle
 *
 * @param {string} bundleId - Bundle ID
 * @returns {Promise<Object>} Bundle object
 */
export const downloadBundle = async (bundleId) => {
  try {
    return await apiRequest(`/bundle/${bundleId}`, {
      method: 'GET'
    });
  } catch (error) {
    throw formatError(error);
  }
};

/**
 * Get Bundle Generation Status
 * Check status of an in-progress bundle generation
 *
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Task status
 */
export const getBundleStatus = async (taskId) => {
  try {
    return await apiRequest(`/bundle/status/${taskId}`, {
      method: 'GET'
    });
  } catch (error) {
    throw formatError(error);
  }
};

/**
 * Submit Approval for High-Risk Plan
 *
 * @param {string} taskId - Task ID
 * @param {Object} approval - Approval object
 * @param {boolean} approval.approved - Whether plan is approved
 * @param {string} approval.reason - Rejection reason (if not approved)
 * @param {Object} approval.modifiedPlan - Modified plan (optional)
 * @returns {Promise<Object>} Result
 */
export const submitApproval = async (taskId, approval) => {
  try {
    return await apiRequest(`/bundle/approval/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(approval)
    });
  } catch (error) {
    throw formatError(error);
  }
};

/**
 * Retry Bundle Validation
 * Re-run validation with different parameters
 *
 * @param {string} taskId - Task ID
 * @param {Object} options - Retry options
 * @param {number} options.coverageThreshold - New coverage threshold
 * @returns {Promise<Object>} Validation result
 */
export const retryValidation = async (taskId, options = {}) => {
  try {
    return await apiRequest(`/bundle/retry-validation/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  } catch (error) {
    throw formatError(error);
  }
};

/**
 * Regenerate Bundle with Fixes
 * Re-run generation with fix instructions
 *
 * @param {string} taskId - Original task ID
 * @param {Object} options - Regeneration options
 * @param {Array<string>} options.fixInstructions - Instructions for fixing issues
 * @returns {Promise<Object>} New bundle result
 */
export const regenerateBundle = async (taskId, options = {}) => {
  try {
    return await apiRequest(`/bundle/regenerate/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(options)
    }, MAX_RETRIES, 300000); // 5 minute timeout
  } catch (error) {
    throw formatBundleError(error);
  }
};

/**
 * Format bundle-specific errors
 */
const formatBundleError = (error) => {
  const formatted = formatError(error);

  // Bundle validation errors
  if (error.data?.validation?.blockers) {
    const blockers = error.data.validation.blockers;
    formatted.message = `Bundle validation failed with ${blockers.length} blocker(s)`;
    formatted.userMessage = `❌ **Validation Failed**\n\n${blockers.length} issue(s) must be fixed:\n\n${blockers.map((b, i) => `${i + 1}. **${b.check}**: ${b.message}`).join('\n')}`;
    formatted.type = 'validation';
    formatted.blockers = blockers;
    formatted.suggestions = error.data.validation.suggestions || [];
  }

  // Approval timeout
  if (error.message && error.message.includes('approval timeout')) {
    formatted.message = 'Approval timeout exceeded';
    formatted.userMessage = '⏱️ **Approval Timeout**\n\nThe plan approval request timed out. Please try again.';
    formatted.type = 'approval_timeout';
  }

  // Plan rejection
  if (error.message && error.message.includes('Plan rejected')) {
    formatted.message = 'Plan rejected by user';
    formatted.userMessage = '❌ **Plan Rejected**\n\nYou rejected the implementation plan. You can:\n- Try with a different request\n- Adjust your requirements\n- Break into smaller tasks';
    formatted.type = 'plan_rejected';
  }

  return formatted;
};

export default {
  ask,
  plan,
  act,
  healthCheck,
  getApiInfo,
  generateBundle,
  downloadBundle,
  getBundleStatus,
  submitApproval,
  retryValidation,
  regenerateBundle
};
