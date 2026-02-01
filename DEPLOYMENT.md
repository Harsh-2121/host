# GizmoChat - Complete Deployment Guide

## 🚀 Overview

GizmoChat is a revolutionary developer-focused chat platform with real-time messaging and multiplayer collaborative boards. This guide covers complete setup on Linode.

---

## 📋 Prerequisites

1. **Linode Account** - https://www.linode.com/
2. **Google OAuth Credentials** - https://console.cloud.google.com/
3. **Domain Name** (optional but recommended)
4. **SSH Client** (Terminal on Mac/Linux, PuTTY on Windows)

---

## 🎯 Part 1: Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click "New Project"
3. Name it "GizmoChat"
4. Click "Create"

### Step 2: Enable Google+ API

1. In the left sidebar, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click "Enable"

### Step 3: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Configure consent screen if prompted:
   - User Type: External
   - App name: GizmoChat
   - Support email: your-email@gmail.com
   - Scopes: email, profile
4. Create OAuth Client ID:
   - Application type: Web application
   - Name: GizmoChat Web Client
   - Authorized JavaScript origins:
     - http://localhost:5173
     - https://your-domain.com
   - Authorized redirect URIs:
     - http://localhost:5173
     - https://your-domain.com
5. Click "Create"
6. **SAVE THE CLIENT ID AND CLIENT SECRET** - you'll need these!

---

## 🖥️ Part 2: Linode Server Setup

### Step 1: Create Linode Instance

1. Log into Linode Dashboard
2. Click "Create" → "Linode"
3. Choose:
   - **Distribution**: Ubuntu 24.04 LTS
   - **Region**: Closest to your users
   - **Plan**: Shared CPU - Linode 2GB ($12/month minimum)
   - **Linode Label**: gizmochat-server
   - **Root Password**: Create a strong password
4. Click "Create Linode"
5. Wait for it to boot (Status: Running)
6. Note your **IP Address** (e.g., 192.168.1.100)

### Step 2: SSH into Server

```bash
ssh root@YOUR_SERVER_IP
# Enter your root password
```

### Step 3: Initial Server Setup

```bash
# Update system
apt update && apt upgrade -y

# Create non-root user
adduser gizmochat
usermod -aG sudo gizmochat

# Switch to new user
su - gizmochat

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx (web server)
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

---

## 🗄️ Part 3: PostgreSQL Database Setup

### Step 1: Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL shell:
CREATE DATABASE gizmochat;
CREATE USER gizmochat_user WITH PASSWORD 'YOUR_SECURE_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE gizmochat TO gizmochat_user;
\q  # Exit PostgreSQL
```

### Step 2: Allow Remote Connections (if using separate DB server)

```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/16/main/postgresql.conf

# Find and uncomment:
listen_addresses = '*'

# Edit pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Add at the end:
host    gizmochat    gizmochat_user    0.0.0.0/0    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## 📦 Part 4: Deploy Backend

### Step 1: Upload Code

Option A - Using Git (recommended):
```bash
cd /home/gizmochat
git clone YOUR_REPO_URL gizmochat
cd gizmochat/server
```

Option B - Using SCP (from your local machine):
```bash
# On your local machine
cd gizmochat
scp -r server gizmochat@YOUR_SERVER_IP:/home/gizmochat/
```

### Step 2: Configure Environment

```bash
cd /home/gizmochat/gizmochat/server

# Copy example env file
cp .env.example .env

# Edit environment variables
nano .env
```

Fill in:
```env
PORT=3001
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gizmochat
DB_USER=gizmochat_user
DB_PASSWORD=YOUR_DB_PASSWORD_HERE

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=PASTE_GENERATED_SECRET_HERE

# Google OAuth
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

# URLs
CLIENT_URL=http://YOUR_SERVER_IP:5173
PRODUCTION_URL=https://your-domain.com
```

### Step 3: Install Dependencies & Setup Database

```bash
# Install dependencies
npm install

# Load database schema
sudo -u postgres psql gizmochat < schema.sql

# Verify tables were created
sudo -u postgres psql gizmochat -c "\dt"
```

### Step 4: Start Server with PM2

```bash
# Start server
pm2 start server.js --name gizmochat-server

# Make PM2 start on boot
pm2 startup
pm2 save

# View logs
pm2 logs gizmochat-server

