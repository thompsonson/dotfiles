# Terminal Emulator Speech-to-Text Integration Research

Research into terminal emulators with extensibility/plugin systems that could support a speech-to-text workflow:

1. Press a hotkey
2. Speak
3. See a preview/confirmation popup of the transcribed text
4. Confirm → text gets typed into the terminal
5. (Bonus) TTS reads back the response

Platforms: macOS Intel and Linux (CPU only, no GPU).

The user already uses tmux.

---

## Quick Recommendation Summary

| Approach | Difficulty | Popup/Confirm? | Cross-Platform | Notes |
|----------|-----------|----------------|----------------|-------|
| **tmux display-popup + script** | Low | Yes (native) | macOS + Linux | Best option. Already uses tmux. Popup shows transcribed text, confirm injects via `send-keys` |
| **WezTerm Lua** | Medium | Yes (PromptInputLine, InputSelector) | macOS + Linux | Most powerful built-in overlay system. Lua scripting can run external STT and show results |
| **Kitty custom kitten** | Medium | Yes (overlay window) | macOS + Linux | Python kitten runs in overlay, `handle_result` injects text |
| **Zellij WASM plugin** | High | Yes (floating pane) | macOS + Linux | Full custom UI via WASM, but requires Rust/compiled plugin |
| **iTerm2 Python API** | Medium | Partial (no native popup) | macOS only | Can `send_text` but no built-in confirmation overlay |
| **Hyper (Electron)** | Medium | Yes (full DOM) | macOS + Linux | Electron = full web UI, but Hyper is heavy and declining |
| **Ghostty** | Not possible | No | macOS + Linux | No plugin/scripting system yet |
| **Alacritty** | Not possible | No | macOS + Linux | Intentionally no plugin system |

**Winner: tmux `display-popup`** -- zero new dependencies, works with any terminal emulator, native popup confirmation, already in the user's workflow.

**Runner-up: WezTerm** -- if switching terminals is on the table, WezTerm's Lua scripting with `PromptInputLine` is the most elegant native solution.

---

## Terminal Emulator Analysis

### 1. tmux (Already in Use) -- BEST OPTION

**Plugin/Scripting System**: tmux has a command language, key bindings, hooks, and can shell out to any script. The `display-popup` command (tmux 3.2+) creates floating overlay windows that run arbitrary commands.

**Overlay/Popup Support**: Yes -- `display-popup` is purpose-built for this. It creates a floating terminal window with configurable size and position. The `-E` flag closes the popup when the command exits. The `-d` flag sets the working directory.

**Custom Hotkeys**: Yes -- `bind-key` supports arbitrary key combinations that trigger commands, including `display-popup`.

**Text Injection**: `tmux send-keys -t <target> -l "<text>"` injects literal text into any pane. The `-l` flag is critical -- it prevents tmux from interpreting words like "Enter" or "Space" as key names.

