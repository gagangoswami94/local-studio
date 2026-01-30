const fs = require('fs').promises;
const path = require('path');

/**
 * Pattern Detector
 * Detects frameworks, state management, API patterns, and architectural patterns
 */
class PatternDetector {
  constructor(workspacePath, options = {}) {
    this.workspacePath = workspacePath;
    this.options = options;
  }

  /**
   * Detect all patterns in workspace
   * @returns {Object} Detected patterns
   */
  async detectAll() {
    const [frameworks, stateManagement, apiPatterns, buildTools, testingFrameworks] = await Promise.all([
      this.detectFrameworks(),
      this.detectStateManagement(),
      this.detectAPIPatterns(),
      this.detectBuildTools(),
      this.detectTestingFrameworks()
    ]);

    return {
      frameworks,
      stateManagement,
      apiPatterns,
      buildTools,
      testingFrameworks,
      summary: this._generateSummary({ frameworks, stateManagement, apiPatterns, buildTools, testingFrameworks })
    };
  }

  /**
   * Detect frameworks from package.json and file patterns
   * @returns {Object} Detected frameworks
   */
  async detectFrameworks() {
    const packageJson = await this._readPackageJson();
    const detected = {
      frontend: [],
      backend: [],
      fullstack: []
    };

    if (!packageJson) {
      return detected;
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Frontend frameworks
    if (allDeps.react) {
      detected.frontend.push({
        name: 'React',
        version: allDeps.react,
        type: 'ui-library'
      });
    }
    if (allDeps.vue) {
      detected.frontend.push({
        name: 'Vue',
        version: allDeps.vue,
        type: 'framework'
      });
    }
    if (allDeps['@angular/core']) {
      detected.frontend.push({
        name: 'Angular',
        version: allDeps['@angular/core'],
        type: 'framework'
      });
    }
    if (allDeps.svelte) {
      detected.frontend.push({
        name: 'Svelte',
        version: allDeps.svelte,
        type: 'framework'
      });
    }

    // Fullstack frameworks
    if (allDeps.next) {
      detected.fullstack.push({
        name: 'Next.js',
        version: allDeps.next,
        type: 'framework',
        features: ['ssr', 'routing', 'api-routes']
      });
    }
    if (allDeps.nuxt) {
      detected.fullstack.push({
        name: 'Nuxt',
        version: allDeps.nuxt,
        type: 'framework',
        features: ['ssr', 'routing']
      });
    }
    if (allDeps.gatsby) {
      detected.fullstack.push({
        name: 'Gatsby',
        version: allDeps.gatsby,
        type: 'framework',
        features: ['ssg', 'graphql']
      });
    }

    // Backend frameworks
    if (allDeps.express) {
      detected.backend.push({
        name: 'Express',
        version: allDeps.express,
        type: 'framework'
      });
    }
    if (allDeps.fastify) {
      detected.backend.push({
        name: 'Fastify',
        version: allDeps.fastify,
        type: 'framework'
      });
    }
    if (allDeps.koa) {
      detected.backend.push({
        name: 'Koa',
        version: allDeps.koa,
        type: 'framework'
      });
    }
    if (allDeps['@nestjs/core']) {
      detected.backend.push({
        name: 'NestJS',
        version: allDeps['@nestjs/core'],
        type: 'framework',
        features: ['typescript', 'decorators', 'di']
      });
    }

    // Check for Python frameworks
    const pythonFrameworks = await this._detectPythonFrameworks();
    detected.backend.push(...pythonFrameworks);

    return detected;
  }

  /**
   * Detect state management libraries
   * @returns {Object} State management patterns
   */
  async detectStateManagement() {
    const packageJson = await this._readPackageJson();
    const detected = [];

    if (!packageJson) {
      return detected;
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Redux ecosystem
    if (allDeps.redux) {
      detected.push({
        name: 'Redux',
        version: allDeps.redux,
        ecosystem: []
      });

      if (allDeps['@reduxjs/toolkit']) {
        detected[detected.length - 1].ecosystem.push('Redux Toolkit');
      }
      if (allDeps['redux-saga']) {
        detected[detected.length - 1].ecosystem.push('Redux Saga');
      }
      if (allDeps['redux-thunk']) {
        detected[detected.length - 1].ecosystem.push('Redux Thunk');
      }
    }

    // Zustand
    if (allDeps.zustand) {
      detected.push({
        name: 'Zustand',
        version: allDeps.zustand,
        type: 'lightweight'
      });
    }

    // MobX
    if (allDeps.mobx) {
      detected.push({
        name: 'MobX',
        version: allDeps.mobx,
        type: 'reactive'
      });
    }

    // Recoil
    if (allDeps.recoil) {
      detected.push({
        name: 'Recoil',
        version: allDeps.recoil,
        type: 'atomic'
      });
    }

    // Jotai
    if (allDeps.jotai) {
      detected.push({
        name: 'Jotai',
        version: allDeps.jotai,
        type: 'atomic'
      });
    }

    // Valtio
    if (allDeps.valtio) {
      detected.push({
        name: 'Valtio',
        version: allDeps.valtio,
        type: 'proxy-based'
      });
    }

    // React Query / TanStack Query
    if (allDeps['@tanstack/react-query'] || allDeps['react-query']) {
      detected.push({
        name: 'TanStack Query',
        version: allDeps['@tanstack/react-query'] || allDeps['react-query'],
        type: 'server-state'
      });
    }

    // SWR
    if (allDeps.swr) {
      detected.push({
        name: 'SWR',
        version: allDeps.swr,
        type: 'server-state'
      });
    }

    // Detect Context API usage
    const contextUsage = await this._detectContextAPI();
    if (contextUsage.found) {
      detected.push({
        name: 'React Context',
        type: 'built-in',
        files: contextUsage.files
      });
    }

    return detected;
  }

  /**
   * Detect API patterns
   * @returns {Object} API patterns
   */
  async detectAPIPatterns() {
    const packageJson = await this._readPackageJson();
    const detected = {
      rest: false,
      graphql: false,
      trpc: false,
      grpc: false,
      websockets: false,
      details: []
    };

    if (!packageJson) {
      return detected;
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // REST
    if (allDeps.axios || allDeps.fetch || allDeps.express) {
      detected.rest = true;
      detected.details.push({
        type: 'REST',
        libraries: [
          allDeps.axios && 'axios',
          allDeps.express && 'express'
        ].filter(Boolean)
      });
    }

    // GraphQL
    if (allDeps.graphql || allDeps['@apollo/client'] || allDeps['apollo-server']) {
      detected.graphql = true;
      detected.details.push({
        type: 'GraphQL',
        libraries: [
          allDeps['@apollo/client'] && 'Apollo Client',
          allDeps['apollo-server'] && 'Apollo Server',
          allDeps.graphql && 'graphql'
        ].filter(Boolean)
      });
    }

    // tRPC
    if (allDeps['@trpc/client'] || allDeps['@trpc/server']) {
      detected.trpc = true;
      detected.details.push({
        type: 'tRPC',
        libraries: ['tRPC'],
        features: ['type-safety', 'rpc']
      });
    }

    // gRPC
    if (allDeps['@grpc/grpc-js'] || allDeps['grpc']) {
      detected.grpc = true;
      detected.details.push({
        type: 'gRPC',
        libraries: ['gRPC']
      });
    }

    // WebSockets
    if (allDeps['socket.io'] || allDeps['ws'] || allDeps['socket.io-client']) {
      detected.websockets = true;
      detected.details.push({
        type: 'WebSockets',
        libraries: [
          allDeps['socket.io'] && 'Socket.IO',
          allDeps['ws'] && 'ws'
        ].filter(Boolean)
      });
    }

    return detected;
  }

  /**
   * Detect build tools
   * @returns {Array} Build tools
   */
  async detectBuildTools() {
    const packageJson = await this._readPackageJson();
    const detected = [];

    if (!packageJson) {
      return detected;
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    if (allDeps.webpack) {
      detected.push({ name: 'Webpack', version: allDeps.webpack });
    }
    if (allDeps.vite) {
      detected.push({ name: 'Vite', version: allDeps.vite });
    }
    if (allDeps.rollup) {
      detected.push({ name: 'Rollup', version: allDeps.rollup });
    }
    if (allDeps.parcel) {
      detected.push({ name: 'Parcel', version: allDeps.parcel });
    }
    if (allDeps.esbuild) {
      detected.push({ name: 'esbuild', version: allDeps.esbuild });
    }
    if (allDeps.turbopack) {
      detected.push({ name: 'Turbopack', version: allDeps.turbopack });
    }

    return detected;
  }

  /**
   * Detect testing frameworks
   * @returns {Array} Testing frameworks
   */
  async detectTestingFrameworks() {
    const packageJson = await this._readPackageJson();
    const detected = [];

    if (!packageJson) {
      return detected;
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    if (allDeps.jest) {
      detected.push({
        name: 'Jest',
        version: allDeps.jest,
        type: 'unit'
      });
    }
    if (allDeps.vitest) {
      detected.push({
        name: 'Vitest',
        version: allDeps.vitest,
        type: 'unit'
      });
    }
    if (allDeps.mocha) {
      detected.push({
        name: 'Mocha',
        version: allDeps.mocha,
        type: 'unit'
      });
    }
    if (allDeps['@testing-library/react']) {
      detected.push({
        name: 'React Testing Library',
        version: allDeps['@testing-library/react'],
        type: 'component'
      });
    }
    if (allDeps.cypress) {
      detected.push({
        name: 'Cypress',
        version: allDeps.cypress,
        type: 'e2e'
      });
    }
    if (allDeps.playwright) {
      detected.push({
        name: 'Playwright',
        version: allDeps.playwright,
        type: 'e2e'
      });
    }

    return detected;
  }

  /**
   * Read package.json
   * @private
   */
  async _readPackageJson() {
    try {
      const packagePath = path.join(this.workspacePath, 'package.json');
      const content = await fs.readFile(packagePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect Python frameworks from requirements.txt or setup.py
   * @private
   */
  async _detectPythonFrameworks() {
    const frameworks = [];

    try {
      // Check requirements.txt
      const requirementsPath = path.join(this.workspacePath, 'requirements.txt');
      const requirements = await fs.readFile(requirementsPath, 'utf8');

      if (requirements.includes('django')) {
        frameworks.push({ name: 'Django', type: 'framework' });
      }
      if (requirements.includes('flask')) {
        frameworks.push({ name: 'Flask', type: 'framework' });
      }
      if (requirements.includes('fastapi')) {
        frameworks.push({ name: 'FastAPI', type: 'framework' });
      }
    } catch (error) {
      // requirements.txt doesn't exist
    }

    return frameworks;
  }

  /**
   * Detect React Context API usage
   * @private
   */
  async _detectContextAPI() {
    try {
      // Look for Context creation patterns
      const { execSync } = require('child_process');
      const grepCommand = `grep -r "createContext\\|useContext" "${this.workspacePath}" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l`;

      const result = execSync(grepCommand, { encoding: 'utf8' });
      const count = parseInt(result.trim(), 10);

      return {
        found: count > 0,
        files: count
      };
    } catch (error) {
      return { found: false, files: 0 };
    }
  }

  /**
   * Generate summary of detected patterns
   * @private
   */
  _generateSummary(patterns) {
    const summary = [];

    // Frontend
    if (patterns.frameworks.frontend.length > 0) {
      summary.push(`Frontend: ${patterns.frameworks.frontend.map(f => f.name).join(', ')}`);
    }

    // Backend
    if (patterns.frameworks.backend.length > 0) {
      summary.push(`Backend: ${patterns.frameworks.backend.map(f => f.name).join(', ')}`);
    }

    // Fullstack
    if (patterns.frameworks.fullstack.length > 0) {
      summary.push(`Fullstack: ${patterns.frameworks.fullstack.map(f => f.name).join(', ')}`);
    }

    // State management
    if (patterns.stateManagement.length > 0) {
      summary.push(`State: ${patterns.stateManagement.map(s => s.name).join(', ')}`);
    }

    // API
    const apiTypes = [];
    if (patterns.apiPatterns.rest) apiTypes.push('REST');
    if (patterns.apiPatterns.graphql) apiTypes.push('GraphQL');
    if (patterns.apiPatterns.trpc) apiTypes.push('tRPC');
    if (patterns.apiPatterns.grpc) apiTypes.push('gRPC');
    if (patterns.apiPatterns.websockets) apiTypes.push('WebSockets');
    if (apiTypes.length > 0) {
      summary.push(`API: ${apiTypes.join(', ')}`);
    }

    return summary.join(' | ');
  }
}

module.exports = PatternDetector;
