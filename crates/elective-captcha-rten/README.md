# elective-captcha-rten

RTen captcha recognizer for PKU Elective. The model is loaded at runtime and
is not embedded in the application binary.

```rust
use elective_captcha_rten::Recognizer;

let recognizer = Recognizer::load("models/recognizer.rten")?;
let text = recognizer.recognize(&image_bytes)?;
```

`Recognizer::load` expects `charsets.json` beside the model. Use
`Recognizer::load_with_charset` when the charset file is stored elsewhere.
`RtenCaptchaProvider` implements `elective_core::captcha::CaptchaProvider`
for callers that use the core abstraction.

The evaluation binary samples 1000 PNG files with the same deterministic
shuffle used by the reference evaluator:

```powershell
cargo run --release -p elective-captcha-rten --bin rten-captcha-eval -- `
  D:\path\to\recognizer.rten `
  D:\path\to\data\collected\auto_labeled
```
