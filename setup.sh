#!/bin/bash

# GizmoChat Development Setup Script
# This script automates the setup process for local development

set -e  # Exit on error

echo "🪟 GizmoChat Setup Script"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be 18 or higher${NC}"
    echo "Current version: $(node -v)"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm -v)${NC}"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL is not installed${NC}"
    echo "Please install PostgreSQL 14+ from https://www.postgresql.org/"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ PostgreSQL installed${NC}"
fi

echo ""
echo "🔧 Setting up Backend..."
echo "========================"

# Backend setup
cd server

if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit server/.env with your configuration${NC}"
else
    echo "✅ .env already exists"
fi

echo "📦 Installing backend dependencies..."
npm install

echo ""
echo "🎨 Setting up Frontend..."
echo "========================="

# Frontend setup
cd ../client

if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit client/.env with your configuration${NC}"
else
    echo "✅ .env already exists"
fi

echo "📦 Installing frontend dependencies..."
npm install

cd ..

echo ""
echo "🗄️  Database Setup"
echo "=================="
echo ""
echo "To set up the database, run these commands:"
echo ""
echo -e "${YELLOW}createdb gizmochat${NC}"
echo -e "${YELLOW}psql gizmochat < server/schema.sql${NC}"
echo ""
read -p "Would you like to set up the database now? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating database..."
    createdb gizmochat 2>/dev/null || echo "Database may already exist"
    
    echo "Loading schema..."
    psql gizmochat < server/schema.sql
    
    echo -e "${GREEN}✅ Database setup complete${NC}"
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Edit server/.env with your configuration"
echo "2. Edit client/.env with your configuration"
echo "3. Get Google OAuth credentials from https://console.cloud.google.com/"
echo ""
echo "To start development:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd server && npm run dev"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd client && npm run dev"
echo ""
echo "Then open http://localhost:5173 in your browser"
echo ""
echo "For production deployment, see DEPLOYMENT.md"
echo ""
