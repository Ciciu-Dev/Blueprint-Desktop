# Blueprint-Desktop

A lightweight, minimalist desktop customisation for **Linux Mint (Cinnamon)** — a cohesive dark-navy and blue look applied across the top panel, application menu, terminal, wallpaper, and desklets.

Built with **JavaScript, CSS, and Bash**.

## Features

| Component | What it does |
|-----------|--------------|
| **Theme** | Cinnamon theme overrides: dark top panel, rounded application menu, bottom bar, workspace buttons, and blue hover accents |
| **Launcher** | Custom application launcher (Blueprint Launcher V5) with persistent favourites |
| **Desklets** | Clock, CPU, and RAM desklets |
| **Terminal** | Blue `BLUE` bash prompt with a git branch indicator, plus development shortcuts |
| **Wallpaper** | Dark SVG wallpaper with a soft blue glow |

## Project structure

```
Blueprint-Desktop/
├── desklet/              # Clock / CPU / RAM desklets
├── launcher/             # Custom application launcher
├── terminal/             # Bash prompt and development shortcuts
│   ├── prompt-final.bash
│   └── shortcuts.bash
├── theme/                # Cinnamon theme overrides (CSS)
│   └── blueprint-overrides.css
├── wallpaper/            # Desktop wallpaper (SVG)
│   └── blueprint.svg
├── LICENSE               # MIT
├── RELEASE_NOTES.md
├── SECURITY.md
└── README.md
```

## Installation

> Blueprint is a custom desktop setup, tested on Linux Mint with Cinnamon. The paths below are the intended layout — adjust them to match your system.

### Theme

The theme ships as a set of CSS overrides for the Cinnamon interface (the upstream Mint CSS is not included). Append the overrides to your active theme's stylesheet and reload the theme:

```bash
cat theme/blueprint-overrides.css >> ~/.themes/<YourTheme>/style.css
cinnamon --reload
```

Then confirm the look in **Menu → Preferences → Appearance → Theme**.

### Terminal

Load the prompt and development shortcuts into your shell:

```bash
source terminal/prompt-final.bash   # blue BLUE prompt + git branch indicator
source terminal/shortcuts.bash      # development shortcuts
```

To make it permanent, append both to `~/.bashrc`:

```bash
source "$HOME/Blueprint-Desktop/terminal/prompt-final.bash"
source "$HOME/Blueprint-Desktop/terminal/shortcuts.bash"
```

Available shortcuts:

| Alias   | Command                                  |
|---------|------------------------------------------|
| `cproj` | `cd ~/Projects`                          |
| `cblue` | `cd ~/MintBlue`                          |
| `gs`    | `git status`                             |
| `gb`    | `git branch --show-current`              |
| `mkcd`  | `mkdir -p <folder> && cd <folder>`       |

### Wallpaper

Copy the wallpaper and set it as your desktop background:

```bash
cp wallpaper/blueprint.svg ~/.background/
```

Then select it from **Menu → Preferences → Background**.

### Launcher & Desklets

The launcher and desklets are Cinnamon extensions. Install them via **Menu → Preferences → Extensions**, or by placing the extension files under `~/.local/share/cinnamon/extensions/`.

## Screenshots

_Add screenshots here (top panel, application menu, terminal prompt, wallpaper)._

## License

Blueprint-Desktop is released under the [MIT License](LICENSE).
