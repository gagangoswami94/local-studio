/**
 * AI Service - Connects to Cloud API
 * Calls real Anthropic API via cloud-api server
 */

const API_URL = 'http://localhost:3001/api';

// Simulate API delay (for fallback mock mode)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fallback mock responses for Ask mode (when API is unavailable)
const askModeResponses = [
  {
    keywords: ['error', 'bug', 'issue', 'problem', 'wrong'],
    response: `## Understanding the Error

That error typically occurs when there's a **mismatch between expected and actual data types**. Here's what's happening:

### Common Causes:
1. **Undefined variable** - You're trying to access a property on \`undefined\`
2. **Async timing issue** - Data hasn't loaded yet
3. **Wrong object structure** - API response format changed

### How to Fix:

\`\`\`javascript
// Add optional chaining and null checks
const value = data?.user?.name || 'Default Name';

// Or use conditional rendering
{data && data.user && (
  <div>{data.user.name}</div>
)}
\`\`\`

### Prevention:
- Always validate data before accessing nested properties
- Add TypeScript for type safety
- Use default values with destructuring

Would you like me to show you how to add proper error boundaries?`
  },
  {
    keywords: ['hook', 'react', 'useeffect', 'usestate'],
    response: `## React Hooks Explained

React hooks are **functions that let you use state and lifecycle features** in functional components.

### Most Common Hooks:

#### 1. useState
Manages component state:
\`\`\`javascript
const [count, setCount] = useState(0);

// Updates are batched
setCount(count + 1);
\`\`\`

#### 2. useEffect
Handles side effects (API calls, subscriptions):
\`\`\`javascript
useEffect(() => {
  // Runs after render
  fetchData();

  // Cleanup function
  return () => cleanup();
}, [dependencies]); // Re-runs when dependencies change
\`\`\`

#### 3. useRef
Persists values without re-rendering:
\`\`\`javascript
const inputRef = useRef(null);
inputRef.current.focus();
\`\`\`

### Key Rules:
- ✅ Only call hooks at the top level
- ✅ Only call hooks in React functions
- ✅ Put all dependencies in useEffect array

Need help with a specific hook?`
  },
  {
    keywords: ['login', 'auth', 'authentication', 'form'],
    response: `## Building a Login Form

Here's what you need for a secure login form:

### Basic Structure:

\`\`\`jsx
const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await loginUser(email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">Login</button>
    </form>
  );
};
\`\`\`

### Security Best Practices:
- ✅ Always use HTTPS
- ✅ Hash passwords server-side (bcrypt)
- ✅ Implement rate limiting
- ✅ Add CSRF protection
- ✅ Use secure session cookies

Would you like me to generate this form with validation?`
  }
];

