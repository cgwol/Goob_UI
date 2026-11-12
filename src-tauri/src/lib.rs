// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Hide the console window when spawning child processes on Windows (prevents flash in release builds).
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(target_os = "windows")]
fn hidden_cmd(program: &str) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(target_os = "windows"))]
fn hidden_cmd(program: &str) -> std::process::Command {
    std::process::Command::new(program)
}

#[derive(serde::Serialize)]
struct OpenWindow {
    title: String,
    process_name: String,
    icon: Option<String>,
    command_line: Option<String>,
    pid: u32,
}

#[derive(serde::Serialize)]
struct SteamGame {
    app_id: String,
    name: String,
}

#[derive(serde::Serialize)]
struct SteamList {
    games: Vec<SteamGame>,
    libraries: Vec<String>,
}

#[tauri::command]
fn system_action(action: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = match action.as_str() {
            "sleep" => {
                let mut c = std::process::Command::new("rundll32.exe");
                c.args(["powrprof.dll,SetSuspendState", "0,1,0"]);
                c
            }
            "shutdown" => {
                let mut c = std::process::Command::new("shutdown");
                c.args(["/s", "/t", "0"]);
                c
            }
            _ => return Err("unknown action".into()),
        };
        cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let script = match action.as_str() {
            "sleep" => "tell application \"System Events\" to sleep",
            "shutdown" => "tell application \"System Events\" to shut down",
            _ => return Err("unknown action".into()),
        };
        std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = action;
        Err("unsupported platform".into())
    }
}

/// Bring the main Goob window forward so controller input has a focused window.
fn focus_goob(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[tauri::command]
fn launch_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let file = std::path::Path::new(&path);
    let is_bat = file
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("bat"))
        .unwrap_or(false);
    let mut cmd = if is_bat {
        let mut c = hidden_cmd("cmd");
        c.args(["/C", &path]);
        c
    } else {
        std::process::Command::new(file)
    };
    if let Some(dir) = file.parent() {
        cmd.current_dir(dir);
    }
    cmd.spawn().map_err(|e| e.to_string())?;

    // Focus the launched app after a short delay. Goob stays where it was.
    let name = file
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    if !name.is_empty() {
        let app2 = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(600));
            let _ = focus_window(app2, name);
        });
    }
    Ok(())
}

/// Check if a process with the given name is currently running (Windows-focused).
#[tauri::command]
fn is_process_running(name: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let output = hidden_cmd("tasklist")
            .args(["/FI", &format!("IMAGENAME eq {}", name), "/NH"])
            .output()
            .map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
        Ok(text.contains(&name.to_lowercase()))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = name;
        Ok(false)
    }
}

/// Bring an existing window to the foreground by process name or title (Windows).
#[tauri::command]
fn focus_window(app: tauri::AppHandle, query: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        let script = format!(
            r#"
            Add-Type -AssemblyName Microsoft.VisualBasic
            $null = [Microsoft.VisualBasic.Interaction]::AppActivate('{}')
            "#,
            query.replace('\'', "''")
        );
        hidden_cmd("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, query);
        Err("focus_window only supported on Windows".into())
    }
}

/// Close a window/process by PID (Windows), then focus Goob so the controller still works.
#[tauri::command]
fn close_window(app: tauri::AppHandle, pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        hidden_cmd("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .spawn()
            .map_err(|e| e.to_string())?;
        let app2 = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(250));
            focus_goob(&app2);
        });
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, pid);
        Err("close_window only supported on Windows".into())
    }
}

/// List currently open top-level windows that appear on the taskbar (Windows).
#[tauri::command]
fn list_open_windows() -> Result<Vec<OpenWindow>, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$windows = Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowHandle -ne 0 }
$result = @()
foreach ($w in $windows) {
    $icon = $null
    if ($w.Path -and (Test-Path $w.Path)) {
        try {
            $extracted = [System.Drawing.Icon]::ExtractAssociatedIcon($w.Path)
            if ($extracted) {
                $bmp = $extracted.ToBitmap()
                $ms = New-Object System.IO.MemoryStream
                $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
                $bytes = $ms.ToArray()
                $icon = [Convert]::ToBase64String($bytes)
                $ms.Dispose()
                $bmp.Dispose()
                $extracted.Dispose()
            }
        } catch {}
    }
    $cmd = $null
    try { $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($w.Id)").CommandLine } catch {}
    $result += [PSCustomObject]@{
        title = $w.MainWindowTitle
        process_name = $w.ProcessName
        icon = $icon
        command_line = $cmd
        pid = $w.Id
    }
}
$result | ConvertTo-Json -Compress
"#;
        let output = hidden_cmd("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", script])
            .output()
            .map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&output.stdout);
        if text.trim().is_empty() {
            return Ok(vec![]);
        }
        let parsed: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        let arr = match parsed {
            serde_json::Value::Array(a) => a,
            serde_json::Value::Object(_) => vec![parsed],
            _ => vec![],
        };
        let mut windows = Vec::new();
        for item in arr {
            let title = item
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if title.is_empty() {
                continue;
            }
            let process_name = item
                .get("process_name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let icon = item
                .get("icon")
                .and_then(|v| v.as_str())
                .map(|s| format!("data:image/png;base64,{}", s));
            let command_line = item
                .get("command_line")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let pid = item.get("pid").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            windows.push(OpenWindow {
                title,
                process_name,
                icon,
                command_line,
                pid,
            });
        }
        Ok(windows)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec![])
    }
}

