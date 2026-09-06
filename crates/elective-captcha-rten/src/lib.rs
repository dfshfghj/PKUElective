//! RTen-backed PKU captcha recognition.
//!
//! The model and charset files are intentionally loaded from paths supplied at
//! runtime. This keeps the crate usable with downloaded or application-managed
//! model files instead of baking a model into the binary.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use elective_core::{captcha::CaptchaProvider, error::Result as CoreResult};
use image::{DynamicImage, imageops::FilterType};
use rten::Model;
use rten_tensor::{AsView, NdTensor};
use serde::Deserialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("failed to read {path}: {source}")]
    Read {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to parse charset file {path}: {source}")]
    Charset {
        path: PathBuf,
        source: serde_json::Error,
    },
    #[error("failed to load RTen model {path}: {message}")]
    Model { path: PathBuf, message: String },
    #[error("invalid captcha image: {0}")]
    Image(#[from] image::ImageError),
    #[error("RTen inference failed: {0}")]
    Inference(String),
    #[error("OCR token {0} is outside the charset")]
    InvalidToken(i64),
    #[error("OCR produced an empty token sequence")]
    EmptyResult,
    #[error("model mutex was poisoned")]
    Poisoned,
}

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Deserialize)]
struct CharsetConfig {
    charset: Vec<String>,
}

/// A dynamically loaded RTen captcha recognizer.
pub struct Recognizer {
    model: Mutex<Model>,
    input_id: rten::NodeId,
    output_id: rten::NodeId,
    charset: Vec<String>,
    model_path: PathBuf,
}

impl Recognizer {
    /// Load a `.rten` model and its `charsets.json` from the same directory.
    pub fn load(model_path: impl AsRef<Path>) -> Result<Self> {
        let model_path = model_path.as_ref().to_path_buf();
        let charset_path = model_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("charsets.json");
        Self::load_with_charset(model_path, charset_path)
    }

    /// Load a `.rten` model and an explicitly selected charset file.
    pub fn load_with_charset(
        model_path: impl AsRef<Path>,
        charset_path: impl AsRef<Path>,
    ) -> Result<Self> {
        let model_path = model_path.as_ref().to_path_buf();
        let charset_path = charset_path.as_ref().to_path_buf();
        let config: CharsetConfig =
            serde_json::from_slice(&fs::read(&charset_path).map_err(|source| Error::Read {
                path: charset_path.clone(),
                source,
            })?)
            .map_err(|source| Error::Charset {
                path: charset_path,
                source,
            })?;
        let model = Model::load_file(&model_path).map_err(|err| Error::Model {
            path: model_path.clone(),
            message: err.to_string(),
        })?;
        let input_id = model.node_id("input1").map_err(|err| Error::Model {
            path: model_path.clone(),
            message: format!("missing input1 node: {err}"),
        })?;
        let output_id = model.node_id("output").map_err(|err| Error::Model {
            path: model_path.clone(),
            message: format!("missing output node: {err}"),
        })?;
        Ok(Self {
            model: Mutex::new(model),
            input_id,
            output_id,
            charset: config.charset,
            model_path,
        })
    }

    pub fn model_path(&self) -> &Path {
        &self.model_path
    }

    /// Recognize an encoded image (PNG/JPEG/etc.) and return the decoded text.
    pub fn recognize(&self, image_bytes: &[u8]) -> Result<String> {
        let (values, shape) = preprocess(image_bytes)?;
        let input = NdTensor::from_data(shape, values);
        let model = self.model.lock().map_err(|_| Error::Poisoned)?;
        let outputs = model
            .run_n(vec![(self.input_id, input.into())], [self.output_id], None)
            .map_err(|err| Error::Inference(err.to_string()))?;
        let output = outputs
            .into_iter()
            .next()
            .ok_or_else(|| Error::Inference("model returned no output".into()))?;
        let tokens: NdTensor<i32, 2> = output
            .try_into()
            .map_err(|err| Error::Inference(format!("{err:?}")))?;
        decode(tokens.iter().map(|token| i64::from(*token)), &self.charset)
    }
}

impl std::fmt::Debug for Recognizer {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Recognizer")
            .field("model_path", &self.model_path)
            .finish_non_exhaustive()
    }
}

/// Adapter for the captcha provider abstraction used by `elective-core`.
pub struct RtenCaptchaProvider {
    recognizer: Recognizer,
}

impl RtenCaptchaProvider {
    pub fn load(model_path: impl AsRef<Path>) -> Result<Self> {
        Ok(Self {
            recognizer: Recognizer::load(model_path)?,
        })
    }

    pub fn recognizer(&self) -> &Recognizer {
        &self.recognizer
    }
}

#[async_trait::async_trait]
impl CaptchaProvider for RtenCaptchaProvider {
    async fn recognize(&self, image: &[u8]) -> CoreResult<String> {
        self.recognizer
            .recognize(image)
            .map_err(|err| elective_core::error::ElectiveError::Fatal(err.to_string()))
    }
}

fn preprocess(image_bytes: &[u8]) -> Result<(Vec<f32>, [usize; 4])> {
    let image = image::load_from_memory(image_bytes)?.to_rgb8();
    let width = ((image.width() as f32 * 64.0) / image.height() as f32) as u32;
    let image = DynamicImage::ImageRgb8(image)
        .resize_exact(width.max(1), 64, FilterType::Lanczos3)
        .to_rgb8();
    let width = image.width() as usize;
    let plane_size = width * 64;
    let mean = [0.485_f32, 0.456, 0.406];
    let std = [0.229_f32, 0.224, 0.225];
    let mut values = vec![0.0; 3 * plane_size];
    for (pixel_index, pixel) in image.pixels().enumerate() {
        for channel in 0..3 {
            values[channel * plane_size + pixel_index] =
                (f32::from(pixel[channel]) / 255.0 - mean[channel]) / std[channel];
        }
    }
    Ok((values, [1, 3, 64, width]))
}

fn decode(tokens: impl IntoIterator<Item = i64>, charset: &[String]) -> Result<String> {
    let mut result = String::new();
    let mut last_token = 0;
    for token in tokens {
        if token == last_token {
            continue;
        }
        last_token = token;
        if token == 0 {
            continue;
        }
        result.push_str(
            charset
                .get(token as usize)
                .ok_or(Error::InvalidToken(token))?,
        );
    }
    if result.is_empty() {
        return Err(Error::EmptyResult);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::decode;

    #[test]
    fn decodes_ctc_tokens() {
        let charset = vec!["_".into(), "a".into(), "b".into()];
        assert_eq!(decode([0, 1, 1, 0, 2], &charset).unwrap(), "ab");
    }
}
