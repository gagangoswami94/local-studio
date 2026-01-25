import { create } from 'zustand';

const STORAGE_KEY = 'local-studio-panel-state';

// Load initial state from localStorage
const loadState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.warn('Failed to load panel state:', err);
  }
  return {
    bottomPanelOpen: true,
    bottomPanelHeight: 200,
    activeBottomTab: 'terminal'
  };
};

// Save state to localStorage
const saveState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      bottomPanelOpen: state.bottomPanelOpen,
      bottomPanelHeight: state.bottomPanelHeight,
      activeBottomTab: state.activeBottomTab
    }));
  } catch (err) {
    console.warn('Failed to save panel state:', err);
  }
};

const usePanelStore = create((set) => ({
  ...loadState(),

  toggleBottomPanel: () => set((state) => {
    const newState = { bottomPanelOpen: !state.bottomPanelOpen };
    saveState({ ...state, ...newState });
    return newState;
  }),

  setBottomPanelHeight: (height) => set((state) => {
    const newState = { bottomPanelHeight: height };
    saveState({ ...state, ...newState });
    return newState;
  }),

  setActiveBottomTab: (tab) => set((state) => {
    const newState = { activeBottomTab: tab };
    saveState({ ...state, ...newState });
    return newState;
  }),

  openBottomPanel: (tab) => set((state) => {
    const newState = {
      bottomPanelOpen: true,
      activeBottomTab: tab || state.activeBottomTab
    };
    saveState({ ...state, ...newState });
    return newState;
  }),

  closeBottomPanel: () => set((state) => {
    const newState = { bottomPanelOpen: false };
    saveState({ ...state, ...newState });
    return newState;
  })
}));

export default usePanelStore;
