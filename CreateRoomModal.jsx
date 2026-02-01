import { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { roomAPI } from '../services/api';
import { useRoomStore } from '../store';
import toast from 'react-hot-toast';

export default function CreateRoomModal({ onClose }) {
  const queryClient = useQueryClient();
  const { addRoom } = useRoomStore();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'group',
    isPublic: true,
  });

  const createMutation = useMutation({
    mutationFn: (data) => roomAPI.createRoom(data),
    onSuccess: (response) => {
      addRoom(response.data);
      queryClient.invalidateQueries(['rooms']);
      toast.success('Room created successfully!');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create room');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Please enter a room name');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Create Room</h2>
            <button onClick={onClose} className="p-2 hover:bg-dark-panel-2 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Room Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Project Discussion"
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What's this room about?"
                className="input"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Privacy</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.isPublic}
                    onChange={() => setFormData({ ...formData, isPublic: true })}
                    className="text-accent"
                  />
                  <span>Public - Anyone can join</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!formData.isPublic}
                    onChange={() => setFormData({ ...formData, isPublic: false })}
                    className="text-accent"
                  />
                  <span>Private - Invite only</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Room'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
