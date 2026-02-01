import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('gizmochat_token'),
  isAuthenticated: !!localStorage.getItem('gizmochat_token'),
  
  setAuth: (user, token) => {
    localStorage.setItem('gizmochat_token', token);
    set({ user, token, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('gizmochat_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export const useRoomStore = create((set, get) => ({
  rooms: [],
  activeRoomId: null,
  activeRoom: null,
  
  setRooms: (rooms) => set({ rooms }),
  
  setActiveRoom: (roomId) => {
    const room = get().rooms.find(r => r.id === roomId);
    set({ activeRoomId: roomId, activeRoom: room });
  },
  
  addRoom: (room) => set((state) => ({
    rooms: [room, ...state.rooms],
  })),
  
  updateRoom: (roomId, updates) => set((state) => ({
    rooms: state.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r),
  })),
}));

export const useMessageStore = create((set) => ({
  messages: {},
  
  setMessages: (roomId, messages) => set((state) => ({
    messages: { ...state.messages, [roomId]: messages },
  })),
  
  addMessage: (roomId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [roomId]: [...(state.messages[roomId] || []), message],
    },
  })),
  
  clearMessages: (roomId) => set((state) => {
    const newMessages = { ...state.messages };
    delete newMessages[roomId];
    return { messages: newMessages };
  }),
}));

export const useBoardStore = create((set) => ({
  cards: {},
  cursors: {},
  
  setCards: (roomId, cards) => set((state) => ({
    cards: { ...state.cards, [roomId]: cards },
  })),
  
  addCard: (roomId, card) => set((state) => ({
    cards: {
      ...state.cards,
      [roomId]: [...(state.cards[roomId] || []), card],
    },
  })),
  
  updateCard: (roomId, cardId, updates) => set((state) => ({
    cards: {
      ...state.cards,
      [roomId]: (state.cards[roomId] || []).map(c => 
        c.id === cardId ? { ...c, ...updates } : c
      ),
    },
  })),
  
  deleteCard: (roomId, cardId) => set((state) => ({
    cards: {
      ...state.cards,
      [roomId]: (state.cards[roomId] || []).filter(c => c.id !== cardId),
    },
  })),
  
  updateCursor: (roomId, userId, position) => set((state) => ({
    cursors: {
      ...state.cursors,
      [roomId]: {
        ...(state.cursors[roomId] || {}),
        [userId]: position,
      },
    },
  })),
  
  removeCursor: (roomId, userId) => set((state) => {
    const newCursors = { ...state.cursors };
    if (newCursors[roomId]) {
      delete newCursors[roomId][userId];
    }
    return { cursors: newCursors };
  }),
}));

export const useUIStore = create((set) => ({
  sidebarCollapsed: false,
  showBoard: false,
  typingUsers: {},
  
  toggleSidebar: () => set((state) => ({
    sidebarCollapsed: !state.sidebarCollapsed,
  })),
  
  setShowBoard: (show) => set({ showBoard: show }),
  
  setUserTyping: (roomId, userId, isTyping) => set((state) => ({
    typingUsers: {
      ...state.typingUsers,
      [roomId]: {
        ...(state.typingUsers[roomId] || {}),
        [userId]: isTyping,
      },
    },
  })),
}));
