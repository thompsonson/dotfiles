# Local Speech-to-Text Input Research

Research into local/offline **speech-to-text input** tools -- applications that let you speak instead of type. Press a key, speak, text appears where your cursor is. NOT voice assistants, NOT voice conversation with AI.

Platforms: macOS Intel, Linux, and Android.

## Context

[Handy](https://handy.computer/) ([GitHub](https://github.com/cjpais/Handy)) does exactly this -- Whisper/Parakeet-based, Tauri app, press key, speak, text pasted. But it's not quite usable yet for daily driving.

The goal: find something that **actually works well enough to replace typing** for drafting text, writing prompts, chat messages, and terminal input.

---

## Quick Recommendation Summary

| Platform | Best Pick | Runner-Up | Notes |
|----------|-----------|-----------|-------|
| **Linux (daily driver)** | SoupaWhisper | hyprwhspr | Simple, fast, works today |
| **Linux (power user)** | Talon Voice | OpenWhispr | Talon if you invest time learning it |
| **Linux (system-level)** | nerd-dictation | ibus-speech-to-text | nerd-dictation is battle-tested |
| **macOS Intel** | Voice Type ($20) | macOS built-in dictation | Voice Type explicitly supports Intel |
| **Android** | FUTO Voice Input | Google offline voice typing | FUTO is the clear winner |

---

## Desktop Tools -- Linux

### SoupaWhisper -- Best Simple Option for Linux

A ~250-line Python script that replicates SuperWhisper's workflow on Linux. Hold F12, speak, release. Text appears in the active window and is copied to clipboard.

- **Engine**: faster-whisper (CTranslate2, 4x faster than OpenAI Whisper)
- **Platforms**: Linux (X11 via xdotool)
- **Offline**: Yes, fully local
- **Integration**: System-wide via xdotool (types into active window) + xclip (clipboard)
- **Models**: tiny.en, base.en, small.en, medium.en, large-v3
- **Recommended model**: base.en -- near-real-time delay, good accuracy for prompts/instructions
- **GPU**: Optional CUDA support (float16), CPU works fine with int8
- **Latency**: base.en on CPU is close to real-time; larger models add 8-15 seconds
- **Setup**: `git clone`, `poetry install`, systemd service available
- **Config**: `~/.config/soupawhisper/config.ini` (model, device, compute type, hotkey)
- **Dependencies**: alsa-utils, xclip, xdotool, libnotify
- **Terminal**: Yes, types into whatever window is focused including terminals
- **Status**: Active (2024-2025), built with Claude Code
- **Repo**: <https://github.com/ksred/soupawhisper>
- **Blog**: <https://www.ksred.com/soupawhisper-how-i-replaced-superwhisper-on-linux/>

**Limitation**: X11 only (xdotool). For Wayland, see hyprwhspr or the AlterFlow guide below.

---

### hyprwhspr -- Best for Hyprland/Wayland

Native speech-to-text for Linux with multiple backend support including NVIDIA Parakeet TDT V3, which is extraordinarily fast on both CPU and GPU.

- **Engine**: Parakeet TDT V3 (via onnx-asr), pywhispercpp, REST API, or WebSocket
- **Platforms**: Linux (Arch, Debian, Ubuntu, Fedora, openSUSE)
- **Offline**: Yes
- **Integration**: System-wide, types into active buffer
- **Hotkey**: Super+Alt+D (start/stop)
- **GPU**: NVIDIA (CUDA), AMD (ROCm), Vulkan, or CPU
- **Parakeet V3 performance**: "Nigh unbelievable speed on modest CPUs" -- fastest backend option
- **Compositor**: Optimized for Hyprland + Waybar, but works on any systemd Linux
- **Terminal**: Yes
- **Status**: Active (2025), integrated into Omarchy ecosystem
- **Repo**: <https://github.com/goodroot/hyprwhspr>

**Standout**: Parakeet TDT V3 via onnx-asr is reportedly faster than Whisper while maintaining strong accuracy. Worth trying as an alternative to Whisper-based tools.

---

### nerd-dictation -- Battle-Tested, Lightweight

Single-file Python script, minimal dependencies, uses Vosk (not Whisper). The longest-running and most widely used Linux dictation tool.

- **Engine**: Vosk
- **Platforms**: Linux only
- **Offline**: Yes, fully local
- **Integration**: xdotool (X11), wtype (Wayland), ydotool (Wayland), or stdout
- **Models**: vosk-model-small-en-us-0.15 (~40MB), vosk-model-en-us-0.22-lgraph (~300MB recommended), vosk-model-en-us-0.22 (~1.5GB best accuracy)
- **Languages**: 20+ via Vosk models
- **Latency**: Near real-time (Vosk streams as you speak)
- **Terminal**: Yes (has a stdout mode with Ctrl-H backspaces)
- **Status**: Active, well-maintained by ideasman42
- **Repo**: <https://github.com/ideasman42/nerd-dictation>

**Trade-off**: Lower accuracy than Whisper (no auto-capitalization, weaker with unusual words), but real-time streaming means zero wait after you stop speaking. Good for short commands and quick dictation where low latency matters more than perfect accuracy.

**Wayland setup guide**: <https://alterflow.ai/offline-voice-typing-on-ubuntu/>

---

### Turbo Whisper -- GUI with Waveform

SuperWhisper-like voice dictation for Linux with a visual waveform UI.

- **Engine**: faster-whisper (via faster-whisper-server)
- **Platforms**: Linux (Arch via AUR, Debian/Ubuntu via PPA), macOS, Windows
- **Offline**: Yes (runs your own Whisper server locally)
- **Integration**: xdotool + xclip
- **Config**: `~/.config/turbo-whisper/config.json`
- **Status**: Active (2025)
- **Repo**: <https://github.com/knowall-ai/turbo-whisper>

---

### OpenWhispr -- Most Feature-Rich

Cross-platform Electron app with the most features: multiple AI providers, custom dictionary, model management UI.

- **Engine**: Whisper (whisper.cpp) + NVIDIA Parakeet (sherpa-onnx)
- **Platforms**: macOS, Windows, Linux (.deb, .rpm, Flatpak, AppImage)
- **Offline**: Yes (local Whisper models: tiny through turbo)
- **Integration**: Auto-paste at cursor via global hotkey (default: backtick)
- **Languages**: 58
- **AI Processing**: Optional post-processing via OpenAI/Claude/Gemini/local models
- **Custom Dictionary**: Yes, for improving accuracy on specific terms
- **Parakeet**: 25 languages via sherpa-onnx, fast on CPU
- **Terminal**: Yes (pastes at cursor)
- **Status**: Active (2025), MIT licensed, growing community
- **Repo**: <https://github.com/OpenWhispr/openwhispr>
- **Site**: <https://openwhispr.com/>

**Note**: Free to build from source. Pro Edition ($8/mo) for pre-built binaries with auto-updates.

---

### Whispering -- Cross-Platform, Open-Source

Tauri-based app with both local and cloud transcription, plus optional AI transforms.

- **Engine**: Local via Speaches, or cloud (OpenAI, Groq, ElevenLabs)
- **Platforms**: macOS, Windows, Linux (AppImage), plus browser version
- **Offline**: Yes (via Speaches local backend)
- **Integration**: Push-to-talk shortcut, text inserted into active app
- **AI Transforms**: Chain grammar fixes, translation, or formatting
- **Terminal**: Yes
- **Status**: Active (2025), MIT licensed, part of Epicenter ecosystem
- **Repo**: <https://github.com/braden-w/whispering>
- **Site**: <https://whispering.bradenwong.com/>

---

### WhisperWriter -- Simple Python App

Small dictation app using Whisper, auto-transcribes mic recordings to the active window.

- **Engine**: faster-whisper (local) or OpenAI API (cloud)
- **Platforms**: Cross-platform (Python/PyQt5)
- **Offline**: Yes by default (local faster-whisper)
- **Hotkey**: Ctrl+Shift+Space (configurable)
- **Modes**: Continuous (stops on silence pause), press-to-toggle, hold-to-record, always-on
- **GPU**: NVIDIA with CUDA for faster-whisper acceleration
- **Terminal**: Types into active window, so yes
- **Status**: Major rewrite May 2024, active
- **Repo**: <https://github.com/savbell/whisper-writer>

---

### AlterFlow's Faster-Whisper Dictation Guide (Ubuntu/Wayland)

Not a tool but a comprehensive setup guide for rolling your own dictation on Ubuntu 24.04+ with Wayland.

- **Stack**: faster-whisper + ydotool (Wayland typing) + custom Python script
- **Hotkey**: Ctrl+Space to start/stop
- **Fully offline**: Yes
- **Guide**: <https://alterflow.ai/blog/offline-voice-typing-on-ubuntu>

Good reference if you want to understand how these tools work under the hood and customize your own.

---

### ibus-speech-to-text -- System Input Method (Fedora 42)

A proper IBus input method that provides voice dictation to any application supporting IBus. This is the "right way" to do it at the system level on GNOME/Fedora.

- **Engine**: Vosk
- **Platforms**: Fedora Linux 42+
- **Offline**: Yes
- **Integration**: IBus input method framework -- works in any IBus-aware application
- **Switching**: Standard Win+Space input method toggle
- **Setup**: GTK 4 / libadwaita configuration tool for model management
- **Status**: Accepted as a Fedora 42 change
- **Reference**: <https://fedoraproject.org/wiki/Changes/ibus-speech-to-text>

**Significance**: This is the first proper system-level speech input method for Linux. Instead of faking keyboard input with xdotool, it integrates through the actual input method framework. However, it uses Vosk (not Whisper), so accuracy may be lower.

---

### Talon Voice -- Most Powerful (Voice Coding)

Talon is not just dictation -- it's a full voice-computing platform designed for developers who need to code by voice. Extremely powerful but has a steep learning curve.

- **Engine**: Built-in Conformer (wav2letter), optional Dragon
- **Platforms**: macOS, Windows, Linux
- **Offline**: Yes (Conformer runs locally)
- **Languages**: English only (Conformer); multilingual via Vosk beta
- **Integration**: Full system control -- typing, mouse, window management, editor commands
- **Coding**: Spelling alphabet, custom grammars, IDE integration, scriptable with Python 3
- **Eye tracking**: Tobii 4C/5 support
- **Accuracy**: Competitive with Dragon, good with made-up/technical words
- **Latency**: Optimized, recent Rust rewrite improved performance
- **Terminal**: Yes, with full command support
- **Status**: Active, strong community
- **Site**: <https://talonvoice.com/>
- **Community**: <https://talon.wiki/>
- **Getting started**: Clone [talonhub/community](https://github.com/talonhub/community) into ~/.talon/user

**Who it's for**: People with RSI, accessibility needs, or anyone willing to invest days/weeks learning the system. Not a "press key, speak, get text" tool -- it's a whole alternative input paradigm.

**Who it's not for**: Anyone wanting quick dictation without learning a new system. The command-based approach (saying "air bat cap" to type "abc") is powerful but requires memorization.

---

## Desktop Tools -- macOS

### macOS Built-in Dictation

The free, built-in option. Quality depends heavily on your hardware.

- **Apple Silicon (M1+)**: Processes locally on-device via Neural Engine. Good accuracy, no internet needed, no timeout, can type while dictating. Improved significantly in macOS Tahoe (2025).
- **Intel Mac**: Sends audio to Apple servers. Slower, less private, less accurate. Offline dictation was removed after macOS Mojave (the "Enhanced Dictation" feature). Only available offline if running macOS Mojave or earlier.
- **Accuracy**: Adequate for short messages, frustrating for extended dictation. Below Whisper quality.
- **Terminal**: Yes, works in any text field

**For Intel Mac users**: Built-in dictation requires internet and is mediocre. Third-party tools are strongly recommended.

---

### Voice Type (Careless Whisper) -- Best for Intel Mac ($20)

Hold a hotkey, speak, release. Clean text appears in any app. One-time purchase, no subscription.

- **Engine**: Whisper-derived models via Core ML / Metal
- **Platforms**: macOS (Apple Silicon AND Intel, macOS Ventura+)
- **Offline**: Yes, fully on-device
- **Models**: 27MB to 550MB, pick speed vs accuracy
- **Integration**: System-wide, works in any text field (Word, Docs, JIRA, Obsidian, terminals)
- **Price**: $19.99 one-time (7-day free trial)
- **Terminal**: Yes
- **Site**: <https://carelesswhisper.app/>

**Key advantage**: Explicitly supports Intel Macs, unlike many competitors. One-time purchase avoids subscription fatigue.

---

### Superwhisper -- Power User Mac Dictation

The most customizable Mac dictation app, with multiple AI model tiers and optional LLM post-processing.

- **Engine**: Whisper models (Nano/Fast/Pro/Ultra tiers)
- **Platforms**: macOS + iOS only
- **Offline**: Yes on Apple Silicon; Intel Macs work best with cloud models
- **Models**: From fast/less accurate to slow/highly accurate (95%+)
- **Latency**: 700ms+ for offline (larger models slower); cloud mode faster
- **Integration**: System-wide via keyboard shortcut
- **Price**: $49 one-time, or $8.49/month
- **Terminal**: Yes
- **Site**: <https://superwhisper.com/>

**For Intel Mac**: Not recommended. Offline models perform poorly on Intel. Cloud models work but defeat the "local" purpose.

---

### OpenSuperWhisper -- Free macOS Alternative

Open-source macOS dictation app with global keyboard shortcuts.

- **Engine**: Whisper
- **Platforms**: macOS only
- **Offline**: Yes
- **Hotkey**: Cmd+backtick
- **Languages**: Multi-language with auto-detection
- **Status**: Active
- **Repo**: <https://github.com/Starmel/OpenSuperWhisper>

---

### Other macOS Options

| Tool | Price | Intel? | Notes |
|------|-------|--------|-------|
| [MacWhisper](https://goodsnooze.gumroad.com/l/macwhisper) | Free/Paid tiers | Yes (slower) | Transcription-focused, added dictation feature |
| [BetterDictation](https://betterdictation.com/) | Paid | No (M1+ only) | Uses Apple Neural Engine, very fast on AS |
| [Spokenly](https://spokenly.app/) | Paid | Unknown | Local-only mode, multilingual, auto-detection |
| [Whisper Notes](https://whispernotes.app/) | $4.99 | Yes (dedicated build) | Transcription app, not real-time dictation |
| [Wispr Flow](https://wisprflow.ai) | $12/mo | Yes | Cloud-based, not offline. Adapts to your writing style |

---

## Android Speech-to-Text Keyboards

### FUTO Voice Input / FUTO Keyboard -- Best Android Option

The clear winner for offline speech-to-text on Android. Based on Whisper, fully offline, actively developed.

- **Engine**: OpenAI Whisper (multiple model sizes)
- **Offline**: Yes, 100% on-device. Internet only for model downloads
- **Integration**: Android voice input API (works with any keyboard) or as standalone FUTO Keyboard
- **Models**: English-39 (fast, default), English-74 (balanced), English-244 (most accurate)
- **Features**: Auto-punctuation, removes "ums" and repeated words, no need to say punctuation
- **Limit**: 30 seconds per recording (enough to speak, review, edit)
- **Keyboard compatibility**: Works with FUTO Keyboard (built-in), OpenBoard, AnySoftKeyboard
- **Accuracy**: Users report "easily the best voice input" -- gets intent right most of the time
- **Latency**: English-39 is fast; English-74 and English-244 are slower
- **Price**: Free (open source, pay-what-you-want)
- **Status**: Active development (FUTO Keyboard in open testing, voice input stable)
- **Voice Input**: <https://voiceinput.futo.org/>
- **Keyboard**: <https://keyboard.futo.org/>
- **GitHub**: <https://github.com/futo-org/voice-input>

**Best approach**: Install FUTO Keyboard for integrated experience, or install FUTO Voice Input standalone to use with your existing keyboard.

---

### Google Offline Voice Typing

Android's built-in option. Decent but not as accurate as FUTO/Whisper for offline use.

- **Setup**: Gboard Settings > Voice typing > Offline speech recognition > Download language pack
- **Offline**: Yes (after downloading 50-100MB language pack)
- **Integration**: Built into Gboard, works everywhere
- **Accuracy**: Good online, noticeably worse offline (struggles with uncommon words, accents)
- **Languages**: Fewer languages available offline than online
- **Faster Voice Typing**: Toggle this on for better offline performance
- **Price**: Free

**Note**: Not all English variants are available offline (e.g., en-NZ). Use en-US or en-GB.

---

### Sayboard -- Vosk-Based (Lighter Weight)

Open-source voice keyboard using Vosk (not Whisper). Lighter on resources but lower accuracy.

- **Engine**: Vosk
- **Offline**: Yes
- **Integration**: Android IME (keyboard replacement)
- **Models**: Download Vosk models via built-in downloader or manually
- **Requires**: Android 6.0+
- **Status**: Available on F-Droid
- **Repo**: <https://github.com/ElishaAz/Sayboard>

**Trade-off**: Smaller models and lower resource usage vs lower accuracy than FUTO.

---

### Kaiboard -- Whisper.cpp on Android

Open-source keyboard using whisper.cpp. Promising concept but limited by small default model.

- **Engine**: whisper.cpp (tiny model by default)
- **Offline**: Yes
- **Integration**: Android keyboard replacement
- **Storage**: ~72MB
- **Status**: Last updated December 2024, being rebuilt
- **Repo**: <https://github.com/kaisoapbox/kaiboard>

**Problems reported by users**: Tiny model = many errors. No larger model option. No text keyboard for corrections. No language selection. Users report switching to FUTO for better accuracy.

---

## Terminal-Specific Usage

All the desktop tools above that use xdotool/ydotool/wtype work in terminals because they type into whatever window is focused. Specific notes:

| Tool | Terminal Works? | How |
|------|----------------|-----|
| SoupaWhisper | Yes | xdotool types into focused window |
| hyprwhspr | Yes | Types into active buffer |
| nerd-dictation | Yes | xdotool, wtype, ydotool, or raw stdout mode |
| OpenWhispr | Yes | Pastes at cursor |
| Whispering | Yes | Push-to-talk into active app |
| WhisperWriter | Yes | Types into active window |
| Talon Voice | Yes | Full terminal command support |
| Voice Type (Mac) | Yes | Works in any text field |
| macOS Dictation | Yes | Works in any text field |

**nerd-dictation's stdout mode** is unique: it can pipe speech directly to stdout without any GUI dependency, which makes it usable in headless/SSH scenarios.

**spchcat** is another option that outputs directly to terminal: `spchcat` with no args captures from default mic and prints to stdout. Useful for piping speech into other commands.

- **Repo**: <https://github.com/petewarden/spchcat>

---

## Whisper Model Size vs Performance Reference

| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| tiny.en | ~39MB | Fastest | ~85% | Quick commands, low-power devices |
| base.en | ~74MB | Fast | ~88% | Daily dictation sweet spot |
| small.en | ~244MB | Medium | ~91% | Good accuracy without GPU |
| medium.en | ~769MB | Slow | ~94% | High accuracy, GPU recommended |
| large-v3 | ~1.5GB | Slowest | ~96% | Best accuracy, GPU required |
| large-v3-turbo | ~809MB | 6x faster than large | ~95% | Best speed/accuracy ratio with GPU |

For real-time dictation, **base.en** is the sweet spot on CPU. Larger models introduce delays that break typing flow unless you have a GPU.

**faster-whisper** (CTranslate2) is ~4x faster than the original OpenAI Whisper implementation for the same accuracy.

**Parakeet TDT V3** (NVIDIA) is reportedly even faster than Whisper while maintaining strong accuracy -- worth trying via hyprwhspr or OpenWhispr.

---

## Comparison: Vosk vs Whisper vs Parakeet

| | Vosk | Whisper | Parakeet TDT V3 |
|---|---|---|---|
| **Accuracy** | Good | Excellent | Excellent |
| **Speed** | Real-time streaming | Batch (wait for result) | Very fast batch |
| **Model size** | 50-200MB | 39MB-1.5GB | ~1GB |
| **CPU usage** | Low | Moderate-High | Low-Moderate |
| **GPU benefit** | Minimal | Huge | Significant |
| **Languages** | 20+ | 99+ | 25 |
| **Auto-capitalize** | No | Yes | Yes |
| **Auto-punctuate** | No | Yes | Yes |
| **Streaming** | Yes (real-time) | No (transcribes after silence) | No |

**Vosk** wins on latency (streaming) and resource usage. **Whisper** wins on accuracy and language support. **Parakeet** is the emerging challenger with excellent speed and accuracy.

---

## What Actually Works for Daily Use

Based on user reports and real-world feedback:

### Tier 1: Ready for Daily Use

1. **FUTO Voice Input** (Android) -- The most praised tool across all platforms. "Easily the best voice input." Auto-punctuation, handles ums, works offline. Install it.

2. **SoupaWhisper** (Linux, X11) -- Simple, works, 250 lines of Python. Hold F12, speak, done. Use base.en model for the speed/accuracy sweet spot.

3. **Voice Type** (macOS, including Intel) -- $20 one-time, hold hotkey, speak, text appears. Works in any app. Intel Mac support is a differentiator.

4. **nerd-dictation** (Linux) -- Battle-tested, lightweight, real-time Vosk streaming. Lower accuracy than Whisper but zero post-speech delay.

### Tier 2: Good but With Caveats

5. **hyprwhspr** (Linux, Wayland) -- Excellent if you're on Hyprland/Wayland. Parakeet backend is impressively fast. Less polished than SoupaWhisper for general use.

6. **OpenWhispr** (Cross-platform) -- Feature-rich but heavier (Electron). Good if you want model management UI, custom dictionaries, and multi-provider support.

7. **Talon Voice** (Cross-platform) -- The most powerful option by far, but requires significant time investment to learn. Worth it for RSI sufferers or anyone spending 8+ hours daily at a keyboard.

8. **Google offline voice typing** (Android) -- Free, built-in, decent. FUTO is better but Google works if you don't want another app.

### Tier 3: Promising but Rough

9. **Whispering** (Cross-platform) -- Good concept, active development, but still maturing.

10. **Handy** (Cross-platform) -- The starting point for this research. Good idea, not quite daily-driver quality yet.

11. **WhisperWriter** (Cross-platform) -- Works for short phrases. PyQt5 UI feels dated.

12. **Kaiboard** (Android) -- Good idea, tiny model = too many errors. Wait for larger model support.

---

## Recommended Setup

### For the user's specific platforms:

**Linux desktop**:
```bash
# Option A: SoupaWhisper (simple, X11)
git clone https://github.com/ksred/soupawhisper.git
cd soupawhisper
sudo apt install alsa-utils xclip xdotool libnotify-bin
poetry install
# Configure ~/.config/soupawhisper/config.ini (model=base.en)
./install.sh  # sets up systemd service

# Option B: nerd-dictation (lightweight, real-time)
git clone https://github.com/ideasman42/nerd-dictation.git
pip3 install vosk
# Download vosk-model-en-us-0.22-lgraph, extract as ./model
./nerd-dictation begin --vosk-model-dir=./model &
# Bind to a hotkey in your DE
```

**macOS Intel**:
- Install [Voice Type](https://carelesswhisper.app/) ($19.99) for the best offline experience on Intel
- Alternatively, try macOS built-in dictation (requires internet on Intel)

**Android**:
- Install [FUTO Voice Input](https://play.google.com/store/apps/details?id=org.futo.voiceinput) or [FUTO Keyboard](https://play.google.com/store/apps/details?id=org.futo.inputmethod.latin.playstore)
- Download the English-39 model (fast) or English-74 (balanced)
- Enable as voice input method in Android settings

---

## Sources

- [SoupaWhisper](https://github.com/ksred/soupawhisper) -- [Blog post](https://www.ksred.com/soupawhisper-how-i-replaced-superwhisper-on-linux/)
- [hyprwhspr](https://github.com/goodroot/hyprwhspr)
- [nerd-dictation](https://github.com/ideasman42/nerd-dictation)
- [Turbo Whisper](https://github.com/knowall-ai/turbo-whisper)
- [OpenWhispr](https://github.com/OpenWhispr/openwhispr) -- [Site](https://openwhispr.com/)
- [Whispering](https://github.com/braden-w/whispering) -- [Site](https://whispering.bradenwong.com/)
- [WhisperWriter](https://github.com/savbell/whisper-writer)
- [Talon Voice](https://talonvoice.com/) -- [Wiki](https://talon.wiki/) -- [Community repo](https://github.com/talonhub/community)
- [Voice Type](https://carelesswhisper.app/)
- [Superwhisper](https://superwhisper.com/)
- [OpenSuperWhisper](https://github.com/Starmel/OpenSuperWhisper)
- [MacWhisper](https://goodsnooze.gumroad.com/l/macwhisper)
- [FUTO Voice Input](https://voiceinput.futo.org/) -- [GitHub](https://github.com/futo-org/voice-input)
- [FUTO Keyboard](https://keyboard.futo.org/)
- [Sayboard](https://github.com/ElishaAz/Sayboard)
- [Kaiboard](https://github.com/kaisoapbox/kaiboard)
- [Handy](https://github.com/cjpais/Handy)
- [spchcat](https://github.com/petewarden/spchcat)
- [ibus-speech-to-text](https://fedoraproject.org/wiki/Changes/ibus-speech-to-text)
- [AlterFlow Wayland guide](https://alterflow.ai/blog/offline-voice-typing-on-ubuntu)
- [awesome-whisper](https://github.com/sindresorhus/awesome-whisper)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- [voice_typing (themanyone)](https://github.com/themanyone/voice_typing)
- [faster-whisper-dictation](https://github.com/doctorguile/faster-whisper-dictation)
- [Voquill](https://github.com/josiahsrc/voquill)
