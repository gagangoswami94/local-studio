import React, { useState } from 'react';
import DiffReviewModal from './DiffReviewModal';

/**
 * Example/Demo Component for DiffReviewModal
 * Use this to test the modal with mock data
 *
 * Usage:
 * import DiffReviewModalExample from './components/DiffReviewModal.example';
 * <DiffReviewModalExample />
 */

// Mock bundle data
const mockBundle = {
  bundle_id: 'bundle_demo_123',
  bundle_type: 'full',
  created_at: new Date().toISOString(),

  // Regular files
  files: [
    {
      path: 'src/components/UserAuth.jsx',
      content: `import React, { useState } from 'react';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default function UserAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate JWT token
    const token = jwt.sign({ email }, 'secret-key', { expiresIn: '1h' });

    console.log('Login successful:', { email, token });
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}`,
      oldContent: '',
      action: 'create',
      description: 'User authentication component with JWT and bcrypt',
      layer: 'application'
    },

    {
      path: 'src/api/auth.js',
      content: `const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({ email, passwordHash });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;`,
      oldContent: '',
      action: 'create',
      description: 'Authentication API endpoints',
      layer: 'api'
    },

    {
      path: 'src/middleware/auth.js',
      content: `const jwt = require('jsonwebtoken');

/**
 * Authentication middleware
 * Verifies JWT token in Authorization header
 */
function authMiddleware(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add user to request
    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = authMiddleware;`,
      oldContent: '',
      action: 'create',
      description: 'JWT authentication middleware',
      layer: 'middleware'
    },

    {
      path: 'src/models/User.js',
      content: `const { Model, DataTypes } = require('sequelize');
const sequelize = require('../database');

class User extends Model {}

User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true
});

module.exports = User;`,
      oldContent: '',
      action: 'create',
      description: 'User model with Sequelize',
      layer: 'model'
    },

    {
      path: 'package.json',
      content: `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "sequelize": "^6.35.0",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.1.2"
  }
}`,
      oldContent: `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}`,
      action: 'update',
      description: 'Add authentication dependencies',
      layer: 'config'
    },

    {
      path: '.env.example',
      content: `# Database
DATABASE_URL=postgresql://user:password@localhost:5432/myapp

# JWT
JWT_SECRET=your-secret-key-here-change-in-production

# Server
PORT=3000
NODE_ENV=development`,
      oldContent: `# Server
PORT=3000
NODE_ENV=development`,
      action: 'update',
      description: 'Add JWT and database configuration',
      layer: 'config'
    }
  ],

  // Test files
  tests: [
    {
      path: 'src/components/UserAuth.test.jsx',
      content: `import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UserAuth from './UserAuth';

describe('UserAuth', () => {
  it('renders login form', () => {
    render(<UserAuth />);

    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('handles input changes', () => {
    render(<UserAuth />);

    const emailInput = screen.getByPlaceholderText('Email');
    const passwordInput = screen.getByPlaceholderText('Password');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  it('handles login submission', async () => {
    const consoleSpy = vi.spyOn(console, 'log');

    render(<UserAuth />);

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' }
    });

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Login successful:',
        expect.objectContaining({ email: 'test@example.com' })
      );
    });
  });
});`,
      sourceFile: 'src/components/UserAuth.jsx',
      framework: 'vitest'
    },

    {
      path: 'src/api/auth.test.js',
      content: `const request = require('supertest');
const { describe, it, expect, beforeEach } = require('vitest');
const app = require('../app');
const { User } = require('../models');

describe('Auth API', () => {
  beforeEach(async () => {
    // Clear database
    await User.destroy({ where: {} });
  });

  describe('POST /api/auth/register', () => {
    it('creates new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User created successfully');
    });

    it('rejects duplicate email', async () => {
      // Create user
      await User.create({
        email: 'test@example.com',
        passwordHash: 'hash'
      });

      // Try to create again
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns token for valid credentials', async () => {
      // Create user
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash('password123', 10);

      await User.create({
        email: 'test@example.com',
        passwordHash
      });

      // Login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('rejects invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });
});`,
      sourceFile: 'src/api/auth.js',
      framework: 'vitest'
    }
  ],

  // Migrations
  migrations: [
    {
      id: 'migration_001_create_users_table',
      description: 'Create users table with email and password fields',
      sql_forward: `CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);`,
      sql_reverse: `DROP INDEX IF EXISTS idx_users_email;
DROP TABLE IF EXISTS users;`,
      dataLossRisk: 'none',
      database: 'postgresql'
    },

    {
      id: 'migration_002_add_user_roles',
      description: 'Add role and status columns to users table',
      sql_forward: `ALTER TABLE users
  ADD COLUMN role VARCHAR(50) DEFAULT 'user',
  ADD COLUMN status VARCHAR(50) DEFAULT 'active';

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);`,
      sql_reverse: `DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_status;

ALTER TABLE users
  DROP COLUMN role,
  DROP COLUMN status;`,
      dataLossRisk: 'low',
      database: 'postgresql'
    }
  ],

  // Commands
  commands: [
    'npm install bcryptjs jsonwebtoken sequelize pg dotenv'
  ]
};

