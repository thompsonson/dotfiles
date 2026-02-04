# Local LLM UI Research

Research into local/self-hosted language model interfaces for personal use across macOS Intel, Linux, and Android.

## Context

Looking for alternatives to [Handy](https://handy.computer/) (which is actually a speech-to-text tool, not a general LLM chat UI). Goal: chat with an LLM locally, ideally from the terminal, with cross-device access including Android.

## Foundation: Ollama

[Ollama](https://ollama.com/) is the standard local LLM inference engine. Everything else connects to it.

- **Install**: `brew install ollama` (macOS) or `curl -fsSL https://ollama.com/install.sh | sh` (Linux)
- **Usage**: `ollama run llama3.2` for instant terminal chat
- **API**: OpenAI-compatible server on port 11434
- **GPU**: NVIDIA, AMD, Apple Metal
- **Models**: One-command download (`ollama pull llama3.2`, `ollama pull mistral`, etc.)

## Terminal Chat Clients

All connect to Ollama as backend.

### oterm (Recommended)

Beautiful TUI client for Ollama. Persistent sessions stored in SQLite, themes, image support (Sixel), MCP tool support.

- **Install**: `uvx oterm` or `pip install oterm`
- **Requires**: Ollama running
- **Repo**: <https://github.com/ggozad/oterm>

### aichat (Recommended)

All-in-one Rust CLI with Chat-REPL, shell assistant, RAG, and multi-provider support (20+ backends including Ollama).

- **Install**: `brew install aichat` or `cargo install aichat`
- **Features**: Tab completion, multi-line input, shell command generation, tool use
- **Repo**: <https://github.com/sigoden/aichat>

### mods (Charmbracelet)

Pipe-friendly CLI. Designed for `cat file | mods "explain this"` workflows. Beautiful Markdown rendering.

- **Install**: `brew install charmbracelet/tap/mods`
- **Repo**: <https://github.com/charmbracelet/mods>

### llm (Simon Willison)

Unix-philosophy CLI with plugin ecosystem. Logs all conversations to SQLite. Extensible via plugins.

- **Install**: `brew install llm` then `llm install llm-ollama`
- **Repo**: <https://github.com/simonw/llm>

### ShellGPT (sgpt)

Shell command generation from natural language. Zsh hotkey integration.

- **Install**: `pipx install shell-gpt`
- **Local**: Requires LiteLLM plugin for Ollama support
- **Repo**: <https://github.com/TheR1D/shell_gpt>

### tgpt

Zero-config terminal chat. Works immediately without API keys (uses free providers). Also supports Ollama.

- **Install**: Go binary, one-liner curl install
- **Repo**: <https://github.com/aandrew-me/tgpt>

## Web UI (Self-Hosted, Cross-Device)

### Open WebUI (Recommended)

The leading self-hosted AI chat interface. ChatGPT-like experience, fully local. Responsive mobile UI works well from phone browsers.

```bash
docker run -d -p 3000:8080 \
  --add-host=host.docker.internal:host-gateway \
  -v open-webui:/app/backend/data \
  --name open-webui \
  ghcr.io/open-webui/open-webui:main
```

- **Features**: RAG, web search, image generation, voice input, MCP, Python code execution, multi-user auth
- **Repo**: <https://github.com/open-webui/open-webui>

### LobeChat

Modern, beautiful web UI with plugin system, MCP support, and agent marketplace.

- **Install**: Docker or one-click Vercel deploy
- **Repo**: <https://github.com/lobehub/lobe-chat>

### LibreChat

Multi-backend ChatGPT clone. Multi-user, OAuth2, conversation branching.

- **Install**: Docker Compose
- **Repo**: <https://github.com/danny-avila/LibreChat>

### llama.cpp Web UI

Minimal built-in web UI from llama.cpp's server mode. Lightweight alternative to Open WebUI.

```bash
llama-server -m model.gguf --port 8080
```

## Desktop GUI Applications

### LM Studio

Most polished GUI. Browse/download models, chat, compare, tune parameters. Vulkan GPU offloading works on Intel Macs.

- **Platforms**: macOS (Intel + Apple Silicon), Windows, Linux
- **License**: Proprietary (free for personal use)
- **URL**: <https://lmstudio.ai/>

### Jan

Open-source ChatGPT alternative. Clean UI. Supports local models + cloud API connections.

- **Platforms**: macOS, Windows, Linux
- **License**: AGPLv3
- **URL**: <https://jan.ai/>

### GPT4All

Free, open-source. Optimized for CPU-only operation. Strong built-in document/RAG support.

- **Platforms**: macOS, Windows, Linux
- **License**: MIT
- **URL**: <https://gpt4all.io/>

## llamafile (Zero-Install)

Single self-contained executable from Mozilla. Bundles model + inference engine + web UI. Download one file, `chmod +x`, run. Works on 6 OSes (macOS, Linux, Windows, FreeBSD, OpenBSD, NetBSD) on x86-64 and ARM64.

- **Repo**: <https://github.com/mozilla-ai/llamafile>
- **GPU**: NVIDIA (CUDA), AMD (ROCm), Apple Metal

## Android Options

### On-Device (Limited)

Running LLMs directly on a phone requires flagship hardware (8+ GB RAM, modern SoC). Even then, expect 8-10 tokens/sec with 3-4B models.

- **SmolChat**: Open-source, runs any GGUF model. <https://github.com/shubham0204/SmolChat-Android>
- **MLC Chat**: NPU-optimized for Snapdragon 8 Gen 2+
- **Google AI Edge Gallery**: Experimental, runs Gemma 3n offline
- **Termux + Ollama**: Possible via proot-Ubuntu, but impractical for daily use

### Remote Access (Practical)

The practical approach: run Ollama + Open WebUI on a home server, access from phone browser via local network or Tailscale/Cloudflare tunnel.

## Recommended Stack

For macOS Intel + Linux + Android + tmux workflow:

| Layer | Tool | Purpose |
|-------|------|---------|
| Backend | **Ollama** | Local model inference on desktop/server |
| Terminal | **oterm** or **aichat** | Chat inside tmux sessions |
| Pipes | **mods** | Pipe terminal output through LLM |
| Web/Mobile | **Open WebUI** | Browser-based chat from any device |
| Android | Phone browser → Open WebUI | Access home server from phone |

## Model Recommendations for Intel Mac

Without a powerful GPU, focus on smaller quantized models:

- **llama3.2:3b** - Good balance of quality and speed
- **phi3:mini** (3.8B) - Microsoft's efficient small model
- **gemma2:2b** - Google's compact model
- **mistral:7b** (Q4 quantized) - Higher quality, slower on CPU

Run with: `ollama run llama3.2:3b`
