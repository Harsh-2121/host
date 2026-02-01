import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Smile, Paperclip, LayoutGrid, Hash, Users } from 'lucide-react';
import { useRoomStore, useMessageStore, useAuthStore, useUIStore } from '../store';
import { roomAPI } from '../services/api';
import socketService from '../services/socket';
import { formatDistanceToNow } from 'date-fns';

export default function ChatArea() {
  const { user } = useAuthStore();
  const { activeRoomId, activeRoom } = useRoomStore();
  const { messages, setMessages, addMessage } = useMessageStore();
  const { setShowBoard } = useUIStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const roomMessages = messages[activeRoomId] || [];

  // Fetch messages when room changes
  const { data: fetchedMessages } = useQuery({
    queryKey: ['messages', activeRoomId],
    queryFn: async () => {
      if (!activeRoomId) return [];
      const { data } = await roomAPI.getMessages(activeRoomId);
      return data;
    },
    enabled: !!activeRoomId,
  });

  useEffect(() => {
    if (fetchedMessages && activeRoomId) {
      setMessages(activeRoomId, fetchedMessages);
    }
  }, [fetchedMessages, activeRoomId, setMessages]);

  // Load board when switching rooms
  useEffect(() => {
    if (activeRoomId) {
      socketService.joinRoom(activeRoomId);
      socketService.loadBoard(activeRoomId);
      socketService.markAsRead(activeRoomId);
    }
  }, [activeRoomId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages]);

  const handleSend = () => {
    if (!input.trim() || !activeRoomId) return;

    socketService.sendMessage(activeRoomId, input.trim());
    setInput('');
    setIsTyping(false);
    socketService.setTyping(activeRoomId, false);
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      socketService.setTyping(activeRoomId, true);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.setTyping(activeRoomId, false);
    }, 1000);
  };

  if (!activeRoomId) {
    return (
      <div className="flex-1 flex items-center justify-center text-dark-muted">
        <div className="text-center">
          <Hash className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-xl">Select a room to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-dark-border flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Hash className="w-6 h-6 text-accent" />
          <div>
            <h2 className="font-bold text-lg">{activeRoom?.name || 'Room'}</h2>
            <p className="text-xs text-dark-muted">
              {activeRoom?.member_count || 0} members
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBoard(true)}
            className="px-4 py-2 bg-dark-panel-2 border border-dark-border hover:border-accent rounded-lg flex items-center gap-2 transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Board</span>
          </button>
          <button className="p-2 hover:bg-dark-panel-2 rounded-lg">
            <Users className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {roomMessages.length === 0 ? (
          <div className="text-center text-dark-muted py-12">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          roomMessages.map((msg, index) => {
            const isOwn = msg.user_id === user?.id;
            const showAvatar = index === 0 || roomMessages[index - 1].user_id !== msg.user_id;
            
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                {showAvatar && !isOwn && (
                  <img
                    src={msg.user_avatar || `https://ui-avatars.com/api/?name=${msg.user_name}&background=random`}
                    alt={msg.user_name}
                    className="w-10 h-10 rounded-full flex-shrink-0"
                  />
                )}
                {!showAvatar && !isOwn && <div className="w-10" />}
                
                <div className={`flex-1 ${isOwn ? 'text-right' : ''}`}>
                  {showAvatar && (
                    <div className={`flex items-baseline gap-2 mb-1 ${isOwn ? 'justify-end' : ''}`}>
                      <span className="font-semibold text-sm">{msg.user_name}</span>
                      <span className="text-xs text-dark-muted">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                  
                  <div
                    className={`inline-block px-4 py-2 rounded-2xl max-w-2xl break-words ${
                      isOwn
                        ? 'bg-accent text-white'
                        : 'bg-dark-panel-2 text-dark-text'
                    }`}
                  >
                    {msg.type === 'code' ? (
                      <pre className="bg-dark-bg p-3 rounded-lg overflow-x-auto">
                        <code>{msg.content}</code>
                      </pre>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-dark-border p-4">
        <div className="flex items-end gap-3">
          <button className="p-2 hover:bg-dark-panel-2 rounded-lg transition-colors">
            <Paperclip className="w-5 h-5 text-dark-muted" />
          </button>
          
          <div className="flex-1 bg-dark-panel-2 border border-dark-border rounded-xl px-4 py-3">
            <textarea
              value={input}
              onChange={handleTyping}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className="w-full bg-transparent outline-none resize-none text-dark-text placeholder:text-dark-muted max-h-32"
              rows={1}
            />
          </div>

          <button className="p-2 hover:bg-dark-panel-2 rounded-lg transition-colors">
            <Smile className="w-5 h-5 text-dark-muted" />
          </button>
          
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="btn-primary px-6"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-xs text-dark-muted mt-2 px-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