/**
 * Example Component
 * Demonstrates DiffReviewModal with mock data
 */
const DiffReviewModalExample = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleApply = (fileIndices) => {
    console.log('Applying selected files:', fileIndices);
    console.log('Files to apply:', fileIndices.map(i => mockBundle.files[i].path));

    alert(`Would apply ${fileIndices.length} file(s):\n\n${
      fileIndices.map(i => mockBundle.files[i].path).join('\n')
    }`);

    setIsModalOpen(false);
  };

  const handleApplyAll = () => {
    console.log('Applying all files');

    const summary = `
Would apply:
- ${mockBundle.files.length} file(s)
- ${mockBundle.tests.length} test(s)
- ${mockBundle.migrations.length} migration(s)
- ${mockBundle.commands.length} command(s)

Files:
${mockBundle.files.map(f => `  ${f.action} ${f.path}`).join('\n')}

Migrations:
${mockBundle.migrations.map(m => `  ${m.id}: ${m.description}`).join('\n')}

Commands:
${mockBundle.commands.map(c => `  ${c}`).join('\n')}
    `.trim();

    alert(summary);

    setIsModalOpen(false);
  };

  const handleCancel = () => {
    console.log('Cancelled');
    setIsModalOpen(false);
  };

  return (
    <div style={{ padding: '40px', background: '#1e1e1e', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ color: '#e0e0e0', marginBottom: '16px' }}>
          DiffReviewModal Example
        </h1>

        <p style={{ color: '#a0a0a0', marginBottom: '24px' }}>
          This example demonstrates the DiffReviewModal component with mock bundle data.
        </p>

        <div style={{ marginBottom: '32px', padding: '20px', background: '#252526', borderRadius: '8px' }}>
          <h3 style={{ color: '#e0e0e0', marginBottom: '12px' }}>Mock Bundle Contents:</h3>
          <ul style={{ color: '#a0a0a0', fontSize: '14px', lineHeight: '1.8' }}>
            <li>{mockBundle.files.length} files (5 created, 2 updated)</li>
            <li>{mockBundle.tests.length} test files</li>
            <li>{mockBundle.migrations.length} migrations</li>
            <li>{mockBundle.commands.length} command</li>
          </ul>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '12px 24px',
            background: '#007acc',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Open Diff Review Modal
        </button>

        <DiffReviewModal
          bundle={mockBundle}
          onApply={handleApply}
          onApplyAll={handleApplyAll}
          onCancel={handleCancel}
          isOpen={isModalOpen}
        />
      </div>
    </div>
  );
};

export default DiffReviewModalExample;
