# Grocery Shop Billing

## Current State
Full-featured grocery billing app with backend sync, camera barcode scanner, bill printing/download/sharing, settings, manage menu, manage users, sales report, customer details. Settings has Bill Logo and Website Logo file inputs but no way to remove a chosen file/image. Item image in Manage Menu has a Remove Image button only when image preview is visible. Barcode scanner uses BarcodeDetector API (primary) and ZXing fallback; no sound feedback anywhere. No Sounds section exists.

## Requested Changes (Diff)

### Add
- **Remove button for every file/image input** wherever a "Choose File" control exists:
  - Settings > Bill Logo: show "Remove" button when billLogoBase64 is set
  - Settings > Website Logo: show "Remove" button when websiteLogoBase64 is set
  - Manage Menu > Add/Edit Item > Image upload: already has Remove Image (keep and ensure it also clears the file input)
- **Sounds section** in Settings page (new card section at the bottom, before the Save button area):
  - A `useSoundSystem` hook that generates tones/beeps using the Web Audio API (no external files needed) for: barcode scan success, item not found, login success, logout, payment success, done & close order, error/validation, add to cart
  - Sounds settings stored in localStorage under `groc_sounds` key
  - Settings section shows individual toggles per sound event, plus a master "Enable All Sounds" toggle
  - Global volume slider (0–100)
  - Each event row: name, description, test/preview button, enable/disable toggle
- **Barcode scanner improvements**:
  - Request higher camera resolution: `width: { ideal: 1920 }, height: { ideal: 1080 }` for better barcode recognition on PC/laptop
  - Increase ZXing reader hints: enable TRY_HARDER, set multiple barcode formats explicitly including CODE_128, EAN_13, EAN_8, UPC_A, UPC_E, DATA_MATRIX, ITF, CODABAR, CODE_39, CODE_93, QR_CODE, AZTEC, PDF_417
  - Add `videoConstraints` torch (flashlight) hint for mobile when available
  - Add a small "Scanning..." animated indicator below the viewfinder when camera is active
  - After a failed detection (item not found in menu), auto-reset `detectedRef` after 2 seconds so user can try again without closing dialog
  - Play barcode scan sound on success, play error sound on item-not-found

### Modify
- Settings page: add Remove buttons next to Bill Logo and Website Logo file inputs
- `BarcodeScannerModal`: play scan success sound; play error sound on not found; reset detectedRef after 2s on not-found so user can retry
- `BarcodeScannerForInput`: play scan success sound on detection
- `BillingPage`: play payment success sound on Pay Now success; play done/close sound on Done & Close; play add-to-cart sound when item is added to cart from search or camera
- `LoginPage`: play login sound on successful login
- Main App logout: play logout sound

### Remove
- Nothing removed

## Implementation Plan
1. Add `useSoundSystem` hook and `SoundSettings` interface
2. Add Sounds settings to localStorage with default values (all enabled, volume 80)
3. Add "Sounds" section card to Settings page with master toggle, volume slider, and per-event rows
4. Add Remove buttons for Bill Logo and Website Logo in Settings
5. Upgrade barcode scanner camera constraints and ZXing hints
6. Wire sound calls into login, logout, barcode scan, add-to-cart, payment, done/close, error events
7. Validate, fix any type errors
