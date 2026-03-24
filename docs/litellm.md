# LiteLLM Proxy (litellm)

`litellm` is a wrapper around [LiteLLM Proxy](https://docs.litellm.ai/docs/simple_proxy) that provides a unified OpenAI-compatible API endpoint for multiple LLM providers (Anthropic, OpenAI, Ollama, etc.). It manages the proxy lifecycle, configuration, and service integration.

**Source:** `~/.local/bin/litellm` (`dot_local/bin/executable_litellm` in chezmoi)

## Synopsis

```bash
litellm                     # Show proxy status (same as litellm status)
litellm start               # Start the proxy server (foreground)
litellm status              # Show whether the proxy is running
litellm stop                # Stop the proxy server
litellm restart             # Restart the proxy server
litellm config              # Show configuration file
litellm models              # List configured models
litellm setup               # Install litellm and create default config
litellm version             # Show litellm version
litellm help                # Show built-in help
```

## Commands

| Command | Description |
|---------|-------------|
| `litellm` / `litellm status` | Show binary version, config path, port, process status, service state |
| `litellm start` | Start the proxy in foreground. Use `--service` for systemd/launchd |
| `litellm stop` | Stop the proxy (tries systemd/launchd first, falls back to kill-by-port) |
| `litellm restart` | Restart the proxy (service manager or manual stop+start) |
| `litellm config` | Print config file. `--edit` opens in `$EDITOR`. `--validate` checks YAML |
| `litellm models` | List model names from config |
| `litellm setup` | Install litellm, create config/env, enable service |
| `litellm version` | Print the litellm version |
| `litellm help` | Show built-in help text |

## Configuration

### Config File

`~/.config/litellm/config.yaml` — LiteLLM proxy configuration with model definitions.

The default config includes models for Anthropic (Claude Sonnet, Claude Haiku), OpenAI (GPT-4o, GPT-4o-mini), and Ollama (Llama 3). API keys are referenced via `os.environ/` so they're read from environment variables at runtime.

### Environment File

`~/.config/litellm/env` — API keys and environment variables. Created with mode `600` by `litellm setup`. This file is loaded by the systemd service (`EnvironmentFile`) and should contain:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### Port and Host

| Variable | Default | Description |
|----------|---------|-------------|
| `$LITELLM_PORT` | `4000` | Port for the proxy server |
| `$LITELLM_HOST` | `0.0.0.0` | Host to bind to (0.0.0.0 = all interfaces) |

## Service Management

### Linux (systemd)

The systemd user service is deployed to `~/.config/systemd/user/litellm-proxy.service`.

```bash
systemctl --user enable litellm-proxy   # Enable on login
systemctl --user start litellm-proxy    # Start now
systemctl --user stop litellm-proxy     # Stop
systemctl --user status litellm-proxy   # Check status
journalctl --user -u litellm-proxy -f   # Follow logs
```

### macOS (launchd)

A LaunchAgent plist is created by `litellm setup` at `~/Library/LaunchAgents/com.user.litellm-proxy.plist`.

```bash
launchctl load ~/Library/LaunchAgents/com.user.litellm-proxy.plist    # Load
launchctl unload ~/Library/LaunchAgents/com.user.litellm-proxy.plist  # Unload
```

Logs go to `~/.local/share/litellm/proxy.log`.

## API Usage

Once running, the proxy provides an OpenAI-compatible API:

```bash
# List available models
curl http://localhost:4000/v1/models

# Chat completion
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet", "messages": [{"role": "user", "content": "Hello"}]}'
```

Any OpenAI SDK-compatible client can point to `http://localhost:4000` as the base URL.

## Integration

- **sysmon**: Shows LiteLLM listening status in the Services section
- **sysup doctor**: Checks for litellm binary and config file
- **Welcome message**: Shows `litellm [start]` in available commands

## First-Time Setup

```bash
litellm setup              # Install binary, create config and env
$EDITOR ~/.config/litellm/env    # Add your API keys
litellm start              # Test in foreground
litellm models             # Verify models loaded
```
