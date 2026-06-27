# Tengacion mobile store release

Tengacion now uses Capacitor 7.6.7 to produce native Android and iOS projects from the existing React app.

## Implemented in the repository

- Native projects: `frontend/android` and `frontend/ios`.
- Shared application ID / bundle ID: `com.tengacion.app`.
- Google Play target SDK: Android 15 / API 35.
- Production mobile endpoints in `frontend/.env.mobile`.
- Native HTTP and cookie bridges for API sessions, uploads, and refresh cookies.
- Camera, microphone, and photo-library usage descriptions.
- Branded adaptive Android icons, iOS icon, and launch artwork.
- iOS privacy manifest and non-tracking declaration.
- In-app and public web account deletion at `/account-deletion`.
- Digital Paystack checkout is disabled in App Store / Play builds. Existing entitlements still work, and Paystack remains available for physical marketplace goods.
- Android upload-key configuration is supported without committing signing secrets.

## Build commands

From `frontend`:

```powershell
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Build the Android App Bundle after creating `android/keystore.properties` from the example:

```powershell
cd android
.\gradlew bundleRelease
```

The AAB is written beneath `android/app/build/outputs/bundle/release/`.

iOS archives must be built on macOS. Open `frontend/ios/App/App.xcworkspace`, select the Tengacion development team, verify the `com.tengacion.app` bundle ID, and use Product > Archive.

## Required owner / console work

### Both stores

1. Own and verify `com.tengacion.app`; changing it later creates a different store app.
2. Deploy the latest backend and frontend, including `/account-deletion` and native CORS origins.
3. Publish the privacy policy at `https://tengacion.com/privacy` and deletion page at `https://tengacion.com/account-deletion`.
4. Prepare a review account with realistic content and no MFA friction, plus review notes explaining report, block, moderation, AI-reporting, and account-deletion flows.
5. Capture phone and tablet screenshots from real release builds. Do not use only logos or login screens.
6. Complete truthful age/content-rating, privacy/data-safety, UGC, child-safety, ads, and AI-generated-content declarations.
7. Test account refresh after 15 minutes and after an app restart, camera/microphone denial, uploads, socket reconnect, password reset, deletion, offline state, and physical-goods checkout on real devices.

### Google Play

1. Create a Play Console app and enroll in Play App Signing.
2. Generate and securely back up an upload key, then configure `android/keystore.properties`.
3. Upload the release AAB to Internal testing first.
4. Use `https://tengacion.com/account-deletion` for the Data safety deletion URL.
5. Complete Data safety using the actual collected data. The app handles identity/contact data, user content, messages, purchase/order data, creator/seller payment details, coarse IP-derived location, diagnostics, and product interaction data.
6. Add a 512x512 listing icon, 1024x500 feature graphic, screenshots, short description, full description, support email, and privacy URL in Play Console.

### Apple App Store

1. Join the Apple Developer Program and create the App Store Connect record for `com.tengacion.app`.
2. Configure signing in Xcode and upload through Organizer/TestFlight.
3. Make App Privacy answers match `PrivacyInfo.xcprivacy` and the production privacy policy.
4. Set the export-compliance answer consistently with `ITSAppUsesNonExemptEncryption = NO` (the app uses standard HTTPS encryption only).
5. Provide review notes and a demo account. Social/UGC moderation and account deletion must be easy for the reviewer to find.
6. Supply iPhone and iPad screenshots, subtitle, description, keywords, support URL, marketing URL, privacy URL, copyright, and age rating.

## Digital purchases before enabling them in native builds

The web app sells tracks, books, videos, and creator subscriptions through Paystack. Those are digital goods. Before turning those purchase buttons on in store builds, implement and test:

- StoreKit in-app purchases plus App Store Server API / notifications for iOS.
- Google Play Billing plus server-side purchase verification and real-time developer notifications for Android.
- Product-ID mapping from Apple/Google products to Tengacion item IDs.
- Restore purchases, pending purchase handling, refunds, revoked entitlements, subscription renewal/cancellation, and price localization.
- App Store Connect and Play Console product setup and review metadata.

Paystack can continue to process physical marketplace products consumed outside the app.
