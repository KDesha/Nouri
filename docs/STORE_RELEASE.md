# Nouri store release checklist

The codebase is configured to build for both stores. The items below require the app owner’s accounts, public URLs, and final business details and therefore must be completed before submission.

## Required before either store

- Deploy the backend at a stable HTTPS URL.
- Set `EXPO_PUBLIC_API_URL` to that URL in the EAS production environment.
- Run `npm run db:migrate` against the production database.
- Replace and rotate the database, USDA, and session secrets. Never place them in the mobile app.
- Confirm ownership of `com.kayladeshasier.nouri`, or change both bundle identifiers before the first uploaded build. Bundle identifiers are difficult or impossible to change later.
- Host a privacy policy written for Nouri’s actual owner, contact information, retention rules, processors, and launch regions.
- Host a support page and a public account-deletion request page.
- Prepare phone screenshots, store descriptions, category, age rating, and support contact.
- If the optional Edamam preview is enabled in production, confirm the commercial plan, caching terms, and required attribution before taking store screenshots.

## Apple App Store

- Enroll in the Apple Developer Program and create the Nouri record in App Store Connect.
- Use bundle ID `com.kayladeshasier.nouri` unless it is changed before upload.
- Add the required privacy policy URL.
- Complete App Privacy accurately. Review account identifiers and health/fitness data because Nouri stores usernames, selected health areas, and personal food reactions.
- Verify the in-app **Delete my account and data** flow against production.
- Upload with `npx eas-cli@latest submit --platform ios --latest`, test through TestFlight, then submit for review.

Apple requires apps with account creation to let users initiate account deletion inside the app: <https://developer.apple.com/support/offering-account-deletion-in-your-app>

## Google Play

- Create the Nouri app in Play Console with package `com.kayladeshasier.nouri`.
- Complete the Data safety form accurately.
- Complete the Health apps declaration under **Nutrition and Weight Management**.
- Supply both an in-app deletion path and a public web URL where users can request account/data deletion.
- Upload the Android App Bundle to internal testing first, then progress through the desired release track.

Google’s account-deletion requirements: <https://support.google.com/googleplay/android-developer/answer/13327111>

Google’s Health apps declaration guidance: <https://support.google.com/googleplay/android-developer/answer/14738291>

## Current technical verification

- Expo SDK 57 / React Native 0.86
- Expo Doctor: all checks pass
- iOS JavaScript/Hermes export: passes
- Android JavaScript/Hermes export: passes
- Mobile TypeScript check: passes
- Backend TypeScript build: passes
- Backend scoring and IBS tests: pass
- Live USDA search and IBS result flow: verified

An actual `.ipa` or Play Store `.aab` is not generated until EAS is connected to the owner’s Expo and store credentials.
