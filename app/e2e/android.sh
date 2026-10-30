#!/usr/bin/env bash
# E2E di emulator: pasang APK debug, buka aplikasi, lalu jalankan skenario lewat DevTools WebView
set -euo pipefail
APK=app/android/app/build/outputs/apk/debug/app-debug.apk
adb wait-for-device
adb install -r "$APK"
adb shell am start -W -n com.harrakyy.qsd/.MainActivity
sleep 10
node app/e2e/android.mjs
