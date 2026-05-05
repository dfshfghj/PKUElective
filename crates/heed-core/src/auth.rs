use reqwest::{
    Client, Url,
    cookie::Jar,
    header::{CACHE_CONTROL, HeaderMap, HeaderValue, REFERER},
};
use serde::Deserialize;
use std::sync::Arc;

use crate::{
    error::{HeedError, Result},
    types::Channel,
};

const LOGIN_URL: &str = "https://iaaa.pku.edu.cn/iaaa/oauthlogin.do";
const SSO_URL: &str = "https://elective.pku.edu.cn/elective2008/ssoLogin.do";
const HELP_TITLE: &str = "<title>帮助-总体流程</title>";
const COURSE_HOME_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/help/HelpController.jpf";

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
            return Err(HeedError::AuthFailed("missing username or password".into()));
        }

        let channel = match channel
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            Some("bzx") => Some(Channel::Bzx),
            Some("bfx") => Some(Channel::Bfx),
            Some(other) => return Err(HeedError::Config(format!("unsupported channel: {other}"))),
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
}

#[derive(Debug, Deserialize)]
struct LoginResponse {
    success: bool,
    token: Option<String>,
}

pub async fn authenticate(credentials: &Credentials) -> Result<AuthSession> {
    if credentials.username.trim().is_empty() || credentials.password.is_empty() {
        return Err(HeedError::AuthFailed("missing username or password".into()));
    }

    let cookie_store = Arc::new(Jar::default());
    let login_url = Url::parse(LOGIN_URL).expect("LOGIN_URL should be a valid URL");
    cookie_store.add_cookie_str(&format!("userName={}", credentials.username), &login_url);

    let mut default_headers = HeaderMap::new();
    default_headers.insert(REFERER, HeaderValue::from_static(COURSE_HOME_URL));
    default_headers.insert(CACHE_CONTROL, HeaderValue::from_static("max-age=0"));

    let client = Client::builder()
        .default_headers(default_headers)
        .cookie_provider(cookie_store)
        .danger_accept_invalid_certs(true)
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36",
        )
        .build()?;

    let response = client
        .post(LOGIN_URL)
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
        return Err(HeedError::AuthFailed(
            "login endpoint returned failure".into(),
        ));
    }

    let token = login
        .token
        .ok_or_else(|| HeedError::AuthFailed("login endpoint did not return token".into()))?;

    let response = client
        .get(SSO_URL)
        .query(&[("rand", "0.1"), ("token", token.as_str())])
        .send()
        .await?
        .error_for_status()?;
    let body = response.text().await?;

    if body.contains(HELP_TITLE) {
        return Ok(AuthSession {
            client,
            username: credentials.username.clone(),
            channel: credentials.channel.clone(),
        });
    }

    if body.contains("/scnStAthVef.jsp/") {
        let channel = credentials.channel.as_ref().ok_or_else(|| {
            HeedError::AuthFailed("channel required for identity selection".into())
        })?;
        let sida = body
            .split("/ssoLogin.do?sida=")
            .nth(1)
            .and_then(|segment| segment.split('&').next())
            .filter(|value| value.chars().all(|ch| ch.is_ascii_alphanumeric()))
            .ok_or_else(|| HeedError::AuthFailed("unable to extract sida".into()))?;

        let response = client
            .get(SSO_URL)
            .query(&[("sida", sida), ("sttp", channel.as_str())])
            .send()
            .await?
            .error_for_status()?;
        let body = response.text().await?;
        if body.contains(HELP_TITLE) {
            return Ok(AuthSession {
                client,
                username: credentials.username.clone(),
                channel: credentials.channel.clone(),
            });
        }
    }

    Err(HeedError::AuthFailed(
        "after login check did not reach elective home".into(),
    ))
}
