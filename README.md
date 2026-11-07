# <img width="50" height="50" alt="cfhelper" src="firefox/cfhelper.png" /> Codeforces Helper

A browser extension for filtering the Codeforces problem archive.

Filters appear in the Codeforces sidebar. Sorting sits above the problem table.

## Browser versions

**Now CF Helper available in Chromium!**

- `firefox/`: the existing Firefox version, preserved without runtime changes. Requires Firefox 140 or newer.
- `chromium/`: the initial Chromium port. Uses native chrome APIs, an MV3 service worker, and asynchronous message responses. Requires Chromium 120 or newer.

## Preview/Screenshots

<details>
  <summary>Click to view</summary>
  <img width="154" height="449" alt="2" src="https://github.com/user-attachments/assets/773d399a-91a0-4904-853b-c634e8f0f6c9" />
  <img width="446" height="254" alt="1" src="https://github.com/user-attachments/assets/4941cbff-38b9-4f74-8480-378a1b556d86" />
</details>

## Install

<details>
  <summary>Mozilla Firefox</summary>

Install [CF Helper from Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/cf-helper/), then open or reload the [Codeforces problemset](https://codeforces.com/problemset).

</details>

<details>
  <summary>Chromium</summary>

The Chromium version is not yet published to the Chrome Web Store. Use [temporary installation](#temporary-installation) instead.

</details>

### Temporary installation

Download and extract this repository, or clone it, before following the steps below.

<details>
  <summary>Mozilla Firefox</summary>

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on** and select `firefox/manifest.json`.
3. Open or reload the [Codeforces problemset](https://codeforces.com/problemset).

Firefox removes temporary add-ons when it restarts.

</details>

<details>
  <summary>Google Chrome</summary>

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `chromium/` folder containing `manifest.json`.
4. Open or reload the [Codeforces problemset](https://codeforces.com/problemset).

</details>

<details>
  <summary>Microsoft Edge</summary>

1. Open `edge://extensions` in Microsoft Edge.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `chromium/` folder containing `manifest.json`.
4. Open or reload the [Codeforces problemset](https://codeforces.com/problemset).

</details>

<details>
  <summary>Opera</summary>

1. Open `opera://extensions` in Opera.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `chromium/` folder containing `manifest.json`.
4. Open or reload the [Codeforces problemset](https://codeforces.com/problemset).

</details>

<details>
  <summary>Brave</summary>

1. Open `brave://extensions` in Brave.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `chromium/` folder containing `manifest.json`.
4. Open or reload the [Codeforces problemset](https://codeforces.com/problemset).

</details>

## Features

- Filter problems by number, name, difficulty, solved count, and tags.
- Sort problems and save filter presets.
- Bookmark problems and pick a random problem.
- Hide tags or difficulty while practicing.
- Connect a Codeforces handle to filter solved and attempted problems.
- Choose how many problems appear per page.

Use **Original archive** to return to the standard Codeforces table.

## Settings

Open **Codeforces Helper** from your browser's Extensions menu to change the language, adjust the archive, connect a handle, or export a problem list and bookmarks.
