#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    heed_tauri_lib::run();
}
