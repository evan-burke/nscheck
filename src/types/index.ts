export interface DnsLookupOptions {
  timeout?: number;
}

export interface DnsProviderResult {
  [key: string]: string[] | string | null | undefined;
  authoritativeServer?: string | null;
  authoritativeServers?: string[];
}

export interface DnsResult {
  google: Record<string, string[]>;
  cloudflare: Record<string, string[]>;
  openDNS: Record<string, string[]>;
  authoritative: DnsProviderResult;
  [key: string]: Record<string, string[]> | DnsProviderResult;
}

export interface ValidationError {
  type: string;
  message: string;
  actual?: string;
  expected?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface DkimValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface DmarcValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  usingRootDomain?: string;
  rootDmarcRecords?: string[];
  originalDomain?: string;
}

export interface ConsistencyResult {
  consistent: boolean;
  hasSuccessfulResults: boolean;
}

export interface ValidationSummary {
  isValid: boolean;
  dkim: DkimValidationResult;
  dmarc: DmarcValidationResult;
  consistency: ConsistencyResult;
}

export interface LogEntry {
  timestamp?: string;
  domain: string;
  success: boolean;
  results?: Record<string, any>;
  ip?: string;
  errors?: ValidationError[];
}

export interface LoggerOptions {
  logDir: string;
  logFile?: string;
  enableFileLogging?: boolean;
}

export interface RequestThrottlerOptions {
  defaultLimit: number;
  overrides?: Record<string, number>;
}