import { useEffect, useRef, useState } from 'react';
import { X, Plus, MessageSquare, Maximize2 } from 'lucide-react';
import { useRoomStore, useBoardStore, useAuthStore, useUIStore } from '../store';
import socketService from '../services/socket';

export default function Board() {
  const { user } = useAuthStore();
  const { activeRoomId } = useRoomStore();
  const { cards: allCards, cursors } = useBoardStore();
  const { setShowBoard } = useUIStore();
  
  const cards = allCards[activeRoomId] || [];
  const roomCursors = cursors[activeRoomId] || {};
  
  const boardRef = useRef(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingCard, setDraggingCard] = useState(null);
  const [showCardCreator, setShowCardCreator] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (panning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        setPanStart({ x: e.clientX, y: e.clientY });
      }

      // Send cursor position
      if (activeRoomId && boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - camera.x) / camera.scale;
        const y = (e.clientY - rect.top - camera.y) / camera.scale;
        socketService.updateCursor(activeRoomId, x, y);
      }
    };

    const handleMouseUp = () => {
      setPanning(false);
      setDraggingCard(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panning, panStart, activeRoomId, camera]);

  const handleCreateCard = (type, content) => {
    if (!activeRoomId) return;
    
    socketService.createCard(activeRoomId, {
      type,
      content,
      x: -camera.x / camera.scale + 100,
      y: -camera.y / camera.scale + 100,
      width: 260,
      height: 160,
    });
    
    setShowCardCreator(false);
  };

  return (
    <div className="relative w-full h-full bg-dark-bg overflow-hidden">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-dark-panel/80 backdrop-blur border-b border-dark-border z-10 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <LayoutGrid className="w-5 h-5 text-accent" />
          <h2 className="font-semibold">Collaborative Board</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCardCreator(true)}
            className="btn-primary px-4 py-2 text-sm"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            New Card
          </button>
          <button
            onClick={() => setShowBoard(false)}
            className="btn-secondary px-4 py-2 text-sm"
          >
            <MessageSquare className="w-4 h-4 mr-2 inline" />
            Back to Chat
          </button>
        </div>
      </div>

      {/* Board Canvas */}
      <div
        ref={boardRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          if (e.target === boardRef.current) {
            setPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
          }
        }}
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
            linear-gradient(var(--dark-bg) 1px, transparent 1px),
            linear-gradient(90deg, var(--dark-bg) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
          backgroundPosition: '0 0, 0 0, 0 0',
        }}
      >
        <div
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Cards */}
          {cards.map((card) => (
            <div
              key={card.id}
              className="absolute bg-dark-panel border border-dark-border rounded-xl shadow-lg overflow-hidden"
              style={{
                left: card.x,
                top: card.y,
                width: card.width,
                height: card.height,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setDraggingCard(card.id);
              }}
            >
              <div className="h-10 bg-dark-panel-2 border-b border-dark-border px-3 flex items-center justify-between cursor-move">
                <span className="text-sm font-medium truncate">{card.user_name}</span>
                {card.user_id === user?.id && (
                  <button
                    onClick={() => socketService.deleteCard(activeRoomId, card.id)}
                    className="p-1 hover:bg-danger/20 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="p-3 overflow-auto h-[calc(100%-40px)]">
                {card.type === 'text' ? (
                  <p className="text-sm whitespace-pre-wrap">{card.content}</p>
                ) : card.type === 'image' ? (
                  <img src={card.content} alt="" className="max-w-full rounded" />
                ) : card.type === 'video' ? (
                  <iframe src={card.content} className="w-full h-full rounded" />
                ) : null}
              </div>
            </div>
          ))}

          {/* Other users' cursors */}
          {Object.entries(roomCursors).map(([userId, cursor]) => (
            <div
              key={userId}
              className="absolute pointer-events-none"
              style={{ left: cursor.x, top: cursor.y }}
            >
              <div className="relative">
                <div className="w-4 h-4 bg-accent rounded-full" />
                <span className="absolute left-6 top-0 bg-dark-panel px-2 py-1 rounded text-xs whitespace-nowrap">
                  {cursor.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card Creator Modal */}
      {showCardCreator && (
        <CardCreatorModal
          onClose={() => setShowCardCreator(false)}
          onCreate={handleCreateCard}
        />
      )}
    </div>
  );
}

function CardCreatorModal({ onClose, onCreate }) {
  const [type, setType] = useState('text');
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (!content.trim()) return;
    onCreate(type, content);
    setContent('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">Create Card</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input"
              >
                <option value="text">📝 Text</option>
                <option value="image">🖼️ Image URL</option>
                <option value="video">🎬 Video URL</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={type === 'text' ? 'Enter text...' : 'Enter URL...'}
                className="input"
                rows={6}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleSubmit} className="btn-primary flex-1">
                Create
              </button>
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
