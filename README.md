# 🪟 GizmoChat

**WhatsApp for Developers** - A revolutionary real-time chat platform with collaborative multiplayer boards, built by developers, for developers.

![GizmoChat](https://img.shields.io/badge/Built%20with-React%20%2B%20Socket.io-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### 💬 Real-Time Chat
- **Instant messaging** with WebSocket-powered real-time sync
- **Code syntax highlighting** for sharing snippets
- **Message history** with infinite scroll
- **Typing indicators** to see who's composing
- **Read receipts** and unread message counts
- **Rich media** support (images, videos, links)

### 🎨 Multiplayer Collaborative Boards
- **Live collaboration** - See everyone's cursor in real-time
- **Drag & drop cards** with text, images, and videos
- **Infinite canvas** with pan and zoom
- **Card management** - Create, move, resize, and delete
- **Real-time sync** across all connected users
- **Persistent storage** - All boards saved to database

### 🔐 Authentication & Security
- **Google OAuth** - Secure, one-click sign-in
- **JWT tokens** for API security
- **Session management** with automatic refresh
- **HTTPS/WSS** support for production

### 👥 Room Management
- **Public & Private rooms** - Control access
- **Direct Messages** - 1-on-1 conversations
- **Room search** - Find conversations quickly
- **Member management** - See who's in each room
- **Invite links** - Easy team onboarding

---

## 🏗️ Architecture

### Backend (Node.js + Express + Socket.io)
```
server/
├── server.js          # Main Express + Socket.io server
├── db.js              # PostgreSQL connection pool
├── auth.js            # Google OAuth & JWT handling
├── schema.sql         # Database schema
└── .env.example       # Environment variables template
```

### Frontend (React + Vite + Tailwind)
```
client/
├── src/
│   ├── components/    # React components
│   │   ├── Sidebar.jsx
│   │   ├── ChatArea.jsx
│   │   ├── Board.jsx
│   │   └── CreateRoomModal.jsx
│   ├── pages/         # Page components
│   │   ├── Login.jsx
│   │   └── Chat.jsx
│   ├── services/      # API & Socket services
│   │   ├── api.js
│   │   └── socket.js
│   ├── store/         # Zustand state management
│   │   └── index.js
│   ├── App.jsx        # Root component
│   └── main.jsx       # Entry point
└── .env.example       # Environment variables template
```

### Database (PostgreSQL)
- **Users** - Profile, auth, presence
- **Rooms** - Chat channels & metadata
- **Messages** - Chat history
- **Board Cards** - Collaborative board state
- **Direct Messages** - 1-on-1 threads
- **Notifications** - User alerts

---

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Google OAuth credentials

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd gizmochat
```

### 2. Setup Database
```bash
# Create database
createdb gizmochat

# Load schema
psql gizmochat < server/schema.sql
```

### 3. Configure Backend
```bash
cd server
cp .env.example .env
nano .env  # Fill in your values
npm install
```

### 4. Configure Frontend
```bash
cd ../client
cp .env.example .env
nano .env  # Fill in your values
npm install
```

### 5. Run Development Servers
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

### 6. Open Browser
Navigate to `http://localhost:5173`

---

## 🌐 Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete Linode deployment instructions.

Quick summary:
1. **Setup Linode server** (Ubuntu 24.04, 2GB RAM minimum)
2. **Install dependencies** (Node.js, PostgreSQL, Nginx)
3. **Configure database** and load schema
4. **Deploy backend** with PM2
5. **Build & serve frontend** with Nginx
6. **Setup SSL** with Let's Encrypt
7. **Configure firewall** and monitoring

---

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gizmochat
DB_USER=gizmochat_user
DB_PASSWORD=your_password
JWT_SECRET=your_secret
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
CLIENT_URL=http://localhost:5173
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api
VITE_SERVER_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=your_client_id
```

---

## 📡 API Reference

### REST Endpoints

#### Authentication
- `POST /api/auth/google` - Login with Google token
- `GET /api/users/me` - Get current user profile

#### Rooms
- `GET /api/rooms` - Get user's rooms
- `POST /api/rooms` - Create new room
- `GET /api/rooms/:id/messages` - Get room messages

#### Users
- `GET /api/users/search?q=query` - Search users

#### Direct Messages
- `POST /api/dm/create` - Create/get DM thread

### WebSocket Events

#### Client → Server
- `message:send` - Send chat message
- `message:typing` - Update typing status
- `board:card:create` - Create board card
- `board:card:move` - Move card position
- `board:card:resize` - Resize card
- `board:card:delete` - Delete card
- `board:cursor` - Update cursor position
- `room:join` - Join a room
- `room:leave` - Leave a room

#### Server → Client
- `message:new` - New message received
- `user:typing` - User typing status
- `user:presence` - User online/offline
- `user:joined` - User joined room
- `user:left` - User left room
- `board:card:created` - Card created
- `board:card:moved` - Card moved
- `board:card:resized` - Card resized
- `board:card:deleted` - Card deleted
- `board:cursor:update` - Cursor position update
- `board:state` - Full board state

---

## 🎨 Customization

### Change Theme Colors
Edit `client/tailwind.config.js`:
```javascript
colors: {
  accent: {
    DEFAULT: '#your-color',
    hover: '#your-hover-color',
  },
}
```

### Modify Database Schema
1. Edit `server/schema.sql`
2. Create migration script
3. Run: `psql gizmochat < your-migration.sql`

### Add Features
1. Backend: Add socket event handlers in `server/server.js`
2. Frontend: Create components in `client/src/components/`
3. State: Add stores in `client/src/store/index.js`

---

## 📊 Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **Socket.io** - Real-time communication
- **PostgreSQL** - Relational database
- **JWT** - Authentication tokens
- **Google OAuth** - User authentication

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **React Query** - Data fetching
- **Socket.io Client** - WebSocket client
- **React Router** - Routing
- **Lucide React** - Icons

### DevOps
- **PM2** - Process management
- **Nginx** - Web server & reverse proxy
- **Let's Encrypt** - SSL certificates
- **UFW** - Firewall

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Write meaningful commit messages
- Test your changes thoroughly
- Update documentation as needed

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- Original LiveBoard concept for inspiration
- Socket.io team for real-time magic
- React team for the amazing framework
- PostgreSQL community for rock-solid database
- Tailwind CSS for beautiful styling

---

## 📞 Support

Need help?
- 📧 Email: support@gizmochat.dev
- 💬 Discord: https://discord.gg/gizmochat
- 🐛 Issues: https://github.com/yourname/gizmochat/issues
- 📖 Docs: See DEPLOYMENT.md

---

## 🗺️ Roadmap

- [ ] File upload support
- [ ] Voice/Video calls
- [ ] End-to-end encryption
- [ ] Mobile apps (React Native)
- [ ] Desktop apps (Electron)
- [ ] AI assistant integration
- [ ] Advanced board tools (drawing, shapes)
- [ ] Screen sharing
- [ ] Threaded conversations
- [ ] Message reactions
- [ ] Custom emojis
- [ ] Dark/Light theme toggle
- [ ] Internationalization (i18n)

---

**Built with ❤️ by developers, for developers**

Star ⭐ this repo if you find it useful!
