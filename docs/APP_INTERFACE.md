# Working on Nouri's app interface

Nouri uses one React Native interface for iPhone and Android. Most visual work happens in TypeScript, and Expo carries those changes into both native apps. You only need to edit separate Xcode or Android files when a feature requires native permissions or configuration.

## Where the interface lives

The mobile folder is deliberately small:

- `App.tsx` decides whether to show authentication or the main experience.
- `AuthScreen.tsx` contains log in, sign up, and guest entry.
- `DemoScreen.tsx` contains food search, portions, health preferences, results, account settings, and the optional Edamam preview.
- `theme.ts` holds the shared colors, shadows, and typography choices.
- `api.ts` is the one place the app uses to talk to the Nouri backend.
- `app.json` contains the app name, icons, bundle identifiers, native plugins, and store build settings.

Keeping API calls in `api.ts` and shared colors in `theme.ts` prevents screens from slowly drifting into different styles or error messages.

## The main user flow

The interface follows a simple order:

1. Search for a familiar food.
2. Choose the general match, with unusual preparations kept behind “Other forms.”
3. Choose a household portion.
4. Adjust how many portions were eaten, or enter grams.
5. Review the food using the person's saved health settings.
6. Read the condition-by-condition explanation and the nutrition estimate.

That order is important. Health results should never appear before the food and amount are clear, because kidney, diabetes, heart-health, and IBS guidance can change with portion size.

## The visual language

Nouri should feel warm, calm, and food-related rather than clinical or alarming.

- Deep green is used for trustworthy actions and selected choices.
- Coral is used for the main call to action.
- Cream and pale mint keep cards friendly and easy to separate.
- Rounded cards and generous spacing help the app feel approachable.
- Plain household language is preferred. Use “1 serving,” not “1 RACC,” and “How many?” instead of technical nutrition terminology.
- Warning colors should explain uncertainty, not make a food feel morally “bad.”

When adding a new control, first try to reuse `Button`, `Chip`, `Card`, `FoodRow`, or `SectionHeading` in `DemoScreen.tsx`. Reusing those pieces keeps tap targets, type size, and spacing consistent.

## Making a screen change

Start the backend:

```bash
cd backend
npm run dev
```

Then start the mobile project in a second terminal:

```bash
cd mobile
npm start
```

Press `i` for the iOS Simulator, `a` for an Android emulator, or `w` for the browser preview. The browser is useful for quick layout work, but permissions, cameras, keyboards, and safe areas must also be checked in a native simulator or phone.

After editing the interface, run:

```bash
npm run typecheck
npx expo-doctor
```

Check at least one narrow phone size. Long food names, larger accessibility text, the keyboard, error messages, and empty results are more likely to reveal layout problems than the happy path.

## Opening the same interface in Xcode

Generate the iOS project when native files do not exist or app configuration has changed:

```bash
cd mobile
npx expo prebuild --platform ios
cd ios
pod install
open Nouri.xcworkspace
```

Open the `.xcworkspace`, not the `.xcodeproj`, because the workspace includes the CocoaPods dependencies. Select the Nouri scheme and an iPhone Simulator, then press Run.

During normal interface work, keep the Expo development server running:

```bash
npm start -- --dev-client --host localhost
```

Changing a native plugin, permission, bundle identifier, or app icon requires rebuilding the native app. Changing ordinary React Native text, layout, or colors usually refreshes without regenerating the project.

## Adding a native feature such as barcode scanning

A camera-based scanner touches both the interface and native configuration:

1. Install the Expo camera package with `npx expo install expo-camera`.
2. Add the camera plugin and a clear permission explanation to `app.json`.
3. Add a scan button near food search and present the scanner as a separate modal or screen.
4. Stop scanning after the first valid UPC so the app does not submit the same code repeatedly.
5. Send the code to the backend; never put nutrition-provider secrets in the phone app.
6. Provide manual barcode entry and regular food search when a package is not found.
7. Rebuild the native iOS and Android projects.
8. Test with a physical phone. A simulator is useful for the surrounding interface but not a real package-camera workflow.

## Preparing the interface for the stores

Before screenshots or submission:

- point the app to the production HTTPS backend;
- test sign up, log in, settings, scoring, feedback, and account deletion;
- confirm every data provider has its required attribution;
- review camera and health-data privacy disclosures if those features are enabled;
- capture screenshots from the final production build, not the browser preview;
- test on both a smaller phone and a larger current device.

The remaining account, privacy, and submission work is listed in [STORE_RELEASE.md](STORE_RELEASE.md).
