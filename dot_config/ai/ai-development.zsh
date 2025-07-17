# =============================================================================
# AI Development Environment (Mistral API + OpenHands)
# =============================================================================

# Load local .env file if it exists (keeps API keys out of git)
if [ -f ~/.env ]; then
  set -a  # automatically export all variables
  source ~/.env
  set +a  # stop automatically exporting
fi

# Mistral API Configuration - load from environment
export MISTRAL_API_KEY="${MISTRAL_API_KEY:-}"

# LiteLLM Local Proxy Configuration
export LITELLM_CONFIG="$HOME/.config/litellm/config.yaml"
export LITELLM_PORT="4000"

# OpenHands will use LiteLLM proxy at localhost:4000
export OPENAI_API_BASE="http://localhost:4000"
export OPENAI_API_KEY="local_dev_key_change_me"  # Matches LiteLLM master_key

# LiteLLM Proxy Management
litellm-start() {
  # Check if container already exists and clean it up
  if docker ps -a | grep -q "litellm"; then
    echo "🧹 Cleaning up existing litellm container..."
    docker stop litellm 2>/dev/null || true
    docker rm litellm 2>/dev/null || true
  fi
  
  # Check if port 4000 is in use
  if lsof -i :4000 >/dev/null 2>&1 || netstat -an 2>/dev/null | grep -q ":4000.*LISTEN"; then
    echo "⚠️  Port 4000 is already in use. Checking what's using it..."
    if command -v lsof >/dev/null 2>&1; then
      lsof -i :4000 2>/dev/null || echo "Unable to determine what's using port 4000"
    else
      echo "Install lsof to see what's using port 4000: brew install lsof"
    fi
    echo "💡 Try: litellm-clean to force cleanup, or use a different port"
    return 1
  fi
  
  echo "🚀 Starting LiteLLM proxy on port 4000..."
  container_id=$(docker run -d --name litellm --rm -p 4000:4000 \
    -v ~/.config/litellm:/app/config \
    -e MISTRAL_API_KEY="$MISTRAL_API_KEY" \
    ghcr.io/berriai/litellm:main-latest --config /app/config/config.yaml --port 4000)
  
  if [ -z "$container_id" ]; then
    echo "❌ Failed to start LiteLLM container"
    return 1
  fi
  
  echo "⏳ Waiting for LiteLLM proxy to be ready..."
  
  # Wait with retry logic (up to 30 seconds)
  for i in {1..10}; do
    sleep 3
    if curl -s http://localhost:4000/health >/dev/null 2>&1; then
      echo "✅ LiteLLM proxy started successfully at http://localhost:4000"
      return 0
    fi
    echo "   Attempt $i/10 - still starting..."
  done
  
  echo "❌ LiteLLM proxy failed to start within 30 seconds. Check logs with: litellm-logs"
  return 1
}

litellm-stop() {
  docker stop litellm 2>/dev/null || echo "LiteLLM container not running"
}

alias litellm-clean='docker stop litellm 2>/dev/null; docker rm litellm 2>/dev/null; echo "🧹 Cleaned up litellm container"'
alias litellm-restart='litellm-stop && sleep 1 && litellm-start'
alias litellm-logs='docker logs litellm -f 2>/dev/null || echo "LiteLLM container not found. Start it with: litellm-start"'

litellm-status() {
  if curl -s http://localhost:4000/health >/dev/null 2>&1; then
    echo "✅ LiteLLM proxy is running at http://localhost:4000"
    echo "📊 Models available:"
    curl -s http://localhost:4000/v1/models -H "Authorization: Bearer local_dev_key_change_me" | jq -r ".data[]?.id" 2>/dev/null || echo "   (Unable to fetch model list)"
  else
    echo "❌ LiteLLM proxy not responding on port 4000"
    if docker ps | grep -q "litellm"; then
      echo "🔍 Container exists but not responding - check logs: litellm-logs"
    else
      echo "🔍 Container not running - start it: litellm-start"
    fi
  fi
}

