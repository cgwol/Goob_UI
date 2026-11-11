/**
 * Apps library page for Goob UI.
 * Nearly identical to the Games page but for local applications (exe and bat files).
 * Tiles are sorted by last-played time. Users can add, rename, set a custom image
 * (stored on disk via the asset protocol), delete, and launch apps.
 * Full keyboard and gamepad navigation with hold-to-repeat. Triangle / K opens the
 * per-tile menu. Circle / Backspace returns to the home screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { SideMenu } from "../components/SideMenu";
import { Popup } from "../components/PromptMenu";
import { useInputMode, getPad } from "../input-mode";
import { getDeadzone } from "../settings";
import { play } from "../sound";
import { addRunning, processNameFromPath } from "../running-apps";

type AppItem = { id: string; name: string; path: string; image?: string; lastPlayed?: number };

const KEY = "apps";

function loadApps(): AppItem[] {
  try {
    const list: AppItem[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return list.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
  } catch {
    return [];
  }
}

function nameFromPath(path: string) {
  const file = path.split(/[/\\]/).pop() ?? path;
  return file.replace(/\.(app|exe|bat)$/i, "");
}

/**
 * Resolve the image URL for a tile. Local file paths go through Tauri's asset protocol
 * (convertFileSrc). Data URLs and remote URLs are used as-is.
 */
function artSrc(app: AppItem) {
  if (!app.image) return "";
  if (app.image.startsWith("data:") || app.image.startsWith("http")) return app.image;
  return convertFileSrc(app.image);
}

