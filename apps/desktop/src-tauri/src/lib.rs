use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Holds the running server child so the app can terminate it cleanly when
/// the main window closes. Wrapped in a Mutex because `CommandChild::kill`
/// takes `self` and we need interior mutability through the shared State.
struct ServerProcess(Mutex<Option<CommandChild>>);

/// Matches the marker emitted by `apps/server/src/index.ts` once Fastify is
/// listening. The sidecar prints `AGBOOK_READY_URL=http://127.0.0.1:<port>`
/// and we parse that to learn the ephemeral port the OS assigned us.
const READY_PREFIX: &str = "AGBOOK_READY_URL=";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            // In debug builds the developer runs `npm run dev:server` and
            // `npm run dev:web` themselves; the window just loads the Vite
            // dev URL and the /api calls go through Vite's proxy, so we
            // don't spawn a sidecar or inject an API base.
            if cfg!(debug_assertions) {
                build_main_window(app.handle(), None)?;
                return Ok(());
            }

            // Route per-user data into the OS-native app data directory so we
            // don't write inside the read-only app bundle on macOS/Windows.
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).ok();

            // AGBOOK_PORT=0 asks the server to let the OS pick a free
            // ephemeral port so we don't collide with whatever the user
            // has running on 8787.
            let sidecar = app
                .shell()
                .sidecar("agbook-server")
                .expect("agbook-server sidecar not bundled")
                .env("AGBOOK_DATA_DIR", data_dir.to_string_lossy().to_string())
                .env("AGBOOK_HOST", "127.0.0.1")
                .env("AGBOOK_PORT", "0");

            let (mut rx, child) = sidecar.spawn().expect("failed to spawn agbook-server");

            app.state::<ServerProcess>()
                .0
                .lock()
                .unwrap()
                .replace(child);

            // Cross-thread handoff of the discovered API base URL. A sync
            // std::sync::mpsc channel is fine here because the setup closure
            // runs on a normal thread and we only need to receive once.
            let (url_tx, url_rx) = std::sync::mpsc::channel::<String>();

            tauri::async_runtime::spawn(async move {
                let mut url_sent = false;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                            let text = String::from_utf8_lossy(&line).to_string();
                            eprintln!("[server] {}", text.trim_end_matches(['\r', '\n']));
                            if !url_sent {
                                if let Some(pos) = text.find(READY_PREFIX) {
                                    let url = text[pos + READY_PREFIX.len()..]
                                        .trim()
                                        .to_string();
                                    if !url.is_empty() {
                                        let _ = url_tx.send(url);
                                        url_sent = true;
                                    }
                                }
                            }
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[server] terminated: {:?}", payload);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            // pkg-compiled Node startup + better-sqlite3 open usually
            // finishes in well under a second; 15 s is a very generous
            // ceiling that stops us from hanging forever if the server
            // errors out before printing anything.
            let api_base = url_rx
                .recv_timeout(Duration::from_secs(15))
                .expect("agbook-server did not become ready in time");

            build_main_window(app.handle(), Some(&api_base))?;
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

/// Build the single main window. When `api_base` is provided we inject it
/// into `window.__AGBOOK_API_BASE__` via an initialization script so the
/// frontend's `resolveApiBase()` picks it up *before* any app code runs —
/// this is how we ship a dynamic sidecar port to static JS assets.
fn build_main_window(
    app: &tauri::AppHandle,
    api_base: Option<&str>,
) -> tauri::Result<()> {
    let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("agbook")
        .inner_size(1280.0, 820.0)
        .min_inner_size(960.0, 600.0)
        .resizable(true)
        .center();

    if let Some(base) = api_base {
        let script = format!(
            "Object.defineProperty(window,'__AGBOOK_API_BASE__',{{value:{},configurable:false,writable:false}});",
            serde_json::to_string(base).unwrap_or_else(|_| "\"\"".into())
        );
        builder = builder.initialization_script(&script);
    }

    builder.build()?;
    Ok(())
}
