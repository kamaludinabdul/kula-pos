#!/bin/bash

# Build script for production deployment
echo "🔨 Building for PRODUCTION environment..."

# Make sure we're using production config
# (restore original if it was changed)
# git checkout .env.production 2>/dev/null || echo "Using current .env.production"

# Build
npm run build

echo "✅ Production build complete!"
