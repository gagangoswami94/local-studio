import { create } from 'zustand';

/**
 * Problems Store - Manages linting and diagnostic problems
 * Structure: { [filePath]: [problems array] }
 */
const useProblemsStore = create((set, get) => ({
  // State
  problems: {}, // { [filePath]: [{ line, column, endLine, endColumn, message, severity, ruleId, source }] }

  /**
   * Set problems for a specific file
   * @param {string} filePath - File path
   * @param {Array} fileProblems - Array of problem objects
   */
  setProblemsForFile: (filePath, fileProblems) => set((state) => ({
    problems: {
      ...state.problems,
      [filePath]: fileProblems
    }
  })),

  /**
   * Clear problems for a specific file
   * @param {string} filePath - File path
   */
  clearProblemsForFile: (filePath) => set((state) => {
    const newProblems = { ...state.problems };
    delete newProblems[filePath];
    return { problems: newProblems };
  }),

  /**
   * Clear all problems
   */
  clearAllProblems: () => set({ problems: {} }),

  /**
   * Get problems for a specific file
   * @param {string} filePath - File path
   * @returns {Array} Array of problems
   */
  getProblemsForFile: (filePath) => {
    const state = get();
    return state.problems[filePath] || [];
  },

  /**
   * Get total error and warning counts across all files
   * @returns {Object} { errors: number, warnings: number }
   */
  getTotalCounts: () => {
    const state = get();
    let errors = 0;
    let warnings = 0;

    Object.values(state.problems).forEach(fileProblems => {
      fileProblems.forEach(problem => {
        if (problem.severity === 'error') {
          errors++;
        } else if (problem.severity === 'warning') {
          warnings++;
        }
      });
    });

    return { errors, warnings };
  },

  /**
   * Get all files that have problems
   * @returns {Array} Array of file paths
   */
  getFilesWithProblems: () => {
    const state = get();
    return Object.keys(state.problems).filter(
      filePath => state.problems[filePath].length > 0
    );
  },

  /**
   * Get problem count for a specific file
   * @param {string} filePath - File path
   * @returns {Object} { errors: number, warnings: number }
   */
  getCountsForFile: (filePath) => {
    const state = get();
    const fileProblems = state.problems[filePath] || [];

    return fileProblems.reduce((counts, problem) => {
      if (problem.severity === 'error') {
        counts.errors++;
      } else if (problem.severity === 'warning') {
        counts.warnings++;
      }
      return counts;
    }, { errors: 0, warnings: 0 });
  }
}));

export default useProblemsStore;
