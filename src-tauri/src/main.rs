// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent};

struct BackendProcess(Mutex<Option<Child>>);

fn home() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn configured_vault_path() -> Option<PathBuf> {
    let config = home()
        .join("Library")
        .join("Application Support")
        .join("个人工作台")
        .join("vault-path.txt");
    let raw = std::fs::read_to_string(config).ok()?;
    let path = raw.trim();
    (!path.is_empty()).then(|| PathBuf::from(path))
}

fn vault_path(app_handle: &tauri::AppHandle) -> PathBuf {
    if let Ok(path) = std::env::var("WORKBENCH_VAULT_PATH") {
        if !path.trim().is_empty() {
            return PathBuf::from(path);
        }
    }

    // The local installer records the Vault location outside the app bundle.
    // This keeps the installed app movable without copying or embedding user data.
    if let Some(path) = configured_vault_path() {
        return path;
    }

    if !cfg!(debug_assertions) {
        // Preserve support for a portable app placed beside its Vault.
        if let Ok(resources) = app_handle.path().resource_dir() {
            if let Some(project_root) = resources
                .parent()
                .and_then(|contents| contents.parent())
                .and_then(|app_bundle| app_bundle.parent())
            {
                let sibling = project_root.join("个人工作台数据");
                if sibling.exists() {
                    return sibling;
                }
            }
        }
    }

    home()
        .join("Library")
        .join("Application Support")
        .join("个人工作台")
        .join("vault")
}

/// Probe read access to the Vault directory from the GUI main process.
///
/// Accessing `~/Documents/...` triggers macOS TCC's "Files and Folders"
/// prompt for the *user-facing* app. If we let the headless backend node
/// process be the first to touch the path, no prompt is shown (it is a
/// background process with no UI to surface the dialog) and the underlying
/// `open()` syscall silently blocks forever — leaving the app on a white
/// screen with no backend listening on 4317.
///
/// Surfacing the prompt here means the user gets one clean "Allow" click,
/// and the authorization then applies to the bundled node sidecar too
/// (same code signature / app identity), so the backend can read the vault.
fn probe_vault_access(app_handle: &tauri::AppHandle) {
    let vault = vault_path(app_handle);
    match std::fs::read_dir(&vault) {
        Ok(_) => println!("[pgt] Vault access OK (TCC granted)"),
        Err(e) => eprintln!(
            "[pgt] Vault access probe failed: {e}. If you denied access, grant it in \
             System Settings → Privacy & Security → Files & Folders (or Full Disk Access) \
             and reopen the app."
        ),
    }
}

fn start_backend(app_handle: &tauri::AppHandle) -> Option<Child> {
    let vault = vault_path(app_handle);

    // Surface the TCC "access Documents" prompt from the GUI process BEFORE
    // spawning the headless backend; otherwise the backend silently hangs on
    // `open()` of a path under ~/Documents.
    probe_vault_access(app_handle);

    // Production: run from the bundled runtime directory.
    // Dev: current working dir (set by `tauri dev`).
    let (server_js, cwd) = if cfg!(debug_assertions) {
        (PathBuf::from("dist-server/server/index.js"), PathBuf::from("."))
    } else {
        let resources = app_handle.path().resource_dir().ok()?;
        let runtime_root = resources.join("_up_/runtime");
        let server = runtime_root.join("dist-server/server/index.js");
        (server, runtime_root)
    };

    println!("[pgt] Vault: {}", vault.display());
    println!("[pgt] Server: {}", server_js.display());
    println!("[pgt] CWD: {}", cwd.display());

    if !server_js.exists() {
        eprintln!("[pgt] Server JS not found — backend won't start");
        return None;
    }

    // .app bundles launched from Finder don't inherit shell PATH, so we
    // probe common Node.js install locations in order.
    let node_paths: Vec<PathBuf> = {
        // Bundle-embedded node (signed together with the app) takes priority so
        // TCC authorization for ~/Documents is attributed to the stable app
        // identity and persists, instead of to an external, changing node binary.
        let mut paths: Vec<PathBuf> = Vec::new();
        if let Ok(resources) = app_handle.path().resource_dir() {
            paths.push(resources.join("_up_/node-runtime/node"));
        }
        paths.push(PathBuf::from("node")); // PATH fallback
        if let Ok(home) = std::env::var("HOME") {
            let home = PathBuf::from(home);
            paths.extend([
                home.join(".nvm/versions/node/v24.16.0/bin/node"),
                home.join(".workbuddy/binaries/node/versions/24.16.0/bin/node"),
                home.join(".workbuddy/binaries/node/versions/22.22.2/bin/node"),
                home.join(".nvm/versions/node").join(format!(
                    "v{}",
                    std::env::var("NODE_VERSION").unwrap_or_else(|_| "24.16.0".to_string())
                )).join("bin/node"),
            ]);
        }
        paths.extend([
            PathBuf::from("/usr/local/bin/node"),
            PathBuf::from("/opt/homebrew/bin/node"),
            PathBuf::from("/usr/bin/node"),
        ]);
        paths
    };

    // Surface backend stdout/stderr to a log file in the user's cache so
    // crashes can be diagnosed without a console attached.
    let log_path = home().join("Library/Logs/pgt-workbench.log");
    let _ = std::fs::create_dir_all(log_path.parent().unwrap_or(&home()));

    for node_path in &node_paths {
        if !node_path.exists() && node_path.components().count() > 1 {
            continue;
        }
        println!("[pgt] Trying node: {}", node_path.display());

        let stdout_log = std::fs::OpenOptions::new().create(true).append(true).open(&log_path).ok().map(std::process::Stdio::from);
        let stderr_log = std::fs::OpenOptions::new().create(true).append(true).open(&log_path).ok().map(std::process::Stdio::from);

        let result = Command::new(node_path)
            .arg(&server_js)
            .current_dir(&cwd)
            .env("WORKBENCH_VAULT_PATH", vault.to_string_lossy().to_string())
            .env(
                "WORKBENCH_STATIC_PATH",
                app_handle
                    .path()
                    .resource_dir()
                    .map(|resources| resources.join("_up_/dist"))
                    .unwrap_or_else(|_| PathBuf::from("dist"))
                    .to_string_lossy()
                    .to_string(),
            )
            .env("WORKBENCH_PORT", "4317")
            .env("NODE_ENV", "production")
            .stdout(stdout_log.unwrap_or(std::process::Stdio::null()))
            .stderr(stderr_log.unwrap_or(std::process::Stdio::null()))
            .spawn();
        match result {
            Ok(child) => {
                println!("[pgt] Backend started (pid={}) using {}", child.id(), node_path.display());
                return Some(child);
            }
            Err(e) => {
                eprintln!("[pgt] Failed to spawn {}: {e}", node_path.display());
            }
        }
    }

    eprintln!("[pgt] No usable node binary found in PATH or common locations");
    None
}

