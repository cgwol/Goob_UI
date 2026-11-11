/**
 * Side menu overlay for Goob UI.
 * Shown when the user presses Escape (keyboard) or Options/Start/PS (controller).
 * Contains top-level items (Home, Settings, Close) and a nested power submenu.
 * Also lists currently open windows (live apps on the taskbar) with their icons.
 * Selecting an open window focuses it. Closed windows disappear automatically.
 * K / Triangle / Y or the ... button opens a popup to Open or Close the app.
 * Supports both keyboard and gamepad navigation.
 */
import goobIcon from '../assets/128x128.png'
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useInputMode, getPad } from "../input-mode";
import { getDeadzone } from "../settings";
import { play } from "../sound";
import { getRunning, type RunningItem } from "../running-apps";
import { Popup } from "./PromptMenu";

const POWER = ["Minimize", "Close app", "Sleep", "Power off"] as const;

type OpenWindow = {
  title: string;
  process_name: string;
  icon?: string | null;
  command_line?: string | null;
  pid?: number;
};

/** Match a Chrome window to a .bat app we launched from Goob, if possible. */
function matchBat(w: OpenWindow, bats: RunningItem[]): RunningItem | null {
  if (!/chrome/i.test(w.process_name || "")) return null;
  const cmd = (w.command_line || "").toLowerCase();
  for (const bat of bats) {
    const name = bat.path.split(/[/\\]/).pop()?.replace(/\.bat$/i, "").toLowerCase() || "";
    if (name && cmd.includes(name)) return bat;
    const dir = bat.path.split(/[/\\]/).slice(0, -1).pop()?.toLowerCase() || "";
    if (dir && cmd.includes(dir)) return bat;
  }
  return null;
}

/** Prefer a clean app name over the full window/tab title. */
function displayName(w: OpenWindow, bats: RunningItem[]): string {
  const bat = matchBat(w, bats);
  if (bat) return bat.name;
  const proc = (w.process_name || "").replace(/\.exe$/i, "");
  const map: Record<string, string> = {
    chrome: "Chrome",
    msedge: "Edge",
    firefox: "Firefox",
    discord: "Discord",
    spotify: "Spotify",
    steam: "Steam",
    steamwebhelper: "Steam",
    code: "VS Code",
    explorer: "File Explorer",
    notepad: "Notepad",
  };
  const key = proc.toLowerCase();
  if (map[key]) return map[key];
  if (proc) return proc.charAt(0).toUpperCase() + proc.slice(1);
  const title = w.title || "";
  const parts = title.split(" - ");
  return parts[parts.length - 1] || title;
}

function isGoob(w: OpenWindow): boolean {
  const t = (w.title || "").toLowerCase();
  const p = (w.process_name || "").toLowerCase();
  // Filtered Titles to hide in side menu
  return t.includes("goob")
    || p.includes("goob")
    || t.includes("react_g_gui")
    || p.includes("razerappengine")
    || p.includes("textinputhost")
    ;
}

type MenuEntry = {
  kind: "base" | "window";
  label: string;
  window?: OpenWindow;
};

