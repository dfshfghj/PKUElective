use tauri::{AppHandle, State};

use elective_core::WishlistItem;

use crate::app_state::AppState;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};
use crate::logger;

#[tauri::command]
pub async fn add_wishlist(
    course_id: String,
    name: String,
    class_id: String,
    teacher: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: add_wishlist");
    let label = format!("已加入待选列表：{} {}班（{}）", course_id, class_id, teacher);
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.add_wishlist(WishlistItem::new(course_id, name, class_id, teacher));
    }
    emit_message(&app, "success", label)?;

    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn remove_wishlist(
    course_id: String,
    class_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: remove_wishlist");
    let label = format!("已移出待选列表：{} {}班", course_id, class_id);
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.remove_wishlist(&course_id, &class_id);
    }
    emit_message(&app, "info", label)?;

    emit_snapshot_events(&app, &state).await
}
