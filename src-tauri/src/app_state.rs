use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};

use elective_captcha_rten::Recognizer;
use elective_core::{AppConfig, Credentials, ElectiveScheduleRow, ElectiveSession, Orchestrator};
use tokio::sync::Mutex;

use crate::auth_persistence::AuthPreferences;

pub struct AppState {
    pub orchestrator: Mutex<Orchestrator>,
    pub credentials: Mutex<Option<Credentials>>,
    pub manual_session: Mutex<Option<ElectiveSession>>,
    pub auth_username: Mutex<Option<String>>,
    pub auth_preferences: Mutex<AuthPreferences>,
    pub auth_restoring: Mutex<bool>,
    pub automation_running: Mutex<bool>,
    pub elective_data_preloading: AtomicBool,
    pub elective_schedule: Mutex<Vec<ElectiveScheduleRow>>,
    pub auth_generation: AtomicU64,
    pub manual_captcha_image_b64: Mutex<Option<String>>,
    pub manual_captcha_verified: Mutex<bool>,
    pub supplement_captcha_recognized: Mutex<Option<String>>,
    pub supplement_captcha_recognition_error: Mutex<Option<String>>,
    pub captcha_recognizer: StdMutex<Option<Arc<Recognizer>>>,
    pub captcha_model_error: StdMutex<Option<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        let config = AppConfig::default();
        Self {
            orchestrator: Mutex::new(Orchestrator::new(config)),
            credentials: Mutex::new(None),
            manual_session: Mutex::new(None),
            auth_username: Mutex::new(None),
            auth_preferences: Mutex::new(AuthPreferences::default()),
            auth_restoring: Mutex::new(true),
            automation_running: Mutex::new(false),
            elective_data_preloading: AtomicBool::new(false),
            elective_schedule: Mutex::new(Vec::new()),
            auth_generation: AtomicU64::new(0),
            manual_captcha_image_b64: Mutex::new(None),
            manual_captcha_verified: Mutex::new(false),
            supplement_captcha_recognized: Mutex::new(None),
            supplement_captcha_recognition_error: Mutex::new(None),
            captcha_recognizer: StdMutex::new(None),
            captcha_model_error: StdMutex::new(None),
        }
    }
}

impl AppState {
    pub fn initialize_captcha_model(&self, resource_dir: Option<std::path::PathBuf>) {
        let mut candidates = Vec::new();
        if let Some(resource_dir) = resource_dir {
            candidates.push(resource_dir.join("captcha").join("recognizer.rten"));
        }
        candidates.push(
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join("captcha")
                .join("recognizer.rten"),
        );
        let model_path = candidates.into_iter().find(|path| path.is_file());
        let result = model_path
            .ok_or_else(|| {
                "验证码识别模型不存在，请确认已安装完整的 PKUElective 资源文件。".to_string()
            })
            .and_then(|path| {
                Recognizer::load(&path).map_err(|err| format!("验证码识别模型加载失败：{err}"))
            });
        match result {
            Ok(recognizer) => {
                *self
                    .captcha_recognizer
                    .lock()
                    .expect("captcha recognizer lock") = Some(Arc::new(recognizer));
                *self
                    .captcha_model_error
                    .lock()
                    .expect("captcha model error lock") = None;
            }
            Err(error) => {
                *self
                    .captcha_recognizer
                    .lock()
                    .expect("captcha recognizer lock") = None;
                *self
                    .captcha_model_error
                    .lock()
                    .expect("captcha model error lock") = Some(error);
            }
        }
    }

    pub fn captcha_recognizer(&self) -> Option<Arc<Recognizer>> {
        self.captcha_recognizer
            .lock()
            .expect("captcha recognizer lock")
            .clone()
    }

    pub fn captcha_model_error(&self) -> Option<String> {
        self.captcha_model_error
            .lock()
            .expect("captcha model error lock")
            .clone()
    }

    pub async fn recognize_captcha(&self, image: Vec<u8>) -> Result<String, String> {
        let recognizer = self.captcha_recognizer().ok_or_else(|| {
            self.captcha_model_error()
                .unwrap_or_else(|| "验证码识别模型不可用。".into())
        })?;
        tauri::async_runtime::spawn_blocking(move || recognizer.recognize(&image))
            .await
            .map_err(|err| format!("验证码识别任务失败：{err}"))?
            .map_err(|err| format!("验证码识别失败：{err}"))
    }

    pub async fn set_auth_state(
        &self,
        credentials: Option<Credentials>,
        session: ElectiveSession,
        username: String,
    ) {
        self.auth_generation.fetch_add(1, Ordering::AcqRel);
        {
            let mut guard = self.credentials.lock().await;
            *guard = credentials;
        }
        {
            let mut guard = self.manual_session.lock().await;
            *guard = Some(session);
        }
        {
            let mut guard = self.auth_username.lock().await;
            *guard = Some(username);
        }
        {
            let mut guard = self.manual_captcha_image_b64.lock().await;
            *guard = None;
        }
        {
            let mut guard = self.manual_captcha_verified.lock().await;
            *guard = false;
        }
        *self.supplement_captcha_recognized.lock().await = None;
        *self.supplement_captcha_recognition_error.lock().await = None;
    }

    pub async fn clear_auth_state(&self) {
        self.auth_generation.fetch_add(1, Ordering::AcqRel);
        self.elective_data_preloading
            .store(false, Ordering::Release);
        {
            let mut credentials = self.credentials.lock().await;
            *credentials = None;
        }
        {
            let mut session = self.manual_session.lock().await;
            *session = None;
        }
        {
            let mut auth_username = self.auth_username.lock().await;
            *auth_username = None;
        }
        {
            let mut orchestrator = self.orchestrator.lock().await;
            orchestrator.clear_runtime_state();
        }
        {
            let mut schedule = self.elective_schedule.lock().await;
            schedule.clear();
        }
        {
            let mut captcha = self.manual_captcha_image_b64.lock().await;
            *captcha = None;
        }
        {
            let mut verified = self.manual_captcha_verified.lock().await;
            *verified = false;
        }
        *self.supplement_captcha_recognized.lock().await = None;
        *self.supplement_captcha_recognition_error.lock().await = None;
    }

    pub async fn finish_auth_restore(&self) {
        let mut restoring = self.auth_restoring.lock().await;
        *restoring = false;
    }
}
