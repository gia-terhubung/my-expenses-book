# Submission prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android notification icon, unused permissions blocked, one submission checklist.

**Architecture:** Config-only change in `apps/mobile/app.config.ts` plus one generated asset; CNG writes the
native files at prebuild.

**Tech Stack:** Expo SDK 58 config plugins, expo-notifications, sips/sharp for the asset.

**Spec:** `docs/superpowers/specs/2026-11-25-submission-prep-design.md`

## Global Constraints

- Glyph: white (#FFFFFF) on transparent only, 96x96 PNG. Colour `#1F5C4C`.
- Keep permissions: CAMERA, photos, USE_BIOMETRIC/USE_FINGERPRINT, POST_NOTIFICATIONS, INTERNET, VIBRATE.

## Review Focus

- Glyph has no opaque non-white pixels (would render as a blob).
- Prebuild manifest still has CAMERA and POST_NOTIFICATIONS after the block list.
- `expo-notifications` meta-data `default_notification_icon` and `_color` present in the manifest.

---

### Task 1: Notification icon and permissions

**Files:** Create `apps/mobile/assets/images/notification-icon.png`; modify `apps/mobile/app.config.ts`.

- [ ] Generate the glyph from `android-icon-monochrome.png` (crop to the mark, all opaque pixels white, 96x96).
- [ ] `expo-notifications` plugin options: `icon: "./assets/images/notification-icon.png"`, `color: "#1F5C4C"`.
- [ ] `android.blockedPermissions` adds the three permissions.
- [ ] `npx expo prebuild --platform android --no-install` into a temp copy; check manifest and drawables.
- [ ] `npm run typecheck && npm test`; commit.

### Task 2: Checklist

**Files:** Create `docs/store/submission-checklist.md`.

- [ ] Items marked code / owner / store, linking existing docs; commit and push.
