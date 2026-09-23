# Nouri

Nouri is a cross-platform nutrition guidance app for iPhone and Android. It combines USDA FoodData Central nutrition data with transparent screening notes for IBS, bladder/IC, kidney health, Crohn’s disease, GERD, diabetes, high blood pressure, and heart health.

The mobile app is built with Expo and React Native, so the same TypeScript interface ships to both stores. The backend is an Express API backed by PostgreSQL.

> Nouri is educational. It does not diagnose, treat, or replace advice from a physician or registered dietitian.

## What is included

- Native iOS and Android app configuration
- EAS preview and production build profiles
- A clean, food-focused interface and original Nouri app icon
- Food-family search that groups broad terms such as chicken into cuts and tomato into useful varieties
- An optional Edamam trial preview for testing natural phrases such as “2 cups banana pudding” without replacing USDA nutrition
- A compact main result list with additional preparations and products in an optional “Other forms” sheet
- Household serving choices and serving-based nutrition estimates
- Clear serving-based nutrition estimates and honest missing-data states
- Expanded total sugar, cholesterol, calcium, iron, and vitamin D fields
- IBS guidance for everyday use and the three low-FODMAP phases
- GERD, diabetes, high-blood-pressure, and heart-health screening
- Lab- and care-plan-aware kidney potassium/phosphorus settings
- Serving-, ripeness-, and ingredient-sensitive IBS warnings
- Personal safe/trigger reactions for logged-in users
- Account-level health priorities and saved doctor/dietitian recommendations
- Signed account sessions and in-app permanent account deletion
- Backward-safe PostgreSQL schema upgrades

## Project layout

```text
backend/    Express API, authentication, USDA integration, and scoring
database/   PostgreSQL schema and local seed foods
mobile/     Expo React Native app and store build configuration
docs/       Store release checklist
```

## Local setup

Requirements: Node.js 22.13 or newer, npm, and PostgreSQL.

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Set these private values in `backend/.env`:

- `DATABASE_URL`: PostgreSQL connection string
- `FDC_API_KEY`: USDA FoodData Central API key
- `JWT_SECRET`: long, random production session secret
- `PORT`: optional; defaults to `4000`

Edamam is optional. If you want to compare its search interpretation with Nouri's USDA results, follow [the Edamam trial guide](docs/EDAMAM_TRIAL.md). Its credentials stay in the backend and are never added to the mobile app.

### 2. Mobile app

```bash
cd mobile
cp .env.example .env
npm install
npm start
```

For a physical phone or store build, `EXPO_PUBLIC_API_URL` must be the public HTTPS URL of the deployed backend. `localhost` and `10.0.2.2` are development fallbacks only.

### Run in Xcode

On a Mac with Xcode and CocoaPods installed, generate the native project and install its pods:

```bash
cd mobile
npx expo prebuild --platform ios
cd ios
pod install
open Nouri.xcworkspace
```

In Xcode, select the `Nouri` scheme, choose an iPhone Simulator, and press Run. Keep `npm start -- --dev-client --host localhost` running from `mobile/` and `npm run dev` running from `backend/`. You can also build, install, and launch the simulator app in one step with `npm run ios`.

## Quality checks

```bash
cd backend
npm run build
npm test -- --runInBand

cd ../mobile
npm run typecheck
npx expo-doctor
```

## Build downloadable apps

From `mobile/`, sign in to an Expo account and associate the project with EAS:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

Create an installable Android preview APK:

```bash
npm run build:preview:android
```

Create production store builds:

```bash
npm run build:android
npm run build:ios
```

Submit the latest builds after the store records and legal URLs are ready:

```bash
npx eas-cli@latest submit --platform android --latest
npx eas-cli@latest submit --platform ios --latest
```

Apple production builds and App Store submission require an Apple Developer Program account. Google Play submission requires a Play Console developer account. See [docs/STORE_RELEASE.md](docs/STORE_RELEASE.md) before submitting.

If you are changing screens, colors, wording, icons, or navigation, [the app interface guide](docs/APP_INTERFACE.md) explains how the pieces fit together and how to preview changes in Expo and Xcode.

## Nutrition and IBS methodology

USDA FoodData Central nutrients are stored per 100 g, then estimated for the household serving the user selects. A dash means the source did not report a nutrient; it never means zero.

The IBS check is intentionally conservative. Food names are screened against common examples from NIDDK, but a name cannot capture serving size, ripeness, recipe ingredients, or individual tolerance. The low-FODMAP experience follows the three-step structure described by Monash University: a short swap phase, structured reintroduction, and long-term personalization.

Primary references:

- [NIDDK: Eating, Diet, & Nutrition for IBS](https://www.niddk.nih.gov/health-information/digestive-diseases/irritable-bowel-syndrome/eating-diet-nutrition)
- [Monash University: Starting the Low FODMAP Diet](https://www.monashfodmap.com/ibs-central/i-have-ibs/starting-the-low-fodmap-diet/)
- [USDA FoodData Central](https://fdc.nal.usda.gov/)

See [docs/MEDICAL_METHOD.md](docs/MEDICAL_METHOD.md) for the condition-by-condition logic, primary references, limitations, and conditions Nouri intentionally does not infer from the available data.

## Search categorization

Nouri uses a deterministic food-family classifier before displaying USDA results. Broad searches can produce several useful general categories, while prepared dishes and specialty records stay behind “Other forms.” The classifier is deliberately testable and does not invent foods or nutrition values.

A future AI fallback can help map unfamiliar wording to a known food family, but USDA records should remain the nutrition source and generative AI should never create nutrient values or medical ratings.

The optional Edamam trial is deliberately narrower than a provider switch. It sends a search only when a person presses Search, displays up to two live interpretations, and does not save Edamam results in Nouri's database. Choosing an interpretation starts a USDA search for that wording. This lets the team judge whether Edamam makes food entry feel more natural while preserving Nouri's existing data rights and scoring behavior.

## Security note

Never commit `.env` files. This repository previously tracked `backend/.env`; remove it from Git tracking and rotate every credential it has contained before any public release. Adding it to `.gitignore` prevents future accidental additions but does not remove secrets from Git history.
