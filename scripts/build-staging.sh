#!/bin/bash
set -e

# Build script for staging deployment
echo "🔨 Building for STAGING environment..."

# Backup current .env.production
if [ -f .env.production ]; then
  cp .env.production .env.production.backup
fi

# Copy staging config to .env.production
cp .env.staging .env.production

# Build
npm run build

# Restore original .env.production
if [ -f .env.production.backup ]; then
  mv .env.production.backup .env.production
fi

echo "✅ Staging build complete!"
