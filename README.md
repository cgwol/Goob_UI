# g_gui — Console-style PC Interface

A modern, controller-first desktop interface built with **Tauri + React + TypeScript**.

Inspired by the Wii home screen, but updated for PC. Launch Steam games, navigate with a PS5 DualSense controller, and run fullscreen like a console.

## Quick Start

```bash
# Install dependencies
npm install

# Start the app in development mode (Tauri + Vite)
npm run dev
```

First launch may take a minute while Rust compiles. Subsequent starts are much faster.

## Project Plan

### Phase 1 — Console Shell
- Fullscreen / borderless window
- Hide mouse cursor by default
- Basic Gamepad API support (PS5 controller navigation)
- Simple focusable grid of placeholder tiles

### Phase 2 — Home Screen UI
- Modern Wii-style grid of large tiles
- Smooth focus animations (scale + glow)
- Spatial / controller-friendly focus management
- Optional channels or rows (Games, Apps, Settings)

### Phase 3 — Steam Integration
- Rust command to launch games via `steam://run/APPID`
- Scan local Steam library (or start with a curated list)
- Display game art and names on tiles

### Phase 4 — Polish & System Integration (Current Focus)
- Auto-launch on boot (macOS login item / Windows startup)
- Settings screen (controller sensitivity, theme, exit)
- Sound effects and animations
- Hide or minimize the app when a game launches

### Phase 4 Settings
- Start with Windows
- Controller Sensitivity in App
- Controller Legends 
- Theme
- System Sounds
- Clear Library
- Return Shortcut

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Desktop**: Tauri v2 (Rust backend)
- **Input**: Browser Gamepad API (PS5 DualSense)
- **Games**: Steam URI protocol (`steam://`)

## Development

```bash
npm run dev          # Full Tauri + Vite dev server
npm run build        # Production build
npm run tauri build  # Package the app
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
