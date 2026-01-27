const Anthropic = require('@anthropic-ai/sdk');

/**
 * Anthropic API service
 * Handles communication with Claude API
 */

// Initialize Anthropic client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Default model to use
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Sleep helper for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is retryable
 */
function isRetryableError(error) {
  // Retry on rate limits, timeouts, and server errors
  if (error.status === 429) return true; // Rate limit
  if (error.status >= 500) return true; // Server errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
  return false;
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(attempt) {
  return RETRY_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Chat completion with Claude
 * @param {Array} messages - Array of {role: 'user'|'assistant', content: string}
 * @param {Object} options - Additional options
 * @param {string} options.model - Model to use (default: claude-3-5-sonnet)
 * @param {number} options.maxTokens - Max tokens to generate (default: 4096)
 * @param {number} options.temperature - Temperature 0-1 (default: 0.7)
 * @param {string} options.system - System prompt
 * @param {boolean} options.stream - Enable streaming (default: false)
 * @returns {Promise<Object>} Response object
 */
async function chatCompletion(messages, options = {}) {
  const {
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
    system,
    stream = false
  } = options;

  let lastError;

  // Retry loop
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const requestParams = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages
      };

      // Add system prompt if provided
      if (system) {
        requestParams.system = system;
      }

      // Handle streaming vs non-streaming
      if (stream) {
        return await streamChatCompletion(requestParams);
      } else {
        const response = await client.messages.create(requestParams);

        return {
          success: true,
          content: response.content[0].text,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens
          },
          model: response.model,
          stopReason: response.stop_reason
        };
      }
    } catch (error) {
      lastError = error;

      // Log the error
      console.error(`Anthropic API error (attempt ${attempt + 1}/${MAX_RETRIES}):`, {
        status: error.status,
        message: error.message,
        code: error.code
      });

      // Check if we should retry
      if (attempt < MAX_RETRIES - 1 && isRetryableError(error)) {
        const delay = getRetryDelay(attempt);
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      // Don't retry, throw error
      break;
    }
  }

  // All retries failed
  throw {
    success: false,
    error: lastError.message || 'Failed to complete chat request',
    status: lastError.status || 500,
    code: lastError.code,
    retries: MAX_RETRIES
  };
}

/**
 * Stream chat completion
 * @param {Object} requestParams - Request parameters
 * @returns {Promise<Object>} Response with streaming iterator
 */
async function streamChatCompletion(requestParams) {
  const stream = await client.messages.stream(requestParams);

  return {
    success: true,
    stream: stream,
    // Helper to collect full response
    async collectResponse() {
      let fullText = '';
      let usage = null;

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            fullText += chunk.delta.text;
          }
        } else if (chunk.type === 'message_delta') {
          if (chunk.usage) {
            usage = chunk.usage;
          }
        }
      }

      return {
        content: fullText,
        usage
      };
    }
  };
}

/**
 * Estimate token count (rough approximation)
 * Claude uses ~4 characters per token on average
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Check if API key is configured
 */
function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY &&
         process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here';
}

module.exports = {
  chatCompletion,
  estimateTokens,
  isConfigured,
  DEFAULT_MODEL
};
