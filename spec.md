# Grocery Shop Billing

## Current State
Full-featured grocery billing app with LocalStorage persistence. Billing page has:
- Item search by name/barcode (text input)
- A camera button that opens a modal, but the modal only shows "Camera scanning coming soon" placeholder text
- Cart management, payment, bill preview/print/download
- Camera component (`useCamera.ts`) and QR scanner (`useQRScanner.ts`) are already installed but not wired into billing

The `useQRScanner` hook uses `jsQR` which reads QR codes only. Grocery items use EAN-13/UPC barcodes so a different library is needed.

## Requested Changes (Diff)

### Add
- Live device camera barcode scanner in the billing page camera modal
- Uses `@zxing/library` (or dynamically loaded ZXing CDN) to decode EAN-13, EAN-8, UPC-A, UPC-E, Code128, Code39, QR barcodes from camera video stream
- `BarcodeScannerModal` component that:
  - Opens device camera (rear-facing by default) using `useCamera` hook
  - Continuously scans video frames for barcodes using ZXing BrowserMultiFormatReader
  - On successful decode: looks up barcode in menuItems, adds matching item to cart, shows toast, closes modal automatically
  - If barcode not found: shows "Item not found for barcode [xxx]" toast, keeps scanning
  - Shows a green scanning overlay/crosshair on the video
  - Has a "Switch Camera" button (front/rear toggle)
  - Has a "Close" button to dismiss
  - Shows loading state while camera initializes
  - Shows error state if camera permission is denied
- Also add an "Upload Barcode Image" tab in the modal so the user can pick a photo from their device gallery instead of using live camera — this image is decoded with ZXing too

### Modify
- Replace the existing camera modal placeholder in `BillingPage` (`showCameraModal` dialog) with the new `BarcodeScannerModal` component
- Import and install `@zxing/library` package

### Remove
- The "Camera scanning coming soon" placeholder text and Camera icon placeholder in the modal

## Implementation Plan
1. Install `@zxing/library` in `src/frontend/package.json` dependencies
2. Create `BarcodeScannerModal` component inside `App.tsx` (or as a separate file) that:
   - Uses `useCamera` hook for video stream management
   - Uses `BrowserMultiFormatReader` from `@zxing/library` for barcode decoding on each animation frame
   - Has two tabs: "Scan with Camera" and "Upload Image"
   - Camera tab: shows live video with scanning overlay, auto-adds item on successful scan
   - Upload tab: file input for image, decodes on selection, auto-adds matching item
3. Wire `BarcodeScannerModal` into `BillingPage` replacing the old camera modal
4. Pass `menuItems` and `addToCart` callback into the modal
5. Typecheck and build
