# Local Voice AI Research

Research into local/self-hosted **voice conversation** interfaces (speak to an LLM, it speaks back) for personal use across macOS Intel, Linux, and Android.

## Context

Looking for a local voice assistant experience - like ChatGPT voice mode but self-hosted. [Handy](https://handy.computer/) does local speech-to-text (Whisper/Parakeet) but is dictation-only, not conversational. The goal is a full voice loop: **Speech → LLM → Speech**.

## The Pipeline

Voice conversation requires three components chained together:

1. **STT (Speech-to-Text)**: Whisper, faster-whisper, whisper.cpp
2. **LLM (Reasoning)**: Ollama, llama.cpp, or a speech-to-speech model
3. **TTS (Text-to-Speech)**: Kokoro, Piper, Pocket TTS, Chatterbox

Latency across this chain determines whether it feels like a conversation or a walkie-talkie.

### Latency Reality Check

| Setup | Latency | Feels like |
|-------|---------|------------|
| Cloud (ChatGPT voice) | ~200-400ms | Natural conversation |
| Moshi speech-to-speech (local) | ~200ms | Natural conversation |
| GPU pipeline (NVIDIA) | ~500ms | Slight pause, usable |
| Good CPU pipeline | ~1-3s | Walkie-talkie |
| Slow CPU pipeline | ~3-5s | Painful |

**An NVIDIA GPU makes a big difference.** Most sub-second numbers require CUDA. On Intel Mac (CPU-only), expect 1-3 seconds.

---

## Turnkey Voice Chat Solutions

### RealtimeVoiceChat (KoljaB) - Best for NVIDIA GPU

~500ms end-to-end latency. The closest thing to "ChatGPT voice mode but local" that exists.

- **Pipeline**: RealtimeSTT (faster-whisper) + Ollama + RealtimeTTS (Kokoro/Coqui/Orpheus)
- **Platforms**: Linux, macOS, Windows
- **Requires**: NVIDIA GPU strongly recommended
- **Status**: No longer actively maintained, but functional
- **Repo**: <https://github.com/KoljaB/RealtimeVoiceChat>

### local-talking-llm (vndee)

Simpler Whisper + Ollama + ChatterBox pipeline. Good starting point, higher latency than RealtimeVoiceChat.

- **Repo**: <https://github.com/vndee/local-talking-llm>
- **Guide**: <https://medium.com/@vndee.huynh/build-your-own-voice-assistant-and-run-it-locally-whisper-ollama-bark-c80e6f815cba>

### voicechat2 (lhl) - Best for AMD GPU

WebSocket-based voice chat with ROCm/AMD GPU support. Uses Opus compression to reduce latency.

- **Repo**: <https://github.com/lhl/voicechat2>

### local_ai_assistant (djsharman)

Whisper + Ollama (Llama3) + Piper with SQLite conversation memory.

- **Repo**: <https://github.com/djsharman/local_ai_assistant>

---

## Speech-to-Speech Models (Skip the Pipeline)

These process audio directly - no STT→text→LLM→text→TTS chain. Lower latency by design.

### Moshi (Kyutai) - Most Promising

Full-duplex speech-to-speech. Both sides modeled as parallel audio streams. Can listen while speaking.

- **Latency**: ~200ms - extraordinary for local
- **Full duplex**: Yes (like a real conversation)
- **Local deployment**: PyTorch, MLX (Apple Silicon), Rust/Candle
- **Caveat**: Smaller model means less reasoning depth than a 7B+ LLM
- **License**: CC-BY 4.0 (models), Apache 2.0 (code)
- **Repo**: <https://github.com/kyutai-labs/moshi>

Kyutai also released companion models:
- **Pocket TTS** (100M params): Runs on CPU in real-time at 6x speed, voice cloning from 5s of audio, 200ms time-to-first-audio. <https://github.com/kyutai-labs/pocket-tts>
- **Kyutai STT**: Streaming speech-to-text optimized for interactive use
- **MoshiVis**: Discuss images via voice

### Ultravox (Fixie AI)

Audio-native LLM - understands speech directly (no separate ASR). Based on Llama 3.1-8B + Whisper-large-v3-turbo. ~150ms time-to-first-token.

- **Caveat**: Audio-in only, text-out. Still needs separate TTS
- **Open weights**: <https://huggingface.co/fixie-ai/ultravox-v0_2>
- **Repo**: <https://github.com/fixie-ai/ultravox>

---

## Voice Agent Frameworks (Build Your Own)

### Pipecat (Daily.co) - Most Polished Framework

Open-source Python framework for real-time voice AI. 40+ plugins, SDKs for Python, JS, React, iOS, Android, C++.

- **Local example**: <https://github.com/kwindla/macos-local-voice-agents> (Silero VAD + MLX Whisper + Ollama + local TTS)
- **On-premise guide**: <https://webrtc.ventures/2025/03/on-premise-voice-ai-creating-local-agents-with-llama-ollama-and-pipecat/>
- **Repo**: <https://github.com/pipecat-ai/pipecat>
- **Note**: MLX components are optimized for Apple Silicon, not Intel

### LiveKit Agents

Open-source realtime voice agent framework. Turn detection, interruption handling, telephony, MCP. Self-hosted with Ollama/vLLM backend. Has Android SDK.

- **Repo**: <https://github.com/livekit/agents>

### LocalAI - OpenAI-Compatible Voice Pipeline

Drop-in OpenAI API replacement that runs locally. Includes Realtime API (VAD + STT + LLM + TTS). Multiple TTS backends: Piper, Kokoro, Pocket TTS, Chatterbox.

- **Repo**: <https://github.com/mudler/LocalAI>
- **Realtime API docs**: <https://localai.io/features/openai-realtime/>

---

## Smart Home Voice Assistants

### Home Assistant + Wyoming Protocol

Most mature ecosystem for local voice control. Whisper (STT) + Piper (TTS) + Ollama (LLM) via Wyoming protocol.

- **2025 improvements**: Streaming TTS halved response latency from 5+ seconds to ~0.5s. Conversational follow-ups without repeating wake word
- **Hardware**: Raspberry Pi 4 (basic) or mini PC (better)
- **Fully offline**: Yes
- **Best for**: Smart home control + general conversation via Ollama backend
- **Docs**: <https://www.home-assistant.io/integrations/wyoming/>

### OVOS (OpenVoiceOS)

Community-driven voice assistant (Mycroft successor). Plugin-based - swap ASR, TTS, and conversation backends. ~500-900ms on modest hardware.

- **Repo**: <https://github.com/openVoiceOS>

### Willow

Open-source Echo/Google Home alternative on ESP32-S3-BOX hardware (~$50). Self-hosted Willow Inference Server.

- **Repo**: <https://github.com/HeyWillow/willow>

---

## Open WebUI Voice Mode

Open WebUI has voice/call features (Whisper STT, Kokoro/Chatterbox TTS), but there is a known **audio streaming bug**: Voice Mode waits for the entire LLM response to generate before playing audio, causing long delays. Not usable for real-time conversation as of mid-2025. Worth monitoring.

- **Docs**: <https://docs.openwebui.com/features/>

---

## TTS Engines (Voice Quality Matters)

| Engine | Size | CPU Real-time? | Voice Cloning | Quality | License |
|--------|------|----------------|---------------|---------|---------|
| **Kokoro** | 82M | Yes (0.7x RT on M1) | No | Excellent | Apache 2.0 |
| **Kyutai Pocket TTS** | 100M | Yes (6x speed on M4) | Yes (5s sample) | Excellent | Open |
| **Piper** | ~60MB | Yes | No | Good (slightly robotic) | MIT |
| **Chatterbox Turbo** | 350M | GPU recommended | Yes (5s sample) | Excellent | MIT |
| **Coqui XTTS-v2** | 467M | GPU needed | Yes (6s sample) | Very good | Non-commercial |

**Best for CPU**: Kokoro or Kyutai Pocket TTS. Both run in real-time on CPU with natural-sounding output.

## STT Engines

| Engine | Best for | Notes |
|--------|----------|-------|
| **faster-whisper** | GPU setups | 4x faster than original Whisper, int8 quantization |
| **whisper.cpp** | CPU / cross-platform | C++, no Python dependency |
| **Distil-Whisper** | Resource-constrained | 6x faster, 49% smaller, within 1% accuracy |

---

## Android Options

Running the full voice pipeline locally on a phone is impractical for quality conversation. Realistic options:

### Self-Hosted Server + Phone Client (Recommended)

Run the heavy models on your Linux box, connect from phone:
- **Pipecat** has Android SDK
- **LiveKit** has Android SDK
- **Open WebUI** accessible via mobile browser
- Access over local network or Tailscale for remote

### On-Device Android

- **LLM Hub**: Android app with TTS auto-readout, needs 6GB+ RAM
- **Picovoice**: Proprietary SDK, fully on-device, demonstrated on Pixel 6a
- **Termux + Whisper + MLC LLM + Android TTS**: Hacky but offline

---

## Recommended Setup for Your Hardware

### Linux Box (Best Machine for This)

**If it has an NVIDIA GPU:**
- **RealtimeVoiceChat** - ~500ms latency, turnkey
- STT: faster-whisper large-v3-turbo
- LLM: Ollama (Qwen3-4B or Llama 3.1-8B)
- TTS: Kokoro or Chatterbox Turbo

**If CPU-only:**
- **Moshi** - speech-to-speech, ~200ms, bypasses the pipeline entirely
- Or: whisper.cpp (small) + Ollama + Kyutai Pocket TTS (~1-3s latency)

### macOS Intel

Without NVIDIA GPU or Apple Silicon, Intel Mac is at a disadvantage. Options:
- Run Moshi with PyTorch backend (best latency option)
- Run whisper.cpp (base) + Ollama (3B model) + Kokoro (~2-4s latency)
- **Better approach**: Run server on Linux box, use Mac as client

### Android Phone

- Connect to your Linux server via Pipecat/LiveKit Android client or browser
- Add Tailscale for access outside your home network

---

## Honest Assessment

### Works well today:
- **Moshi** - genuinely impressive 200ms latency, full-duplex, but limited reasoning depth
- **RealtimeVoiceChat on NVIDIA GPU** - ~500ms, closest to ChatGPT voice mode
- **Home Assistant + Ollama + Piper** - mature, improved streaming in late 2025
- **Kokoro / Pocket TTS** - local TTS quality has reached parity with commercial services

### Promising but requires assembly:
- **Ultravox + Kokoro/Pocket TTS** - could be very fast but needs custom integration
- **Pipecat local agents** - well-engineered but more setup work
- **LocalAI Realtime API** - OpenAI-compatible, actively developed

### Not there yet:
- **Open WebUI voice mode** - streaming bug makes it impractical for conversation
- **On-device Android** - works but limited by phone hardware and battery
- **Intel Mac native** - CPU bottleneck makes sub-second latency difficult

### The bottom line:
The TTS and STT problems are solved. The remaining challenge is LLM inference speed and gluing everything together. If you have an NVIDIA GPU on your Linux box, RealtimeVoiceChat gets you 90% of the way to ChatGPT voice mode. If not, Moshi is the most interesting option - it trades reasoning depth for remarkably low latency by doing speech-to-speech directly.
