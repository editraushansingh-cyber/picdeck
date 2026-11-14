# CamTom 7.0.52 — Reverse-engineering notes

Target: `/Applications/REA SE/CamTom.app/Contents/Resources/app.asar` (Electron 29.4.6, `com.myepick.camtom.in`).
Hamesha ki tarah: **observed** = shipped bytes se seedha mila (deobfuscated code / string literals); **inferred** = code padh ke nikala gaya matlab, runtime par verify nahi kiya.

ASAR integrity mismatch tha (`better_sqlite3.node`), isliye REA ne `record-and-continue` maanga. Bade ASAR (368 MB, 5511 entries) par `analyze_javascript_application` 300 s deadline par timeout karta hai, isliye manual deobfuscation kiya:

* Obfuscator flavour: string-array + RC4 (`_0x21c6(range, key)`), har call apni key ke saath.
* 487 wrapper/proxy functions chain karte hain (`_0x571975 -> _0x443594 -> _0x21c6`).
* Tool: `/tmp/camtom/deobany.cjs` (sandbox eval + recursive proxy resolution + literal folding + string concat folding).
* Outputs: `/tmp/camtom/index.deob2.js` (main process), `preload.deob.js`, `indexflipbook.deob.js`, `index2.deob.js`.

---

## 1. App ka structure

| File | Kaam |
| --- | --- |
| `src/index.js` | Electron main process: window, autoUpdate, `camtomin://` protocol, menus, shortcuts |
| `src/index2.js` | Upload/compress orchestration (hidden windows, threads, SQLite queue) |
| `src/preload.js` | IPC bridge (`api2.sendIPC` / `receiveIPC`) |
| `src/upload/` | **Flutter web app** (`main.dart.js`, 1.76 MB) — asli uploader UI + Drive/Firestore logic |
| `src/compress/` | hidden `BrowserWindow` pages (`cmp0.html`, `cmpface.html`) — thumbnails + watermark + face detect |
| `src/flipbook/` | flipbook preview window |

**Observed:** main window `BrowserWindow({width: 730, height: 600, webSecurity:false, partition:"persist:camtom", nodeIntegration:true, contextIsolation:true})`, `loadURL` → hosted studio site. Upload hidden window `https://upload.camtom.in` par jata hai (`index2.deob.js`), `webSecurity:false`, `partition:"persist:camtom"`.

## 2. Cloud footprint

**Observed strings:**

* Studio web app / panels: `https://camtommyepickphotographerpanelsfaceainnew.firebaseapp.com`
* Uploader: `https://upload.camtom.in`
* Client gallery / compression dev: `https://findphotos.camtom.in`
* Local helper: `http://localhost:45633/`
* Custom protocol: `camtomin://`

**Observed Firebase config** (Flutter bundle mein embed, `main.dart.js`):

```
apiKey:            AIzaSyDZYRnh_Tzf4W8Bgwy0kBSHMBCSXYpn9PE
appId:             1:473346203757:web:df89250574d1bb5cc91f64
messagingSenderId: 473346203757
projectId:         camtom-myepick
authDomain:        camtom-myepick.firebaseapp.com
databaseURL:       https://camtom-myepick-default-rtdb.firebaseio.com
storageBucket:     camtom-myepick.appspot.com
measurementId:     G-RN8BB9BPYT
```

Use ho rahe SDKs (Flutter deps ke runtime calls se): **Firebase Auth**, **Cloud Firestore**, **Firebase Realtime Database** (config), **Google Drive API v3** (`https://www.googleapis.com/drive/v3/`), Google Identity Services (`accounts.google.com/gsi/client`).

## 3. Original photo kahan jata hai — Google Drive

**Observed** (`main.dart.js`, class `A.Sm`):

```js
new A.QE(new A.Mt(new A.Se(m, new A.Nc(...)),
   "https://www.googleapis.com/", "drive/v3/", s))
  .pL(0, r, true, true, A.an5(stream, size, "application/octet-stream"))
```

* `m` = OAuth access token (`Authorization: Bearer <token>` + `X-Goog-AuthUser: 0` header, class `A.Sh`/`A.Sg`).
* `r` = file metadata object → `r.p1 = [parentFolderId]`, `r.k2 = fileName`, `r.fy = "image/" + ext`.
* Upload `pL(0, meta, true, true, stream)` = Drive v3 **multipart insert** (metadata + media), body `application/octet-stream` streamed.

