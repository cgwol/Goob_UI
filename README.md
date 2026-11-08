# Goob UI

**Version 1.0.0**

A modern, controller-first desktop interface built with **Tauri + React + TypeScript**.

Launch Steam games and local apps, navigate with a DualSense (or other) controller, and run fullscreen like a console.

## How to Install Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install) (required for Tauri)
- Windows, macOS, or Linux

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/cgwol/react_g_gui.git
   cd react_g_gui
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run dev
   ```
4. (Optional) Build a production installer:
   ```bash
   npm run tauri build
   ```
   The packaged app will be in `src-tauri/target/release/bundle/`.

## How to Use the App

1. Launch Goob UI.
2. Use a controller (recommended) or keyboard to navigate the home screen tiles:
   - **Games** — your Steam and local game library
   - **Apps** — local applications
   - **Settings** — themes, window mode, sensitivity, etc.
3. Select a tile to launch it.
4. Press the Options / Start / Escape button (depending on input) to open the side menu.
5. Use the back button (Circle / B / Backspace) to return to the previous screen.

Controller legends adapt to PlayStation, Xbox, or Nintendo layouts (or auto-detect).

## How to Install Games

### Steam Games
1. Go to the **Games** page.
2. Select **Add game** → **Add Steam game**.
3. Choose a game from your local Steam library.
4. Some Steam Games don't have a game image, this can be set manually later.

**Recommended Steam settings for best results:**
- Enable steam to launch when computer starts
- In Steam → Settings → Controller, make sure your controller is detected 
- Prefer games that support native controller input (or have good community controller configs).
- For the cleanest experience with Goob UI’s window modes, run Steam and games in **borderless windowed** or **fullscreen** rather than exclusive fullscreen when the launcher needs to stay in control of focus/windowing.
- Keep Steam running in the background so library scanning and launching work reliably.
- In Steams Controller Advanced Settings, disable:
1. Guide Button focuses Steam
2. Turn off Controlles when exiting Big Picture Mode
3. Enable Guide Button Chords for Controllers

### Local / Non-Steam Games
1. Go to the **Games** page.
2. Select **Add game** → **Add other game**.
3. Pick an `.exe` (or equivalent) file.
4. Rename the tile and optionally set a custom image.

Games are sorted by last played. You can rename, change the tile image, or delete entries from the tile menu (Triangle / Y / K).

## How to Install Apps

1. Go to the **Apps** page.
2. Select **Add app**.
3. Choose an `.exe` or `.bat` file.
4. Rename the tile and optionally set a custom image.

Apps work the same way as local games (launch, rename, set image, delete, last-played sort).

## Best Settings for Media Apps

*(Coming later — left blank for now.)*

## Current Known Issues

1. Production builds getting game through steam can be slow.
2. Proper Windowed Mode and Windows Fullscreen support that doesnt rely on user settings resolution
3. Cursor issues when tabbing back into app.  

## Features to be added in future versions

1. Local config file
2. Sleep Screen
3. In app/gmae home button support

## How to Run the Dev Environment

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install) (required for Tauri)
- Windows, macOS, or Linux

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/cgwol/react_g_gui.git
   cd react_g_gui
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run dev
   ```
4. (Optional) Build a production installer:
   ```bash
   npm run tauri build
   ```
   The packaged app will be in `src-tauri/target/release/bundle/`.

- Vite serves the frontend at `http://localhost:1420`.
- The first Rust compile can take a minute; later starts are much faster.

Recommended editor setup: VS Code with the Tauri and rust-analyzer extensions.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Desktop**: Tauri v2 (Rust backend)
- **Input**: Browser Gamepad API (DualSense and others)
- **Games**: Steam URI protocol + local executables

## License

**Recommended: MIT License**

MIT is simple, permissive, and the most common choice for personal/open-source projects like this. It lets others use, modify, and distribute the code with minimal restrictions (just keep the copyright notice).

If you want stronger copyleft (derivatives must stay open), consider **GPL-3.0**. If you prefer something more lawyer-friendly with explicit patent grants, **Apache-2.0** is also popular.

Add a `LICENSE` file with the full text of whichever you choose, and put a short notice at the bottom of this README.