export function Apps() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const { mode, padKind } = useInputMode();

  const [apps, setApps] = useState<AppItem[]>(loadApps);
  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const picking = useRef(false);
  const appsRef = useRef(apps);
  appsRef.current = apps;

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuForRef = useRef(menuFor);
  menuForRef.current = menuFor;
  const [tileDraft, setTileDraft] = useState("");

  const [addedId, setAddedId] = useState<string | null>(null);
  const addedIdRef = useRef(addedId);
  addedIdRef.current = addedId;
  const [draft, setDraft] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const addOpenRef = useRef(addOpen);
  addOpenRef.current = addOpen;
  const rowRef = useRef<HTMLDivElement>(null);

  // Persist the library whenever it changes
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(apps));
  }, [apps]);

  // One-time migration: any old base64 images stored in localStorage are written to disk
  useEffect(() => {
    let alive = true;
    void (async () => {
      const current = appsRef.current;
      const next = await Promise.all(
        current.map(async (a) => {
          if (!a.image?.startsWith("data:")) return a;
          try {
            const path = await invoke<string>("save_data_url", { id: a.id, dataUrl: a.image });
            return { ...a, image: path };
          } catch {
            return a;
          }
        }),
      );
      if (alive && next.some((a, i) => a.image !== current[i]?.image)) setApps(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Keep the focused tile scrolled into view
  useEffect(() => {
    const el = rowRef.current?.children[focused] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focused]);

  const launch = (app: AppItem) => {
    addRunning({
      id: app.id,
      name: app.name,
      path: app.path,
      processName: processNameFromPath(app.path),
      image: app.image,
    })

    play("launch");
    const now = Date.now();
    setApps((list) => {
      const next = list.map((a) => (a.id === app.id ? { ...a, lastPlayed: now } : a));
      next.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
      return next;
    });
    setFocused(0);
    invoke("launch_path", { path: app.path }).catch((err) => console.error(err));
  };

  // Open a file picker and copy the chosen image into the app's tile storage
  const pickImage = async (id: string) => {
    const picked = await open({
      title: "Choose a tile image",
      multiple: false,
      directory: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });
    if (typeof picked !== "string") return null;
    return invoke<string>("save_tile_image", { id, path: picked });
  };

  const addApp = async () => {
    if (picking.current) return;
    picking.current = true;
    try {
      const picked = await open({
        title: "Choose an app",
        multiple: false,
        directory: false,
        filters: [{ name: "App", extensions: ["exe", "bat"] }],
      });
      if (typeof picked !== "string") return;
      const id = crypto.randomUUID();
      const name = nameFromPath(picked);
      setApps((list) => [...list, { id, name, path: picked }]);
      setDraft(name);
      setAddedId(id);
    } finally {
      picking.current = false;
    }
  };

  const closeAdded = () => {
    setAddedId(null);
    setDraft("");
  };

  const saveName = () => {
    const name = draft.trim();
    if (!name || !addedId) return;
    setApps((list) => list.map((a) => (a.id === addedId ? { ...a, name } : a)));
    closeAdded();
  };

  const cancelAdd = () => {
    if (!addedId) return;
    setApps((list) => list.filter((a) => a.id !== addedId));
    closeAdded();
  };

  const choose = () => {
    if (focusedRef.current === appsRef.current.length) {
      setAddOpen(true);
      return;
    }
    launch(appsRef.current[focusedRef.current]);
  };

  const openTileMenu = () => {
    const app = appsRef.current[focusedRef.current];
    if (!app) return;
    setTileDraft(app.name);
    setMenuFor(app.id);
  };

  const saveTileName = () => {
    const name = tileDraft.trim();
    if (!name || !menuFor) return;
    setApps((list) => list.map((a) => (a.id === menuFor ? { ...a, name } : a)));
    setMenuFor(null);
  };

  // Delete the tile and its image file
  const deleteTile = () => {
    if (!menuFor) return;
    const app = appsRef.current.find((a) => a.id === menuFor);
    if (app?.image) invoke("delete_tile_image", { path: app.image }).catch(() => { });
    setApps((list) => list.filter((a) => a.id !== menuFor));
    setMenuFor(null);
    setFocused(0);
  };

  const setTileImage = () => {
    const id = menuFor;
    setMenuFor(null);
    setTimeout(() => {
      void (async () => {
        if (picking.current || !id) return;
        picking.current = true;
        try {
          const image = await pickImage(id);
          if (!image) return;
          setApps((list) => list.map((a) => (a.id === id ? { ...a, image } : a)));
        } finally {
          picking.current = false;
        }
      })();
    }, 50);
  };

  const setAddedImage = () => {
    const id = addedId;
    const name = draft.trim();
    if (id && name) {
      setApps((list) => list.map((a) => (a.id === id ? { ...a, name } : a)));
    }
    closeAdded();
    setTimeout(() => {
      void (async () => {
        if (picking.current || !id) return;
        picking.current = true;
        try {
          const image = await pickImage(id);
          if (!image) return;
          setApps((list) => list.map((a) => (a.id === id ? { ...a, image } : a)));
        } finally {
          picking.current = false;
        }
      })();
    }, 50);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).tagName === "INPUT";
      if (e.key === "Backspace" && !typing) {
        e.preventDefault();
        // Close the popup instead of leaving the page
        if (menuForRef.current || addedIdRef.current || addOpenRef.current) {
          return;
        }
        navigate("/");
      }
      if (
        e.key === "Escape" &&
        !menuOpenRef.current &&
        !addedIdRef.current &&
        !menuForRef.current &&
        !addOpenRef.current
      ) {
        setMenuOpen(true);
      }
      if (menuOpenRef.current || picking.current || addedIdRef.current || menuForRef.current || addOpenRef.current) {
        return;
      }
      if ((e.key === "k" || e.key === "K") && !menuForRef.current) {
        openTileMenu();
        return;
      }
      if (e.key === "ArrowLeft") {
        setFocused((f) => (f - 1 + appsRef.current.length + 1) % (appsRef.current.length + 1));
      }
      if (e.key === "ArrowRight") {
        setFocused((f) => (f + 1) % (appsRef.current.length + 1));
      }
      if (e.key === "Enter") choose();
    };
    window.addEventListener("keydown", onKey);

    // Gamepad polling loop — paused while any popup or file picker is open
    let alive = true;
    let raf = 0;
    let prevCross = false;
    let prevMenu = false;
    let prevTriangle = false;
    let prevCircle = false;
    let armed = false;
    let armedCross = false;
    let wasPaused = false;
    let holdDir: "left" | "right" | null = null;
    let holdSince = 0;
    let lastFire = 0;

    const tick = () => {
      if (!alive) return;

      const paused = picking.current || menuOpenRef.current || addedIdRef.current || menuForRef.current || addOpenRef.current;

      if (paused) {
        wasPaused = true;
        raf = requestAnimationFrame(tick);
        return;
      }

      if (wasPaused) {
        wasPaused = false;
        armedCross = false;
        const padNow = getPad();
        prevCircle = !!padNow?.buttons[1]?.pressed;
      }

      const pad = getPad();
      if (pad) {
        const count = appsRef.current.length + 1;
        const zone = getDeadzone();
        const x = pad.axes[0] ?? 0;
        const left = x < -zone || !!pad.buttons[14]?.pressed;
        const right = x > zone || !!pad.buttons[15]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const circle = !!pad.buttons[1]?.pressed;
        const triangle = !!pad.buttons[3]?.pressed;
        const ps = !!pad.buttons[16]?.pressed;
        const start = !!pad.buttons[9]?.pressed;
        const now = performance.now();

        const active = left && !right ? "left" : right && !left ? "right" : null;

        // Hold-to-repeat for left/right navigation
        if (active !== holdDir) {
          holdDir = active;
          holdSince = now;
          lastFire = now;
          if (active) {
            setFocused((f) => (active === "left" ? (f - 1 + count) % count : (f + 1) % count));
          }
        } else if (active && now - holdSince >= 420 && now - lastFire >= 180) {
          lastFire = now;
          setFocused((f) => (active === "left" ? (f - 1 + count) % count : (f + 1) % count));
        }

        if (triangle && !prevTriangle) openTileMenu();

        if (!cross) armedCross = true;
        if (armedCross && cross && !prevCross) choose();

        if (circle && !prevCircle) navigate("/");
        if (!ps && !start) armed = true;
        if (armed && (ps || start) && !prevMenu) setMenuOpen(true);
        prevCross = cross;
        prevMenu = ps || start;
        prevTriangle = triangle;
        prevCircle = circle;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [navigate]);

  const backIcon =
    mode === "keyboard" ? "⌫" : mode === "gamepad" && padKind === "playstation" ? "○" : mode === "gamepad" ? "B" : "";
  const menuIcon =
    mode === "keyboard" ? "Esc" : mode === "gamepad" && padKind === "playstation" ? "OPTIONS" : mode === "gamepad" ? "☰" : "";
  const moreIcon =
    mode === "keyboard" ? "K" : mode === "gamepad" && padKind === "playstation" ? "△" : mode === "gamepad" ? "Y" : "...";

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand" onClick={() => setMenuOpen(true)}>
          {menuIcon && <span className="keycap">{menuIcon}</span>}
          Apps
        </span>
      </header>

      <div
        className={addedId || menuFor || addOpen ? "row is-blocked" : "row"}
        ref={rowRef}
        onWheel={(e) => {
          if (!rowRef.current) return;
          rowRef.current.scrollLeft += e.deltaY;
        }}
      >
        {apps.map((app, i) => (
          <div
            key={app.id}
            className={i === focused ? "tile-wrap focused" : "tile-wrap"}
            onMouseEnter={() => setFocused(i)}
          >
            <div className="tile-title">
              <span>{app.name}</span>
            </div>
            <div className="tile" onClick={() => launch(app)}>
              {artSrc(app) && (
                <img
                  className="tile-art"
                  src={artSrc(app)}
                  alt=""
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              <button
                type="button"
                className="tile-more"
                onClick={(e) => {
                  e.stopPropagation();
                  setFocused(i);
                  setTileDraft(app.name);
                  setMenuFor(app.id);
                }}
              >
                {moreIcon}
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className={focused === apps.length ? "tile focused" : "tile"}
          onMouseEnter={() => setFocused(apps.length)}
          onClick={() => setAddOpen(true)}
        >
          <span className="tile-label">Add app</span>
        </button>
      </div>

      {addOpen && (
        <Popup
          title="Add app"
          onClose={() => setAddOpen(false)}
          actions={[
            {
              label: "Add App",
              onSelect: () => {
                setAddOpen(false);
                setTimeout(() => void addApp(), 50);
              },
            },
            { label: "Cancel", onSelect: () => setAddOpen(false) },
          ]}
        />
      )}

      {menuFor && (
        <Popup
          title="App"
          onClose={() => setMenuFor(null)}
          actions={[
            { label: "Save name", onSelect: saveTileName },
            { label: "Set image", onSelect: setTileImage },
            { label: "Delete", onSelect: deleteTile },
          ]}
        >
          <input
            className="popup-input"
            value={tileDraft}
            onChange={(e) => setTileDraft(e.target.value)}
            placeholder="Name"
          />
        </Popup>
      )}

      {addedId && (
        <Popup
          title="Added"
          onClose={closeAdded}
          actions={[
            { label: "Save name", onSelect: saveName },
            { label: "Set image", onSelect: setAddedImage },
            { label: "Cancel add", onSelect: cancelAdd },
          ]}
        >
          <input
            className="popup-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Name"
          />
        </Popup>
      )}

      <button type="button" className="back" onClick={() => navigate("/")}>
        {backIcon && <span className="keycap">{backIcon}</span>}
        Back
      </button>
      <SideMenu open={menuOpen} onClose={closeMenu} />
    </div>
  );
}
