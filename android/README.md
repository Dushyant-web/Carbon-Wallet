# Carbon Wallet: Android apps

Three native apps (Kotlin + Jetpack Compose, no WebView) built from one project as product flavours. They use the
website's own API, the same look (Carbon Ledger colours, IBM Plex + Newsreader, the portal header with the tricolour
rule, A / A+ / A++ text size and Hindi / English) and the same demo data.

| App | Flavour | Package | For | Tabs |
|---|---|---|---|---|
| **Carbon Ghar** | `ghar` | `in.carbonwallet.ghar` | households | My home · Bill · Mohalla · Card & items · Schemes |
| **Carbon Dukaan** | `dukaan` | `in.carbonwallet.dukaan` | approved shops | Scan card · My shop · Sales · Catalogue |
| **Carbon Admin** | `admin` | `in.carbonwallet.admin` | platform admins | Overview · Shops · Removals · Help desk · Schemes |

Every app also has notifications (bell) and a profile page (language, text size, sign out).

## Run on the emulator against your local website

1. Start the website and the engine (see the main README): `npm run dev` and `uv run uvicorn app.main:app --port 8001`.
2. Open the `android/` folder in Android Studio, or from a terminal:

   ```bash
   cd android
   ./gradlew :app:installGharDebug      # or installDukaanDebug / installAdminDebug
   ```

The debug build calls `http://10.0.2.2:3000`, which is your computer's `localhost` as seen from the emulator.
Debug builds show one-tap demo logins from `ACCOUNTS.md` on the sign-in screen.

## Run on a real phone (same Wi-Fi)

Find your computer's Wi-Fi address (macOS: `ipconfig getifaddr en0`) and put it in `android/local.properties`:

```properties
cw.apiUrl=http://192.168.1.20:3000
```

Then `./gradlew :app:installGharDebug` with the phone plugged in (USB debugging on).

## Release builds (Play Store)

1. Deploy the website (DEPLOY.md), then set its HTTPS address in `android/local.properties`:
   `cw.releaseApiUrl=https://<your-site>.netlify.app`. Release builds refuse plain http.
2. Create an upload key once and keep it safe (never commit it):

   ```bash
   keytool -genkeypair -v -keystore carbonwallet-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   and `android/keystore.properties`:

   ```properties
   storeFile=carbonwallet-upload.jks
   storePassword=…
   keyAlias=upload
   keyPassword=…
   ```
3. Build the bundles: `./gradlew bundleGharRelease bundleDukaanRelease bundleAdminRelease`
   (output in `app/build/outputs/bundle/`). R8 shrinking is on; release APKs are about 3 MB (Ghar), 2.5 MB (Admin)
   and 13 MB (Dukaan, which carries the offline barcode reader; Play delivers about 8 MB to each phone).

### Google sign-in (Ghar and Dukaan)

Admins sign in with a password; the server refuses Google for admins.

1. In Google Cloud, create an **Android** OAuth client for each app (package name above + your signing key's SHA-1),
   and list their client IDs in the server's `GOOGLE_ANDROID_CLIENT_IDS` (DEPLOY.md).
2. Put the **web** client ID in `android/local.properties`: `cw.googleWebClientId=….apps.googleusercontent.com`.
   Without it the "Continue with Google" button stays hidden.

## How it stays fast on a cheap phone

- **Opens on cached data.** Every screen first shows what it loaded last time (memory, then disk), then refreshes, so
  tabs switch instantly and the app still opens without network. The cache is wiped on sign-out.
- **Prefetch.** Right after sign-in each app loads all its tabs in parallel.
- **One warm connection.** A single OkHttp client keeps connections open to the website.
- **Small and native.** No WebView, no navigation or chart libraries: charts are drawn on a Compose canvas, icons are
  the website's lucide icons as vectors, and fonts are bundled so text never waits for a download.
- **Light API.** The admin overview asks for `?users=25` instead of every account (433 KB → 7 KB).

## Security

- The session token from the website is stored encrypted with a key in the Android Keystore and sent as
  `Authorization: Bearer …` (the website accepts this from the apps). App backups are off.
- The token is only sent to the configured server; release builds allow HTTPS only.
- Each app checks the account's role after sign-in (a shop account can't use Ghar, and so on); the server checks
  every request again.
- The Carbon Card screen shows the private barcode (with a "hide" option) and turns the screen to full brightness so
  shop scanners read it.

## Project layout

```
app/src/main/…/core/        shared: theme, network + cache, session, UI components, charts, portal header, barcode
app/src/main/…/core/shell/  sign-in, tabs + page stack, notifications, profile
app/src/ghar/…/ghar/        household screens (bill photo upload + review, mohalla, Carbon Card, removal requests)
app/src/dukaan/…/dukaan/    shop screens (CameraX + ML Kit scanner, NFC reader, counter flow, catalogue, sales)
app/src/admin/…/admin/      admin screens (overview, shop approval, removal decisions, help desk, schemes)
app/src/google/…            "Continue with Google" (Credential Manager), shared by Ghar and Dukaan
```

Toolchain: AGP 9.4, Gradle 9.6, Kotlin 2.4, compileSdk 37, minSdk 26, targetSdk 36, JDK 17+ (Android Studio's bundled JDK works).
