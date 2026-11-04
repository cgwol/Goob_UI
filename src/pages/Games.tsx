import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { SideMenu } from "../components/SideMenu";
import { Popup } from "../components/PromptMenu";
import { useInputMode } from "../input-mode";

type Game = { id: string; name: string; path: string };

const KEY = "games";

function loadGames(): Game[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function nameFromPath(path: string) {
  const file = path.split(/[/\\]/).pop() ?? path;
  return file.replace(/\.(app|exe)$/i, "");
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

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(games));
  }, [games]);

  // CHANGE: start the exe from Rust
  const launch = (game: Game) => {
    invoke("launch_path", { path: game.path }).catch((err) => console.error(err));
  };

  const add = async () => {
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
      setTimeout(() => void add(), 50);
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

  const deleteTile = () => {
    if (!menuFor) return;
    setGames((list) => list.filter((g) => g.id !== menuFor));
    setMenuFor(null);
    setFocused(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).tagName === "INPUT";
      if (e.key === "Backspace" && !typing) {
        e.preventDefault();
        navigate("/");
      }
      if (e.key === "Escape" && !menuOpenRef.current && !addedIdRef.current && !menuForRef.current) {
        setMenuOpen(true);
      }
      if (menuOpenRef.current || picking.current || addedIdRef.current || menuForRef.current) return;
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
        picking.current || menuOpenRef.current || addedIdRef.current || menuForRef.current;

      if (paused) {
        wasPaused = true;
        raf = requestAnimationFrame(tick);
        return;
      }

      if (wasPaused) {
        wasPaused = false;
        armedCross = false;
      }

      const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
      if (pad) {
        const count = gamesRef.current.length + 1;
        const x = pad.axes[0] ?? 0;
        const left = x < -0.6 || !!pad.buttons[14]?.pressed;
        const right = x > 0.6 || !!pad.buttons[15]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const circle = !!pad.buttons[1]?.pressed;
        const triangle = !!pad.buttons[3]?.pressed;
        const ps = !!pad.buttons[16]?.pressed;
        const start = !!pad.buttons[9]?.pressed;
        const now = performance.now();

        const active = left && !right ? "left" : right && !left ? "right" : null;

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

      <div className="row">
        {games.map((game, i) => (
          <div
            key={game.id}
            className={i === focused ? "tile focused" : "tile"}
            onMouseEnter={() => setFocused(i)}
            onClick={() => launch(game)}
          >
            <span className="tile-label">{game.name}</span>
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
        ))}
        <button
          type="button"
          className={focused === games.length ? "tile focused" : "tile"}
          onMouseEnter={() => setFocused(games.length)}
          onClick={() => setTimeout(() => void add(), 50)}
        >
          <span className="tile-label">Add game</span>
        </button>
      </div>

      {menuFor && (
        <Popup
          title="Game"
          onClose={() => setMenuFor(null)}
          actions={[
            { label: "Save name", onSelect: saveTileName },
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