Matlab: **photo bytes camera/disk se seedha studio ke apne Google Drive folder mein** jaate hain. Koi beech ka apna S3/GCS nahi. Photo realistically Drive ke folder tree mein `parentFolderId` ke andar banti hai; `publicFolderName` bhi Firestore metadata mein jata hai (public link/publish ke liye).

Token kahan se aata hai: `A.Sg.wM()` expiry check karta hai (`expirationTime` vs `Date.now()`), expire hone par `sendIPC("needLoginGmail")` bhejta hai → main process `need-login-gmail` → renderer Google sign-in popup kholta hai (token `sendIPC("data-login-gmail", token+email)` wapas). Redirect/loopback `http://localhost:45633/` local helper se hota hai (inferred: OAuth loopback receiver).

## 4. Metadata kahan jata hai — Cloud Firestore

**Observed** (`A.YX`, `A.HX`):

```js
firestore.collection("AlbumsDB").doc(albumID)
        .collection("Photos").doc("Photos" + (albumIndex + threadIndex))
        .set({ [documentID]: photoObject }, {merge:true})

firestore.collection("AlbumsDB").doc(albumID)
        .collection("FACEIDS").doc(faceId)
        .set({ [documentID]: faceData }, {merge:true})
```

Photo document fields (observed):

* `photoName`, `photoPath` (Drive file id/url — success handler mein `a.CW` se aata hai), `photoUploaded: 1`, `photoMarkerName: "null"`
* `sizeee`, `cmpphoto` (compressed preview), `faces` (face descriptors array)
* public mode mein: `pN`, `dI`, `aN`, `pP`, `iR`, `pMN`, `pFN` (public folder name) — ye keys public gallery ke liye aliases hain.

**Critical ordering (observed):** Firestore doc **sirf Drive upload promise resolve hone ke baad** likha jata hai:

```js
p.b.y0(...).aK(0, new A.a0t(...))   // success
           .fV(new A.a0u(...));     // failure -> sirf retry, Firestore write nahi
```

Success handler: `photoPath = a.CW; photoUploaded = 1;` phir `YW(...)` → Firestore `set`. Fail par `l4` (dobara queue). **Isi wajah se client ko wahi Drive photo dikhti hai jo Drive par hai — "upload hua par dikh nahi raha" ya "dikh raha par Drive par nahi" possible nahi.**

Album index formula (observed): `Photos{N}` jahan `N = floor(photosInThisPass / 1600) + threadIndex`. Matlab 1600 photos per sub-collection chunk, thread ke hisaab se shard.

## 5. Local queue — SQLite

`index2.deob.js` (observed):

```js
db = new Database(dbPath)
db.pragma('journal_mode = WAL'); db.pragma('synchronous = NORMAL'); db.pragma('busy_timeout = 5000')
table: T_ADMIN_PHOTO_TABLE  (fields: albumID, documentID, photoPath, photoUploaded)
```

Flow:
1. Compress windows photo list banate hain (`album-Uploading-Process` events, `data_ready_to_send`).
2. Har compressed photo `upload_data_receive` event se Flutter uploader ko jati hai.
3. Upload success → SQLite row update (`update_Photo_To_Database`: `photoUploaded = 1`, `photoPath = ...`).
4. App restart par pending rows (`photoUploaded = 0`) dobara queue hoti hain — resumable upload.

## 6. Thumbnail / watermark / face — sab local

`src/compress/` ke hidden BrowserWindows: `sizee` (full jpg size), `thumbsize`, `thumbpadding`, `faceid`, `faceapisize`, `facesize`, `compress`, `thumtrans` (watermark transparency), `imgw` (width), `gravity`, `rpy`. RAW → `./rawtopg` (`CamtomRawToJPG`). Face detection local `faceapi.js` + `ssd_mobilenetv1` model (`webSecurity:false` ke saath CORS headers inject karke). Cloud par koi processing nahi.

## 7. Live sync — kya sirf "refresh" hai ya push?

**Observed:** Firestore + Realtime DB dono initialized hain. Uploader side par writes `set(..., {merge:true})` hain; client gallery side ka code is ASAR mein nahi hai (woh `findphotos.camtom.in` par hosted alag web app hai), isliye **exact transport verify nahi hua**.

