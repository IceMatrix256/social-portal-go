# Social Portal - Ethereal P2P Fork

A decentralized, privacy-focused social media aggregator and identity manager with robust P2P sync and Freenet-inspired ethereal chunk storage.

## Overview

This is a fork of the original Social Portal, optimized for Android APK with added P2P synchronization capabilities using Gun.js and distributed data storage via IPFS chunks, inspired by Freenet's ethereal datastore. Preserves the anti-tracking ethos by keeping all sync peer-to-peer without central servers.

- **Architecture**: Static Client-Side App (React + Vite) with P2P extensions
- **Identity**: Polycentric (Local-first, stored in IndexedDB, synced P2P)
- **Sync**: Gun.js for decentralized data synchronization
- **Storage**: IPFS for ethereal chunk-based data storage
- **Data**: Peer-to-Peer / Direct API fetch (no central backend)

## Features

- **Unified Feed**: Mix content from ActivityPub, AT Protocol, Nostr, and RSS.
- **Local Identity**: Your keys and data stay on your device, synced across devices P2P.
- **Privacy**: No tracking, no algorithm; P2P sync preserves anonymity.
- **Customizable**: Pin networks, manage topics, add custom RSS feeds.
- **P2P Sync**: Sync identities and settings across devices without servers.
- **Ethereal Storage**: Store data in distributed IPFS chunks for resilience.

## Self-Hosting

Same as original, but with added P2P features.

## Self-Hosting

Since the app is a static SPA, you can host it anywhere.

1. **Build**:

    ```bash
    npm run build
    ```

2. **Deploy**:
    Serve the `dist/` directory using any web server (Nginx, Caddy, Apache) or static host (Vercel, Netlify, GitHub Pages).

### CORS Proxy Note

To bypass browser CORS restrictions for some legacy networks (like RSS feeds), the app falls back to `allorigins.win`/other public proxies or internal dev proxies when needed. For a robust self-hosted production setup, it is recommended to run a small CORS proxy alongside the static app.

Networks that support direct (peer-to-peer) connections without a proxy:

- Bluesky
- Nostr (via Relays)
- Misskey (most instances)
- Mastodon (most instances)

In production/native mode, these direct-capable networks are attempted directly first; proxy fallback is only used if the direct request fails.

## Portable Deployment (Cross-Platform)

For a truly portable "deploy anywhere" experience (e.g., on Android via Termux, or a USB stick), we provide a build command.

1. **Build**:

    ```bash
    npm run build:portable
    ```

    This creates `social-portal-portable.zip` containing the `dist/` folder and `server.go`.

2. **Deploy**:
    Copy `social-portal-portable.zip` to your device, extract it, and run:

    ```bash
    go run scripts/server.go
    ```

3. **Access**: Open `http://localhost:8080` (or the printed Network URL).

This server handles static app hosting and CORS proxying with the Go standard library (requires `go` installed).

## Remote Access & Security

To access your self-hosted instance securely from other devices (e.g., hosting on a Raspberry Pi or Android phone and accessing from an iPhone), we strongly recommend using a mesh VPN like **Tailscale**.

- **Zero Config**: Install Tailscale on your host and client devices.
- **No Open Ports**: You do not need to open ports on your router or expose your IP to the public internet.
- **Security**: Access is encrypted and authenticated. Only your devices can see the Social Portal.
- **MagicDNS**: You can access your instance via a stable hostname (e.g., `http://raspberry-pi:8080`) regardless of network changes.

## Development

```bash
npm install
npm run dev
```

## 🚀 One-Line Deployment

### 📱 Native Android APK

If you prefer a standalone app experience without using Termux, you can download the latest pre-built APK:

1. Go to the [Social Portal Releases Page](https://github.com/IceMatrix256/social-portal/releases).
2. Download the `app-debug.apk` file from the latest release.
3. Install the `.apk` file on your Android device.

---

### 💻 Android (Termux) /  Mac / 🐧 Linux (One-Liner)

This is for the "Power User" experience with a local proxy backend.

```bash
curl -fsSL https://raw.githubusercontent.com/icematrix256/social-portal/main/deploy/install.sh | bash
```

### 🪟 Windows (PowerShell)

```powershell
iex (iwr https://raw.githubusercontent.com/icematrix256/social-portal/main/deploy/install.ps1 -UseBasicParsing)
```

> [!NOTE]
> These scripts will automatically detect your OS, install necessary dependencies (Python, Node, Git), clone the repository, and set up a desktop shortcut or terminal alias.
