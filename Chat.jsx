import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import Board from '../components/Board';
import { useRoomStore, useMessageStore, useBoardStore, useUIStore, useAuthStore } from '../store';
import { roomAPI } from '../services/api';
import socketService from '../services/socket';
import toast from 'react-hot-toast';

export default function Chat() {
  const { user } = useAuthStore();
  const { rooms, setRooms, activeRoomId, setActiveRoom } = useRoomStore();
  const { addMessage } = useMessageStore();
  const { addCard, updateCard, deleteCard, updateCursor } = useBoardStore();
  const { showBoard } = useUIStore();

  // Fetch user's rooms
  const { data: roomsData } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data } = await roomAPI.getRooms();
      return data;
    },
  });

  useEffect(() => {
    if (roomsData) {
      setRooms(roomsData);
      if (!activeRoomId && roomsData.length > 0) {
        setActiveRoom(roomsData[0].id);
      }
    }
  }, [roomsData, setRooms, activeRoomId, setActiveRoom]);

  // Socket event listeners
  useEffect(() => {
    // Message events
    socketService.on('message:new', (message) => {
      addMessage(message.room_id, message);
      
      // Show notification if not active room
      if (message.room_id !== activeRoomId && message.user_id !== user?.id) {
        toast(`New message from ${message.user_name}`, {
          icon: '💬',
        });
      }
    });

    // Board events
    socketService.on('board:card:created', (card) => {
      addCard(card.room_id, card);
      if (card.user_id !== user?.id) {
        toast(`${card.userName} added a card`, { icon: '📌' });
      }
    });

    socketService.on('board:card:moved', ({ cardId, x, y }) => {
      if (activeRoomId) {
        updateCard(activeRoomId, cardId, { x, y });
      }
    });

    socketService.on('board:card:resized', ({ cardId, width, height }) => {
      if (activeRoomId) {
        updateCard(activeRoomId, cardId, { width, height });
      }
    });

    socketService.on('board:card:deleted', ({ cardId }) => {
      if (activeRoomId) {
        deleteCard(activeRoomId, cardId);
      }
    });

    socketService.on('board:cursor:update', ({ userId, name, x, y }) => {
      if (activeRoomId && userId !== user?.id) {
        updateCursor(activeRoomId, userId, { x, y, name });
      }
    });

    socketService.on('user:presence', ({ userId, name, status }) => {
      console.log(`${name} is now ${status}`);
    });

    socketService.on('user:joined', ({ userId, name }) => {
      toast(`${name} joined`, { icon: '👋' });
    });

    socketService.on('user:left', ({ userId, name }) => {
      toast(`${name} left`, { icon: '👋' });
    });

    return () => {
      socketService.off('message:new');
      socketService.off('board:card:created');
      socketService.off('board:card:moved');
      socketService.off('board:card:resized');
      socketService.off('board:card:deleted');
      socketService.off('board:cursor:update');
      socketService.off('user:presence');
      socketService.off('user:joined');
      socketService.off('user:left');
    };
  }, [activeRoomId, addMessage, addCard, updateCard, deleteCard, updateCursor, user]);

  return (
    <div className="h-screen flex bg-dark-bg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col relative">
        {!showBoard ? (
          <ChatArea />
        ) : (
          <Board />
        )}
      </div>
    </div>
  );
}
