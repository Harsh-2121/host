-- GizmoChat Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    username VARCHAR(50) UNIQUE,
    status VARCHAR(20) DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_username ON users(username);

-- Rooms (Chat channels)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'group', -- 'dm', 'group', 'channel'
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    password_hash VARCHAR(255),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rooms_type ON rooms(type);
CREATE INDEX idx_rooms_owner ON rooms(owner_id);

-- Room members
CREATE TABLE IF NOT EXISTS room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'moderator', 'member'
    is_muted BOOLEAN DEFAULT false,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_read_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

CREATE INDEX idx_room_members_room ON room_members(room_id);
CREATE INDEX idx_room_members_user ON room_members(user_id);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'file', 'code', 'system'
    metadata JSONB,
    edited_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_room ON messages(room_id, created_at DESC);
CREATE INDEX idx_messages_user ON messages(user_id);

-- Direct message threads (for 1-on-1 chats)
CREATE TABLE IF NOT EXISTS dm_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user1_id, user2_id),
    CHECK (user1_id < user2_id) -- Ensures consistent ordering
);

CREATE INDEX idx_dm_threads_users ON dm_threads(user1_id, user2_id);

-- Board cards (for multiplayer boards)
CREATE TABLE IF NOT EXISTS board_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'video', 'code'
    content TEXT NOT NULL,
    x INTEGER NOT NULL DEFAULT 0,
    y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 260,
    height INTEGER NOT NULL DEFAULT 160,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_board_cards_room ON board_cards(room_id);
CREATE INDEX idx_board_cards_user ON board_cards(user_id);

-- User reactions to messages
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON message_reactions(message_id);

-- User presence/activity
CREATE TABLE IF NOT EXISTS user_presence (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'offline', -- 'online', 'away', 'busy', 'offline'
    custom_status TEXT,
    last_activity TIMESTAMP DEFAULT NOW(),
    socket_id VARCHAR(255)
);

-- File uploads metadata
CREATE TABLE IF NOT EXISTS file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_files_message ON file_uploads(message_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    content TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'dark',
    notifications_enabled BOOLEAN DEFAULT true,
    sound_enabled BOOLEAN DEFAULT true,
    preferences JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER board_cards_updated_at BEFORE UPDATE ON board_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert default public room
INSERT INTO rooms (id, name, type, description, is_public, owner_id)
VALUES (
    'public-room-1',
    'General',
    'channel',
    'Public room for all users',
    true,
    NULL
) ON CONFLICT DO NOTHING;
