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
---

## 10. Invoice / Quotation system (Nov 2026 pass)

### 10.1 Kahan hai — desktop app mein nahi, hosted panel mein

| Target | Invoice code? | Evidence |
| --- | --- | --- |
| `app.asar` (368 MB, 4703 files) | **Nahi** | Poore ASAR mein `invoice` ke sirf 38 byte-hits — sab `googleapis` ke bundled `displayvideo` / `content_v2` `Resource$Invoices` + `sqlite3` ka `ShowBitvec` comment. (`observed`) |
| ASAR file list | **Nahi** | `src/` ke 175 non-`node_modules` files mein koi `invoice`, `bill`, `tax`, `gst`, `quot`, `receipt` naam ka file nahi. (`observed`) |
| `src/upload/main.dart.js` (Flutter uploader, 1.76 MB) | **Nahi** | `invoice`/`billing`/`GST`/`quotation`/`receipt` = 0 hits. Sirf Firebase RTDB URL. (`observed`) |
| **`camtommyepickphotographerpanelsfaceainnew.firebaseapp.com`** | **Haan** | Flutter web studio panel, `main.dart.js` 7.72 MB. Yahan poora Quotation/Bill/Receipt system hai. (`observed`) |

Matlab: CamTom ka desktop app sirf upload/compress/flipbook karta hai. Billing ek **web panel** hai — usi Firebase project par (`camtom-myepick`), alag hosting par.

### 10.2 Panel modules (observed strings)

Dashboard · Customers · **Quotation** · Assignment/Order Booking · Team · **Payment Receipt** · **Expenses** · **Bill** · Reports · Payment QR · Calender · Profile · Support Us · Service/Work Types · **Terms Condition** · Download History.

### 10.3 Quotation + Bill ek hi model, ek hi collection nahi

| Cheez | Quotation | Bill |
| --- | --- | --- |
| Firestore path | `User/{uid}/Quotations` | `User/{uid}/Bills` |
| PDF header | `QUOTATION` | `INVOICE` |
| Number label | `Quote No:` | `Bill No:` |
| Date label | `Date:` | `Date:` |
| Validity label | `Valid Until:` | `Bill Due Date:` |
| Totals label | `QUOTATION TOTAL` | `BILL TOTAL` |
| Payments block | nahi | haan (`Payments` + payment rows) |
| Signature toggle | `QUOSING` | `BILLSING` |

(observed: `m.c ? "QUOTATION" : "BILL"`, `f ? "Bill" : "Quote"` + `" No:"`, `f ? "Bill Due Date" : "Valid Until"`.)

Do alag Firestore collections hain — `Ph(bool isBill)` ek hi function se dono handle karta hai.

### 10.4 Numbering — auto increment, per-user

```js
Ph(a){ // a = isBill
  const col = a ? "Bills" : "Quotations";
  return User/{uid}/{col}
    .orderBy("quoNo", descending)
    .limit(1)
    .get()
    .then(snap => snap.empty ? 1 : snap.docs[0].data().quoNo + 1);
}
```
(observed)

* Number **dono collections mein alag** chalta hai — Bill #7 aur Quote #7 dono ho sakte hain.
* `User.indexNumbers = {quoteNumber, billNumber}` se **user ke profile par bhi mirror** hota hai (probably display/backup ke liye). (`observed` field; mirror likhne ka trigger inferred.)
* Koi prefix/year nahi — sirf integer. PicDeck ka `INV-26-0001` isse zyada informative hai.

### 10.5 Quotation document — poora schema (observed)

Firestore doc `User/{uid}/Quotations/{id}`:

| Field | Type | Kaam |
| --- | --- | --- |
| `quoNo` | int | Sequential number |
| `date` | timestamp | Quote/Bill date |
| `validity` | timestamp? | `Valid Until` / `Bill Due Date` |
| `gstno` | string? | Client/studio GST — sirf header mein print |
| `upiID` | string? | UPI line on PDF |
| `status` | int (default `0`) | Quote: `0 None · 1 Sent · 2 Hold · 3 Booked · 4 Updated · 5 Rejected`; Bill: `0 None · 1 Sent · 2 Paid · 3 Overdue · 4 Cancelled · 5 Refunded` |
| `budget` | bool | "Budget Price Applied" mode |
| `budgetAmt` | num? | Flat total jab budget mode on ho |
| `tax` | num? | **Percentage** (`Tax in %`) |
| `discount` | num? | Rupees, subtotal se ghata kar |
| `miscellaneous` | num? | Rupees, total mein jod kar |
| `total` | num | Cached final total (`Zc()` isi ko return karta hai) |
| `bankDetails` | map | `{bankName, bankAccountNumber, bankAccountHolderName, bankIFSCCode}` |
| `toDetails` | map | `{name, businessName, address, phone, docId}` — `docId` customer doc ka ref |
| `listItem` | array | Line items (neeche) |
| `termsConditions` | string[] | Free-text lines |
| `dates` | array? | Event schedule — `{date, name, desc}` |
| `paymentList` | array | Payment entries (neeche) |
| `docID` | string? | Self ref (create ke baad) |
| `serverDate` | timestamp | Server write time |

