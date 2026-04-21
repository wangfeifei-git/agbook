use std::sync::Mutex;

use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Holds the running server child so the app can terminate it cleanly when
/// the main window closes. Wrapped in a Mutex because `CommandChild::kill`
/// takes `self` and we need interior mutability through the shared State.
struct ServerProcess(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            // In debug builds we assume the developer runs `npm run dev:server`
            // themselves, so we skip spawning the sidecar and let the frontend
            // talk to the long-lived dev server via the Vite proxy.
            if cfg!(debug_assertions) {
                return Ok(());
            }

            // Route per-user data into the OS-native app data directory so we
            // don't write inside the read-only app bundle on macOS/Windows.
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).ok();

            let sidecar = app
                .shell()
                .sidecar("agbook-server")
                .expect("agbook-server sidecar not bundled")
                .env("AGBOOK_DATA_DIR", data_dir.to_string_lossy().to_string())
                .env("AGBOOK_HOST", "127.0.0.1")
                .env("AGBOOK_PORT", "8787");

            let (mut rx, child) = sidecar.spawn().expect("failed to spawn agbook-server");

            app.state::<ServerProcess>()
                .0
                .lock()
                .unwrap()
                .replace(child);

            // Drain stdout/stderr so the sidecar never blocks on a full pipe,
            // and surface a couple of lines in the Tauri log for diagnostics.
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            eprintln!("[server] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[server] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[server] terminated: {:?}", payload);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building agbook desktop application")
        .run(|app_handle, event| {
            // When the app exits for any reason, make sure the Node sidecar
            // is not left dangling as a zombie process.
            if let RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<ServerProcess>() {
                    if let Some(child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
