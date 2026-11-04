// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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

#[tauri::command]
fn launch_path(path: String) -> Result<(), String> {
    let file = std::path::Path::new(&path);
    let is_bat = file
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("bat"))
        .unwrap_or(false);
    let mut cmd = if is_bat {
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", &path]);
        c
    } else {
        std::process::Command::new(file)
    };
    if let Some(dir) = file.parent() {
        cmd.current_dir(dir);
    }
    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(serde::Serialize)]
struct SteamGame {
    app_id: String,
    name: String,
}

fn steam_root() -> Option<std::path::PathBuf> {
    let output = std::process::Command::new("reg")
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
fn list_steam_games() -> Result<Vec<SteamGame>, String> {
    let steam = steam_root().ok_or("Steam install not found")?;
    let vdf = steam.join("steamapps").join("libraryfolders.vdf");
    let text = std::fs::read_to_string(&vdf).map_err(|e| e.to_string())?;

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

    let mut games = Vec::new();
    for lib in libs {
        let Ok(entries) = std::fs::read_dir(&lib) else {
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
    Ok(games)
}

#[tauri::command]
fn launch_steam(app_id: String) -> Result<(), String> {
    let steam = steam_root().ok_or("Steam install not found")?;
    std::process::Command::new(steam.join("steam.exe"))
        .arg("-applaunch")
        .arg(&app_id)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_image(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    };
    Ok(format!(
        "data:{mime};base64,{}",
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes)
    ))
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
            greet,
            system_action,
            launch_path,
            list_steam_games,
            launch_steam,
            read_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