# Check status
pm2 status
```

---

## 🎨 Part 5: Deploy Frontend

### Step 1: Setup Frontend

```bash
cd /home/gizmochat/gizmochat/client

# Create .env file
cp .env.example .env
nano .env
```

Fill in:
```env
VITE_API_URL=http://YOUR_SERVER_IP:3001/api
VITE_SERVER_URL=http://YOUR_SERVER_IP:3001
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

### Step 2: Build Frontend

```bash
# Install dependencies
npm install

# Build for production
npm run build

# This creates a 'dist' folder with production files
```

### Step 3: Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/gizmochat
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;  # or your-domain.com

    # Frontend
    location / {
        root /home/gizmochat/gizmochat/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable the site:
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/gizmochat /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx on boot
sudo systemctl enable nginx
```

---

## 🔒 Part 6: SSL/HTTPS Setup (Optional but Recommended)

### Using Let's Encrypt (Free SSL)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Certbot will automatically configure Nginx!

# Test auto-renewal
sudo certbot renew --dry-run
```

Update your .env files to use HTTPS URLs.

---

## 🔥 Part 7: Firewall Configuration

```bash
# Allow SSH
sudo ufw allow 22

# Allow HTTP & HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow PostgreSQL (only if using remote DB)
# sudo ufw allow 5432

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## ✅ Part 8: Testing & Verification

### Test Backend

```bash
# Check if server is running
curl http://localhost:3001/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Test Frontend

1. Open browser: `http://YOUR_SERVER_IP`
2. You should see the GizmoChat login page
3. Click "Continue with Google"
4. After login, you should see the chat interface

### Test Database

```bash
# Connect to database
sudo -u postgres psql gizmochat

# Check users table
SELECT * FROM users;

# Exit
\q
```

---

## 📊 Part 9: Monitoring & Maintenance

### View Logs

```bash
# Backend logs
pm2 logs gizmochat-server

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u nginx -f
```

### Restart Services

```bash
# Restart backend
pm2 restart gizmochat-server

# Restart Nginx
sudo systemctl restart nginx

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Update Application

```bash
# Pull latest code
cd /home/gizmochat/gizmochat
git pull

# Update backend
cd server
npm install
pm2 restart gizmochat-server

# Update frontend
cd ../client
npm install
npm run build
```

---

## 🐛 Troubleshooting

### Can't connect to server
```bash
# Check if server is running
pm2 status

# Check if port is listening
sudo netstat -tlnp | grep 3001

# Check firewall
sudo ufw status
```

### Database connection errors
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
sudo -u postgres psql gizmochat -c "SELECT 1;"

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### Google OAuth not working
- Verify CLIENT_ID in both .env files
- Check Authorized URLs in Google Console
- Clear browser cache and cookies

### WebSocket connection failing
- Check Nginx configuration for /socket.io location
- Verify server is using same port (3001)
- Check browser console for CORS errors

---

## 📈 Performance Optimization

### Enable Gzip Compression

```bash
sudo nano /etc/nginx/nginx.conf

# Add in http block:
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
gzip_min_length 1000;

sudo systemctl restart nginx
```

### Setup Database Backups

```bash
# Create backup script
nano ~/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/gizmochat/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
sudo -u postgres pg_dump gizmochat > $BACKUP_DIR/gizmochat_$DATE.sql
# Keep only last 7 backups
ls -t $BACKUP_DIR/*.sql | tail -n +8 | xargs rm -f
```

```bash
# Make executable
chmod +x ~/backup-db.sh

# Add to cron (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /home/gizmochat/backup-db.sh
```

---

## 🎉 Done!

Your GizmoChat is now live! Access it at:
- http://YOUR_SERVER_IP (or https://your-domain.com)

### Next Steps

1. **Invite team members** - Share your domain/IP
2. **Create rooms** - Use the + button in the sidebar
3. **Try the board** - Click "Board" button in any room
4. **Customize** - Edit colors in client/tailwind.config.js

---

## 📚 Additional Resources

- Linode Docs: https://www.linode.com/docs/
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Nginx Docs: https://nginx.org/en/docs/
- PM2 Docs: https://pm2.keymetrics.io/docs/

## 🆘 Support

If you encounter issues:
1. Check logs (see Monitoring section)
2. Verify all environment variables
3. Ensure all services are running
4. Check firewall rules

Happy chatting! 🚀
