use tauri::{AppHandle, State};

use elective_core::WishlistItem;

use crate::app_state::AppState;
use crate::emit::emit_message;
use crate::logger;

#[tauri::command]
pub async fn add_wishlist(
    course_id: String,
    name: String,
    class_id: String,
    teacher: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<WishlistItem>, String> {
    logger::info("command: add_wishlist");
    let label = format!(
        "已加入待选列表：{} {}班（{}）",
        course_id, class_id, teacher
    );
    {
        let mut orchestrator = state.automation.lock().await;
        orchestrator.add_wishlist(WishlistItem::new(course_id, name, class_id, teacher));
    }
    emit_message(&app, "success", label)?;

    Ok(state.automation.lock().await.wishlist().to_vec())
}

#[tauri::command]
pub async fn remove_wishlist(
    course_id: String,
    class_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<WishlistItem>, String> {
    logger::info("command: remove_wishlist");
    let label = format!("已移出待选列表：{} {}班", course_id, class_id);
    {
        let mut orchestrator = state.automation.lock().await;
        orchestrator.remove_wishlist(&course_id, &class_id);
    }
    emit_message(&app, "info", label)?;

    Ok(state.automation.lock().await.wishlist().to_vec())
}
