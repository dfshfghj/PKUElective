use cookie_store::serde::json::{
    load_all as load_cookies_json, save_incl_expired_and_nonpersistent,
};
use reqwest::{
    Client,
    header::{CACHE_CONTROL, COOKIE, HeaderMap, HeaderValue, REFERER},
};
use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
use serde::Deserialize;
use std::{
    io::{BufReader, BufWriter},
    sync::Arc,
};

use crate::{
    error::{ElectiveError, Result},
    types::Channel,
};

const LOGIN_URL: &str = "https://iaaa.pku.edu.cn/iaaa/oauthlogin.do";
const SSO_URL: &str = "https://elective.pku.edu.cn/elective2008/ssoLogin.do";
const HELP_TITLE: &str = "<title>帮助-总体流程</title>";
const COURSE_HOME_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/help/HelpController.jpf";
type SharedCookieStore = Arc<CookieStoreMutex>;

#[derive(Debug, Clone)]
pub struct Credentials {
    pub username: String,
    pub password: String,
    pub channel: Option<Channel>,
}

impl Credentials {
    pub fn try_from_parts(
        username: String,
        password: String,
        channel: Option<String>,
    ) -> Result<Self> {
        let username = username.trim().to_string();
        if username.is_empty() || password.is_empty() {
            return Err(ElectiveError::AuthFailed("missing username or password".into()));
        }

        let channel = match channel
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            Some("bzx") => Some(Channel::Bzx),
            Some("bfx") => Some(Channel::Bfx),
            Some(other) => return Err(ElectiveError::Config(format!("unsupported channel: {other}"))),
            None => None,
        };

        Ok(Self {
            username,
            password,
            channel,
        })
    }
}

#[derive(Clone)]
pub struct AuthSession {
    client: Client,
    cookie_store: SharedCookieStore,
    username: String,
    channel: Option<Channel>,
}

impl AuthSession {
    pub fn client(&self) -> &Client {
        &self.client
    }

    pub fn username(&self) -> &str {
        &self.username
    }

    pub fn channel(&self) -> Option<&Channel> {
        self.channel.as_ref()
    }

    pub fn persist_cookies_json(&self) -> Result<String> {
        let store = self
            .cookie_store
            .lock()
            .map_err(|err| ElectiveError::Fatal(format!("cookie store lock poisoned: {err}")))?;
        let mut writer = BufWriter::new(Vec::new());
        save_incl_expired_and_nonpersistent(&*store, &mut writer)
            .map_err(|err| ElectiveError::Fatal(format!("failed to serialize cookies: {err}")))?;
        let bytes = writer
            .into_inner()
            .map_err(|err| ElectiveError::Fatal(format!("failed to flush cookies: {err}")))?;
        String::from_utf8(bytes)
            .map_err(|err| ElectiveError::Fatal(format!("cookie store contained invalid utf8: {err}")))
    }

    pub fn from_persisted_cookies(
        username: String,
        channel: Option<Channel>,
        cookies_json: &str,
    ) -> Result<Self> {
        let cookie_store = load_cookies_json(BufReader::new(cookies_json.as_bytes()))
            .map_err(|err| ElectiveError::Fatal(format!("failed to deserialize cookies: {err}")))?;
        Self::build(
            username,
            channel,
            Arc::new(CookieStoreMutex::new(cookie_store)),
        )
    }

    pub async fn verify_alive(&self) -> Result<()> {
        let body = self
            .client
            .get(COURSE_HOME_URL)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;

        if body.contains(HELP_TITLE) {
            Ok(())
        } else {
            Err(ElectiveError::SessionExpired)
        }
    }
}

fn build_client(cookie_store: SharedCookieStore) -> Result<Client> {
    let mut default_headers = HeaderMap::new();
    default_headers.insert(REFERER, HeaderValue::from_static(COURSE_HOME_URL));
    default_headers.insert(CACHE_CONTROL, HeaderValue::from_static("max-age=0"));

    Ok(Client::builder()
        .default_headers(default_headers)
        .cookie_provider(cookie_store)
        .danger_accept_invalid_certs(true)
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36",
        )
        .build()?)
}

impl AuthSession {
    fn build(
        username: String,
        channel: Option<Channel>,
        cookie_store: SharedCookieStore,
    ) -> Result<Self> {
        let client = build_client(Arc::clone(&cookie_store))?;
        Ok(Self {
            client,
            cookie_store,
            username,
            channel,
        })
    }
}

#[derive(Debug, Deserialize)]
struct LoginResponse {
    success: bool,
    token: Option<String>,
}

pub async fn authenticate(credentials: &Credentials) -> Result<AuthSession> {
    if credentials.username.trim().is_empty() || credentials.password.is_empty() {
        return Err(ElectiveError::AuthFailed("missing username or password".into()));
    }

    let cookie_store = Arc::new(CookieStoreMutex::new(CookieStore::default()));
    let client = build_client(Arc::clone(&cookie_store))?;

    let response = client
        .post(LOGIN_URL)
        .header(COOKIE, format!("userName={}", credentials.username))
        .form(&[
            ("appid", "syllabus"),
            ("userName", credentials.username.as_str()),
            ("password", credentials.password.as_str()),
            ("randCode", ""),
            ("smsCode", ""),
            ("otpCode", ""),
            (
                "redirUrl",
                "http://elective.pku.edu.cn:80/elective2008/agent4Iaaa.jsp/../ssoLogin.do",
            ),
        ])
        .send()
        .await?
        .error_for_status()?;

    let login: LoginResponse = response.json().await?;
    if !login.success {
        return Err(ElectiveError::AuthFailed(
            "login endpoint returned failure".into(),
        ));
    }

    let token = login
        .token
        .ok_or_else(|| ElectiveError::AuthFailed("login endpoint did not return token".into()))?;

    let response = client
        .get(SSO_URL)
        .query(&[("rand", "0.1"), ("token", token.as_str())])
        .send()
        .await?
        .error_for_status()?;
    let body = response.text().await?;

    if body.contains(HELP_TITLE) {
        return AuthSession::build(
            credentials.username.clone(),
            credentials.channel.clone(),
            cookie_store,
        );
    }

    if body.contains("/scnStAthVef.jsp/") {
        let channel = credentials.channel.as_ref().ok_or_else(|| {
            ElectiveError::AuthFailed("channel required for identity selection".into())
        })?;
        let sida = body
            .split("/ssoLogin.do?sida=")
            .nth(1)
            .and_then(|segment| segment.split('&').next())
            .filter(|value| value.chars().all(|ch| ch.is_ascii_alphanumeric()))
            .ok_or_else(|| ElectiveError::AuthFailed("unable to extract sida".into()))?;

        let response = client
            .get(SSO_URL)
            .query(&[("sida", sida), ("sttp", channel.as_str())])
            .send()
            .await?
            .error_for_status()?;
        let body = response.text().await?;
        if body.contains(HELP_TITLE) {
            return AuthSession::build(
                credentials.username.clone(),
                credentials.channel.clone(),
                cookie_store,
            );
        }
    }

    Err(ElectiveError::AuthFailed(
        "after login check did not reach elective home".into(),
    ))
}
