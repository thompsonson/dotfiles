# Wake-on-LAN (wol)

`wol` sends Wake-on-LAN magic packets to devices in a name → MAC/IP registry, and can poll-ping a device until it answers. Useful for "wake the NAS, then wait until it's actually reachable" scripts.

**Source:** `~/.local/bin/wol` (`dot_local/bin/executable_wol` in chezmoi)

## Synopsis

```bash
wol                              # Device dashboard: MAC, IP, live reachability (default)
wol status                       # Same as above
wol list                         # List configured devices (no ping)
wol wake <name> [--ping] [--timeout N]   # Send magic packet; --ping waits (default 60s)
wol ping <name> [timeout_s]      # Poll ping until reachable or timeout (default 60s)
wol doctor                       # Diagnose dependencies and config
wol config [--edit]              # Show config or open in $EDITOR
wol version                      # Show wol version
wol help                         # Show built-in help
```

## Commands

| Command | Description |
|---------|-------------|
| `wol` / `wol status` | Dashboard: name, MAC, IP, and live reachability for every configured device |
| `wol list` | Same table, without pinging each device |
| `wol wake <name> [--ping] [--timeout N]` | Send the magic packet. With `--ping`, waits (default 60s) for the device's IP to answer, polling every 2s |
| `wol ping <name> [timeout_s]` | Poll-ping a device (independent of waking it) until it answers or the timeout elapses |
| `wol doctor` | Checks `wakeonlan`/`python3`/`ping` availability and validates configured MAC addresses |
| `wol config [--edit]` | Show the config file, or open it in `$EDITOR` |
| `wol version` | Print the wol version |
| `wol help` | Show built-in help text |

## Configuration

Devices live in `~/.config/wol/config`, one per line, whitespace-separated:

```
# name            mac                  ip (optional)   broadcast (optional, default 255.255.255.255)
alpha             aa:bb:cc:dd:ee:ff    192.168.1.10
beta              11:22:33:44:55:66    192.168.1.11    192.168.1.255
gamma             22:33:44:55:66:77
```

- **name** — arbitrary identifier used on the command line
- **mac** — required, validated by `wol doctor` and before every `wake`
- **ip** — optional, but required for `wol ping` / `wol wake --ping`
- **broadcast** — optional, defaults to `255.255.255.255`; override per-device if the target is on a routed subnet where the global broadcast won't reach it

Edit with:

```bash
wol config --edit
```

## Sending the magic packet

`wol wake` prefers the `wakeonlan` binary (installed via the standard package workflow — see the repo's `CLAUDE.md`). If it's not present, it falls back to a small `python3` UDP-broadcast implementation, so `wol wake` still works on a machine without `wakeonlan` installed as long as Python 3 is available.

## Example workflow

```bash
# Wake a machine and wait until it responds to ping
wol wake alpha --ping

# Wait longer for a slow-booting box
wol wake alpha --ping --timeout 180

# Just check what's currently reachable
wol status

# Poll a machine that's already booting (e.g. after a manual power-on)
wol ping alpha 120
```

## Cross-Platform Support

| Feature | macOS | Linux/WSL |
|---------|-------|-----------|
| Magic packet (`wakeonlan`) | via Homebrew | via apt |
| Magic packet (python3 fallback) | ✓ | ✓ |
| Ping | `ping -c 1 -t 1` | `ping -c 1 -W 1` |

Not installed on Termux — the Termux install path only sets up the zsh/Oh My Zsh/Powerlevel10k stack (see `CLAUDE.md`).
