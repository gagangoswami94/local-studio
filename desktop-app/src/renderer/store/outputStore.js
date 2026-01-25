import { create } from 'zustand';

const MAX_LOGS = 1000; // Keep last 1000 logs to prevent memory issues

const useOutputStore = create((set) => ({
  logs: [],
  selectedSource: 'All', // Filter: 'All', 'Build', 'Test', 'Extension', 'AI'

  addLog: (message, level = 'info', source = 'System') => set((state) => {
    const newLog = {
      id: Date.now() + Math.random(), // Unique ID
      timestamp: new Date(),
      level, // 'info', 'warn', 'error'
      message,
      source // 'Build', 'Test', 'Extension', 'AI', 'System'
    };

    const newLogs = [...state.logs, newLog];

    // Keep only last MAX_LOGS entries
    if (newLogs.length > MAX_LOGS) {
      return { logs: newLogs.slice(-MAX_LOGS) };
    }

    return { logs: newLogs };
  }),

  clearLogs: () => set({ logs: [] }),

  setSelectedSource: (source) => set({ selectedSource: source }),

  getFilteredLogs: () => {
    const state = useOutputStore.getState();
    if (state.selectedSource === 'All') {
      return state.logs;
    }
    return state.logs.filter(log => log.source === state.selectedSource);
  }
}));

export default useOutputStore;
