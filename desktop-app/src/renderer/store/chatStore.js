import { create } from 'zustand';
import * as api from '../services/api';

// Get initial mode from localStorage or default to 'ask'
const getInitialMode = () => {
  try {
    return localStorage.getItem('aiMode') || 'ask';
  } catch {
    return 'ask';
  }
};

const useChatStore = create((set, get) => ({
  // State
  messages: [],
  isLoading: false,
  currentMode: getInitialMode(), // 'ask' | 'plan' | 'act'
  pendingPlan: null, // Store plan awaiting approval
  contextFiles: [], // Array of file paths included in context (max 5)

  // Set AI mode
  setMode: (mode) => {
    set({ currentMode: mode });
    try {
      localStorage.setItem('aiMode', mode);
    } catch (error) {
      console.error('Failed to save mode to localStorage:', error);
    }
  },

  // Approve plan
  approvePlan: (plan) => {
    const { messages } = get();
    const approvalMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `✅ **Plan Approved!**\n\nStarting implementation...\n\n*In a real implementation, this would execute the plan and apply all changes.*`,
      timestamp: new Date().toISOString()
    };
    set({
      messages: [...messages, approvalMessage],
      pendingPlan: null
    });
  },

  // Cancel plan
  cancelPlan: () => {
    const { messages } = get();
    const cancelMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '❌ **Plan Cancelled**\n\nNo changes were made. Feel free to ask me to modify the plan or try something else.',
      timestamp: new Date().toISOString()
    };
    set({
      messages: [...messages, cancelMessage],
      pendingPlan: null
    });
  },

  // Context file management
  addContextFile: (filePath) => {
    const { contextFiles } = get();

    // Check if file already in context
    if (contextFiles.includes(filePath)) {
      return;
    }

    // Limit to 5 files
    if (contextFiles.length >= 5) {
      console.warn('Maximum 5 files allowed in context');
      return;
    }

    set({ contextFiles: [...contextFiles, filePath] });
  },

  removeContextFile: (filePath) => {
    const { contextFiles } = get();
    set({ contextFiles: contextFiles.filter(f => f !== filePath) });
  },

  clearContext: () => {
    set({ contextFiles: [] });
  },

  addCurrentFileToContext: (currentFilePath) => {
    if (currentFilePath) {
      get().addContextFile(currentFilePath);
    }
  },

  // Actions
  sendMessage: async (content) => {
    const { messages, currentMode, contextFiles } = get();

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };

    set({ messages: [...messages, userMessage], isLoading: true });

    // Call appropriate AI function based on mode
    try {
      let aiResponse;

      // Load context file contents
      const contextWithContent = await Promise.all(
        contextFiles.map(async (filePath) => {
          try {
            const result = await window.electronAPI.fs.readFile(filePath);
            if (result.success) {
              return {
                path: filePath,
                content: result.data
              };
            }
            return null;
          } catch (error) {
            console.error('Failed to load context file:', filePath, error);
            return null;
          }
        })
      );

      // Filter out any failed loads
      const validContext = contextWithContent.filter(c => c !== null);

      if (currentMode === 'ask') {
        // Ask mode - call real API
        const response = await api.ask(content, validContext);
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.response,
          timestamp: new Date().toISOString(),
          usage: response.usage,
          model: response.model
        };
        set({ messages: [...get().messages, aiResponse], isLoading: false });

      } else if (currentMode === 'plan') {
        // Plan mode - call real API
        const response = await api.plan(content, validContext);
        const plan = response.data.response; // Extract plan from response
        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: plan, // Store plan object directly
          mode: 'plan',
          timestamp: new Date().toISOString(),
          usage: response.data.usage,
          model: response.data.model
        };
        set({
          messages: [...get().messages, aiResponse],
          pendingPlan: plan,
          isLoading: false
        });

      } else if (currentMode === 'act') {
        // Act mode - call real API with approved plan if available
        const { pendingPlan } = get();
        const response = await api.act(content, validContext, pendingPlan);
        const result = response.data.response; // Extract result from response

        // Format result as markdown
        let resultMarkdown = `# ${result.title}\n\n`;
        resultMarkdown += `✅ **${result.filesCreated || 0} file(s) created**\n`;
        resultMarkdown += `📝 **${result.filesModified || 0} file(s) modified**\n`;
        resultMarkdown += `➕ **${result.files?.length || 0} files changed**\n\n`;
        resultMarkdown += `## Summary\n${result.summary}\n\n`;

        if (result.files && result.files.length > 0) {
          resultMarkdown += `## Files Changed\n\n`;
          result.files.forEach(file => {
            resultMarkdown += `### ${file.path} (${file.action})\n\n`;
            resultMarkdown += '```diff\n' + file.diff + '\n```\n\n';
          });
        }

        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: resultMarkdown,
          mode: 'act',
          timestamp: new Date().toISOString(),
          usage: response.data.usage,
          model: response.data.model
        };
        set({ messages: [...get().messages, aiResponse], isLoading: false });
      }

    } catch (error) {
      console.error('Failed to get AI response:', error);

      // Use user-friendly error message if available
      const errorContent = error.userMessage || `❌ **Error**\n\n${error.message || 'Failed to generate response. Please try again.'}`;

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        error: true,
        errorType: error.type || 'unknown',
        timestamp: new Date().toISOString()
      };
      set({ messages: [...get().messages, errorMessage], isLoading: false });
    }
  },

  addMessage: (message) => {
    const { messages } = get();
    set({ messages: [...messages, { ...message, id: Date.now().toString(), timestamp: new Date().toISOString() }] });
  },

  clearChat: () => {
    set({ messages: [], isLoading: false });
  }
}));

export default useChatStore;