fn steam_root() -> Option<std::path::PathBuf> {
    let output = hidden_cmd("reg")
        .args(["query", r"HKCU\Software\Valve\Steam", "/v", "SteamPath"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let path = text.lines().find_map(|line| {
        let line = line.trim();
        let rest = line.strip_prefix("SteamPath")?.trim();
        let rest = rest.strip_prefix("REG_SZ")?.trim();
        Some(std::path::PathBuf::from(rest))
    })?;
    if path.join("steamapps").exists() {
        Some(path)
    } else {
        None
    }
}

fn field(body: &str, key: &str) -> String {
    let needle = format!("\"{key}\"");
    for line in body.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix(&needle) {
            return rest.trim().trim_matches('"').to_string();
        }
    }
    String::new()
}

#[tauri::command]
fn list_steam_games(cached: Option<Vec<String>>) -> Result<SteamList, String> {
    let libs = if let Some(paths) = cached.as_ref().filter(|p| !p.is_empty()) {
        let found: Vec<std::path::PathBuf> = paths
            .iter()
            .map(std::path::PathBuf::from)
            .filter(|p| p.exists())
            .collect();
        if found.is_empty() {
            discover_steam_libs()?
        } else {
            found
        }
    } else {
        discover_steam_libs()?
    };

    let mut games = Vec::new();
    for lib in &libs {
        let Ok(entries) = std::fs::read_dir(lib) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("appmanifest_") || !name.ends_with(".acf") {
                continue;
            }
            let Ok(body) = std::fs::read_to_string(entry.path()) else {
                continue;
            };
            let app_id = field(&body, "appid");
            let title = field(&body, "name");
            if !app_id.is_empty() && !title.is_empty() {
                games.push(SteamGame {
                    app_id,
                    name: title,
                });
            }
        }
    }
    games.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(SteamList {
        games,
        libraries: libs
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect(),
    })
}

/// Find every Steam library folder. This is the slow path: it shells out to
/// `reg.exe` once, then reads libraryfolders.vdf.
fn discover_steam_libs() -> Result<Vec<std::path::PathBuf>, String> {
    let steam = steam_root().ok_or("Steam install not found")?;
    let vdf = steam.join("steamapps").join("libraryfolders.vdf");
    let text = std::fs::read_to_string(&vdf).unwrap_or_default();

    let mut libs = vec![steam.join("steamapps")];
    for line in text.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("\"path\"") {
            let path = rest.trim().trim_matches('"').replace("\\\\", "\\");
            let lib = std::path::PathBuf::from(path).join("steamapps");
            if !libs.contains(&lib) {
                libs.push(lib);
            }
        }
    }
    Ok(libs)
}

#[tauri::command]
fn launch_steam(_app: tauri::AppHandle, app_id: String) -> Result<(), String> {
    let steam = steam_root().ok_or("Steam install not found")?;
    std::process::Command::new(steam.join("steam.exe"))
        .arg("-applaunch")
        .arg(&app_id)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn tiles_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("tiles");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn clear_tile(dir: &std::path::Path, id: &str) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let prefix = format!("{id}.");
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&prefix) {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

#[tauri::command]
fn save_tile_image(app: tauri::AppHandle, id: String, path: String) -> Result<String, String> {
    let dir = tiles_dir(&app)?;
    clear_tile(&dir, &id);
    let src = std::path::PathBuf::from(&path);
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let dest = dir.join(format!("{id}.{ext}"));
    std::fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn save_data_url(app: tauri::AppHandle, id: String, data_url: String) -> Result<String, String> {
    let (mime, b64) = data_url
        .strip_prefix("data:")
        .and_then(|rest| rest.split_once(";base64,"))
        .ok_or("bad data url")?;
    let ext = match mime {
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "png",
    };
    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, b64)
        .map_err(|e| e.to_string())?;
    let dir = tiles_dir(&app)?;
    clear_tile(&dir, &id);
    let dest = dir.join(format!("{id}.{ext}"));
    std::fs::write(&dest, bytes).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_tile_image(path: String) -> Result<(), String> {
    if path.is_empty() || path.starts_with("data:") || path.starts_with("http") {
        return Ok(());
    }
    let file = std::path::Path::new(&path);
    if file.exists() {
        std::fs::remove_file(file).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn clear_tiles(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("tiles");
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Result<String, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let path = config_path(&app)?;
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            system_action,
            launch_path,
            list_steam_games,
            launch_steam,
            save_tile_image,
            save_data_url,
            delete_tile_image,
            clear_tiles,
            load_config,
            save_config,
            is_process_running,
            focus_window,
            close_window,
            list_open_windows
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}