import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { invoke } from "@tauri-apps/api/core"; // CHANGE
import { SideMenu } from "../components/SideMenu";
import { Popup } from "../components/PromptMenu"; // CHANGE
import { useInputMode, getPad, setPadChoice, type PadChoice } from "../input-mode";
import { play } from "../sound";
import {
  getDeadzone,
  useSensitivity,
  useTheme,
  useVolume,
  useWindowMode,
  useResolution,
  setSensitivity,
  setTheme,
  setVolume,
  setWindowMode,
  setResolution,
  type Sensitivity,
  type Theme,
  type Volume,
  type WindowMode,
  type Resolution,
} from "../settings";

const ITEMS = [
  "Start with Windows",
  "Controller Stick Sensitivity",
  "Controller Legend",
  "Theme",
  "System volume",
  "Window mode",
  "Resolution",
  "Clear Library", // CHANGE
] as const;
const SENS: Sensitivity[] = ["Low", "Medium", "High"];
const LEGENDS: PadChoice[] = ["auto detection", "playstation", "xbox", "nintendo", "generic"];
const THEMES: Theme[] = ["Dark", "Light", "Forest", "Ocean", "Black"];
const VOLUMES: Volume[] = ["Off", "Low", "Medium", "High"];
const WINDOWS: WindowMode[] = ["Windowed fullscreen", "Fullscreen", "Windowed"];
const RESOLUTIONS: Resolution[] = ["720p", "1080p", "1440p", "4K"];

type Drop = "sens" | "legend" | "theme" | "volume" | "window" | "resolution" | null;

function legendLabel(value: PadChoice) {
  return value === "auto detection" ? "Auto" : value[0].toUpperCase() + value.slice(1);
}

