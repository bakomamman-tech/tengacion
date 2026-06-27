# Google Play TWA Readiness

> Legacy alternative: Tengacion now has a Capacitor Android project at `frontend/android`,
> shared with the iOS packaging strategy. Use the Capacitor project for the primary Play Store
> release. Do not publish both a TWA and Capacitor app with the same package name. The Digital
> Asset Links endpoint below remains useful if a future TWA or verified Android web-link flow is
> intentionally introduced.

Tengacion can be packaged for Google Play as a Trusted Web Activity (TWA) once the production web origin and Android package are linked with Digital Asset Links.

## What is implemented

- `GET /.well-known/assetlinks.json` is served by the backend.
- The endpoint is disabled with a clear `404` until Android signing values are configured.
- When configured, it returns the Digital Asset Links statement required by Android/Chrome TWA verification.
- Akuso answers have in-app helpful, not helpful, and report controls so users can flag offensive or unsafe AI output without leaving the app.
- Reported Akuso output is stored as assistant feedback and queued for admin review.
- Public UGC already has in-app reporting paths for posts, comments, messages, and profiles; direct messaging also exposes user blocking.

## Required production environment

Set these values on the production host:

```env
ANDROID_TWA_PACKAGE_NAME=com.tengacion.app
ANDROID_TWA_SHA256_CERT_FINGERPRINTS=AA:BB:CC:...
```

Notes:

- Use the final Android application id chosen for the Play Store package.
- Use the Google Play App Signing SHA-256 certificate fingerprint, not only a local debug key.
- Multiple fingerprints can be comma-separated if you need to support more than one signing key.
- After deployment, verify that `https://tengacion.com/.well-known/assetlinks.json` returns JSON, not the SPA HTML fallback.

## Next Play Store steps

1. Generate the TWA Android project with the production origin `https://tengacion.com`.
2. Set the Android package name to match `ANDROID_TWA_PACKAGE_NAME`.
3. Build and upload the Android App Bundle to Play Console.
4. Copy the Play App Signing SHA-256 fingerprint into `ANDROID_TWA_SHA256_CERT_FINGERPRINTS`.
5. Redeploy the backend and confirm the `assetlinks.json` endpoint.
6. During Play review, use a test account that can demonstrate post/comment/message/profile reporting, direct-message blocking, and Akuso response reporting.

Reference anchors:

- [Google Play: AI-Generated Content policy](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en).
- [Google Play: User Generated Content policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en).
- [Chrome for Developers: Trusted Web Activity Digital Asset Links setup](https://developer.chrome.com/docs/android/trusted-web-activity/android-for-web-devs).
- [Android Developers: Android App Bundle](https://developer.android.com/guide/app-bundle).
