import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import useChatStore from '../store/chatStore';
import ChatContext from './ChatContext';
import FileSelector from './FileSelector';
import ToolMessage from './ToolMessage';
import AgenticProgress from './AgenticProgress';
import ToolApproval from './ToolApproval';

const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-language">{language || 'text'}</span>
        <button className="code-block-copy" onClick={handleCopy}>
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 6px 6px',
          fontSize: '13px'
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const PlanResponse = ({ plan }) => {
  const { approvePlan, cancelPlan } = useChatStore();
  const [expandedSteps, setExpandedSteps] = useState({});

  const toggleStep = (stepId) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  return (
    <div className="plan-response">
      <div className="plan-header">
        <h3 className="plan-title">📋 {plan.title}</h3>
        <div className="plan-summary">
          <span className="plan-stat">
            <strong>{plan.filesChanged}</strong> files
          </span>
          <span className="plan-stat">
            <strong>+{plan.linesAdded}</strong> added
          </span>
          {plan.linesRemoved > 0 && (
            <span className="plan-stat">
              <strong>-{plan.linesRemoved}</strong> removed
            </span>
          )}
          <span className="plan-stat">
            ⏱️ <strong>{plan.estimatedTime}</strong>
          </span>
        </div>
      </div>

      <div className="plan-steps">
        {plan.steps.map((step) => (
          <div key={step.id} className="plan-step">
            <div className="plan-step-header" onClick={() => toggleStep(step.id)}>
              <span className="plan-step-number">{step.id}</span>
              <div className="plan-step-info">
                <h4 className="plan-step-title">{step.title}</h4>
                <p className="plan-step-changes">{step.changes}</p>
              </div>
              <span className="plan-step-arrow">
                {expandedSteps[step.id] ? '▼' : '▶'}
              </span>
            </div>

            {expandedSteps[step.id] && (
              <div className="plan-step-details">
                <p className="plan-step-description">{step.description}</p>
                {step.files.length > 0 && (
                  <div className="plan-step-files">
                    <strong>Files:</strong>
                    <ul>
                      {step.files.map((file, idx) => (
                        <li key={idx}>
                          <code>{file}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {plan.risks && plan.risks.length > 0 && (
        <div className="plan-risks">
          <h4>⚠️ Potential Risks:</h4>
          <ul>
            {plan.risks.map((risk, idx) => (
              <li key={idx}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="plan-actions">
        <button className="plan-btn plan-btn-cancel" onClick={cancelPlan}>
          ✕ Cancel
        </button>
        <button className="plan-btn plan-btn-approve" onClick={() => approvePlan(plan)}>
          ✓ Approve & Execute
        </button>
      </div>
    </div>
  );
};

const Message = ({ message }) => {
  const isUser = message.role === 'user';

  // Handle bundle mode messages (plan display)
  if (message.mode === 'bundle' && typeof message.content === 'object') {
    return (
      <div className="chat-message ai-message">
        <div className="message-avatar">🤖</div>
        <div className="message-content-wrapper">
          <div className="message-header">
            <span className="message-role">AI Assistant</span>
            <span className="message-timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="message-content">
            <PlanResponse plan={message.content} />
          </div>
        </div>
      </div>
    );
  }

  // Handle tool messages (agentic mode)
  if (message.tools && Array.isArray(message.tools)) {
    return (
      <div className="chat-message tool-message-group">
        <div className="message-avatar">🤖</div>
        <div className="message-content-wrapper">
          <div className="message-header">
            <span className="message-role">AI Assistant</span>
            <span className="message-timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            {message.iteration && (
              <span className="message-iteration">
                Step {message.iteration}
              </span>
            )}
          </div>
          <div className="message-content">
            {message.content && (
              <div className="tool-message-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
            <div className="tool-messages">
              {message.tools.map((tool, idx) => (
                <ToolMessage key={idx} tool={tool} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-message ${isUser ? 'user-message' : 'ai-message'}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-content-wrapper">
        <div className="message-header">
          <span className="message-role">{isUser ? 'You' : 'AI Assistant'}</span>
          <span className="message-timestamp">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className="message-content">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const value = String(children).replace(/\n$/, '');

                  return !inline && match ? (
                    <CodeBlock language={match[1]} value={value} />
                  ) : (
                    <code className="inline-code" {...props}>
                      {children}
                    </code>
                  );
                },
                p({ children }) {
                  return <p className="message-paragraph">{children}</p>;
                },
                ul({ children }) {
                  return <ul className="message-list">{children}</ul>;
                },
                ol({ children }) {
                  return <ol className="message-list">{children}</ol>;
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
};

const ModeSelector = () => {
  const { currentMode, setMode } = useChatStore();

  const modes = [
    {
      id: 'ask',
      icon: '💬',
      label: 'Ask',
      color: 'blue',
      description: 'Get explanations, no code changes',
      hint: 'Ask about your code, debug errors, get explanations',
      cost: null
    },
    {
      id: 'bundle',
      icon: '📦',
      label: 'Bundle',
      color: 'green',
      description: 'Generate complete changes, review once, apply atomically',
      hint: 'Describe the feature you want to add, review all changes together',
      cost: 'Low (~$0.05-0.20 per feature)'
    },
    {
      id: 'agentic',
      icon: '🤖',
      label: 'Agentic',
      color: 'purple',
      description: 'Work step-by-step with full control over each action',
      hint: 'AI works iteratively with approval at each step',
      cost: 'Higher (~$0.50-5.00 per task)'
    }
  ];

  const currentModeData = modes.find(m => m.id === currentMode);

  return (
    <div className="mode-selector-container">
      <div className="mode-selector">
        {modes.map((mode) => (
          <button
            key={mode.id}
            className={`mode-btn mode-${mode.color} ${currentMode === mode.id ? 'active' : ''}`}
            onClick={() => setMode(mode.id)}
            title={mode.description}
          >
            <span className="mode-icon">{mode.icon}</span>
            <span className="mode-label">{mode.label}</span>
          </button>
        ))}
      </div>
      <div className={`mode-hint mode-hint-${currentModeData.color}`}>
        {currentModeData.hint}
        {currentModeData.cost && (
          <span className="mode-cost"> • Cost: {currentModeData.cost}</span>
        )}
      </div>
    </div>
  );
};

const ChatPanel = () => {
  const {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    currentMode,
    agenticState,
    stopAgenticExecution,
    approveToolExecution,
    rejectToolExecution
  } = useChatStore();
  const [input, setInput] = useState('');
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedInput = input.trim();

    if (!trimmedInput || isLoading) return;

    sendMessage(trimmedInput);
    setInput('');
  };

  const handleKeyDown = (e) => {
    // Enter to send, Shift+Enter for new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Get placeholder based on current mode
  const getPlaceholder = () => {
    switch (currentMode) {
      case 'ask':
        return 'Ask about your code...';
      case 'bundle':
        return 'Describe the feature you want to add...';
      case 'agentic':
        return 'What would you like me to help you with step-by-step?';
      default:
        return 'Ask AI or describe what you want to build...';
    }
  };

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">💬</span>
          <h3>AI Assistant</h3>
        </div>
        <button
          className="chat-clear-btn"
          onClick={clearChat}
          disabled={messages.length === 0}
          title="Clear chat"
        >
          🗑️ Clear
        </button>
      </div>

      {/* Mode Selector */}
      <ModeSelector />

      {/* Agentic Progress Indicator */}
      {agenticState.isRunning && (
        <AgenticProgress
          currentIteration={agenticState.currentIteration}
          maxIterations={agenticState.maxIterations}
          currentTool={agenticState.currentTool}
          tokensUsed={agenticState.tokensUsed}
          tokenBudget={agenticState.tokenBudget}
          onStop={stopAgenticExecution}
        />
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <h4>Start a conversation</h4>
            <p>Ask me to help you build features, generate code, or debug issues.</p>
            <div className="chat-suggestions">
              <div className="suggestion-chip" onClick={() => setInput('Create a login form with email and password')}>
                Create a login form
              </div>
              <div className="suggestion-chip" onClick={() => setInput('Explain how React hooks work')}>
                Explain React hooks
              </div>
              <div className="suggestion-chip" onClick={() => setInput('Help me debug this error')}>
                Debug an error
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="chat-message ai-message">
                <div className="message-avatar">🤖</div>
                <div className="message-content-wrapper">
                  <div className="message-header">
                    <span className="message-role">AI Assistant</span>
                  </div>
                  <div className="message-loading">
                    <span className="loading-text">AI is thinking</span>
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Context Files */}
      <ChatContext onOpenFileSelector={() => setIsFileSelectorOpen(true)} />

      {/* Input */}
      <div className="chat-input-container">
        <form onSubmit={handleSubmit} className="chat-input-form">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!input.trim() || isLoading}
            title="Send message (Enter)"
          >
            {isLoading ? '⏳' : '➤'}
          </button>
        </form>
        <div className="chat-input-hint">
          Press <kbd>Enter</kbd> to send • <kbd>Shift</kbd> + <kbd>Enter</kbd> for new line
        </div>
      </div>

      {/* File Selector Modal */}
      <FileSelector
        isOpen={isFileSelectorOpen}
        onClose={() => setIsFileSelectorOpen(false)}
      />

      {/* Tool Approval Modal */}
      {agenticState.pendingApproval && (
        <ToolApproval
          tool={agenticState.pendingApproval}
          onApprove={approveToolExecution}
          onReject={rejectToolExecution}
          timeout={300000}
        />
      )}
    </div>
  );
};

export default ChatPanel;
