# Impulse Tracker (MVP)

Privacy-first, cross-platform mobile application for logging urges and impulses related to habits users are trying to stop. Built as an MVP using modern React Native tooling with a focus on clean architecture, scalability, and on-device data privacy.

## Features
- Log habit urges with contextual data (urge, cue, location, timestamp)
- Positive reinforcement dashboard with basic stats
- Replacement-action “shop” (preset actions + user-defined)
- In-depth analytics based on logged data
- Profile & settings screen with local data export
- Bottom-tab navigation with a clean, modular layout

## Privacy-First Design
- All habit and impulse data is stored **locally on the user’s device**
- No server-side storage of sensitive user data
- Optional authentication handles identity only (no data sync)
- Export functionality allows users to back up their own data

## Tech Stack
- **Framework:** Expo (React Native)
- **Language:** TypeScript
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Navigation:** React Navigation (Bottom Tabs)
- **Storage:** On-device persistence (encrypted/local storage)
- **Platform:** iOS & Android (single codebase)

## Architecture Highlights
- Modular screen-based structure
- Centralized state management for logs and actions
- Reusable UI components styled via utility classes
- Designed for easy iteration toward production features (notifications, sync, monetization)

## Running Locally
```bash
npm install
npx expo start
