use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager};

static LOGGER: OnceLock<AppLogger> = OnceLock::new();

pub struct AppLogger {
    path: PathBuf,
    file: Mutex<File>,
}

impl AppLogger {
    fn new(path: PathBuf, file: File) -> Self {
        Self {
            path,
            file: Mutex::new(file),
        }
    }
}

pub fn init(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(logger) = LOGGER.get() {
        return Ok(logger.path.clone());
    }

    let path = log_file_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|err| err.to_string())?;

    let logger = AppLogger::new(path.clone(), file);
    let _ = LOGGER.set(logger);

    info(format!("logger initialized at {}", path.display()));
    Ok(path)
}

pub fn log_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    Ok(dir.join(Path::new("logs")).join("app.log"))
}

pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|panic_info| {
        error(format!("panic: {panic_info}"));
    }));
}

pub fn info(message: impl AsRef<str>) {
    write_line("INFO", message.as_ref());
}

pub fn warn(message: impl AsRef<str>) {
    write_line("WARN", message.as_ref());
}

pub fn error(message: impl AsRef<str>) {
    write_line("ERROR", message.as_ref());
}

fn write_line(level: &str, message: &str) {
    let timestamp_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let line = format!("[{timestamp_ms}] [{level}] {message}\n");

    if let Some(logger) = LOGGER.get() {
        if let Ok(mut file) = logger.file.lock() {
            let _ = file.write_all(line.as_bytes());
            let _ = file.flush();
        }
    }

    eprint!("{line}");
}
