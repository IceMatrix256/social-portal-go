# Social Portal Go (Alpha Fork)

Go-backed alpha fork of the main Social Portal project.

## What this fork is

This repository is based on **IceMatrix256/social-portal** (the main project) and keeps the React UI while introducing a Go runtime path for serving/proxying.

- **Frontend**: React + Vite
- **Gateway/Proxy**: Go (`scripts/server.go`)
- **Identity**: Polycentric (local-first, IndexedDB)
- **Status**: Alpha (actively iterating)

## What changed vs main

- Added Go server for static hosting + proxy endpoints.
- Native/mobile fetch path hardening for better real-device behavior.
- Reliability improvements for selected media adapters (Imgur/Pixelfed path).
- Android debug APK build + release flow for this fork.

## Features

- Unified cross-network feed (Mastodon, Bluesky, Nostr, RSS, etc.)
- Local identity and local persistence
- No centralized account required
- Customizable sources/topics and saved content

## Development

```bash
npm install
npm run start
```

`npm run start` launches both:
- Go backend (`go run scripts/server.go`)
- Vite frontend

## Build

```bash
npm run build
```

## Portable Deployment (Go)

1. Build portable bundle:

   ```bash
   npm run build:portable
   ```

   Produces `social-portal-portable.zip` with `dist/` + `scripts/server.go`.

2. On target machine:

   ```bash
   go run scripts/server.go
   ```

3. Open:
   - `http://localhost:8090`

## Android APK (Alpha)

- Repo: https://github.com/IceMatrix256/social-portal-go
- Releases: https://github.com/IceMatrix256/social-portal-go/releases
- Current alpha includes an installable debug APK asset.

## Notes

- This fork intentionally does **not** include ethereal/I2P branding.
- Full Go-side adapter aggregation is still in progress; current alpha focuses on reliability and deployability.
