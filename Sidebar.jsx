import { useState } from 'react';
import { Hash, Plus, LogOut, Settings, Search, Users, MessageSquare } from 'lucide-react';
import { useRoomStore, useAuthStore, useUIStore } from '../store';
import CreateRoomModal from './CreateRoomModal';

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { rooms, activeRoomId, setActiveRoom } = useRoomStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className={`bg-dark-panel border-r border-dark-border flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
        {/* Header */}
        <div className="h-16 border-b border-dark-border flex items-center justify-between px-4">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-bold text-lg">GizmoChat</h1>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-dark-panel-2 rounded-lg transition-colors"
          >
            <Hash className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        {!sidebarCollapsed && (
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 text-sm"
              />
            </div>
          </div>
        )}

        {/* Rooms List */}
        <div className="flex-1 overflow-y-auto p-2">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-dark-muted uppercase">
              <span>Rooms</span>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-1 hover:bg-dark-panel-2 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <div className="space-y-1">
            {filteredRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setActiveRoom(room.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeRoomId === room.id
                    ? 'bg-accent text-white'
                    : 'hover:bg-dark-panel-2 text-dark-text'
                }`}
                title={sidebarCollapsed ? room.name : undefined}
              >
                <Hash className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{room.name}</span>
                    {room.unread_count > 0 && (
                      <span className="px-2 py-0.5 bg-danger text-white text-xs rounded-full">
                        {room.unread_count}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* User Profile */}
        <div className="border-t border-dark-border p-3">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <img
              src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.name}&background=3b82f6&color=fff`}
              alt={user?.name}
              className="w-10 h-10 rounded-full"
            />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user?.name}</p>
                <p className="text-xs text-dark-muted truncate">{user?.email}</p>
              </div>
            )}
          </div>
          
          {!sidebarCollapsed && (
            <div className="flex gap-2 mt-3">
              <button className="flex-1 btn-secondary text-sm py-2">
                <Settings className="w-4 h-4 inline mr-1" />
                Settings
              </button>
              <button 
                onClick={logout}
                className="flex-1 btn-secondary text-sm py-2 hover:text-danger"
              >
                <LogOut className="w-4 h-4 inline mr-1" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateRoomModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
}
