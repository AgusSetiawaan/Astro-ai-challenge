export interface Frame {
  class: string;
  method: string;
  file?: string;
  line?: number;
  obfuscated: boolean;
}

export interface RawCrash {
  exception: string;
  message: string;
  thread?: string;
  frames: Frame[];
  cause?: RawCrash;
}

export interface DeobfCrash extends RawCrash {
  mappingApplied: boolean;
  cause?: DeobfCrash;
}

export type FrameKind = 'app' | 'framework' | 'os' | 'coroutine' | 'native';

export interface ClassifiedFrame extends Frame {
  kind: FrameKind;
}

export type Severity = 'sev1' | 'sev2' | 'sev3';
export type Confidence = 'high' | 'med' | 'low';

export interface TicketDraft {
  title: string;
  severity: Severity;
  labels: string[];
  summary: string;
  suspectedCause: string;
  reproGuess: string;
  topAppFrame?: ClassifiedFrame;
  confidence: Confidence;
}

export interface MappingEntry {
  obfuscatedClass: string;
  originalClass: string;
  methods: Map<string, string>; // obfuscatedMethod → originalMethod
}
export type MappingTable = Map<string, MappingEntry>;

export type CrashFormat = 'logcat' | 'crashlytics' | 'vitals' | 'unknown';