fn kill_backend(proc: &BackendProcess) {
    if let Some(mut child) = proc.0.lock().unwrap().take() {
        println!("[pgt] Shutting down backend...");
        let _ = child.kill();
        let _ = child.wait();
    }
}

/// Start a filesystem watcher on the Vault and emit Tauri events on changes.
/// Replaces the original HTTP EventSource approach — works in the secure
/// `tauri://` context where the SSE connection was blocked.
fn start_vault_watcher(app_handle: &tauri::AppHandle) {
    let vault = vault_path(app_handle);
    if !vault.exists() {
        eprintln!("[pgt] Vault not found at {} — file watcher disabled", vault.display());
        return;
    }

    let handle = app_handle.clone();
    let path = vault.clone();
    std::thread::spawn(move || {
        let rt = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(e) => {
                eprintln!("[pgt] Watcher runtime init failed: {e}");
                return;
            }
        };
        rt.block_on(async move {
            let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<notify::Result<Event>>();
            let mut watcher = match RecommendedWatcher::new(
                move |res| {
                    let _ = tx.send(res);
                },
                Config::default().with_poll_interval(Duration::from_secs(2)),
            ) {
                Ok(w) => w,
                Err(e) => {
                    eprintln!("[pgt] Watcher creation failed: {e}");
                    return;
                }
            };
            if let Err(e) = watcher.watch(&path, RecursiveMode::Recursive) {
                eprintln!("[pgt] Watcher failed to watch {}: {e}", path.display());
                return;
            }
            println!("[pgt] Watching vault: {}", path.display());

            while let Some(res) = rx.recv().await {
                if let Ok(event) = res {
                    let kind_str = match event.kind {
                        EventKind::Create(_) => "create",
                        EventKind::Modify(_) => "modify",
                        EventKind::Remove(_) => "remove",
                        _ => continue,
                    };
                    for path in event.paths {
                        let _ = handle.emit("vault-change", serde_json::json!({
                            "kind": kind_str,
                            "path": path.to_string_lossy(),
                        }));
                    }
                }
            }
        });
    });
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let child = start_backend(app.handle());
            app.manage(BackendProcess(Mutex::new(child)));

            // Start vault filesystem watcher (replaces HTTP SSE for realtime sync)
            start_vault_watcher(app.handle());

            let open = MenuItemBuilder::with_id("open", "打开工作台").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&open, &quit]).build()?;

            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("个人工作台")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        kill_backend(&*app.state::<BackendProcess>());
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri app")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                kill_backend(&*app_handle.state::<BackendProcess>());
            }
        });
}
