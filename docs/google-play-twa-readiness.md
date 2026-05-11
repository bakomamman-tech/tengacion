# Google Play TWA Readiness

Tengacion can be packaged for Google Play as a Trusted Web Activity (TWA) once the production web origin and Android package are linked with Digital Asset Links.

## What is implemented

- `GET /.well-known/assetlinks.json` is served by the backend.
- The endpoint is disabled with a clear `404` until Android signing values are configured.
- When configured, it returns the Digital Asset Links statement required by Android/Chrome TWA verification.

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

Reference anchors:

- Chrome for Developers: Trusted Web Activity Digital Asset Links setup.
- Android Developers: Google Play distribution guidance.
