/**
 * Games library page for Goob UI.
 * Renders a horizontally scrollable row of game tiles. Games can be local executables
 * or Steam titles. Tiles are sorted by last-played time. Users can add, rename, set a
 * custom image (stored on disk via the asset protocol), delete, and launch games.
 * Full keyboard and gamepad navigation with hold-to-repeat. Triangle / K opens the
 * per-tile menu. Circle / Backspace returns to the home screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { addRunning, processNameFromPath } from "../running-apps";
import { SideMenu } from "../components/SideMenu";
import { Popup } from "../components/PromptMenu";
import { useInputMode, getPad } from "../input-mode";
import { getDeadzone } from "../settings";
import { play } from "../sound";

type Game = { id: string; name: string; path: string; steamId?: string; image?: string; lastPlayed?: number };
type SteamGame = { app_id: string; name: string };

const KEY = "games";

function loadGames(): Game[] {
  try {
    const list: Game[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return list.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
  } catch {
    return [];
  }
}

function nameFromPath(path: string) {
  const file = path.split(/[/\\]/).pop() ?? path;
  return file.replace(/\.(app|exe)$/i, "");
}

/**
 * Resolve the image URL for a tile. Local file paths go through Tauri's asset protocol
 * (convertFileSrc). Data URLs and remote Steam covers are used as-is.
 */
function artSrc(game: Game) {
  if (game.image) {
    if (game.image.startsWith("data:") || game.image.startsWith("http")) return game.image;
    return convertFileSrc(game.image);
  }
  if (game.steamId) return `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamId}/library_600x900.jpg`;
  return "";
}