Line item (`listItem[]`):

| Field | Kaam |
| --- | --- |
| `title` | Item/package name |
| `desc` | Description |
| `qnty` | Quantity |
| `price` | Rate |
| `total` | qty × price (cached) |
| `group` | Group heading, default `"Deliverables"` |
| `index` | Sort order |
| `keyIndx` | Group key (same group ke items share karte hain) |

Event date (`dates[]`): `{date, name, desc}` — PDF par "Inquiry for dates" strip banti hai, numbered list ki tarah, har row `name :- date, desc`.

Payment (`paymentList[]`): `{userName, docID, entryType, amount, updated, receiptNo, dateTime, orderDocID, expDocID, createTime, updateUID, paymentMode, description}` — **yahi `Account` collection ka row hai**, quotation usi doc ko embed karta hai. `paymentMode` index into `["CASH","UPI (mobile)","CARD","BANK TRANSFER"]`.

### 10.6 Totals maths — do modes (observed)

**Items mode** (`budget == false`):
```
itemsTotal   = Σ (qnty × price)              // aAv()
base         = itemsTotal === 0 ? miscellaneous : itemsTotal
afterDisc    = base - discount
taxAmount    = afterDisc × (tax/100)         // dy mein cache hota
total        = afterDisc + taxAmount + miscellaneous
```
**Budget mode** (`budget == true`):
```
gross   = budgetAmt - discount
net     = gross / (1 + tax/100)      // tax inclusive nikala jata hai
total   = budgetAmt                  // final = budgetAmt
```
(observed, `aea()` / `Zc()` / `aAv()`)

Note: **budget mode mein tax inclusive hai** (reverse-calculate), items mode mein **exclusive** (add-on). Ye ek asli design decision hai jo copy karne layak hai ya nahi — interview ka sawaal.

Advance = `Σ paymentList[].amount` (`acn()`). Balance = `total - advance`. Payment list sirf **Bill** par print hoti hai.

### 10.7 PDF layout — exact section order (observed)

1. **Header** — logo (Google Drive `lh3.googleusercontent.com/d/<id>` ya bundled `logo2.png`), studio name uppercase, address, phone, `GST No. <gstno>` (agar ho), right side `INVOICE`/`QUOTATION` + `Made by CamTom- Photographers Solution` footer line.
2. **Customer vs meta** (do columns) — left: `Customer name`, business name, address, `Phone:`; right: `Bill/Quote No:`, `Date:`, `Bill Due Date`/`Valid Until:`.
3. **Inquiry for dates** — uppercase strip + numbered event rows (sirf tab jab `dates[]` bhari ho).
4. **Items table** — header `QTY | DETAILS | PRICE` (AMOUNT column bhi hai lekin header string `"AMOUNT"` bundle mein nahi mila, cell-level `q[3]` se render hota hai). Group headings bold + underline; har group ke items ke baad **group subtotal** line (`<group> :-` + amount). Har row: qty, title (+ desc chhota), price, qty×price.
5. **Payment Details block** — tab print hota hai jab bank details ya UPI ho: `BANK NAME:`, `ACCOUNT NO.:`, `IFSC CODE.:`, `UPI ID:`.
6. **Totals (right column)** — `TOTAL` (bold bar) → `Advance` → `Balance`. (Print PDF par `SUB TOTAL`/`Tax in %`/`Discount`/`Miscellaneous` **nahi** aate — wo sirf **editor screen** ke summary mein dikhte hain, `bmE.bx7()` mein. Ye important difference hai.)
7. **Signature** — signature image (Drive ya bundled `signature.png`) + `SIGNATURE` label. Sirf tab jab user ne signature setting on ki ho.
8. **Terms & Conditions** — uppercase heading + numbered list (agar terms bhari hon).
9. **Payments** (sirf Bill) — `Payments` heading + rows: date, description, `Mode: <CASH/UPI/CARD/BANK TRANSFER>`, amount.
10. Footer har page par — `Made by CamTom- Photographers Solution 1/N` ya `1 / N Pages` (setting se).

### 10.8 Editor screen (jo PDF par nahi aata)

`arV()` ke accordion sections: `Basic Details`, `Items` (+ `Add Items/Groups`), `Tax & Miscellaneous`, `Terms Conditions`, `Generate Preview`.

* `Tax in %` ka label dynamic hai: `Tax in % 18=₹1,234` (percent + computed amount preview).
* Har field ke saath note: *"Note: Keep empty for remove the field from <Quotation|Bill> PDF"* — matlab **0/blank = field print hi nahi hoti**. Ye ek clean pattern hai.
* `Discount` → `SUB TOTAL` ke baad negative line. `Miscellaneous` → total mein jod.
* `Set final total` + `Total Budget` toggle = budget mode.
* `Add UPI on PDF` / `Bank Details on PDF` alag toggles.
* `Order Dates` — *"Note: This Order Dates & Name are optional"*.

