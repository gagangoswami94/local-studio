import { create } from 'zustand';
import Fuse from 'fuse.js';

/**
 * Command Store - Manages command palette commands
 */
const useCommandStore = create((set, get) => ({
  // State
  commands: [],
  isPaletteOpen: false,

  /**
   * Register a command
   * @param {Object} command - {id, label, action, category, keybinding}
   */
  registerCommand: (command) => set((state) => {
    // Check if command already exists
    const exists = state.commands.find(cmd => cmd.id === command.id);
    if (exists) {
      console.warn(`Command ${command.id} already registered`);
      return state;
    }

    return {
      commands: [...state.commands, command]
    };
  }),

  /**
   * Register multiple commands
   * @param {Array} commands - Array of command objects
   */
  registerCommands: (commands) => set((state) => {
    const existingIds = new Set(state.commands.map(cmd => cmd.id));
    const newCommands = commands.filter(cmd => !existingIds.has(cmd.id));

    return {
      commands: [...state.commands, ...newCommands]
    };
  }),

  /**
   * Unregister a command
   * @param {string} commandId - Command ID to remove
   */
  unregisterCommand: (commandId) => set((state) => ({
    commands: state.commands.filter(cmd => cmd.id !== commandId)
  })),

  /**
   * Search commands using fuzzy search
   * @param {string} query - Search query
   * @returns {Array} Filtered commands
   */
  searchCommands: (query) => {
    const { commands } = get();

    if (!query.trim()) {
      return commands;
    }

    const fuse = new Fuse(commands, {
      keys: [
        { name: 'label', weight: 0.7 },
        { name: 'category', weight: 0.3 }
      ],
      threshold: 0.4,
      includeScore: true
    });

    const results = fuse.search(query);
    return results.map(result => result.item);
  },

  /**
   * Get command by ID
   * @param {string} commandId - Command ID
   * @returns {Object|null} Command object
   */
  getCommand: (commandId) => {
    const { commands } = get();
    return commands.find(cmd => cmd.id === commandId) || null;
  },

  /**
   * Execute a command
   * @param {string} commandId - Command ID to execute
   */
  executeCommand: (commandId) => {
    const command = get().getCommand(commandId);
    if (command && command.action) {
      try {
        command.action();
      } catch (error) {
        console.error(`Error executing command ${commandId}:`, error);
      }
    }
  },

  /**
   * Open command palette
   */
  openPalette: () => set({ isPaletteOpen: true }),

  /**
   * Close command palette
   */
  closePalette: () => set({ isPaletteOpen: false }),

  /**
   * Toggle command palette
   */
  togglePalette: () => set((state) => ({ isPaletteOpen: !state.isPaletteOpen }))
}));

export default useCommandStore;
