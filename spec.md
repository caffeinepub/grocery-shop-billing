# Grocery Shop Billing

## Current State

The app has a barcode scanner built on QuaggaJS (CDN). The scanner:
- Uses `useBarcodeScanner` hook that wraps Quagga.init() inside a React Dialog portal
- Uses `active` prop to trigger a `startScanner` via a polling loop (retries 60 times, 50ms apart) waiting for the container div to appear in the DOM
- Reads the barcode value correctly from `data.codeResult.code` — no random number logic visible
- Has a camera view component (`ScannerCameraView`) with a scan line animation CSS
- Used in two places: `BarcodeScannerModal` (billing, adds item to cart) and `BarcodeScannerForInput` (add item barcode field)

Known issues based on user reports:
1. Quagga.init() fails silently or the camera stream does not attach to the video element when the Dialog portal mounts late
2. If init fails, the scanner does not retry — it just sets status to "error" and waits
3. The `scanline` CSS animation is defined inline via a `style` tag but the keyframe is NOT declared anywhere in the CSS — the green line is static
4. Quagga's frequency is 10 (10 Hz) which may be too slow; continuous scanning stops if Quagga enters an internal error state
5. Camera black screen: Quagga creates its own video element inside the container but the container may not be visible/sized when Quagga initialises, causing black output

## Requested Changes (Diff)

### Add
- CSS `@keyframes scanline` definition injected into the document at app startup so the animated green scan line works
- Auto-retry loop: if Quagga.init() fails, retry the entire init sequence automatically up to 3 times with 1s delay, showing "Camera initialization failed. Retrying..." to the user
- Continuous re-scan: after a failed decode attempt (no barcode found), automatically continue scanning without stopping (Quagga already does this by default if `onProcessed` is not used to stop it — ensure `stopScanner` is never called on a missed frame)
- `onProcessed` handler that keeps the scanning loop alive: if Quagga fires `onProcessed` with no valid result, do nothing (let it continue) rather than stopping
- Status text "Scanning Barcode..." with pulsing animation visible whenever camera is active

### Modify
- `useBarcodeScanner` hook:
  - Add retry loop (up to 3 attempts) around `Quagga.init()` — on failure, wait 1s then retry, showing retry message in status
  - Increase `frequency` from 10 to 15 (more decode attempts per second)
  - Ensure `Quagga.onDetected` callback uses `data.codeResult.code` directly (already correct, confirm and keep)
  - Add `Quagga.onProcessed` handler that does nothing on miss (explicitly suppresses any stop behavior)
  - After `Quagga.start()`, also set the video element's `autoplay`, `playsinline`, `muted` attributes and call `video.play()` to force playback on iOS/Android
  - On Quagga init error, update errorMsg to "Camera initialization failed. Retrying..." for the first 2 retries, then final error message on 3rd failure
- `ScannerCameraView`:
  - Add `<style>` tag injection via a `useEffect` to insert the `@keyframes scanline` CSS rule if it doesn't exist yet, ensuring the scan line always animates
  - Keep the scan line animation structure (top: 0, animation: scanline 2s ease-in-out infinite)

### Remove
- Nothing to remove — no random number generation was found in the current code (the reported issue is likely caused by scan line not animating and scanner getting stuck, making the UX appear broken)

## Implementation Plan

1. In `useBarcodeScanner` hook in App.tsx:
   - Wrap the `Quagga.init()` Promise inside a retry loop (maxRetries = 3)
   - On each retry failure, update `errorMsg` to "Camera initialization failed. Retrying..." and wait 1000ms before next attempt
   - After all retries exhausted, show final error
   - Increase `frequency` to 15
   - After `Quagga.start()`, find the video element and call `.play()` with catch
   - Add `Quagga.onProcessed(() => {})` — empty handler to prevent any internal stop

2. In `ScannerCameraView` component:
   - Add a one-time `useEffect` that injects `@keyframes scanline { 0%,100%{top:0%} 50%{top:calc(100% - 2px)} }` into a `<style>` tag in `document.head` if not already present

3. Verify barcode value path: confirm `data.codeResult.code` is used (it is) — add a console.log during dev to confirm, but no functional change needed here
