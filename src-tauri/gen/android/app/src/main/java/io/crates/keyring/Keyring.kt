package io.crates.keyring

import android.content.Context
import androidx.annotation.Keep

@Keep
class Keyring {
  @Keep
  companion object {
    init {
      System.loadLibrary("elective_tauri_lib")
    }

    @Keep
    external fun initializeNdkContext(context: Context)
  }
}
