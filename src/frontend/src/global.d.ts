// Ambient module declarations for packages loaded via CDN / dynamic import
declare module "@zxing/library" {
  export enum BarcodeFormat {
    EAN_13,
    EAN_8,
    CODE_128,
    CODE_39,
    CODE_93,
    UPC_A,
    UPC_E,
    QR_CODE,
    DATA_MATRIX,
    AZTEC,
    PDF_417,
    CODABAR,
    ITF,
  }

  export enum DecodeHintType {
    TRY_HARDER,
    POSSIBLE_FORMATS,
  }

  export class NotFoundException extends Error {}

  export class BrowserMultiFormatReader {
    constructor(
      hints?: Map<DecodeHintType, unknown>,
      timeBetweenScansMillis?: number,
    );
    decodeFromConstraints(
      constraints: MediaStreamConstraints,
      videoSource: string | HTMLVideoElement,
      callback: (result: Result | null, error: Error | null) => void,
    ): Promise<void>;
    decodeFromVideoDevice(
      deviceId: string | null,
      videoSource: string | HTMLVideoElement,
      callback: (result: Result | null, error: Error | null) => void,
    ): Promise<void>;
    decodeFromStream(
      stream: MediaStream,
      videoSource: string | HTMLVideoElement,
      callback: (result: Result | null, error: Error | null) => void,
    ): Promise<void>;
    decodeFromImageUrl(url: string): Promise<Result>;
    decodeFromImageElement(element: HTMLImageElement): Promise<Result>;
    reset(): void;
    stopContinuousDecode(): void;
  }

  export interface Result {
    getText(): string;
  }
}

declare module "qrcode" {
  export interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
  }
  function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions,
  ): Promise<string>;
  export default { toDataURL };
}

declare module "html-to-image" {
  export function toPng(
    node: HTMLElement,
    options?: Record<string, unknown>,
  ): Promise<string>;
  export function toJpeg(
    node: HTMLElement,
    options?: Record<string, unknown>,
  ): Promise<string>;
  export function toBlob(
    node: HTMLElement,
    options?: Record<string, unknown>,
  ): Promise<Blob | null>;
  export function toSvg(
    node: HTMLElement,
    options?: Record<string, unknown>,
  ): Promise<string>;
}