export function Settings() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const { mode, padKind, padChoice } = useInputMode();
  const sensitivity = useSensitivity();
  const theme = useTheme();
  const volume = useVolume();
  const windowMode = useWindowMode();
  const resolution = useResolution();

  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const [startup, setStartup] = useState(false);
  const [drop, setDrop] = useState<Drop>(null);
  const dropRef = useRef(drop);
  dropRef.current = drop;
  const [dropFocus, setDropFocus] = useState(0);
  const dropFocusRef = useRef(dropFocus);
  dropFocusRef.current = dropFocus;
  const [confirm, setConfirm] = useState(false); // CHANGE
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;

  useEffect(() => {
    isEnabled().then(setStartup).catch((err) => console.error(err));
  }, []);

  const toggleStartup = async () => {
    try {
      if (startup) {
        await disable();
        setStartup(false);
      } else {
        await enable();
        setStartup(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // CHANGE: wipe games, apps, and the tile image files
  const clearLibrary = async () => {
    localStorage.removeItem("games");
    localStorage.removeItem("apps");
    await invoke("clear_tiles").catch((err) => console.error(err));
    setConfirm(false);
  };

  const options = () => {
    if (dropRef.current === "sens") return SENS;
    if (dropRef.current === "legend") return LEGENDS;
    if (dropRef.current === "theme") return THEMES;
    if (dropRef.current === "volume") return VOLUMES;
    if (dropRef.current === "window") return WINDOWS;
    if (dropRef.current === "resolution") return RESOLUTIONS;
    return [];
  };

  const openDrop = (kind: Drop) => {
    const list =
      kind === "sens"
        ? SENS
        : kind === "legend"
          ? LEGENDS
          : kind === "theme"
            ? THEMES
            : kind === "volume"
              ? VOLUMES
              : kind === "window"
                ? WINDOWS
                : RESOLUTIONS;
    const current =
      kind === "sens"
        ? sensitivity
        : kind === "legend"
          ? padChoice
          : kind === "theme"
            ? theme
            : kind === "volume"
              ? volume
              : kind === "window"
                ? windowMode
                : resolution;
    setDropFocus(Math.max(0, list.indexOf(current as never)));
    setDrop(kind);
  };

  const pick = () => {
    const list = options();
    const chosen = list[dropFocusRef.current];
    if (dropRef.current === "sens") setSensitivity(chosen as Sensitivity);
    if (dropRef.current === "legend") setPadChoice(chosen as PadChoice);
    if (dropRef.current === "theme") setTheme(chosen as Theme);
    if (dropRef.current === "volume") {
      setVolume(chosen as Volume);
      play("select");
    }
    if (dropRef.current === "window") void setWindowMode(chosen as WindowMode);
    if (dropRef.current === "resolution") setResolution(chosen as Resolution);
    setDrop(null);
  };

  const choose = () => {
    const item = ITEMS[focusedRef.current];
    if (item === "Start with Windows") void toggleStartup();
    if (item === "Controller Stick Sensitivity") openDrop("sens");
    if (item === "Controller Legend") openDrop("legend");
    if (item === "Theme") openDrop("theme");
    if (item === "System volume") openDrop("volume");
    if (item === "Window mode") openDrop("window");
    if (item === "Resolution") openDrop("resolution");
    if (item === "Clear Library") setConfirm(true); // CHANGE
  };

  const value = (label: (typeof ITEMS)[number]) => {
    if (label === "Start with Windows") return startup ? "On" : "Off";
    if (label === "Controller Stick Sensitivity") return sensitivity;
    if (label === "Theme") return theme;
    if (label === "System volume") return volume;
    if (label === "Window mode") return windowMode;
    if (label === "Resolution") return resolution;
    if (label === "Clear Library") return ""; // CHANGE
    return legendLabel(padChoice);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmRef.current) return; // CHANGE
      if (e.key === "Backspace") {
        e.preventDefault();
        if (dropRef.current) {
          setDrop(null);
          return;
        }
        navigate("/");
      }
      if (e.key === "Escape") {
        if (dropRef.current) {
          setDrop(null);
          return;
        }
        if (!menuOpenRef.current) setMenuOpen(true);
        return;
      }
      if (menuOpenRef.current) return;
      if (dropRef.current) {
        const count = options().length;
        if (e.key === "ArrowUp") setDropFocus((f) => (f - 1 + count) % count);
        if (e.key === "ArrowDown") setDropFocus((f) => (f + 1) % count);
        if (e.key === "Enter") pick();
        return;
      }
      if (e.key === "ArrowUp") setFocused((f) => (f - 1 + ITEMS.length) % ITEMS.length);
      if (e.key === "ArrowDown") setFocused((f) => (f + 1) % ITEMS.length);
      if (e.key === "Enter") choose();
    };
    window.addEventListener("keydown", onKey);

    let alive = true;
    let raf = 0;
    let prevCircle = false;
    let prevMenu = false;
    let prevCross = false;
    let armed = false;
    let armedCross = false;
    let holdDir: "up" | "down" | null = null;
    let holdSince = 0;
    let lastFire = 0;

    const tick = () => {
      if (!alive) return;
      if (confirmRef.current) {
        // CHANGE
        raf = requestAnimationFrame(tick);
        return;
      }
      const pad = getPad();
      if (pad) {
        const zone = getDeadzone();
        const y = pad.axes[1] ?? 0;
        const up = y < -zone || !!pad.buttons[12]?.pressed;
        const down = y > zone || !!pad.buttons[13]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const circle = !!pad.buttons[1]?.pressed;
        const ps = !!pad.buttons[16]?.pressed;
        const start = !!pad.buttons[9]?.pressed;
        const now = performance.now();

        if (!ps && !start) armed = true;
        if (armed && !menuOpenRef.current && !dropRef.current && (ps || start) && !prevMenu) setMenuOpen(true);
        if (circle && !prevCircle && !menuOpenRef.current) {
          if (dropRef.current) setDrop(null);
          else navigate("/");
        }

        if (!menuOpenRef.current) {
          const count = dropRef.current ? options().length : ITEMS.length;
          const active = up && !down ? "up" : down && !up ? "down" : null;
          if (active !== holdDir) {
            holdDir = active;
            holdSince = now;
            lastFire = now;
            if (active === "up") {
              if (dropRef.current) setDropFocus((f) => (f - 1 + count) % count);
              else setFocused((f) => (f - 1 + count) % count);
            }
            if (active === "down") {
              if (dropRef.current) setDropFocus((f) => (f + 1) % count);
              else setFocused((f) => (f + 1) % count);
            }
          } else if (active && now - holdSince >= 420 && now - lastFire >= 180) {
            lastFire = now;
            if (active === "up") {
              if (dropRef.current) setDropFocus((f) => (f - 1 + count) % count);
              else setFocused((f) => (f - 1 + count) % count);
            }
            if (active === "down") {
              if (dropRef.current) setDropFocus((f) => (f + 1) % count);
              else setFocused((f) => (f + 1) % count);
            }
          }

          if (!cross) armedCross = true;
          if (armedCross && cross && !prevCross) {
            if (dropRef.current) pick();
            else choose();
          }
        }

        prevCircle = circle;
        prevMenu = ps || start;
        prevCross = cross;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [navigate, startup, sensitivity, theme, padChoice, volume, windowMode, resolution]);

  const backIcon =
    mode === "keyboard" ? "⌫" : mode === "gamepad" && padKind === "playstation" ? "○" : mode === "gamepad" ? "B" : "";
  const menuIcon =
    mode === "keyboard" ? "Esc" : mode === "gamepad" && padKind === "playstation" ? "OPTIONS" : mode === "gamepad" ? "☰" : "";

  const dropList =
    drop === "sens"
      ? SENS
      : drop === "legend"
        ? LEGENDS
        : drop === "theme"
          ? THEMES
          : drop === "volume"
            ? VOLUMES
            : drop === "window"
              ? WINDOWS
              : drop === "resolution"
                ? RESOLUTIONS
                : [];

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand" onClick={() => setMenuOpen(true)}>
          {menuIcon && <span className="keycap">{menuIcon}</span>}
          Settings
        </span>
        <span className="clock">
          {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
      </header>

      <div className="settings">
        {ITEMS.map((label, i) => (
          <div key={label} className="setting-wrap">
            <button
              type="button"
              className={i === focused ? "setting focused" : "setting"}
              onMouseEnter={() => setFocused(i)}
              onClick={() => {
                setFocused(i);
                if (label === "Start with Windows") void toggleStartup();
                if (label === "Controller Stick Sensitivity") openDrop("sens");
                if (label === "Controller Legend") openDrop("legend");
                if (label === "Theme") openDrop("theme");
                if (label === "System volume") openDrop("volume");
                if (label === "Window mode") openDrop("window");
                if (label === "Resolution") openDrop("resolution");
                if (label === "Clear Library") setConfirm(true); // CHANGE
              }}
            >
              <span>{label}</span>
              <span className="setting-value">{value(label)}</span>
            </button>
            {((label === "Controller Stick Sensitivity" && drop === "sens") ||
              (label === "Controller Legend" && drop === "legend") ||
              (label === "Theme" && drop === "theme") ||
              (label === "System volume" && drop === "volume") ||
              (label === "Window mode" && drop === "window") ||
              (label === "Resolution" && drop === "resolution")) && (
              <div className="dropdown">
                {dropList.map((option, n) => (
                  <button
                    key={option}
                    type="button"
                    className={n === dropFocus ? "dropdown-item focused" : "dropdown-item"}
                    onMouseEnter={() => setDropFocus(n)}
                    onClick={() => {
                      setDropFocus(n);
                      if (drop === "sens") setSensitivity(option as Sensitivity);
                      if (drop === "legend") setPadChoice(option as PadChoice);
                      if (drop === "theme") setTheme(option as Theme);
                      if (drop === "volume") {
                        setVolume(option as Volume);
                        play("select");
                      }
                      if (drop === "window") void setWindowMode(option as WindowMode);
                      if (drop === "resolution") setResolution(option as Resolution);
                      setDrop(null);
                    }}
                  >
                    {drop === "legend" ? legendLabel(option as PadChoice) : option}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CHANGE */}
      {confirm && (
        <Popup
          title="Clear library?"
          onClose={() => setConfirm(false)}
          actions={[
            { label: "Confirm", onSelect: () => void clearLibrary() },
            { label: "Cancel", onSelect: () => setConfirm(false) },
          ]}
        />
      )}

      <button type="button" className="back" onClick={() => navigate("/")}>
        {backIcon && <span className="keycap">{backIcon}</span>}
        Back
      </button>
      <SideMenu open={menuOpen} onClose={closeMenu} />
    </div>
  );
}