// Mock responses for Plan mode
const planModeTemplates = [
  {
    keywords: ['component', 'create', 'add', 'build'],
    plan: {
      title: 'Create New Component',
      steps: [
        {
          id: 1,
          title: 'Create component file',
          description: 'Create a new React component with props and state',
          files: ['src/components/NewComponent.jsx'],
          changes: '+45 lines'
        },
        {
          id: 2,
          title: 'Add component styles',
          description: 'Create CSS module for component styling',
          files: ['src/components/NewComponent.module.css'],
          changes: '+32 lines'
        },
        {
          id: 3,
          title: 'Update parent component',
          description: 'Import and use the new component',
          files: ['src/App.jsx'],
          changes: '+3 lines, -0 lines'
        },
        {
          id: 4,
          title: 'Add tests',
          description: 'Create unit tests for the component',
          files: ['src/components/NewComponent.test.jsx'],
          changes: '+28 lines'
        }
      ],
      filesChanged: 4,
      linesAdded: 108,
      linesRemoved: 0,
      risks: [
        'New dependency might increase bundle size',
        'Breaking changes in existing parent component'
      ],
      estimatedTime: '5 minutes'
    }
  },
  {
    keywords: ['fix', 'bug', 'error'],
    plan: {
      title: 'Fix Authentication Bug',
      steps: [
        {
          id: 1,
          title: 'Add null check in auth service',
          description: 'Prevent undefined error when token is missing',
          files: ['src/services/auth.js'],
          changes: '+5 lines, -2 lines'
        },
        {
          id: 2,
          title: 'Update login component',
          description: 'Add error boundary and fallback UI',
          files: ['src/components/Login.jsx'],
          changes: '+12 lines, -3 lines'
        },
        {
          id: 3,
          title: 'Add error logging',
          description: 'Log authentication failures for debugging',
          files: ['src/utils/logger.js'],
          changes: '+8 lines'
        }
      ],
      filesChanged: 3,
      linesAdded: 25,
      linesRemoved: 5,
      risks: [
        'May need to clear user sessions',
        'Backwards compatibility with old tokens'
      ],
      estimatedTime: '10 minutes'
    }
  },
  {
    keywords: ['refactor', 'improve', 'optimize'],
    plan: {
      title: 'Refactor State Management',
      steps: [
        {
          id: 1,
          title: 'Create Zustand store',
          description: 'Set up centralized state management',
          files: ['src/store/appStore.js'],
          changes: '+45 lines'
        },
        {
          id: 2,
          title: 'Remove prop drilling',
          description: 'Replace props with store hooks in 5 components',
          files: [
            'src/components/Header.jsx',
            'src/components/Sidebar.jsx',
            'src/components/Dashboard.jsx',
            'src/components/Settings.jsx',
            'src/components/Profile.jsx'
          ],
          changes: '+28 lines, -67 lines'
        },
        {
          id: 3,
          title: 'Update tests',
          description: 'Modify tests to work with new store',
          files: ['src/**/*.test.jsx'],
          changes: '+15 lines, -8 lines'
        }
      ],
      filesChanged: 7,
      linesAdded: 88,
      linesRemoved: 75,
      risks: [
        'Components may need re-testing',
        'Possible performance impact during migration'
      ],
      estimatedTime: '20 minutes'
    }
  }
];

// Mock responses for Act mode
const actModeTemplates = [
  {
    keywords: ['button', 'component'],
    result: {
      title: 'Button Component Created',
      files: [
        {
          path: 'src/components/Button.jsx',
          action: 'created',
          diff: `+import React from 'react';
+import './Button.css';
+
+const Button = ({
+  children,
+  onClick,
+  variant = 'primary',
+  disabled = false
+}) => {
+  return (
+    <button
+      className={\`btn btn-\${variant}\`}
+      onClick={onClick}
+      disabled={disabled}
+    >
+      {children}
+    </button>
+  );
+};
+
+export default Button;`
        },
        {
          path: 'src/components/Button.css',
          action: 'created',
          diff: `+.btn {
+  padding: 10px 20px;
+  border: none;
+  border-radius: 6px;
+  font-weight: 600;
+  cursor: pointer;
+  transition: all 0.2s ease;
+}
+
+.btn-primary {
+  background: #2196F3;
+  color: white;
+}
+
+.btn-primary:hover {
+  background: #1976D2;
+}
+
+.btn:disabled {
+  opacity: 0.5;
+  cursor: not-allowed;
+}`
        },
        {
          path: 'src/App.jsx',
          action: 'modified',
          diff: `@@ -2,6 +2,7 @@
 import React from 'react';
+import Button from './components/Button';

 function App() {
   return (
     <div>
+      <Button onClick={() => console.log('Clicked!')}>
+        Click Me
+      </Button>
     </div>
   );
 }`
        }
      ],
      filesCreated: 2,
      filesModified: 1,
      linesAdded: 45,
      summary: 'Successfully created a reusable Button component with variants and added it to App.jsx'
    }
  }
];

/**
 * Ask Mode - Returns helpful explanations
 * Now calls real API with context files
 */