### 10.9 Distribution (observed)

* PDF `printing` package se banti hai (Flutter web) — `printPdf` (print dialog), `sharePdf` (share sheet), `rasterPdf` (image preview).
* WhatsApp: `https://api.whatsapp.com/send?phone=<number>&text=<encoded>` — **PDF attach nahi hoti**, sirf text message jata hai. PDF share alag se (`sharePdf`).
* Kahin bhi email bhejne ka code nahi mila quotation ke liye.

### 10.10 CamTom se kya lena, kya nahi

**Lena chahiye:**
1. **Budget vs Items mode** — clients aksar "total ₹2,00,000 karo" bolte hain, item-wise breakdown baad mein. Ye real workflow hai.
2. **Group + group subtotal** — Packages (`Deliverables`, `Pre Wedding`, `Wedding Day`) ke andar items. PicDeck mein abhi flat list hai.
3. **Blank = hide** rule — har optional field PDF se gayab ho jati hai, placeholder nahi chhodta.
4. **Event dates strip** — PicDeck ka `functions[]` already yahi karta hai, par CamTom ka `{date, name, desc}` (desc ke saath) zyada flexible hai.
5. **Advance/Balance** — PicDeck ke paas abhi sirf `status: PAID` hai, partial payment model nahi.
6. **Payment receipt** alag document — advance milne par customer ko receipt.

**Nahi lena:**
1. Do alag collections (Quotations/Bills) — PicDeck ka `type` field behtar hai.
2. Integer-only numbering — `INV-26-0001` better.
3. Tax inclusive vs exclusive ka mixed behaviour — confusing hai, ek hi chuno.
4. `miscellaneous` ko `base` ban jane dena jab items 0 hon — ye edge case bug jaisa hai.

**Clear difference:** CamTom ka PDF **SUB TOTAL / tax / discount lines print nahi karta**, sirf TOTAL. Editor mein sab dikhta hai. PicDeck ka Blush Ivory design subtotal + discount print karta hai — ye jaan-boojh kar behtar hai (client ko transparency milti hai), par interview ka sawaal hai.

---

## 11. PicDeck invoice upgrade (interview ke baad — jo actually bana)

Section 10 ke evidence par user ne ye faisle diye, aur wahi implement hua:

| Sawaal | Faisla | Kahan bana |
| --- | --- | --- |
| Advance + balance | Haan, poora payment log | `InvoicePayment` model + `PaymentsEditor.tsx` |
| Groups | Haan, group subtotal ke saath | `InvoiceItem.group` + `InvoiceSheet` grouping |
| Pricing modes | Dono (item-wise + flat budget) | `Invoice.budgetMode/budgetAmount`, `computeTotals` |
| Print par totals | Sirf **TOTAL → ADVANCE → BALANCE** | `InvoiceSheet` (subtotal/discount/tax print nahi) |
| Numbering | Studio prefix + year + number | `User.invoicePrefix`, `formatInvoiceNumber` → `RF/2026/001` |
| Terms | Studio default + per-invoice override | `User.invoiceTerms`, `Invoice.terms`, `resolveTerms` |
| Functions | Naam + date + venue + description | `InvoiceFunction.desc`, `FunctionsEditor` 4th field |
| Payment details | UPI + bank dono | Letterhead (already tha) |
| Logo + signature | Dono print par | `InvoiceSheet` footer |
| Quotation vs invoice | Same design, label badle | `type` field |
| Client ko bhejna | WhatsApp par PDF/link | `WhatsAppShare.tsx` + `/i/[token]` |
| Draft visibility | Sirf SENT/PAID par link | `isPubliclyVisible` guard |

**CamTom se jo deliberately nahi liya:** GST/tax columns schema mein pade hain par `computeTotals` unhe chhoota hi nahi (TOTAL/sab 0 rakhta hai). Budget-mode ka tax-inclusive reverse calculation bhi nahi liya — budget amount hi final total hai.

**Naya client-facing route:** `GET /i/<publicToken>` — token pehli baar `SENT`/`PAID` par mint hota hai (`newShareToken()`), draft par link 404 deta hai. Print view aur public view ek hi `InvoiceSheet` component use karte hain, isliye jo PDF studio ne dekha wahi client dekhta hai.

**Verification (observed, local dev par):**
- `npx tsc --noEmit`, `npm run lint`, `npm test` (59 tests), `npm run build` — sab pass.
- Naya document `RF/2026/002` bana (prefix settings se).
- Editor save ne group + payment rows DB mein likhe (`InvoiceItem.group`, `InvoicePayment`).
- Budget mode on karne par `subtotal = total = budgetAmount`.
- Draft + token → 404; SENT + token → 200.
- Public sheet screenshot/PDF: `picdeck-invoice-demo/20-blush-ivory-groups-advance.{png,pdf}`.