**Existing Voice Integration**: The [stt-mcp-server-linux](https://github.com/marcindulak/stt-mcp-server-linux) project already does exactly this: push-to-talk via Right Ctrl, Whisper transcription, injection via `tmux send-keys`. It runs in Docker and is Linux-only (uses `/dev/input` for key detection).

**How Hard to Build the Workflow**:

This is the easiest path. A bash script in a tmux popup can do the entire workflow:

```bash
# In ~/.tmux.conf:
bind-key v display-popup -E -w 60% -h 30% -T "Voice Input" \
  "~/.local/bin/voice-input.sh #{pane_id}"

# voice-input.sh:
# 1. Record audio (sox/arecord) until silence or keypress
# 2. Transcribe with whisper.cpp / vosk
# 3. Show transcribed text + [Enter] to confirm / [Esc] to cancel
# 4. On confirm: tmux send-keys -t $TARGET_PANE -l "$text"
# 5. (Bonus) say "$response" or espeak "$response" for TTS
```

The popup runs inside tmux's own floating window, shows the transcription, waits for confirmation, then injects text into the original pane. When the script exits, the popup disappears automatically.

**Additional tmux mechanisms**:
- `confirm-before` -- built-in yes/no confirmation dialog
- `display-menu` -- native menu with selectable options
- `display-message` -- show a status line message
- [tmux-menus](https://github.com/jaclu/tmux-menus) plugin -- advanced popup menus

**Cross-Platform**: macOS + Linux. tmux 3.2+ required for `display-popup`.

**Sources**:
- [tmux display-popup guide](https://tmuxai.dev/tmux-popup/)
- [tmux popup cheatsheet](https://justyn.io/til/til-tmux-popup-cheatsheet/)
- [stt-mcp-server-linux](https://github.com/marcindulak/stt-mcp-server-linux)
- [tmux-menus plugin](https://github.com/jaclu/tmux-menus)
- [tmux send-keys usage](https://tmuxai.dev/tmux-send-keys/)
- [Creating tmux popup sessions](https://madprofessorblog.org/articles/creating-a-tmux-keybinding-for-pop-up-sessions/)

---

### 2. WezTerm -- BEST NATIVE TERMINAL OPTION

**Plugin/Scripting System**: WezTerm is configured entirely in Lua 5.4. The config file is a full Lua program. The killer feature is `wezterm.action_callback()` -- any keybinding can execute arbitrary Lua code with access to the window and pane objects.

**Overlay/Popup Support**: Yes -- WezTerm has three built-in overlay mechanisms:
- **`PromptInputLine`** -- displays a text prompt overlay, user types a line, callback receives the text. Supports styled descriptions via `wezterm.format`. Nightly builds add `initial_value` to pre-fill the input.
- **`InputSelector`** -- displays a selectable list overlay with optional fuzzy finding. Each choice has a `label` and `id`. The callback receives the selected item.
- **`PaneSelect`** -- overlays pane labels for selection.

All three are modal overlays rendered by WezTerm itself -- they are not shell commands in a separate pane.

**Custom Hotkeys**: Yes -- full keybinding system with `wezterm.action_callback` for arbitrary Lua execution. Supports leader keys (tmux-style prefix), modal key tables (vim-style modes), and direct key assignments.

**Text Injection**: `pane:send_text(text)` sends text to a pane as if the user typed it.

**Existing Voice Integration**: No specific voice/STT integration found.

**How Hard to Build the Workflow**:

Medium difficulty. The Lua scripting is powerful but you need to call an external STT process and handle async results. A sketch:

```lua
-- In ~/.wezterm.lua:
config.keys = {
  {
    key = "v",
    mods = "CTRL|SHIFT",
    action = wezterm.action_callback(function(window, pane)
      -- 1. Spawn external recording + transcription process
      local handle = io.popen("voice-record-and-transcribe.sh")
      local text = handle:read("*a")
      handle:close()

      -- 2. Show confirmation via PromptInputLine (pre-filled with transcription)
      window:perform_action(
        wezterm.action.PromptInputLine({
          description = "Transcribed text (edit or Enter to confirm, Esc to cancel):",
          initial_value = text,  -- nightly only
          action = wezterm.action_callback(function(inner_window, inner_pane, line)
            if line then
              inner_pane:send_text(line)
            end
          end),
        }),
        pane
      )
    end),
  },
}
```

The challenge is that `io.popen` blocks the Lua event loop during recording/transcription. A more robust approach would use WezTerm's `wezterm.background_child_process` or an external daemon.

**`PromptInputLine` with `initial_value`** is ideal for the confirmation step -- it shows the transcribed text pre-filled in an editable input overlay. The user can edit, press Enter to confirm (which calls `pane:send_text`), or Esc to cancel. This is the cleanest native implementation of the confirmation popup.

**Cross-Platform**: macOS + Linux + Windows. GPU-accelerated.

**Sources**:
- [WezTerm PromptInputLine](https://wezterm.org/config/lua/keyassignment/PromptInputLine.html)
- [WezTerm InputSelector](https://wezterm.org/config/lua/keyassignment/InputSelector.html)
- [WezTerm send_text](https://wezterm.org/config/lua/pane/send_text.html)
- [WezTerm Lua config reference](https://wezterm.org/config/lua/general.html)
- [Custom Lua functions in keybindings discussion](https://github.com/wezterm/wezterm/discussions/4357)
- [WezTerm as AI-native terminal](https://gist.github.com/johnlindquist/53b5638e82e1932cfc762ad23ad99d87)

---

### 3. Kitty -- GOOD OPTION

**Plugin/Scripting System**: Kitty has "kittens" -- Python scripts that run in overlay windows over the terminal. A kitten has two functions:
- `main(args)` -- runs in the overlay window, can use `input()` for user interaction, returns a value
- `handle_result(args, answer, target_window_id, boss)` -- runs in the kitty process, can manipulate windows and paste text

Kitty also has a remote control protocol (JSON over Unix socket or TCP) with encrypted communication support, and a shell (`ctrl+shift+escape`) for interactive control.

**Overlay/Popup Support**: Yes -- kittens run in overlay windows by default. Launch types include `overlay`, `overlay-main`, `os-window`, `tab`, `window`, and `background`. Overlays cover the current active kitty window.

**Custom Hotkeys**: Yes -- `map` directives in `kitty.conf` bind keys to kitten launches or remote control commands.

**Text Injection**: In `handle_result()`, the kitten has access to the `boss` object which can paste text into the target window. Remote control also supports `send-text`.

**Screen Content Access**: Kittens can read the active window's screen content, scrollback buffer, and ANSI formatting via the `@result_handler(type_of_input=...)` decorator.

**Existing Voice Integration**: No voice/STT kitten found. KittenTTS exists but is a standalone TTS model, unrelated to the kitty terminal.

**How Hard to Build the Workflow**:

Medium difficulty. A custom kitten can implement the full workflow:

```python
# ~/.config/kitty/voice_input.py
import subprocess

def main(args):
    """Runs in overlay window"""
    print("Recording... (press Enter to stop)")
    input()  # Wait for user to stop recording
    # Or use subprocess to record + transcribe
    result = subprocess.run(
        ["voice-transcribe.sh"],
        capture_output=True, text=True
    )
    text = result.stdout.strip()
    print(f"\nTranscribed: {text}")
    confirm = input("\n[Enter] to send, [Esc/Ctrl-C] to cancel: ")
    return text

def handle_result(args, answer, target_window_id, boss):
    """Runs in kitty process -- injects text"""
    if answer:
        w = boss.window_id_map.get(target_window_id)
        if w is not None:
            w.paste_text(answer)
```

```ini
# In kitty.conf:
map ctrl+shift+v kitten voice_input.py
```

The overlay window provides the visual confirmation step, and `handle_result` injects the text into the original terminal window. The kitten framework handles the overlay lifecycle automatically.

**Cross-Platform**: macOS + Linux. GPU-accelerated (OpenGL).

**Sources**:
- [Custom kittens documentation](https://sw.kovidgoyal.net/kitty/kittens/custom/)
- [Kitty remote control](https://sw.kovidgoyal.net/kitty/remote-control/)
- [Kitty remote control protocol](https://sw.kovidgoyal.net/kitty/rc_protocol/)
- [Kitty launch command (overlay types)](https://sw.kovidgoyal.net/kitty/launch/)
- [Kittens introduction](https://sw.kovidgoyal.net/kitty/kittens_intro/)

---

### 4. Zellij -- CAPABLE BUT HIGH EFFORT

**Plugin/Scripting System**: Zellij uses WebAssembly (WASM) plugins compiled via WASI. Plugins written in any language that compiles to WASM (Rust has first-class support with official SDK). Plugins get a `render()` function for custom UI, a `pipe()` function for receiving messages, and access to background workers for long-running tasks.

**Overlay/Popup Support**: Yes -- plugins can run in floating panes with configurable position and size (`--floating --width 50 --height 20% -x 10% -y 50%`). Floating panes were introduced in Zellij 0.25.0. Pinned floating panes (stay on top) were added in 0.42.0.

**Custom Hotkeys**: Yes -- keybindings can use `MessagePlugin` or `LaunchOrFocusPlugin` actions to send messages to WASM plugins via pipes. Pipes support `launch_new`, `skip_cache`, `floating`, `name`, `payload`, and `title` parameters.

**Text Injection**: Plugins can write to panes via the plugin API's `write_chars` command.

**Existing Voice Integration**: No voice/STT plugin found.

**How Hard to Build the Workflow**:

High difficulty. You need to:
1. Write a WASM plugin in Rust (or another WASM-compatible language)
2. Implement audio recording (challenging in WASM sandbox -- likely needs an external helper process)
3. Implement the render function for the confirmation UI
4. Handle pipe messages from keybindings

The WASM sandbox makes audio access difficult. The practical approach would be a plugin that launches an external recording/transcription script, receives the result via pipe, renders it for confirmation, then injects text. This is doable but significantly more work than tmux or WezTerm approaches.

**Cross-Platform**: macOS + Linux.

**Sources**:
- [Zellij new plugin system](https://zellij.dev/news/new-plugin-system/)
- [Zellij plugin API commands](https://zellij.dev/documentation/plugin-api-commands.html)
- [Zellij developing a Rust plugin](https://zellij.dev/tutorials/developing-a-rust-plugin/)
- [Zellij pipes, filepicker](https://zellij.dev/news/welcome-screen-pipes-filepicker/)
- [Zellij floating panes](https://zellij.dev/news/floating-panes-tmux-mode/)
- [Zellij keybinding actions](https://zellij.dev/documentation/keybindings-possible-actions.html)
- [Zellij example plugins](https://zellij.dev/documentation/plugin-examples.html)

---

### 5. iTerm2 -- macOS ONLY, PARTIAL

**Plugin/Scripting System**: iTerm2 has a Python scripting API (`pip install iterm2`) that provides full control over sessions, windows, tabs, and profiles. Scripts can run as daemons, one-shot scripts, or be triggered by events. Additionally, iTerm2 has coprocesses -- external programs whose stdin receives terminal output and whose stdout is treated as keyboard input.

**Overlay/Popup Support**: No native popup/overlay mechanism. The Python API can create new windows, tabs, and split panes, but there is no floating overlay or modal dialog. You would need to use a separate window or split pane for the confirmation step.

**Custom Hotkeys**: Yes -- via the Python API's key binding hooks and iTerm2's trigger system.

**Text Injection**: `session.async_send_text(text)` sends text as if the user typed it. Coprocesses can also inject text by writing to stdout.

**Existing Voice Integration**: A GitHub gist exists for a coprocess that triggers macOS `say` (TTS) on Fabric task completion -- demonstrates the coprocess mechanism for voice output. No STT integration found.

**How Hard to Build the Workflow**:

Medium difficulty for a partial solution. You can build STT + injection easily via the Python API, but the confirmation popup is the weak point -- iTerm2 has no native overlay/popup. You would need to either:
- Open a temporary split pane (works but visually disruptive)
- Use a separate floating OS window (loses context)
- Skip the confirmation step and inject directly (loses the safety check)

**Cross-Platform**: macOS only. Not an option for the Linux requirement.

**Sources**:
- [iTerm2 Python API](https://iterm2.com/python-api/)
- [iTerm2 Python API introduction](https://iterm2.com/python-api/tutorial/index.html)
- [iTerm2 targeted input example](https://iterm2.com/python-api/examples/targeted_input.html)
- [iTerm2 coprocesses](https://iterm2.com/documentation-coprocesses.html)
- [iTerm2 session.async_send_text](https://iterm2.com/python-api/session.html)
- [Writing iTerm2 Python scripts](https://cgamesplay.com/post/2020/11/25/iterm-plugins/)

---

### 6. Hyper -- CAPABLE BUT DECLINING

**Plugin/Scripting System**: Hyper is built on Electron and uses JavaScript/React plugins. Extensions are Node.js modules loaded by both the Electron main process and the renderer process. The extension system is built around composition of React components and Redux actions.

**Overlay/Popup Support**: Yes -- since Hyper is an Electron app with full DOM access, plugins can render arbitrary React components including modals, overlays, and popups.

**Custom Hotkeys**: Yes -- plugins can register keyboard shortcuts.

**Text Injection**: Plugins can write to the terminal via the Redux store and terminal session objects.

**Existing Voice Integration**: No Hyper-specific voice plugin found. However, since Hyper is Electron-based, the following Electron voice libraries could be used:
- [electron-voice](https://github.com/orthagonal/electron-voice) -- real-time voice-to-text using Vosk, runs in a separate process
- [Artyom.js](https://ourcodeworld.com/articles/read/165/voice-commands-speech-recognition-and-speech-synthesis-with-electron-framework) -- speech recognition and synthesis wrapper
- Whisper via WebGPU/WASM -- runs in a WebWorker

**How Hard to Build the Workflow**:

Medium difficulty. Electron gives you full access to Node.js APIs (microphone, subprocess, file system) and full DOM for UI. A Hyper plugin could:
1. Listen for a hotkey
2. Record audio via Node.js (`node-record-lpcm16` or similar)
3. Transcribe via whisper.cpp subprocess or Vosk
4. Show a React modal overlay with the transcription
5. On confirm, write to the terminal session

The main drawback is that Hyper itself is heavy (Electron), has performance issues, and appears to be declining in maintenance and community activity. Building a plugin for a declining platform is risky.

**Cross-Platform**: macOS + Linux + Windows.

**Sources**:
- [Hyper terminal](https://hyper.is/)
- [HyperTerm -- A Hackable Terminal (Medium)](https://medium.com/@rupesh.more/hyperterm-a-hackable-terminal-e980edb1e50c)
- [electron-voice](https://github.com/orthagonal/electron-voice)
- [Artyom.js voice commands in Electron](https://ourcodeworld.com/articles/read/165/voice-commands-speech-recognition-and-speech-synthesis-with-electron-framework)

---

### 7. Ghostty -- NOT POSSIBLE (YET)

**Plugin/Scripting System**: Ghostty does not have a plugin or scripting system as of early 2026. There is an active [GitHub discussion (#2353)](https://github.com/ghostty-org/ghostty/discussions/2353) about a future Scripting API, and Mitchell Hashimoto has acknowledged community demand, but no timeline has been committed.

On macOS, Ghostty 1.2.0 (September 2025) added Apple Shortcuts integration, which provides some scriptability but is macOS-only and limited.

On Linux, Ghostty uses D-Bus (required by GTK), which could theoretically be used for basic scripting, but it is not officially exposed as an API.

**Libghostty** (an embeddable terminal library) is in early development with a Zig API available for testing, but the C API is not ready.

**Overlay/Popup Support**: No.

**Custom Hotkeys**: Configuration-based key bindings only, no programmatic hook system.

**Existing Voice Integration**: None.

**How Hard to Build**: Not possible with current capabilities.

**Cross-Platform**: macOS + Linux.

**Sources**:
- [Ghostty](https://ghostty.org/)
- [Ghostty scripting API discussion](https://github.com/ghostty-org/ghostty/discussions/2353)
- [Libghostty announcement](https://mitchellh.com/writing/libghostty-is-coming)
- [Ghostty 1.2.0 release notes](https://ghostty.org/docs/install/release-notes/1-2-0)

---

### 8. Alacritty -- NOT POSSIBLE (BY DESIGN)

**Plugin/Scripting System**: None, by design. Alacritty's philosophy is "integration over plugins" -- it favors external tools (window managers, terminal multiplexers) over internal extensibility. There are no plans to add a plugin system.

**What it does offer**: TOML configuration, regex hints for URL detection, Vi mode for viewport navigation, live config reload.

**Overlay/Popup Support**: No.

**Custom Hotkeys**: Configuration-based only (TOML), limited to built-in actions.

**Existing Voice Integration**: None.

**How Hard to Build**: Not possible. Alacritty is explicitly designed to not have plugins. Use tmux inside Alacritty for the popup workflow.

**Cross-Platform**: macOS + Linux + Windows + BSD.

**Sources**:
- [Alacritty](https://alacritty.org/)
- [Alacritty GitHub](https://github.com/alacritty/alacritty)

---

## Existing Terminal Voice/STT Projects

Several projects already combine terminal usage with speech-to-text, mostly targeting Claude Code:

### stt-mcp-server-linux
Local speech-to-text MCP server for tmux on Linux. Push-to-talk via Right Ctrl, Whisper tiny model transcription, injection via `tmux send-keys`. Runs in Docker. Linux-only (uses `/dev/input` for key detection, `/dev/snd` for audio).
- **Repo**: <https://github.com/marcindulak/stt-mcp-server-linux>
- **HN discussion**: <https://news.ycombinator.com/item?id=45208832>

### claude-ptt
Push-to-talk voice input for Claude Code using Whisper. Dual backends: OpenAI Whisper API and local whisper.cpp. Cross-platform (Windows, macOS, Linux including X11 and Wayland). Default hotkey: Ctrl+Space. Visual feedback for recording/transcribing status. Automatic fallback between backends.
- **Repo**: <https://github.com/aaddrick/claude-ptt>

### claude-code-voice
Voice-to-text for Claude Code using OpenAI Whisper. Push-to-talk with customizable hotkey (default: Right Shift). Auto-clipboard copy, local processing, smart silence detection, real-time audio levels.
- **Repo**: <https://github.com/jdpsc/claude-code-voice>

### voicemode
Natural voice conversations with Claude Code. Works offline with optional local services (Whisper STT, Kokoro TTS). Low latency.
- **Repo**: <https://github.com/mbailey/voicemode>

### speech2type (macOS)
Simple CLI tool for fast voice typing in every Mac app. Uses Deepgram API. Default hotkey: Cmd+;. Works with Claude Code, Cursor, any macOS app.
- **Repo**: <https://github.com/gergomiklos/speech2type>

### voice_typing (Linux)
Offline voice typing for Linux text terminals using Whisper/whisper.cpp. Uses ydotool to type into any active window. Works with X11 and without X (text terminals).
- **Repo**: <https://github.com/themanyone/voice_typing>

### WhisperTux (Linux)
Simple GUI around whisper.cpp for voice-to-text on Linux. Transcribes speech, then uses ydotool to type the text into the focused application. Described as "super useful for voice prompting AI models and speaking terminal commands."
- **Repo**: <https://github.com/cjams/whispertux>

---

## STT Engines for the Backend

Any terminal integration needs a speech-to-text backend. For CPU-only systems (macOS Intel, Linux no GPU):

| Engine | Size | Speed (CPU) | Accuracy | Streaming | Setup |
|--------|------|-------------|----------|-----------|-------|
| **whisper.cpp** (base.en, Q4_K_M) | ~142MB | Fast | Good | Via whisper-stream | `brew install whisper-cpp` or build from source |
| **Vosk** (small-en-us) | ~40MB | Real-time | Decent | Yes (native) | `pip install vosk` + model download |
| **Vosk** (en-us-0.22-lgraph) | ~300MB | Real-time | Good | Yes (native) | `pip install vosk` + model download |
| **faster-whisper** (base.en, int8) | ~74MB | 4x faster than Whisper | Good | No | `pip install faster-whisper` |
| **Parakeet TDT V3** (onnx-asr) | ~1GB | Very fast | Excellent | No | Via hyprwhspr or sherpa-onnx |

**For this workflow**: whisper.cpp with the base.en model (Q4_K_M quantized) is the best balance. Fast enough on CPU for interactive use, good accuracy, and the `whisper-stream` tool provides live microphone transcription. Vosk is a lighter alternative with real-time streaming but lower accuracy.

**Sources**:
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
- [Vosk](https://alphacephei.com/vosk/)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)

---

## Recommended Architecture: tmux display-popup

Since the user already uses tmux, the simplest and most robust approach is a shell script launched via `tmux display-popup`:

### Architecture

```
[tmux keybinding: prefix + v]
        |
        v
[display-popup runs voice-input.sh]
        |
        v
[Record audio via sox/arecord]
        |
        v
[Transcribe via whisper.cpp or vosk]
        |
        v
[Show transcribed text in popup]
[User: Enter to confirm, Esc to cancel, e to edit]
        |
        v
[tmux send-keys -t $ORIG_PANE -l "$text"]
        |
        v
[Text appears in original pane]
        |
        v (bonus)
[say/espeak reads response from pane]
```

### Implementation Sketch

**tmux.conf binding**:
```bash
bind-key v run-shell -b '\
  PANE="#{pane_id}"; \
  tmux display-popup -E -w 70% -h 40% -T " Voice Input " \
    "$HOME/.local/bin/voice-input.sh $PANE"'
```

**voice-input.sh** (conceptual):
```bash
#!/bin/bash
TARGET_PANE="$1"
TMPFILE=$(mktemp /tmp/voice-XXXXXX.wav)

echo "  Recording... (press Enter to stop)"
echo ""

# Record audio until Enter is pressed
# sox: -d = default mic, -r 16000 = 16kHz, -c 1 = mono
sox -d -r 16000 -c 1 "$TMPFILE" &
SOX_PID=$!
read -r  # Wait for Enter
kill $SOX_PID 2>/dev/null
wait $SOX_PID 2>/dev/null

echo "  Transcribing..."
echo ""

# Transcribe with whisper.cpp
TEXT=$(whisper-cli -m ~/.local/share/whisper/base.en.bin -f "$TMPFILE" --no-timestamps -nt 2>/dev/null | sed 's/^[[:space:]]*//')

rm -f "$TMPFILE"

if [ -z "$TEXT" ]; then
  echo "  (no speech detected)"
  sleep 1
  exit 1
fi

echo "  Transcribed:"
echo ""
echo "    $TEXT"
echo ""
echo "  [Enter] Send  [e] Edit  [Esc/q] Cancel"
echo ""

read -rsn1 KEY
case "$KEY" in
  ""|$'\n')  # Enter -- send as-is
    tmux send-keys -t "$TARGET_PANE" -l "$TEXT"
    ;;
  e|E)  # Edit -- let user modify
    read -r -e -i "$TEXT" -p "  Edit: " EDITED
    if [ -n "$EDITED" ]; then
      tmux send-keys -t "$TARGET_PANE" -l "$EDITED"
    fi
    ;;
  *)  # Anything else -- cancel
    echo "  Cancelled."
    sleep 0.5
    ;;
esac
```

### TTS Bonus (Step 5)

For reading back responses, a separate tmux hook or keybinding could capture the last N lines of pane output and pipe to TTS:

```bash
# macOS:
tmux capture-pane -t "$PANE" -p -S -5 | say

# Linux:
tmux capture-pane -t "$PANE" -p -S -5 | espeak-ng

# Or use KittenTTS (25MB, CPU-only, open-source):
# https://github.com/KittenML/KittenTTS
```

### Why tmux Wins

1. **Zero new dependencies** -- already using tmux
2. **Works with any terminal emulator** -- Alacritty, Kitty, Ghostty, WezTerm, iTerm2, Terminal.app
3. **Native floating popup** -- `display-popup` provides the confirmation overlay
4. **Simple injection** -- `send-keys -l` handles text injection reliably
5. **Shell script** -- no compiled language, no plugin SDK, just bash
6. **Cross-platform** -- works on macOS and Linux identically
7. **Composable** -- easy to swap STT backends, add TTS, modify the UI

---

## Alternative: WezTerm Native Approach

If the user is willing to switch to WezTerm (or already uses it), the Lua-native approach is more elegant:

### Key WezTerm APIs for This Workflow

| API | Purpose |
|-----|---------|
| `wezterm.action_callback(fn)` | Bind arbitrary Lua to a hotkey |
| `PromptInputLine` | Show an overlay with editable text input |
| `InputSelector` | Show an overlay with selectable choices |
| `pane:send_text(str)` | Inject text into terminal |
| `wezterm.run_child_process(args)` | Run external command |
| `window:active_pane()` | Get active pane (including overlays) |

### Advantages Over tmux

- **`PromptInputLine` with `initial_value`** pre-fills the transcription in an editable overlay -- cleaner UX than a bash script's `read` prompt
- **No subprocess needed for the popup** -- the overlay is rendered by WezTerm itself
- **Lua has better string handling** than bash for text manipulation
- **Single config file** -- everything lives in `~/.wezterm.lua`

### Disadvantages

- Requires switching terminal emulators (or running WezTerm alongside current setup)
- `initial_value` for `PromptInputLine` is only in nightly builds
- Lua `io.popen` blocks the event loop during recording -- needs careful async handling
- Less composable than the tmux approach (tied to WezTerm)

---

## Summary Table

| Terminal | Plugin System | Popups/Overlays | Hotkey Hooks | Text Injection | Voice Projects | Build Difficulty | Platforms |
|----------|--------------|-----------------|--------------|----------------|----------------|-----------------|-----------|
| **tmux** | Shell commands | `display-popup` (floating) | `bind-key` | `send-keys -l` | stt-mcp-server-linux | **Low** | macOS + Linux |
| **WezTerm** | Lua 5.4 | PromptInputLine, InputSelector | `action_callback` | `pane:send_text` | None | **Medium** | macOS + Linux + Windows |
| **Kitty** | Python kittens | Overlay windows | `map` in config | `handle_result` paste | None | **Medium** | macOS + Linux |
| **Zellij** | WASM (Rust) | Floating panes | `MessagePlugin` pipe | Plugin API `write_chars` | None | **High** | macOS + Linux |
| **iTerm2** | Python API | No native popup | Python hooks | `async_send_text` | Coprocess TTS gist | **Medium** | macOS only |
| **Hyper** | JS/React (Electron) | Full DOM overlays | Plugin hotkeys | Redux terminal write | None (Electron libs available) | **Medium** | macOS + Linux + Windows |
| **Ghostty** | None (planned) | No | Config-only | No | None | **Not possible** | macOS + Linux |
| **Alacritty** | None (by design) | No | Config-only | No | None | **Not possible** | macOS + Linux |

---

## Sources

### Terminal Emulators
- [Kitty custom kittens](https://sw.kovidgoyal.net/kitty/kittens/custom/)
- [Kitty remote control](https://sw.kovidgoyal.net/kitty/remote-control/)
- [Kitty launch command](https://sw.kovidgoyal.net/kitty/launch/)
- [WezTerm PromptInputLine](https://wezterm.org/config/lua/keyassignment/PromptInputLine.html)
- [WezTerm InputSelector](https://wezterm.org/config/lua/keyassignment/InputSelector.html)
- [WezTerm send_text](https://wezterm.org/config/lua/pane/send_text.html)
- [WezTerm Lua reference](https://wezterm.org/config/lua/general.html)
- [iTerm2 Python API](https://iterm2.com/python-api/)
- [iTerm2 coprocesses](https://iterm2.com/documentation-coprocesses.html)
- [Ghostty scripting discussion](https://github.com/ghostty-org/ghostty/discussions/2353)
- [Libghostty](https://mitchellh.com/writing/libghostty-is-coming)
- [Zellij plugin system](https://zellij.dev/news/new-plugin-system/)
- [Zellij plugin API](https://zellij.dev/documentation/plugin-api-commands.html)
- [Zellij floating panes](https://zellij.dev/news/floating-panes-tmux-mode/)
- [Hyper terminal](https://hyper.is/)
- [Alacritty](https://alacritty.org/)

### tmux Popup / Scripting
- [tmux display-popup guide](https://tmuxai.dev/tmux-popup/)
- [tmux popup cheatsheet](https://justyn.io/til/til-tmux-popup-cheatsheet/)
- [tmux send-keys](https://tmuxai.dev/tmux-send-keys/)
- [tmux-menus plugin](https://github.com/jaclu/tmux-menus)
- [tmux scripting guide](https://tao-of-tmux.readthedocs.io/en/latest/manuscript/10-scripting.html)
- [Popup session keybinding](https://madprofessorblog.org/articles/creating-a-tmux-keybinding-for-pop-up-sessions/)
- [Floating popups in tmux (DEV)](https://dev.to/waylonwalker/floating-popups-in-tmux-67)

### Existing Voice/STT Terminal Projects
- [stt-mcp-server-linux](https://github.com/marcindulak/stt-mcp-server-linux)
- [claude-ptt](https://github.com/aaddrick/claude-ptt)
- [claude-code-voice](https://github.com/jdpsc/claude-code-voice)
- [voicemode](https://github.com/mbailey/voicemode)
- [speech2type](https://github.com/gergomiklos/speech2type)
- [voice_typing](https://github.com/themanyone/voice_typing)
- [WhisperTux](https://github.com/cjams/whispertux)
- [OpenWhispr](https://github.com/OpenWhispr/openwhispr)

### STT Engines
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
- [Vosk](https://alphacephei.com/vosk/)
- [Vosk models](https://alphacephei.com/vosk/models)
- [nerd-dictation](https://github.com/ideasman42/nerd-dictation)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)

### Voice-to-Text Claude Code Integration Guide
- [Voice-to-Text Integration (DeepWiki)](https://deepwiki.com/FlorianBruniaux/claude-code-ultimate-guide/9.4-voice-to-text-integration)
- [Voice Control for Claude Code (Medium)](https://medium.com/@agentic.ai.forge/voice-control-for-claude-code-a-step-by-step-guide-to-local-speech-recognition-ffc4928a9aec)
- [Voicy for Claude Code](https://usevoicy.com/speech-to-text-in-claude-code)