export const askMode = async (message, contextFiles = []) => {
  try {
    // Call real cloud API
    const response = await fetch(`${API_URL}/chat/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        context: contextFiles
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API error:', data);
      throw new Error(data.error || 'Failed to get response');
    }

    // Return the markdown response from API
    return data.response;

  } catch (error) {
    console.error('Ask mode error:', error);

    // Fallback to mock response if API unavailable
    await delay(2000);

    const lowerMessage = message.toLowerCase();

    // Find matching response
    const match = askModeResponses.find(template =>
      template.keywords.some(keyword => lowerMessage.includes(keyword))
    );

    if (match) {
      return match.response;
    }

    // Default response
    return `## Great Question!

I understand you're asking about: "${message}"

**Note**: Cloud API is unavailable. This is a fallback mock response.

Let me help you with that. In general:

1. **First**, identify the core problem or concept
2. **Then**, break it down into smaller pieces
3. **Finally**, apply the solution step by step

### Quick Tips:
- Check the official documentation first
- Look for similar examples in your codebase
- Test changes incrementally
- Use console.log for debugging

\`\`\`javascript
// Example debugging approach
console.log('Current state:', data);
console.log('Expected:', expectedValue);
\`\`\`

Would you like me to dive deeper into any specific aspect?`;
  }
};

/**
 * Plan Mode - Returns structured plan
 */
export const planMode = async (message) => {
  await delay(2500);

  const lowerMessage = message.toLowerCase();

  // Find matching plan template
  const match = planModeTemplates.find(template =>
    template.keywords.some(keyword => lowerMessage.includes(keyword))
  );

  if (match) {
    return match.plan;
  }

  // Default plan
  return {
    title: 'Implementation Plan',
    steps: [
      {
        id: 1,
        title: 'Analyze requirements',
        description: 'Review the request and identify all necessary changes',
        files: [],
        changes: 'Analysis phase'
      },
      {
        id: 2,
        title: 'Implement changes',
        description: 'Create or modify files according to requirements',
        files: ['src/components/Feature.jsx', 'src/utils/helpers.js'],
        changes: '+35 lines, -5 lines'
      },
      {
        id: 3,
        title: 'Add tests',
        description: 'Write unit tests for new functionality',
        files: ['src/components/Feature.test.jsx'],
        changes: '+22 lines'
      },
      {
        id: 4,
        title: 'Update documentation',
        description: 'Document the new feature',
        files: ['README.md'],
        changes: '+10 lines'
      }
    ],
    filesChanged: 4,
    linesAdded: 67,
    linesRemoved: 5,
    risks: [
      'May require additional dependencies',
      'Potential impact on existing features'
    ],
    estimatedTime: '15 minutes'
  };
};

/**
 * Act Mode - Returns patch bundle structure
 */
export const actMode = async (message) => {
  await delay(3000);

  const lowerMessage = message.toLowerCase();

  // Find matching act template
  const match = actModeTemplates.find(template =>
    template.keywords.some(keyword => lowerMessage.includes(keyword))
  );

  if (match) {
    return match.result;
  }

  // Default act result
  return {
    title: 'Changes Applied',
    files: [
      {
        path: 'src/feature/NewFeature.jsx',
        action: 'created',
        diff: `+import React, { useState } from 'react';
+
+const NewFeature = () => {
+  const [value, setValue] = useState('');
+
+  return (
+    <div className="new-feature">
+      <h2>New Feature</h2>
+      <input
+        value={value}
+        onChange={(e) => setValue(e.target.value)}
+      />
+    </div>
+  );
+};
+
+export default NewFeature;`
      },
      {
        path: 'src/App.jsx',
        action: 'modified',
        diff: `@@ -1,5 +1,6 @@
 import React from 'react';
+import NewFeature from './feature/NewFeature';

 function App() {
   return (
     <div className="app">
+      <NewFeature />
     </div>
   );
 }`
      }
    ],
    filesCreated: 1,
    filesModified: 1,
    linesAdded: 28,
    summary: 'Successfully implemented the requested feature and integrated it into the application'
  };
};
