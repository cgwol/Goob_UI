// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn system_action(action: String) -> Result<(), String> {
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
    Ok(())
}

#[tauri::command]
fn launch_path(path: String) -> Result<(), String> {
    let file = std::path::Path::new(&path);
    let mut cmd = std::process::Command::new(file);
    if let Some(dir) = file.parent() {
        cmd.current_dir(dir);
    }
    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet, system_action])
        .invoke_handler(tauri::generate_handler![greet, system_action, launch_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}