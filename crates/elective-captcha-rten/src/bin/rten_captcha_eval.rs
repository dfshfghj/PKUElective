use std::{
    env, fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, bail};
use elective_captcha_rten::Recognizer;

const SAMPLE_SIZE: usize = 1000;

fn shuffle(paths: &mut [PathBuf]) {
    let mut state = 0x9e37_79b9_u64;
    for index in (1..paths.len()).rev() {
        state = state
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1);
        paths.swap(index, (state as usize) % (index + 1));
    }
}

fn label(path: &Path) -> Result<String> {
    path.file_stem()
        .and_then(|v| v.to_str())
        .and_then(|v| v.rsplit_once('_').map(|(_, label)| label.to_owned()))
        .filter(|v| !v.is_empty())
        .with_context(|| format!("cannot extract label from {}", path.display()))
}

fn main() -> Result<()> {
    let model_path = PathBuf::from(
        env::args()
            .nth(1)
            .unwrap_or_else(|| "data/recognizer.rten".into()),
    );
    let data_dir = PathBuf::from(
        env::args()
            .nth(2)
            .unwrap_or_else(|| "data/collected/auto_labeled".into()),
    );
    let mut paths = fs::read_dir(&data_dir)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|e| e.eq_ignore_ascii_case("png")))
        .collect::<Vec<_>>();
    if paths.len() < SAMPLE_SIZE {
        bail!(
            "expected at least {SAMPLE_SIZE} PNG files in {}",
            data_dir.display()
        );
    }
    shuffle(&mut paths);
    paths.truncate(SAMPLE_SIZE);
    let recognizer = Recognizer::load(&model_path)
        .with_context(|| format!("failed to load {}", model_path.display()))?;
    let mut exact = 0;
    let mut chars = 0;
    let mut total = 0;
    for (index, path) in paths.iter().enumerate() {
        let expected = label(path)?;
        let predicted = recognizer.recognize(&fs::read(path)?)?;
        exact += usize::from(predicted == expected);
        chars += predicted
            .chars()
            .zip(expected.chars())
            .filter(|(a, b)| a == b)
            .count();
        total += expected.chars().count();
        if (index + 1) % 200 == 0 {
            println!("progress {}/{}", index + 1, SAMPLE_SIZE);
        }
    }
    println!("model={}", model_path.display());
    println!("samples={SAMPLE_SIZE}");
    println!(
        "exact={exact}/{SAMPLE_SIZE} ({:.2}%)",
        exact as f64 / SAMPLE_SIZE as f64 * 100.0
    );
    println!(
        "characters={chars}/{total} ({:.2}%)",
        chars as f64 / total as f64 * 100.0
    );
    Ok(())
}
