use tauri::{AppHandle, State};

use heed_core::WishlistItem;

use crate::app_state::AppState;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};

#[tauri::command]
pub async fn add_wishlist(
    name: String,
    class_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let label = format!("已加入待选列表：{} {}", name, class_id);
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.add_wishlist(WishlistItem::new(name, class_id));
    }
    emit_message(&app, "success", label)?;

    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn remove_wishlist(
    name: String,
    class_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let label = format!("已移出待选列表：{} {}", name, class_id);
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.remove_wishlist(&name, &class_id);
    }
    emit_message(&app, "info", label)?;

    emit_snapshot_events(&app, &state).await
}
