# 🚀 GizmoChat - Quick Start Guide

## For Local Development (5 minutes)

### 1. Get Google OAuth Credentials

1. Go to https://console.cloud.google.com/
2. Create new project "GizmoChat"
3. Enable Google+ API
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized origins:
   - `http://localhost:5173`
6. Save your **Client ID** and **Client Secret**

### 2. Setup Database

```bash
# Create database
createdb gizmochat

# Load schema
psql gizmochat < server/schema.sql
```

### 3. Configure Environment

**server/.env:**
```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gizmochat
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
JWT_SECRET=$(openssl rand -base64 32)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
CLIENT_URL=http://localhost:5173
```

**client/.env:**
```env
VITE_API_URL=http://localhost:3001/api
VITE_SERVER_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

### 4. Install & Run

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Run backend (Terminal 1)
cd server && npm run dev

# Run frontend (Terminal 2)
cd client && npm run dev
```

### 5. Open Browser

Navigate to `http://localhost:5173`

---

## For Production on Linode (30 minutes)

### Prerequisites
- Linode account
- Domain name (optional)
- Google OAuth credentials (from above)

### Step-by-Step

#### 1. Create Linode Server
- Distribution: Ubuntu 24.04 LTS
- Plan: Shared CPU - Linode 2GB ($12/mo)
- Region: Your choice
- Note your IP address

#### 2. SSH and Setup

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Nginx
apt install -y nginx

# Install PM2
npm install -g pm2
```

#### 3. Setup Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE gizmochat;
CREATE USER gizmochat_user WITH PASSWORD 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE gizmochat TO gizmochat_user;
\q
```

#### 4. Deploy Code

```bash
# Create directory
mkdir -p /var/www/gizmochat
cd /var/www/gizmochat

# Upload your code (via git or scp)
# Then:
cd server
npm install
```

#### 5. Load Database Schema

```bash
sudo -u postgres psql gizmochat < schema.sql
```

#### 6. Configure Backend

```bash
# Create .env in server directory
nano server/.env
```

Paste:
```env
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gizmochat
DB_USER=gizmochat_user
DB_PASSWORD=YOUR_PASSWORD
JWT_SECRET=$(openssl rand -base64 32)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
CLIENT_URL=http://YOUR_SERVER_IP
PRODUCTION_URL=http://YOUR_SERVER_IP
```

#### 7. Start Backend

```bash
cd /var/www/gizmochat/server
pm2 start server.js --name gizmochat
pm2 startup
pm2 save
```

#### 8. Build Frontend

```bash
cd /var/www/gizmochat/client

# Create .env
nano .env
```

Paste:
```env
VITE_API_URL=http://YOUR_SERVER_IP:3001/api
VITE_SERVER_URL=http://YOUR_SERVER_IP:3001
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

```bash
# Install and build
npm install
npm run build
```

#### 9. Configure Nginx

```bash
nano /etc/nginx/sites-available/gizmochat
```

Paste:
```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;

    location / {
        root /var/www/gizmochat/client/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/gizmochat /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### 10. Setup Firewall

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

#### 11. Done!

Visit `http://YOUR_SERVER_IP` in your browser!

---

## Optional: Add SSL (HTTPS)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate (requires domain name)
certbot --nginx -d yourdomain.com

# Auto-renew
certbot renew --dry-run
```

---

## Troubleshooting

### Backend won't start
```bash
pm2 logs gizmochat
# Check the error message
```

### Database connection failed
```bash
sudo -u postgres psql gizmochat -c "SELECT 1;"
# Verify database exists and is accessible
```

### Can't login with Google
- Check CLIENT_ID matches in both .env files
- Verify authorized origins in Google Console
- Clear browser cache

### WebSocket not connecting
```bash
# Check Nginx config
nginx -t

# Restart Nginx
systemctl restart nginx

# Check if backend is running
pm2 status
```

---

## Common Commands

```bash
# View backend logs
pm2 logs gizmochat

# Restart backend
pm2 restart gizmochat

# Stop backend
pm2 stop gizmochat

# View Nginx logs
tail -f /var/log/nginx/error.log

# Restart Nginx
systemctl restart nginx

# Check database
sudo -u postgres psql gizmochat

# Backup database
pg_dump gizmochat > backup.sql

# Restore database
psql gizmochat < backup.sql
```

---

## Need More Help?

See detailed guides:
- **DEPLOYMENT.md** - Complete deployment walkthrough
- **README.md** - Full documentation
- GitHub Issues - Report bugs

Happy chatting! 🎉
