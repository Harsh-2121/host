import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  emit(event, data) {
    if (!this.socket) {
      console.warn('Socket not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  on(event, callback) {
    if (!this.socket) {
      console.warn('Socket not connected');
      return;
    }
    
    this.socket.on(event, callback);
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.socket) return;
    
    this.socket.off(event, callback);
    
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Message methods
  sendMessage(roomId, content, type = 'text', metadata = null) {
    this.emit('message:send', { roomId, content, type, metadata });
  }

  setTyping(roomId, isTyping) {
    this.emit('message:typing', { roomId, isTyping });
  }

  markAsRead(roomId) {
    this.emit('message:read', { roomId });
  }

  // Board methods
  createCard(roomId, card) {
    this.emit('board:card:create', { roomId, ...card });
  }

  moveCard(roomId, cardId, x, y) {
    this.emit('board:card:move', { roomId, cardId, x, y });
  }

  resizeCard(roomId, cardId, width, height) {
    this.emit('board:card:resize', { roomId, cardId, width, height });
  }

  deleteCard(roomId, cardId) {
    this.emit('board:card:delete', { roomId, cardId });
  }

  updateCursor(roomId, x, y) {
    this.emit('board:cursor', { roomId, x, y });
  }

  loadBoard(roomId) {
    this.emit('board:load', { roomId });
  }

  // Room methods
  joinRoom(roomId) {
    this.emit('room:join', { roomId });
  }

  leaveRoom(roomId) {
    this.emit('room:leave', { roomId });
  }
}

export default new SocketService();
