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
  currentMode: getInitialMode(), // 'ask' | 'bundle' | 'agentic'
  pendingPlan: null, // Store plan awaiting approval (bundle mode)
  contextFiles: [], // Array of file paths included in context (max 5)

  // Agentic mode state
  agenticState: {
    isRunning: false,
    currentIteration: 0,
    maxIterations: 25,
    currentTool: null,
    pendingApproval: null,
    toolExecutionHistory: [],
    tokensUsed: 0,
    tokenBudget: 100000,
    approveAll: false // Auto-approve all tools if true
  },

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
  approvePlan: async (plan) => {
    const { messages, contextFiles } = get();

    // Add approval message
    const approvalMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `✅ **Plan Approved!**\n\nGenerating code changes...`,
      timestamp: new Date().toISOString()
    };

    set({
      messages: [...messages, approvalMessage],
      isLoading: true,
      pendingPlan: null
    });

    try {
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

      const validContext = contextWithContent.filter(c => c !== null);

      // Call act API with approved plan
      const response = await api.act(
        `Execute the approved plan: ${plan.title}`,
        validContext,
        plan.raw // Send the raw API plan data
      );

      const result = response.data.response;

      // Format result as markdown
      let resultMarkdown = `# ✅ Implementation Complete\n\n`;
      resultMarkdown += `## ${result.title || 'Code Changes'}\n\n`;
      resultMarkdown += `📝 **${result.filesCreated || 0} file(s) created**\n`;
      resultMarkdown += `✏️  **${result.filesModified || 0} file(s) modified**\n`;
      resultMarkdown += `🗑️  **${result.filesDeleted || 0} file(s) deleted**\n\n`;

      if (result.summary) {
        resultMarkdown += `## Summary\n${result.summary}\n\n`;
      }

      if (result.files && result.files.length > 0) {
        resultMarkdown += `## Files Changed\n\n`;
        result.files.forEach(file => {
          resultMarkdown += `### ${file.path} (${file.action})\n\n`;
          if (file.diff) {
            resultMarkdown += '```diff\n' + file.diff + '\n```\n\n';
          }
        });
      }

      const codeResponse = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: resultMarkdown,
        timestamp: new Date().toISOString(),
        usage: response.data.usage,
        model: response.data.model
      };

      set({
        messages: [...get().messages, codeResponse],
        isLoading: false
      });

    } catch (error) {
      console.error('Failed to execute plan:', error);

      const errorContent = error.userMessage || `❌ **Error Executing Plan**\n\n${error.message || 'Failed to generate code. Please try again.'}`;

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        error: true,
        timestamp: new Date().toISOString()
      };

      set({
        messages: [...get().messages, errorMessage],
        isLoading: false
      });
    }
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

  // Agentic Mode Actions
  startAgenticExecution: () => {
    set({
      agenticState: {
        ...get().agenticState,
        isRunning: true,
        currentIteration: 0,
        toolExecutionHistory: []
      }
    });
  },

  stopAgenticExecution: () => {
    set({
      agenticState: {
        ...get().agenticState,
        isRunning: false,
        currentTool: null,
        pendingApproval: null
      }
    });
  },

  updateAgenticIteration: (iteration) => {
    set({
      agenticState: {
        ...get().agenticState,
        currentIteration: iteration
      }
    });
  },

  updateTokenUsage: (tokensUsed) => {
    set({
      agenticState: {
        ...get().agenticState,
        tokensUsed
      }
    });
  },

  setCurrentTool: (tool) => {
    set({
      agenticState: {
        ...get().agenticState,
        currentTool: tool
      }
    });
  },

  addToolExecution: (toolExecution) => {
    const { agenticState } = get();
    set({
      agenticState: {
        ...agenticState,
        toolExecutionHistory: [...agenticState.toolExecutionHistory, toolExecution]
      }
    });
  },

  requestToolApproval: (tool) => {
    set({
      agenticState: {
        ...get().agenticState,
        pendingApproval: tool
      }
    });
  },

  approveToolExecution: (modifiedParams = null, approveAll = false) => {
    const { agenticState } = get();
    if (agenticState.pendingApproval) {
      // Send approval via IPC
      window.electronAPI.agentic.approveToolExecution({
        approved: true,
        modifiedParams: modifiedParams || agenticState.pendingApproval.params,
        approveAll
      });

      set({
        agenticState: {
          ...agenticState,
          pendingApproval: null,
          approveAll: approveAll || agenticState.approveAll
        }
      });
    }
  },

  rejectToolExecution: (reason = 'User rejected') => {
    const { agenticState } = get();
    if (agenticState.pendingApproval) {
      // Send rejection via IPC
      window.electronAPI.agentic.rejectToolExecution({
        approved: false,
        reason
      });

      set({
        agenticState: {
          ...agenticState,
          pendingApproval: null
        }
      });
    }
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

      } else if (currentMode === 'bundle') {
        // Bundle mode - get workspace files and call real API
        const workspaceFiles = await window.electronAPI.workspace.getFiles();
        const response = await api.plan(content, validContext, workspaceFiles);

        // Transform API response to UI format
        const apiPlan = response.data;
        const plan = {
          title: `Implementation Plan: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
          complexity: apiPlan.complexity,
          filesChanged: apiPlan.files_to_change?.length || 0,
          linesAdded: 0, // Will be calculated during execution
          linesRemoved: 0,
          estimatedTime: `${apiPlan.estimated_minutes || 30} min`,
          steps: apiPlan.steps?.map((step, idx) => ({
            id: idx + 1,
            title: step.description,
            changes: `${step.files?.length || 0} file(s) - ${step.type}`,
            description: step.description,
            files: step.files || [],
            type: step.type
          })) || [],
          risks: apiPlan.risks || [],
          dependencies: apiPlan.dependencies,
          migrations: apiPlan.migrations,
          files_to_change: apiPlan.files_to_change,
          plan_id: apiPlan.plan_id,
          raw: apiPlan // Keep raw API response for execution
        };

        aiResponse = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: plan, // Store transformed plan object
          mode: 'bundle',
          timestamp: new Date().toISOString(),
          usage: apiPlan.usage,
          model: apiPlan.model
        };
        set({
          messages: [...get().messages, aiResponse],
          pendingPlan: plan,
          isLoading: false
        });

      } else if (currentMode === 'agentic') {
        // Agentic mode - call real API with step-by-step execution
        const { pendingPlan, agenticState } = get();
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
          mode: 'agentic',
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
