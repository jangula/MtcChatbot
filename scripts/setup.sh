#!/bin/bash

# MTC Maris WhatsApp Chatbot - Setup Script

echo "=========================================="
echo "MTC Maris WhatsApp Chatbot Setup"
echo "=========================================="

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js 18+ is required"
    exit 1
fi
echo "✓ Node.js version: $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm is required"
    exit 1
fi
echo "✓ npm version: $(npm -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Create .env if not exists
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✓ .env file created. Please edit with your configuration."
else
    echo "✓ .env file already exists"
fi

# Create logs directory
mkdir -p logs
echo "✓ Logs directory created"

# Check PostgreSQL
if command -v psql &> /dev/null; then
    echo "✓ PostgreSQL client found"
else
    echo "⚠ PostgreSQL client not found. Make sure PostgreSQL is installed and running."
fi

echo ""
echo "=========================================="
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your configuration"
echo "2. Create PostgreSQL database: createdb mtc_maris_chatbot"
echo "3. Start development server: npm run dev"
echo ""
echo "For WhatsApp Business API setup, see README.md"
echo "=========================================="