# OpenHands Management  
openhands-start() {
  # Check if container already exists and clean it up
  if docker ps -a | grep -q "openhands-app"; then
    echo "🧹 Cleaning up existing OpenHands container..."
    docker stop openhands-app 2>/dev/null || true
    docker rm openhands-app 2>/dev/null || true
  fi
  
  # Check if port 3000 is in use
  if lsof -i :3000 >/dev/null 2>&1 || netstat -an 2>/dev/null | grep -q ":3000.*LISTEN"; then
    echo "⚠️  Port 3000 is already in use. Checking what's using it..."
    if command -v lsof >/dev/null 2>&1; then
      lsof -i :3000 2>/dev/null || echo "Unable to determine what's using port 3000"
    else
      echo "Install lsof to see what's using port 3000: brew install lsof"
    fi
    echo "💡 Try: docker stop openhands-app or use a different port"
    return 1
  fi
  
  echo "🚀 Starting OpenHands on port 3000..."
  container_id=$(docker run -d --rm -e SANDBOX_RUNTIME_CONTAINER_IMAGE=docker.all-hands.dev/all-hands-ai/runtime:0.39-nikolaik -e LOG_ALL_EVENTS=true -v /var/run/docker.sock:/var/run/docker.sock -v ~/.openhands-state:/.openhands-state -p 3000:3000 --add-host host.docker.internal:host-gateway --name openhands-app docker.all-hands.dev/all-hands-ai/openhands:0.39)
  
  if [ -z "$container_id" ]; then
    echo "❌ Failed to start OpenHands container"
    return 1
  fi
  
  echo "⏳ Waiting for OpenHands to be ready..."
  
  # Wait with retry logic (up to 30 seconds)
  for i in {1..10}; do
    sleep 3
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
      echo "✅ OpenHands started successfully at http://localhost:3000"
      echo "🌐 Open http://localhost:3000 in your browser to use OpenHands"
      return 0
    fi
    echo "   Attempt $i/10 - still starting..."
  done
  
  echo "❌ OpenHands failed to start within 30 seconds. Check logs with: docker logs openhands-app"
  return 1
}

openhands-stop() {
  docker stop openhands-app 2>/dev/null || echo "OpenHands container not running"
}

alias openhands-status='docker ps | grep openhands-app && echo "✅ Running at http://localhost:3000" || echo "❌ Not running"'

# Complete AI Development Workflow
ai-start() {
  echo "🤖 Starting AI Development Stack..."
  
  # Check prerequisites
  if [ -z "$MISTRAL_API_KEY" ]; then
    echo "⚠️  MISTRAL_API_KEY not set. Please add it to ~/.env:"
    echo "   echo \"MISTRAL_API_KEY=your_key_here\" >> ~/.env"
    echo "   source ~/.env"
    return 1
  fi
  
  # Start LiteLLM
  if litellm-start; then
    echo "✅ LiteLLM proxy started successfully"
    echo ""
    
    # Start OpenHands
    if openhands-start; then
      echo ""
      echo "🎉 AI Development Stack is ready!"
      echo "🌐 LiteLLM: http://localhost:4000"
      echo "🤖 OpenHands: http://localhost:3000"
    else
      echo "❌ Failed to start OpenHands"
      echo "💡 LiteLLM is running, but OpenHands failed to start"
      return 1
    fi
  else
    echo "❌ Failed to start LiteLLM proxy"
    echo "💡 Try: litellm-clean && ai-start"
    return 1
  fi
}

ai-stop() {
  echo "🛑 Stopping AI Development Stack..."
  openhands-stop
  litellm-stop
  echo "✅ AI Development Stack stopped"
}

alias ai-restart='ai-stop && sleep 2 && ai-start'

ai-status() {
  echo "🤖 AI Development Stack Status:"
  echo "================================"
  litellm-status
  echo ""
  openhands-status
  echo ""
  if [ -n "$MISTRAL_API_KEY" ]; then
    echo "🔑 API Key: Set ✅"
  else
    echo "🔑 API Key: Not set ❌ (add to ~/.env)"
  fi
}