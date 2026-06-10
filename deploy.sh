#!/bin/bash
# AgentGate — 1-command Vercel deployment
# Run this from the project root once with: bash deploy.sh
set -e

echo "🚀 Deploying AgentGate to Vercel..."

# Install Vercel CLI if needed
if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm install -g vercel
fi

# Deploy (will prompt for login on first run)
npx vercel deploy --yes \
  --env NEXT_PUBLIC_SUPABASE_URL="https://uvmnflfwtbpcakijbbqf.supabase.co" \
  --env NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bW5mbGZ3dGJwY2FraWpiYnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjg4MzAsImV4cCI6MjA5NjcwNDgzMH0.XuYccdnL2LozNtes8uRgn4fdenrrIkM9Lodfm9WC67k"

echo "✅ Deployed. Copy the URL above."
