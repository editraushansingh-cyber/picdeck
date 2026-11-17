# Upload compression and signup design

## Intent

Let a studio choose how raster photographs are stored in its Google Drive at upload time, while replacing all public 14-day-trial language and behaviour with a straightforward free account signup.

## Decisions

- The event upload panel has one clearly labelled storage-quality selector: Original (100%), High (50%), Medium (30%), and Small (20%). The selected setting applies to the batch currently being uploaded.
- Original uploads preserve the exact file. The compressed choices convert supported raster images to JPEG in the browser before the existing resumable Drive upload begins. They use the selected JPEG encoder quality and keep the image dimensions; this avoids misleading size guarantees and keeps Drive uploads within the existing direct-upload architecture.
- RAW files always remain original, with an explicit notice; browser compression must never destroy camera RAW data. If an image cannot be decoded by the browser, it is uploaded unchanged and the user is told why.
- The progress area distinguishes preparation/compression from Drive upload, then retains the existing per-file/batch progress and error reporting.
- New users receive the existing Free plan without a trial expiry. `Subscription.endsAt` becomes nullable to represent an ongoing free subscription; active subscription lookup accepts a null end date. Existing paid/trial records retain their end dates.
- Public pages, metadata, dashboard plan badge, and terms use account/free-plan language and do not promise or describe a trial.

## Out of scope

- No server-side original archive is added for compressed uploads.
- No changes to Google Drive OAuth, Drive folder ownership, payment collection, paid-plan rules, or existing historical subscriptions.
- No claim that a percentage produces an exact percentage file-size reduction.

## Constraints

- Google Drive remains the photo store in production; Supabase Storage is not used for photo originals.
- A selection of 100% means the source file is uploaded unchanged.
- Database changes use a new forward-only Prisma migration; the committed provider remains PostgreSQL.
- The feature must remain usable in local-storage development, even though client-side compression happens before either storage path.