**Inferred (Firestore standard pattern, high confidence):** client gallery `AlbumsDB/{albumID}/Photos/{shard}` par `onSnapshot` listener lagata hai, aur studio panel bhi usi DB par listener lagata hai. Selection/booking bhi likne par dono taraf snapshot fire hota hai → ~1 s ke andar update. Maine ASAR mein koi WebSocket/SSE/polling code nahi dekha (Sirf Firebase SDK ka generic code), jo is baat ko support karta hai ki sync fully Firebase ke managed listeners par hai.

**Iska matlab:** CamTom apna realtime layer khud nahi likhta; Firebase ka hosted realtime DB use karta hai. Isi wajah se Drive (bytes) aur Firestore (index/metadata) separate rehte hain aur dono ko milane ka kaam client par hota hai.

## 8. POSIX `camtomin://` — deep link

`CFBundleURLSchemes: ["camtomin"]`. Main process: `app.on('second-instance')` / `open-url` se URL `camtominurl` mein, phir `mainWindow.webContents.send("camtomin", url)`. Studio website is link se "open CamTom with album X" kar sakti hai. Window band hone par `uniLink` par `camtominurl = null`.

---

## 9. PicDeck ke liye translation

| CamTom | PicDeck (hamara) |
| --- | --- |
| Electron desktop app + Flutter uploader | Browser upload (`/api/events/[id]/photos`) — already hai |
| Google Drive (studio ka account, OAuth) | Wahi: `lib/drive.ts`, `drive.file` scope, per-studio `DriveLink` — **already hai** |
| Firestore `AlbumsDB/{album}/Photos/PhotosN/{doc}` | Postgres `Photo` table (Prisma) — **already hai** |
| Firestore `photoUploaded` flag + queue | `Photo.status` (`uploading` → `ready`) + local-disk fallback |
| Firestore `onSnapshot` realtime | **Missing** → SSE (Server-Sent Events) + polling fallback |
| Firestore `FACEIDS` sub-collection | Optional: face-search; abhi scope se bahar |
| Firebase Auth (Gmail) | NextAuth-style sessions (already hai) |
| `camtomin://` deep link | Nahin chahiye (web-only) |
| Selection client-side likhi jati hai | Client selection → API → `SelectionEvent` table → SSE broadcast → studio dashboard turant update |

**Ordering rule jo CamTom se copy karni hai:** photo `ready` tabhi jab Drive upload (ya fallback disk write) succeed ho. `Photo.status` isi ko enforce karega; gallery API sirf `status = 'ready'` photos return karega.

**Live-sync implementation (PicDeck) — ban gaya aur browser par verify hua:**

1. `SelectionEvent` model (`id, eventId, kind, photoIds, actor, clientName, createdAt`) — append-only log.
2. `GET /api/events/[id]/stream` → SSE (`text/event-stream`), in-process hub + 25 s heartbeat + `Last-Event-ID` replay.
3. Client tap → `pushLiveSelection` server action (debounced 350 ms) → DB transaction → hub `publish` → studio + client tabs.
4. `useGalleryStream` hook: ek event ke liye ek hi shared `EventSource` (studio page par counter aur grid dono mount hote hain), polling fallback agar stream kabhi na khule.
5. Upload route photo row `status: "READY"` ke saath banata hai aur `photo-ready` publish karta hai → khuli client gallery naye tiles pull kar leti hai.
6. `GET /api/events/[id]/gallery-state` polling/refresh snapshot.

**Verify kiya gaya:** client `/g/673643` par photo select → studio `/dashboard/events/<id>` bina reload ke "1 selected"; unselect → "0 selected"; upload ke baad client gallery bina reload 6 photos.

**Ek bug jo yahan pakda gaya:** hub `publish()` pehle room ko `event.id` se dhundh raha tha (wo SSE row id hai, event/gallery id nahi) — sab events chup-chaap drop ho rahe the. Ab `event.eventId` use hota hai aur dev mein "no subscribers" warning aati hai.

**Known limit:** hub per-process hai. Multi-instance deploy par `publish()` ke peeche shared bus (Postgres `LISTEN/NOTIFY` ya Redis) chahiye; tab tak doosre instance ka write agle poll (5 s) par dikhega.

Yeh same effect deta hai jo CamTom Firestore se deta hai, par hamare Postgres/Next stack par, bina kisi third-party realtime service ke.