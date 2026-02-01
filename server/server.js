import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { query } from './db.js';
import { authenticateGoogle, verifyJWT } from './auth.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [process.env.CLIENT_URL, process.env.PRODUCTION_URL],
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: [process.env.CLIENT_URL, process.env.PRODUCTION_URL],
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// In-memory store for active users and rooms
const activeUsers = new Map(); // socketId -> user data
const userSockets = new Map(); // userId -> Set of socketIds
const roomUsers = new Map(); // roomId -> Set of userIds

// ==================== REST API ROUTES ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Google OAuth login
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    const { user, token: jwtToken } = await authenticateGoogle(token);
    res.json({ user, token: jwtToken });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Get user profile
app.get('/api/users/me', authenticateUser, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, avatar_url, username, status FROM users WHERE id = $1',
      [req.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get user's rooms
app.get('/api/rooms', authenticateUser, async (req, res) => {
  try {
    const result = await query(
      `SELECT r.*, rm.role, rm.last_read_at,
        (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count,
        (SELECT COUNT(*) FROM messages WHERE room_id = r.id AND created_at > rm.last_read_at) as unread_count
       FROM rooms r
       JOIN room_members rm ON r.id = rm.room_id
       WHERE rm.user_id = $1
       ORDER BY r.updated_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Create a new room
app.post('/api/rooms', authenticateUser, async (req, res) => {
  try {
    const { name, type, description, isPublic, memberIds } = req.body;
    
    const result = await query(
      `INSERT INTO rooms (name, type, description, is_public, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, type || 'group', description, isPublic !== false, req.userId]
    );
    
    const room = result.rows[0];
    
    // Add creator as admin
    await query(
      `INSERT INTO room_members (room_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [room.id, req.userId]
    );
    
    // Add other members if provided
    if (memberIds && memberIds.length > 0) {
      for (const memberId of memberIds) {
        await query(
          `INSERT INTO room_members (room_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [room.id, memberId]
        );
      }
    }
    
    res.json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get room messages
app.get('/api/rooms/:roomId/messages', authenticateUser, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;
    
    // Verify user is a member
    const memberCheck = await query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, req.userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }
    
    let queryText = `
      SELECT m.*, u.name as user_name, u.avatar_url as user_avatar
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.room_id = $1 AND m.deleted_at IS NULL
    `;
    
    const params = [roomId];
    
    if (before) {
      queryText += ' AND m.created_at < $2';
      params.push(before);
    }
    
    queryText += ' ORDER BY m.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await query(queryText, params);
    
    // Update last read timestamp
    await query(
      'UPDATE room_members SET last_read_at = NOW() WHERE room_id = $1 AND user_id = $2',
      [roomId, req.userId]
    );
    
    res.json(result.rows.reverse());
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Search users
app.get('/api/users/search', authenticateUser, async (req, res) => {
  try {
    const { q } = req.query;
    const result = await query(
      `SELECT id, name, email, username, avatar_url, status
       FROM users
       WHERE (name ILIKE $1 OR email ILIKE $1 OR username ILIKE $1)
       AND id != $2
       LIMIT 20`,
      [`%${q}%`, req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Create or get DM thread
app.post('/api/dm/create', authenticateUser, async (req, res) => {
  try {
    const { userId: otherUserId } = req.body;
    const user1 = req.userId < otherUserId ? req.userId : otherUserId;
    const user2 = req.userId < otherUserId ? otherUserId : req.userId;
    
    // Check if thread exists
    let result = await query(
      'SELECT * FROM dm_threads WHERE user1_id = $1 AND user2_id = $2',
      [user1, user2]
    );
    
    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    }
    
    // Create new DM room and thread
    const roomResult = await query(
      `INSERT INTO rooms (name, type, is_public)
       VALUES ($1, 'dm', false)
       RETURNING *`,
      ['Direct Message']
    );
    
    const room = roomResult.rows[0];
    
    // Add both users as members
    await query(
      `INSERT INTO room_members (room_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [room.id, user1, user2]
    );
    
    // Create thread record
    result = await query(
      `INSERT INTO dm_threads (user1_id, user2_id, room_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user1, user2, room.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create DM error:', error);
    res.status(500).json({ error: 'Failed to create DM' });
  }
});

// Middleware to authenticate API requests
function authenticateUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = verifyJWT(token);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ==================== SOCKET.IO REAL-TIME ====================

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  try {
    const decoded = verifyJWT(token);
    socket.userId = decoded.userId;
    socket.userName = decoded.name;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.userName} (${socket.userId})`);
  
  // Store active user
  activeUsers.set(socket.id, {
    userId: socket.userId,
    name: socket.userName,
    socketId: socket.id
  });
  
  if (!userSockets.has(socket.userId)) {
    userSockets.set(socket.userId, new Set());
  }
  userSockets.get(socket.userId).add(socket.id);
  
  // Update user status
  await query(
    `INSERT INTO user_presence (user_id, status, last_activity, socket_id)
     VALUES ($1, 'online', NOW(), $2)
     ON CONFLICT (user_id) 
     DO UPDATE SET status = 'online', last_activity = NOW(), socket_id = $2`,
    [socket.userId, socket.id]
  );
  
  // Join user's rooms
  const rooms = await query(
    'SELECT room_id FROM room_members WHERE user_id = $1',
    [socket.userId]
  );
  
  for (const row of rooms.rows) {
    socket.join(row.room_id);
    
    if (!roomUsers.has(row.room_id)) {
      roomUsers.set(row.room_id, new Set());
    }
    roomUsers.get(row.room_id).add(socket.userId);
    
    // Notify room of user joining
    io.to(row.room_id).emit('user:presence', {
      userId: socket.userId,
      name: socket.userName,
      status: 'online'
    });
  }
  
  // ===== CHAT EVENTS =====
  
  socket.on('message:send', async (data) => {
    try {
      const { roomId, content, type = 'text', metadata } = data;
      
      // Verify membership
      const memberCheck = await query(
        'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
        [roomId, socket.userId]
      );
      
      if (memberCheck.rows.length === 0) {
        return socket.emit('error', { message: 'Not a member of this room' });
      }
      
      // Save message
      const result = await query(
        `INSERT INTO messages (room_id, user_id, content, type, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [roomId, socket.userId, content, type, metadata ? JSON.stringify(metadata) : null]
      );
      
      const message = result.rows[0];
      
      // Get user info
      const userInfo = await query(
        'SELECT name, avatar_url FROM users WHERE id = $1',
        [socket.userId]
      );
      
      const fullMessage = {
        ...message,
        user_name: userInfo.rows[0].name,
        user_avatar: userInfo.rows[0].avatar_url
      };
      
      // Broadcast to room
      io.to(roomId).emit('message:new', fullMessage);
      
      // Update room timestamp
      await query('UPDATE rooms SET updated_at = NOW() WHERE id = $1', [roomId]);
      
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  socket.on('message:typing', ({ roomId, isTyping }) => {
    socket.to(roomId).emit('user:typing', {
      userId: socket.userId,
      name: socket.userName,
      isTyping
    });
  });
  
  socket.on('message:read', async ({ roomId }) => {
    await query(
      'UPDATE room_members SET last_read_at = NOW() WHERE room_id = $1 AND user_id = $2',
      [roomId, socket.userId]
    );
  });
  
  // ===== BOARD EVENTS =====
  
  socket.on('board:card:create', async (data) => {
    try {
      const { roomId, type, content, x, y, width, height } = data;
      
      const result = await query(
        `INSERT INTO board_cards (room_id, user_id, type, content, x, y, width, height)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [roomId, socket.userId, type, content, x, y, width, height]
      );
      
      const card = result.rows[0];
      
      io.to(roomId).emit('board:card:created', {
        ...card,
        userName: socket.userName
      });
    } catch (error) {
      console.error('Create card error:', error);
    }
  });
  
  socket.on('board:card:move', async ({ roomId, cardId, x, y }) => {
    try {
      await query(
        'UPDATE board_cards SET x = $1, y = $2, updated_at = NOW() WHERE id = $3',
        [x, y, cardId]
      );
      
      socket.to(roomId).emit('board:card:moved', { cardId, x, y });
    } catch (error) {
      console.error('Move card error:', error);
    }
  });
  
  socket.on('board:card:resize', async ({ roomId, cardId, width, height }) => {
    try {
      await query(
        'UPDATE board_cards SET width = $1, height = $2, updated_at = NOW() WHERE id = $3',
        [width, height, cardId]
      );
      
      socket.to(roomId).emit('board:card:resized', { cardId, width, height });
    } catch (error) {
      console.error('Resize card error:', error);
    }
  });
  
  socket.on('board:card:delete', async ({ roomId, cardId }) => {
    try {
      const result = await query(
        'DELETE FROM board_cards WHERE id = $1 AND user_id = $2 RETURNING *',
        [cardId, socket.userId]
      );
      
      if (result.rows.length > 0) {
        io.to(roomId).emit('board:card:deleted', { cardId });
      }
    } catch (error) {
      console.error('Delete card error:', error);
    }
  });
  
  socket.on('board:cursor', ({ roomId, x, y }) => {
    socket.to(roomId).emit('board:cursor:update', {
      userId: socket.userId,
      name: socket.userName,
      x,
      y
    });
  });
  
  socket.on('board:load', async ({ roomId }) => {
    try {
      const result = await query(
        `SELECT bc.*, u.name as user_name
         FROM board_cards bc
         JOIN users u ON bc.user_id = u.id
         WHERE bc.room_id = $1
         ORDER BY bc.created_at`,
        [roomId]
      );
      
      socket.emit('board:state', { cards: result.rows });
    } catch (error) {
      console.error('Load board error:', error);
    }
  });
  
  // ===== ROOM EVENTS =====
  
  socket.on('room:join', async ({ roomId }) => {
    socket.join(roomId);
    
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Set());
    }
    roomUsers.get(roomId).add(socket.userId);
    
    io.to(roomId).emit('user:joined', {
      userId: socket.userId,
      name: socket.userName
    });
  });
  
  socket.on('room:leave', ({ roomId }) => {
    socket.leave(roomId);
    
    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.userId);
    }
    
    io.to(roomId).emit('user:left', {
      userId: socket.userId,
      name: socket.userName
    });
  });
  
  // ===== DISCONNECT =====
  
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.userName}`);
    
    activeUsers.delete(socket.id);
    
    if (userSockets.has(socket.userId)) {
      userSockets.get(socket.userId).delete(socket.id);
      
      // If no more sockets for this user, mark offline
      if (userSockets.get(socket.userId).size === 0) {
        userSockets.delete(socket.userId);
        
        await query(
          `UPDATE user_presence SET status = 'offline', last_activity = NOW()
           WHERE user_id = $1`,
          [socket.userId]
        );
        
        // Notify all rooms
        for (const [roomId, users] of roomUsers.entries()) {
          if (users.has(socket.userId)) {
            io.to(roomId).emit('user:presence', {
              userId: socket.userId,
              name: socket.userName,
              status: 'offline'
            });
            users.delete(socket.userId);
          }
        }
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 GizmoChat server running on port ${PORT}`);
});
