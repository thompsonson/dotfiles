# OpenHands AI Development Setup

This guide explains how to set up OpenHands (All Hands AI) with Mistral API integration using your chezmoi dotfiles configuration.

## Overview

The setup creates a local AI sovereignty stack:
- **OpenHands** (localhost:3000) - AI coding assistant interface
- **LiteLLM Proxy** (localhost:4000) - Local API proxy for sovereignty
- **Mistral API** (api.mistral.ai) - EU-hosted AI models

All secrets stay local in your `~/.env` file and are never committed to git.

## Prerequisites

- Docker installed and running
- `uv` package manager (installed via brew in the setup)
- Mistral API key (get from https://console.mistral.ai/)

## Installation

1. **Apply chezmoi configuration**:
   ```bash
   chezmoi apply
   ```

2. **Get your Mistral API key**:
   - Go to https://console.mistral.ai/
   - Create an account and generate an API key

3. **Configure your API key locally** (never commit this):
   ```bash
   echo "MISTRAL_API_KEY=your_actual_api_key_here" > ~/.env
   ```

4. **Reload your shell** to pick up new aliases:
   ```bash
   exec zsh
   ```

## Usage

### Quick Start

```bash
# Start the AI development stack
ai-start           # Starts LiteLLM proxy (auto-cleanup if needed)
openhands-start    # Starts OpenHands (in new terminal)

# Test the setup
ai-dev test        # Comprehensive testing

# Access OpenHands
# Open http://localhost:3000 in your browser
```

> **Note**: `ai-start` now automatically checks for API keys and cleans up existing containers if needed.

### Available Commands

#### Main Workflow
- `ai-start` - Start LiteLLM proxy with auto-cleanup and API key check
- `ai-stop` - Stop both services gracefully
- `ai-status` - Check service status and API key configuration
- `ai-restart` - Restart the entire AI stack

#### LiteLLM Management
- `litellm-start` - Start LiteLLM proxy with port conflict detection
- `litellm-stop` - Stop LiteLLM proxy
- `litellm-restart` - Restart LiteLLM proxy
- `litellm-clean` - Force cleanup of LiteLLM containers
- `litellm-logs` - View LiteLLM logs
- `litellm-status` - Check LiteLLM health and available models

#### OpenHands Management
- `openhands-start` - Start OpenHands
- `openhands-stop` - Stop OpenHands
- `openhands-status` - Check OpenHands status

#### Utility Commands
- `ai-dev setup` - Show setup instructions
- `ai-dev test` - Test complete stack
- `ai-dev logs` - View service logs
- `ai-dev config` - Show current configuration
- `ai-dev pull` - Pull Docker images
- `ai-dev clean` - Stop and remove containers

## Enhanced Container Management

The dotfiles include improved container management features:

### Automatic Cleanup
- `ai-start` and `litellm-start` automatically clean up existing containers
- No more "container name already in use" errors
- Graceful handling of stuck containers

### Port Conflict Detection
- Automatic detection when port 4000 is already in use
- Shows what process is using the port (if `lsof` is available)
- Provides clear recovery steps

### Self-Healing Commands
- `ai-restart` - Full stack restart with cleanup
- `litellm-restart` - LiteLLM service restart
- `litellm-clean` - Force cleanup when needed

### Better Error Messages
- Clear indication of what went wrong
- Actionable recovery steps
- API key validation before starting services

## Configuration

### LiteLLM Configuration
Located at `~/.config/litellm/config.yaml`:
- Maps Mistral models to OpenAI-compatible endpoints
- Uses environment variables for API keys
- Configured for `devstral` and `mistral-small` models

### OpenHands Configuration
Located at `~/.openhands-state/settings.json`:
- Points to local LiteLLM proxy
- Uses CodeActAgent for development tasks
- Configured for optimal coding assistance

## Testing

Run comprehensive tests to verify your setup:

```bash
ai-dev test
```

This will check:
- ✅ API key configuration
- ✅ OpenHands CLI installation
- ✅ Docker availability
- ✅ Configuration files
- ✅ Service connectivity
- ✅ LiteLLM API functionality

## Troubleshooting

### Common Issues

1. **API Key Not Set**
   ```bash
   # Check if API key is loaded
   echo $MISTRAL_API_KEY
   
   # If empty, check ~/.env file
   cat ~/.env
   ```

2. **Docker Not Running**
   ```bash
   # Check Docker status
   docker ps
   
   # Start Docker Desktop (macOS) or Docker daemon (Linux)
   ```

3. **Port Conflicts**
   
   The new aliases handle port conflicts automatically! If you encounter issues:
   
   ```bash
   # Option 1: Use the new restart command (recommended)
   ai-restart
   
   # Option 2: Force cleanup and restart
   litellm-clean
   ai-start
   
   # Option 3: Manual check (if needed)
   lsof -i :3000
   lsof -i :4000
   ```
   
   The `litellm-start` command now:
   - Automatically cleans up existing containers
   - Detects port conflicts and shows what's using the port
   - Provides helpful error messages with recovery steps

4. **OpenHands CLI Not Found**
   ```bash
   # Reinstall via uv
   uv tool install openhands-ai
   
   # Check uv tools
   uv tool list
   ```

### Service Logs

View detailed logs for debugging:

```bash
ai-dev logs          # Both services
litellm-logs         # LiteLLM only
docker logs openhands-app  # OpenHands only
```

### Clean Reset

If things get stuck, use the enhanced cleanup commands:

```bash
# Quick restart (recommended)
ai-restart           # Stops and restarts entire stack

# Manual cleanup
litellm-clean        # Force cleanup LiteLLM
ai-dev clean         # Stop and remove all containers
ai-dev pull          # Pull fresh images
ai-start             # Start fresh
```

## Security Notes

- ✅ API keys stored locally in `~/.env` (git-ignored)
- ✅ All configurations use environment variables
- ✅ No secrets in committed files
- ✅ Local proxy for API sovereignty
- ✅ Data stays local except API calls to Mistral EU

## Model Configuration

The setup includes two Mistral models:

### DevStral (Primary)
- **Model**: `mistral/devstral-small-2505`
- **Use**: Code generation and development tasks
- **Access**: `devstral` via OpenHands

### Mistral Small (Secondary)
- **Model**: `mistral/mistral-small-latest`
- **Use**: General purpose tasks
- **Access**: `mistral-small` via API

## Advanced Usage

### Custom Models

Edit `~/.config/litellm/config.yaml` to add more models:

```yaml
model_list:
  - model_name: your-model
    litellm_params:
      model: mistral/your-model-name
      api_key: ${MISTRAL_API_KEY}
      api_base: https://api.mistral.ai/v1
```

### Environment Variables

Available environment variables:
- `MISTRAL_API_KEY` - Your Mistral API key
- `LITELLM_CONFIG` - Path to LiteLLM config
- `LITELLM_PORT` - LiteLLM proxy port (default: 4000)
- `OPENAI_API_BASE` - OpenHands API endpoint
- `OPENAI_API_KEY` - Local proxy key

## Architecture

```
User Browser (localhost:3000)
    ↓
OpenHands Container
    ↓ OpenAI-compatible API
LiteLLM Proxy (localhost:4000)
    ↓ Environment variable substitution
Mistral API (api.mistral.ai)
```

This architecture ensures:
- Complete API sovereignty
- Local secret management
- No vendor lock-in
- EU data residency (Mistral)

## Support

For issues with:
- **OpenHands**: Check https://github.com/All-Hands-AI/OpenHands
- **LiteLLM**: Check https://github.com/BerriAI/litellm
- **This Setup**: Use `ai-dev test` for diagnostics

## Next Steps

1. Access OpenHands at http://localhost:3000
2. Start with a simple coding task
3. Explore the CodeActAgent capabilities
4. Customize models and configurations as needed

The setup provides a complete AI development environment while maintaining security and sovereignty over your data and API keys.