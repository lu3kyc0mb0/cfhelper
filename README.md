# Codeforces Helper

Firefox 140+ extension that adds tools to the Codeforces problem archive.

## Installation

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Choose **Load Temporary Add-on…** and select `manifest.json`.
3. Reload [Codeforces Problemset](https://codeforces.com/problemset).

**Filters**, **Sort by** and **Practice statistics** appear above the existing problem table. Filters and sorting cover the full API archive. **Original archive** restores the actual original DOM nodes and pagination, including the site's own functionality. The extension's filters operate independently of the Codeforces sidebar. Gym, private groups and acmsguru are outside its scope.

To update an unpacked copy, click **Reload** in `about:debugging`, then reload Codeforces. Temporary installations disappear after restarting Firefox. Permanent installation in standard Firefox requires Mozilla signing; this ZIP is unsigned.

## Archive tools

- Exact task ID (`1900A`) or contest ID (`1900`), case-insensitive name search, multiple task indices (`A, B, C1`). Contest IDs are URL IDs, not round numbers.
- Inclusive difficulty, solved-count and contest-ID ranges. Unrated tasks are excluded when a difficulty range is set.
- Multiple tags with **all / any** matching and exclusions. Click a tag to include it, exclude it, then clear it.
- Sorting beside Filters: difficulty, popularity, name or contest ID. “Newest” means higher contest ID, not publication date.
- Bookmarks, up to 30 saved filter collections and a random task from the complete result set.
- Hide tags and difficulty to avoid spoilers. These preferences also apply to text exports.
- 25, 50 or 100 rendered problems per page, plus compact rows. Pagination bounds DOM size instead of rendering the entire archive.
- Manual task marks have been removed. Old `progress` data is discarded and never interpreted as an Accepted result.

## Settings

Open Firefox’s Extensions menu (puzzle icon), then click **Codeforces Helper** to change settings in its popup. You can also pin the extension and open the popup from its toolbar icon. There is no Settings button on the Codeforces page. Add-on Preferences (`about:addons`) remain available. Changes apply immediately to open archive pages.

- **Extension language:** English or Russian, applied immediately. This changes the extension's UI, not Codeforces's own menus, problem names or tag names.
- **Export:** download the filtered task list or bookmarked tasks as `.txt`. All matching cached tasks are exported, not just the current page. No data is sent to a server for export. The standalone Preferences view exports using the saved filters and cached archive.

The extension retains Codeforces styling. Colour themes and custom palettes are not included.

## Public practice history

Enter a handle in Settings and press **Sync latest submissions**. This sends that handle only to Codeforces's public `user.status` API. No login, password, cookies, API key or source code is used.

Each explicit click loads at most 1,000 submissions. **Load older submissions** extends the snapshot; it does not run a background loop. A visible notice distinguishes partial history from a loaded history. Until all pages are loaded, **No known AC** can include tasks solved in older, unloaded submissions. The snapshot can also become stale after new submissions; sync it manually. Syncing the latest page starts a fresh snapshot. API offset pagination can shift if new submissions arrive while older pages are loaded; avoid syncing during a contest and refresh the snapshot afterwards.

Filters support **Accepted**, **No known AC**, and **Attempted, no known AC**. Only `OK` verdicts count as Accepted. Tags statistics count distinct accepted archive problems from the loaded history; tags overlap, and these counts are not a measurement of skill or a claim about weak topics. Only one handle snapshot is stored per browser profile. **Disconnect handle** deletes it. Changing a handle does not merge histories.

## Network behaviour and privacy

Only two anonymous GET endpoints are implemented:

- `https://codeforces.com/api/problemset.problems`
- `https://codeforces.com/api/user.status?handle=…&from=…&count=1000`

The [official API limit](https://codeforces.com/apiHelp) is **one request per two seconds**, not five requests per second. The supplied brainstorming document's proposed 200–300 ms interval is therefore not used. Both endpoints share a serial queue with at least 2.5 seconds between request starts. The last-request time persists across background restarts; concurrent catalogue requests are deduplicated. HTTP 403/429/503 and API rate-limit responses produce a cooldown without automatic retries. The limiter only controls this extension, not other programs sharing the same IP.

The catalogue is cached for six hours and remains usable after a failed refresh. A history snapshot is stored locally; network refreshes are explicit. Both endpoints have a 25-second timeout. Filters, bookmarks, collections, preferences, snapshots and rate-limit timestamps stay in `browser.storage.local`. There are no developer servers, analytics or remote scripts. HTTP connection metadata is naturally visible to Codeforces. Exports are local downloads.

Permissions are limited to local extension storage and `https://codeforces.com/*`. Firefox's data disclosure declares `authenticationInfo` because a manually entered username/handle can be transmitted to Codeforces. No passwords, session tokens or cookies are collected. Entering a handle is optional; archive filtering works without one.

## Scope and contest rules

The interface only attaches to `/problemset`, `/problemset/` and `/problemset/page/<number>`. It does not attach to contest pages, task statements, submissions, hacking, standings, Gym or groups. There is no generated solution, AI hint, automated submission, CSRF extraction, source-code retrieval, session interception or protection bypass.

From the supplied idea list, this release implements API queuing/caching, offline/error handling, accepted-task filtering, topic counts and bounded archive rendering. Quick Submit, IDE integration, sample parsing, friend authentication and standings virtualization are not implemented. They would require separate workflows and validation; this release does not claim to replace them.

Designed for independent practice using the [contest rules](https://codeforces.com/blog/entry/4088), [AI restrictions](https://codeforces.com/blog/entry/133941) and [API documentation](https://codeforces.com/apiHelp) checked on 1 November 2026. It cannot detect participation in a live or virtual round in another tab. Organizers' specific rules still apply. This is an independent project, not a Codeforces-approved add-on; technical restrictions are not a guarantee against sanctions or legal liability.

## Development and validation

Runtime JavaScript/CSS is dependency-free. `core.js` contains filtering and aggregation, `background.js` the API queue, `i18n.js` translations, `ui.js` preferences validation and DOM helpers, `settings.js` shared preferences, and `content.js` native table integration.

```sh
npm install
npm run lint:extension
npm run build
```

The build command creates `dist/cfhelper-firefox-1.0.0.zip` using web-ext. No build step is required to load the source extension.

Manual Firefox checks: reload the add-on and archive; test Filters and standalone sorting; open the extension popup and add-on Preferences; switch languages; change row density; connect a handle and load older history; export bookmarks; restore the native table. Test an unavailable API with and without a previous cache. Mozilla signing and live Firefox verification remain separate release steps.
