// Minimal typings for Web NFC (Chrome on Android) and the Shape Detection BarcodeDetector,
// which TypeScript's DOM lib doesn't ship yet. Always feature-detect before use.

interface NDEFRecordInit {
  recordType: string;
  data?: string | BufferSource;
  mediaType?: string;
}

interface NDEFMessageInit {
  records: NDEFRecordInit[];
}

interface NDEFRecord {
  recordType: string;
  data?: DataView;
  encoding?: string;
}

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: { records: NDEFRecord[] };
}

declare class NDEFReader extends EventTarget {
  constructor();
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: NDEFMessageInit | string, options?: { signal?: AbortSignal; overwrite?: boolean }): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
  static getSupportedFormats(): Promise<string[]>;
}
