# Daily preview: preserve the reference person

## Diagnosis (2026-09-28)

The morning and evening crons call `generateFullLook()` in `services/tryon.ts`.
The old pipeline used two IDM-VTON passes, then sent the **entire person** to
Nano Banana to add shoes. Open/layered tops and IDM errors also triggered a
whole-person Nano Banana fallback. A text instruction to keep the face unchanged
did not constrain which pixels the model could redraw.

Comparing the stored `full-CM-07-PA-14-SO-11.png.body.png` and final image showed
changes in framing, proportions and facial appearance during the shoe pass.
The old cache key only contained garment IDs, so replacing the reference photo,
garment photos or generation logic did not invalidate previous results. A failed
shoe pass could also cache the body without the selected shoes as a finished look.

The reference actually used by production is `/api/base-photo`, a 768 × 1024
portrait. `assets/base-photo.jpg` is a different, headless photograph and must
not be used for identity. The production reference crops the feet at the ankles.

## Current behavior

- After each IDM-VTON pass, copy the original head pixels using the calibrated
  mask in `services/tryon-identity.ts`. Only the neck boundary blends; the face,
  glasses and hair are preserved. Reject outputs with a changed aspect ratio.
- The shoe model receives only the lower half of the image. Only pixels below
  row 870 can be merged into the result, with a 24-pixel transition. It cannot
  change the head or torso. Request an explicit `3:2` output: a real test with
  `match_input_image` returned a portrait crop and was rejected.
- No whole-person Nano Banana fallback. Open shirts, cardigans and other
  unsupported tops return no preview; the cron still delivers the outfit text.
- Cache keys include reference and garment **contents**, descriptions, pipeline
  version, model identifiers and identity-mask configuration. Legacy previews
  remain stored but are never selected by this pipeline.
- Save successful intermediate stages so retries can resume. Save `final.png`
  only after all requested edits succeed, including shoes.
- Bound provider polling, image downloads and Blob operations with an abort
  signal. Cancel known in-flight predictions when the deadline expires.
- Morning/evening functions enable Fluid Compute and allow 300 seconds, with
  at most 180 seconds allocated to rendering and time reserved for Slack.
  Other routes retain their existing 60-second limit.

This preserves identity for this fixed pose; it does not guarantee clothing fit,
shoe accuracy or seamless alignment on every generated result. The daily preview
currently renders top, bottom and shoes; outerwear remains in the outfit text.
Single-item legacy try-on endpoints are outside this daily-preview change.

## Replacing the reference

Use a sharp, front-facing, full-length photograph showing the entire head **and
feet**, arms slightly away from the torso, even lighting and a plain background.
Keep this canonical pose for every outfit.

Replace the bytes served by `/api/base-photo`, then recalibrate the SHA-256,
dimensions, head polygon, neck transition and shoe crop boundaries in
`IDENTITY_PROFILE`. Inspect representative tops and footwear before deploying.
The renderer deliberately refuses an unknown reference hash rather than applying
a head mask to the wrong location. Changing the reference URL alone is insufficient.

## Validation and rollout

```bash
cd wardrobe-knight
npm run typecheck
npm run test:tryon
```

Tests cover exact preservation of face/hair pixels, shoe isolation, changed
reference/garment cache invalidation, interrupted-stage resumption, missing
photos, unsupported garments, output framing and Replicate FileOutput handling.

Visual QA also applied head protection to the existing CM-07/PA-14 body render
and ran the isolated shoe edit against Replicate using the stored SO-11 product
reference. The landscape result was composited and visually reviewed locally.
This was a targeted image-pipeline check, not a new end-to-end cron invocation.

Deploy the code and `vercel.json` together to activate the correction for the
daily cron. Verify the reference is the intended person and inspect a preview
before relying on daily delivery. Do not manually invoke the morning cron just
to test rendering: it sends Slack messages and records the outfit as worn.

During local inspection, the existing `.env` / `.env.local` combination produced
an invalid `GOOGLE_SERVICE_ACCOUNT_JSON`. This prevented a complete local
Sheets → render → cron test; it does not establish a production configuration
failure. No Slack messages were sent during this investigation.

Provider references: [IDM-VTON API](https://replicate.com/cuuupid/idm-vton/api),
[Nano Banana API](https://replicate.com/google/nano-banana/api),
[Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration).
