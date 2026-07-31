package com.pkuelective.desktop

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)

    val safeAreaBridge = SafeAreaBridge(resources.displayMetrics.density)
    webView.addJavascriptInterface(safeAreaBridge, SAFE_AREA_BRIDGE_NAME)

    ViewCompat.setOnApplyWindowInsetsListener(webView) { _, windowInsets ->
      val safeArea = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      safeAreaBridge.update(safeArea)
      webView.evaluateJavascript(safeAreaBridge.updateScript(), null)
      windowInsets
    }
    ViewCompat.requestApplyInsets(webView)
  }

  private class SafeAreaBridge(private val density: Float) {
    @Volatile
    private var insets = Insets.NONE

    fun update(value: Insets) {
      insets = value
    }

    @JavascriptInterface
    fun getInsets(): String = insets.toCssPixels(density)

    fun updateScript(): String =
      "window.__applyAndroidSafeAreaInsets?.(${insets.toCssPixels(density)})"

    private fun Insets.toCssPixels(density: Float): String =
      listOf(top, right, bottom, left)
        .joinToString(",") { (it / density).toString() }
  }

  private companion object {
    const val SAFE_AREA_BRIDGE_NAME = "__TAURI_ANDROID_SAFE_AREA__"
  }
}