export function Games() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const { mode, padKind } = useInputMode();

  const [games, setGames] = useState<Game[]>(loadGames);
  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const picking = useRef(false);
  const gamesRef = useRef(games);
  gamesRef.current = games;

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
  const [steamGames, setSteamGames] = useState<SteamGame[] | null>(null);
  const steamRef = useRef(steamGames);
  steamRef.current = steamGames;
  const rowRef = useRef<HTMLDivElement>(null);

  // Persist the library whenever it changes
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(games));
  }, [games]);

  // One-time migration: any old base64 images stored in localStorage are written to disk
  useEffect(() => {
    let alive = true;
    void (async () => {
      const current = gamesRef.current;
      const next = await Promise.all(
        current.map(async (g) => {
          if (!g.image?.startsWith("data:")) return g;
          try {
            const path = await invoke<string>("save_data_url", { id: g.id, dataUrl: g.image });
            return { ...g, image: path };
          } catch {
            return g;
          }
        }),
      );
      if (alive && next.some((g, i) => g.image !== current[i]?.image)) setGames(next);
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

  const launch = (game: Game) => {
    play("launch");
    const now = Date.now();
    setGames((list) => {
      const next = list.map((g) => (g.id === game.id ? { ...g, lastPlayed: now } : g));
      next.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
      return next;
    });
    setFocused(0);

    if (game.steamId) {
      addRunning({
        id: game.id,
        name: game.name,
        path: game.path || `steam:${game.steamId}`,
        processName: game.name.replace(/[^a-zA-Z0-9]/g, "") + ".exe",
        steamId: game.steamId,
      });
      invoke("launch_steam", { appId: game.steamId }).catch((err) => console.error(err));
      return;
    }
    addRunning({
      id: game.id,
      name: game.name,
      path: game.path,
      processName: processNameFromPath(game.path),
    });
    invoke("launch_path", { path: game.path }).catch((err) => console.error(err));
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

  const addOther = async () => {
    if (picking.current) return;
    picking.current = true;
    try {
      const picked = await open({
        title: "Choose a game or app",
        multiple: false,
        directory: false,
        filters: [{ name: "Executable", extensions: ["exe"] }],
      });
      if (typeof picked !== "string") return;
      const id = crypto.randomUUID();
      const name = nameFromPath(picked);
      setGames((list) => [...list, { id, name, path: picked }]);
      setDraft(name);
      setAddedId(id);
    } finally {
      picking.current = false;
    }
  };

  const openSteam = async () => {
    setAddOpen(false);
    try {
      const list = await invoke<SteamGame[]>("list_steam_games");
      setSteamGames(list);
    } catch (err) {
      console.error(err);
      setSteamGames([]);
    }
  };

  const addSteam = (game: SteamGame) => {
    setGames((list) => [
      ...list,
      { id: crypto.randomUUID(), name: game.name, path: "", steamId: game.app_id },
    ]);
    setSteamGames(null);
  };

  const closeAdded = () => {
    setAddedId(null);
    setDraft("");
  };

  const saveName = () => {
    const name = draft.trim();
    if (!name || !addedId) return;
    setGames((list) => list.map((g) => (g.id === addedId ? { ...g, name } : g)));
    closeAdded();
  };

  const cancelAdd = () => {
    if (!addedId) return;
    setGames((list) => list.filter((g) => g.id !== addedId));
    closeAdded();
  };

  const choose = () => {
    if (focusedRef.current === gamesRef.current.length) {
      setAddOpen(true);
      return;
    }
    launch(gamesRef.current[focusedRef.current]);
  };

  const openTileMenu = () => {
    const game = gamesRef.current[focusedRef.current];
    if (!game) return;
    setTileDraft(game.name);
    setMenuFor(game.id);
  };

  const saveTileName = () => {
    const name = tileDraft.trim();
    if (!name || !menuFor) return;
    setGames((list) => list.map((g) => (g.id === menuFor ? { ...g, name } : g)));
    setMenuFor(null);
  };

  // Delete the tile and its image file
  const deleteTile = () => {
    if (!menuFor) return;
    const game = gamesRef.current.find((g) => g.id === menuFor);
    if (game?.image) invoke("delete_tile_image", { path: game.image }).catch(() => {});
    setGames((list) => list.filter((g) => g.id !== menuFor));
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
          setGames((list) => list.map((g) => (g.id === id ? { ...g, image } : g)));
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
      setGames((list) => list.map((g) => (g.id === id ? { ...g, name } : g)));
    }
    closeAdded();
    setTimeout(() => {
      void (async () => {
        if (picking.current || !id) return;
        picking.current = true;
        try {
          const image = await pickImage(id);
          if (!image) return;
          setGames((list) => list.map((g) => (g.id === id ? { ...g, image } : g)));
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
        navigate("/");
      }
      if (
        e.key === "Escape" &&
        !menuOpenRef.current &&
        !addedIdRef.current &&
        !menuForRef.current &&
        !addOpenRef.current &&
        !steamRef.current
      ) {
        setMenuOpen(true);
      }
      if (
        menuOpenRef.current ||
        picking.current ||
        addedIdRef.current ||
        menuForRef.current ||
        addOpenRef.current ||
        steamRef.current
      ) {
        return;
      }
      if ((e.key === "k" || e.key === "K") && !menuForRef.current) {
        openTileMenu();
        return;
      }
      if (e.key === "ArrowLeft") {
        setFocused((f) => (f - 1 + gamesRef.current.length + 1) % (gamesRef.current.length + 1));
      }
      if (e.key === "ArrowRight") {
        setFocused((f) => (f + 1) % (gamesRef.current.length + 1));
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

      const paused =
        picking.current ||
        menuOpenRef.current ||
        addedIdRef.current ||
        menuForRef.current ||
        addOpenRef.current ||
        steamRef.current;

      if (paused) {
        wasPaused = true;
        raf = requestAnimationFrame(tick);
        return;
      }

      if (wasPaused) {
        wasPaused = false;
        armedCross = false;
      }

      const pad = getPad();
      if (pad) {
        const count = gamesRef.current.length + 1;
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
          Games
        </span>
      </header>

      <div
        className={addedId || menuFor || addOpen || steamGames ? "row is-blocked" : "row"}
        ref={rowRef}
        onWheel={(e) => {
          if (!rowRef.current) return;
          rowRef.current.scrollLeft += e.deltaY;
        }}
      >
        {games.map((game, i) => (
          <div
            key={game.id}
            className={i === focused ? "tile-wrap focused" : "tile-wrap"}
            onMouseEnter={() => setFocused(i)}
          >
            <div className="tile-title">
              <span>{game.name}</span>
            </div>
            <div className="tile" onClick={() => launch(game)}>
              {artSrc(game) && (
                <img
                  className="tile-art"
                  src={artSrc(game)}
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
                  setTileDraft(game.name);
                  setMenuFor(game.id);
                }}
              >
                {moreIcon}
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className={focused === games.length ? "tile focused" : "tile"}
          onMouseEnter={() => setFocused(games.length)}
          onClick={() => setAddOpen(true)}
        >
          <span className="tile-label">Add game</span>
        </button>
      </div>

      {addOpen && (
        <Popup
          title="Add game"
          onClose={() => setAddOpen(false)}
          actions={[
            { label: "Add Steam game", onSelect: () => void openSteam() },
            {
              label: "Add other game",
              onSelect: () => {
                setAddOpen(false);
                setTimeout(() => void addOther(), 50);
              },
            },
            { label: "Cancel", onSelect: () => setAddOpen(false) },
          ]}
        />
      )}

      {steamGames && (
        <Popup
          title={steamGames.length ? "Steam" : "No Steam games found"}
          onClose={() => setSteamGames(null)}
          actions={[
            ...steamGames.map((game) => ({
              label: game.name,
              onSelect: () => addSteam(game),
            })),
            { label: "Cancel", onSelect: () => setSteamGames(null) },
          ]}
        />
      )}

      {menuFor && (
        <Popup
          title="Game"
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