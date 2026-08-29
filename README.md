# Reflex

Reflex is a privacy-first mobile app that helps people reduce unwanted habits. It combines quick habit logging, pattern-based analytics, and in-the-moment support so users can understand both why a habit happens and how to change it.

This project demonstrates end-to-end mobile product development, from onboarding and local data modeling to analytics, accessibility-minded interactions, and production iOS delivery.

## What Reflex Does

- Guides new users through choosing habits and setting an estimated current amount and long-term goal amount for each habit
- Supports habits measured in times or minutes, with separate Day, Week, or Month (28-day) frequencies for estimated current and long-term goal amounts
- Logs habit activity or successful resistance with multiple cues, a location, intensity, notes, quantity, date, and time
- Provides a guided resistance flow with practical steps and replacement actions
- Shows encouraging dashboard summaries and progress for each tracked habit
- Presents analytics by habit, including trends, calendar history, cues, locations, and editable past logs
- Includes preset habits with default icons and colors while allowing full customization
- Lets users manage their habits, cues, locations, profile, and replacement actions
- Schedules an optional daily reminder locally on the device
- Exports and imports app data so users control their own backups

## Privacy

Personal habit data stays on the user's device. Reflex does not require an account and does not use a backend to store or sync personal data.

- Habit plans, logs, cues, locations, and replacement actions are stored locally
- Profile information and preferences are stored locally
- Daily reminders are local notifications, not remote push notifications
- Exporting creates a file the user controls and can choose to store or share
- Importing is optional and only uses a file selected by the user
- Resetting the app removes the locally stored Reflex data from that device

Because there is no cloud account or automatic cloud sync, moving data to another device currently requires exporting it and importing it on the other device.

## Main Screens

- **Home:** Habit-specific progress, recent activity, and positive reinforcement
- **Log:** Fast habit logging with an optional guided resistance flow
- **Shop:** Preset and custom replacement actions
- **Analytics:** Trends, history, patterns, and log editing
- **Settings:** Tracking lists, reminders, profile, data import/export, reset, and app information
- **Onboarding:** Habit selection, customization, and starting-point setup

## Tech Stack

- Expo SDK 54 and React Native
- TypeScript
- React Navigation
- NativeWind and Tailwind CSS
- Expo SQLite for structured on-device data
- AsyncStorage, SecureStore, and the local file system for device-only preferences and files
- Expo Notifications for local reminders
- EAS Build and Submit for production iOS delivery

## Engineering Highlights

- Designed a local-first data model for habits, plans, logs, cues, locations, and replacement actions
- Built reusable screen, picker, and modal patterns for a consistent mobile interface
- Added data-derived dashboards and analytics that update as users create or edit logs
- Implemented JSON import and export with validation for user-controlled backups
- Integrated local notifications, haptic feedback, image selection, and native iOS controls
- Structured the app around typed navigation and centralized data operations

## Project Structure

```text
components/   Shared UI components, including the common Screen wrapper
data/         Local database, data models, presets, and persistence helpers
screens/      Onboarding and main app screens
assets/       App icons, splash artwork, and other bundled assets
App.tsx       Navigation and top-level app flow
```

## Run Locally

### Requirements

- Node.js and npm
- Xcode for a local iOS build
- Android Studio for a local Android build

Install the project dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npm start
```

Run a native development build:

```bash
npm run ios
npm run android
```

A development build is recommended when testing notifications or other native functionality that Expo Go does not fully support.

## Validate Changes

Check the TypeScript project:

```bash
npx tsc --noEmit
```

Verify that the iOS JavaScript bundle can be created:

```bash
CI=1 npx expo export --platform ios
```