export function SideMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [focused, setFocused] = useState(0);
  const [powerOpen, setPowerOpen] = useState(false);
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [ctxFor, setCtxFor] = useState<OpenWindow | null>(null);
  const focusedRef = useRef(focused);
  const powerRef = useRef(powerOpen);
  const windowsRef = useRef(windows);
  const ctxRef = useRef(ctxFor);
  focusedRef.current = focused;
  powerRef.current = powerOpen;
  windowsRef.current = windows;
  ctxRef.current = ctxFor;
  const { mode, padKind } = useInputMode();

  // const menuIcon =
  //   mode === "keyboard"
  //     ? "Esc"
  //     : mode === "gamepad" && padKind === "playstation"
  //       ? "OPTIONS"
  //       : mode === "gamepad"
  //         ? "☰"
  //         : "";

  const moreIcon =
    mode === "keyboard"
      ? "K"
      : mode === "gamepad" && padKind === "playstation"
        ? "△"
        : mode === "gamepad"
          ? "Y"
          : "...";

  const openCtx = (w: OpenWindow) => {
    play("menu");
    setCtxFor(w);
  };

  const bats = getRunning().filter((r) => r.path.toLowerCase().endsWith(".bat"));
  const live = windows.filter((w) => !isGoob(w));

  const entries: MenuEntry[] = powerOpen
    ? POWER.map((label) => ({ kind: "base" as const, label }))
    : [
      { kind: "base" as const, label: "Home" },
      ...live.map((w) => ({
        kind: "window" as const,
        label: displayName(w, bats),
        window: w,
      })),
      { kind: "base" as const, label: "Settings" },
      { kind: "base" as const, label: "Close" },
    ];

  // Poll open windows while the menu is open
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const refresh = async () => {
      try {
        const list = await invoke<OpenWindow[]>("list_open_windows");
        if (alive) setWindows(list);
      } catch {
        // keep previous list on error
      }
    };
    refresh();
    const id = setInterval(refresh, 1200);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [open]);

  const choose = async (entry: MenuEntry) => {
    if (entry.kind === "window" && entry.window) {
      const q = entry.window.title || entry.window.process_name;
      await invoke("focus_window", { query: q }).catch((err) =>
        console.error(err),
      );
      onClose();
      return;
    }
    const label = entry.label;
    if (label === "Home") navigate("/");
    if (label === "Settings") navigate("/settings");
    if (label === "Close") {
      setPowerOpen(true);
      setFocused(0);
      return;
    }
    if (label === "Minimize") await getCurrentWindow().minimize();
    if (label === "Close app") await getCurrentWindow().close();
    if (label === "Sleep") await invoke("system_action", { action: "sleep" });
    if (label === "Power off")
      await invoke("system_action", { action: "shutdown" });
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setPowerOpen(false);
      setCtxFor(null);
      return;
    }
    play("menu");
    setFocused(0);

    const onKey = (e: KeyboardEvent) => {
      if (ctxRef.current) return;
      const list = powerRef.current
        ? POWER.map((label) => ({ kind: "base" as const, label }))
        : [
          { kind: "base" as const, label: "Home" },
          ...windowsRef.current
            .filter((w) => !isGoob(w))
            .map((w) => ({
              kind: "window" as const,
              label: displayName(w, getRunning().filter((r) => r.path.toLowerCase().endsWith(".bat"))),
              window: w,
            })),
          { kind: "base" as const, label: "Settings" },
          { kind: "base" as const, label: "Close" },
        ];
      const n = list.length;
      if (e.key === "Escape" || e.key === "ArrowLeft") {
        if (powerRef.current) {
          setPowerOpen(false);
          setFocused(0);
          return;
        }
        onClose();
      }
      if (e.key === "ArrowUp") {
        play("move");
        setFocused((f) => (f - 1 + n) % n);
      }
      if (e.key === "ArrowDown") {
        play("move");
        setFocused((f) => (f + 1) % n);
      }
      if (e.key === "Enter") choose(list[focusedRef.current]);
      if ((e.key === "k" || e.key === "K")) {
        const entry = list[focusedRef.current];
        if (entry?.kind === "window" && entry.window) openCtx(entry.window);
      }
    };
    window.addEventListener("keydown", onKey);

    let alive = true;
    let raf = 0;
    let prevUp = false;
    let prevDown = false;
    let prevCross = false;
    let prevTriangle = false;
    let prevClose = false;
    let armed = false;
    let wasCtx = false;

    const tick = () => {
      if (!alive) return;
      if (ctxRef.current) {
        wasCtx = true;
        raf = requestAnimationFrame(tick);
        return;
      }

      const pad = getPad();

      // Prompt just closed — ignore the button that closed or selected it
      if (wasCtx) {
        wasCtx = false;
        prevClose = !!(
          pad?.buttons[1]?.pressed ||
          pad?.buttons[16]?.pressed ||
          pad?.buttons[9]?.pressed
        );
        // Don't treat the Cross that chose Cancel as selecting the app
        prevCross = !!pad?.buttons[0]?.pressed;
        armed = false;
      }

      if (pad) {
        const zone = getDeadzone();
        const y = pad.axes[1] ?? 0;
        const up = y < -zone || !!pad.buttons[12]?.pressed;
        const down = y > zone || !!pad.buttons[13]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const triangle = !!pad.buttons[3]?.pressed;
        const circle = !!pad.buttons[1]?.pressed;
        const ps = !!pad.buttons[16]?.pressed;
        const start = !!pad.buttons[9]?.pressed;
        const list = powerRef.current
          ? POWER.map((label) => ({ kind: "base" as const, label }))
          : [
            { kind: "base" as const, label: "Home" },
            ...windowsRef.current
              .filter((w) => !isGoob(w))
              .map((w) => ({
                kind: "window" as const,
                label: displayName(w, getRunning().filter((r) => r.path.toLowerCase().endsWith(".bat"))),
                window: w,
              })),
            { kind: "base" as const, label: "Settings" },
            { kind: "base" as const, label: "Close" },
          ];
        const n = list.length;

        if (up && !prevUp) {
          play("move");
          setFocused((f) => (f - 1 + n) % n);
        }
        if (down && !prevDown) {
          play("move");
          setFocused((f) => (f + 1) % n);
        }
        if (cross && !prevCross) choose(list[focusedRef.current]);
        if (triangle && !prevTriangle) {
          const entry = list[focusedRef.current];
          if (entry?.kind === "window" && entry.window) openCtx(entry.window);
        }

        if (!circle && !ps && !start) armed = true;
        if (armed && (circle || ps || start) && !prevClose) {
          if (powerRef.current) {
            setPowerOpen(false);
            setFocused(0);
          } else {
            onClose();
          }
        }

        prevUp = up;
        prevDown = down;
        prevCross = cross;
        prevTriangle = triangle;
        prevClose = circle || ps || start;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <aside className="side-menu" onClick={(e) => e.stopPropagation()}>
        <span className="menu-title">
          <img className="menu-logo" src={goobIcon} alt="Goob" />
        </span>
        {entries.map((entry, i) => (
          <button
            key={entry.kind === "window" ? entry.window!.process_name + entry.label : entry.label}
            type="button"
            className={i === focused ? "menu-item focused" : "menu-item"}
            onMouseEnter={() => {
              if (i !== focused) play("move");
              setFocused(i);
            }}
            onClick={() => choose(entry)}
          >
            {entry.kind === "window" && entry.window && (
              <img
                src={
                  (() => {
                    const bat = matchBat(
                      entry.window!,
                      getRunning().filter((r) => r.path.toLowerCase().endsWith(".bat")),
                    );
                    if (bat?.image) {
                      if (bat.image.startsWith("data:") || bat.image.startsWith("http"))
                        return bat.image;
                      return convertFileSrc(bat.image);
                    }
                    return entry.window!.icon || "";
                  })()
                }
                alt=""
                style={{
                  width: 20,
                  height: 20,
                  marginRight: 8,
                  verticalAlign: "middle",
                  borderRadius: 3,
                }}
              />
            )}
            {entry.label}
            {entry.kind === "window" && (
              <span
                className="menu-more"
                style={{ marginLeft: "auto", paddingLeft: 12, opacity: 0.8 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (entry.window) openCtx(entry.window);
                }}
              >
                {moreIcon}
              </span>
            )}
          </button>
        ))}
      </aside>
      {ctxFor && (
        <Popup
          title={displayName(ctxFor, getRunning().filter((r) => r.path.toLowerCase().endsWith(".bat")))}
          onClose={() => setCtxFor(null)}
          actions={[
            {
              label: "Open",
              onSelect: () => {
                const q = ctxFor.title || ctxFor.process_name;
                invoke("focus_window", { query: q }).catch(console.error);
                setCtxFor(null);
                onClose();
              },
            },
            {
              label: "Close",
              onSelect: () => {
                if (ctxFor.pid) {
                  invoke("close_window", { pid: ctxFor.pid }).catch(console.error);
                }
                setCtxFor(null);
              },
            },
            { label: "Cancel", onSelect: () => setCtxFor(null) },
          ]}
        />
      )}
    </div>
  );
}