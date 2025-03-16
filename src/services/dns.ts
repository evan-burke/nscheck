import { promises as dns } from 'dns';
import {
  DnsResult,
  DnsLookupOptions,
  ValidationResult,
  ValidationError,
  DkimValidationResult,
  DmarcValidationResult,
  ConsistencyResult,
  ValidationSummary
} from '../types';

/**
 * DNS Resolver to query multiple DNS providers
 */
export class DnsResolver {
  private timeout: number;
  private providers: { [key: string]: string };

  constructor(options: DnsLookupOptions = {}) {
    this.timeout = options.timeout || 10000; // Default timeout of 10 seconds
    this.providers = {
      google: '8.8.8.8',
      cloudflare: '1.1.1.1',
      openDNS: '208.67.222.222'
      // Authoritative nameservers will be determined per domain
    };
  }

  /**
   * Query a specific DNS provider with timeout
   */
  async queryWithTimeout(domain: string, recordType: string, provider?: string): Promise<string[]> {
    const resolver = new dns.Resolver();
    
    if (provider) {
      resolver.setServers([provider]);
    }
    
    const timeoutPromise = new Promise<string[]>((_, reject) => {
      setTimeout(() => reject(new Error('DNS query timed out')), this.timeout);
    });
    
    try {
      // The actual DNS query
      const queryPromise = resolver.resolveTxt(domain);
      const result = await Promise.race([queryPromise, timeoutPromise]);
      return result.map(item => item.join(''));
    } catch (error) {
      if ((error as Error).message === 'DNS query timed out') {
        throw error;
      }
      // Return empty array for non-existent records to handle gracefully
      return [];
    }
  }

  /**
   * Get authoritative nameservers for a domain
   */
  private async getAuthoritativeNameservers(domain: string): Promise<string[]> {
    try {
      const nsRecords = await dns.resolveNs(domain);
      return nsRecords;
    } catch (error) {
      // If can't resolve NS records, try parent domain
      const parts = domain.split('.');
      if (parts.length > 2) {
        const parentDomain = parts.slice(1).join('.');
        return this.getAuthoritativeNameservers(parentDomain);
      }
      return [];
    }
  }

  /**
   * Query all configured DNS providers for a domain and record type
   */
  async queryAllProviders(domain: string, recordType: string, prefix?: string): Promise<DnsResult> {
    const fullDomain = prefix ? `${prefix}.${domain}` : domain;
    const result: any = {};
    
    // Query standard DNS providers
    const providerQueries = Object.entries(this.providers).map(async ([providerName, providerIp]) => {
      try {
        const records = await this.queryWithTimeout(fullDomain, recordType, providerIp);
        result[providerName] = { [fullDomain]: records };
      } catch (error) {
        result[providerName] = { [fullDomain]: [] };
      }
    });
    
    // Query authoritative nameservers
    const authNsRecords = await this.getAuthoritativeNameservers(domain);
    const authServer = authNsRecords.length > 0 ? authNsRecords[0] : null;
    
    if (authServer) {
      try {
        const records = await this.queryWithTimeout(fullDomain, recordType, authServer);
        result.authoritative = { [fullDomain]: records };
      } catch (error) {
        result.authoritative = { [fullDomain]: [] };
      }
    } else {
      result.authoritative = { [fullDomain]: [] };
    }
    
    await Promise.all(providerQueries);
    
    return result as DnsResult;
  }
}

/**
 * DKIM Validator to check DKIM records
 */
export class DkimValidator {
  /**
   * Validates DKIM records for a domain
   */
  validate(domain: string, records: Record<string, string[]>): DkimValidationResult {
    const result: DkimValidationResult = {
      isValid: false,
      errors: []
    };
    
    // Check for primary DKIM records (k2/k3)
    const k2Records = records[`k2._domainkey.${domain}`] || [];
    const k3Records = records[`k3._domainkey.${domain}`] || [];
    
    if (k2Records.length > 0 && k3Records.length > 0) {
      // Check if they point to correct destinations
      const k2Valid = k2Records.some(r => r.includes('dkim2.mcsv.net'));
      const k3Valid = k3Records.some(r => r.includes('dkim3.mcsv.net'));
      
      if (k2Valid && k3Valid) {
        result.isValid = true;
      } else if (k2Records.some(r => r.includes('dkim3.mcsv.net')) && 
                 k3Records.some(r => r.includes('dkim2.mcsv.net'))) {
        // Check for switched records
        result.errors.push({
          type: 'switchedRecords',
          message: 'DKIM records appear to be switched - k2 points to dkim3 and k3 points to dkim2'
        });
      } else {
        result.errors.push({
          type: 'incorrectDestination',
          message: 'DKIM records found but point to incorrect destinations'
        });
      }
    } else {
      // Check fallback (k1 record)
      const k1Records = records[`k1._domainkey.${domain}`] || [];
      
      if (k1Records.length > 0 && k1Records.some(r => r.includes('dkim.mcsv.net'))) {
        result.isValid = true;
      } else {
        // No valid DKIM setup found
        if (k2Records.length === 0 && k3Records.length === 0 && k1Records.length === 0) {
          result.errors.push({
            type: 'missingRecords',
            message: 'No DKIM records found'
          });
        } else {
          result.errors.push({
            type: 'invalidRecords',
            message: 'DKIM records found but are not configured correctly'
          });
        }
      }
    }
    
    return result;
  }

  /**
   * Check for common DKIM configuration errors
   */
  checkCommonErrors(domain: string, records: Record<string, string[]>): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: []
    };
    
    // Check for records published at www subdomain
    const wwwRecords = Object.keys(records).filter(k => 
      k.includes(`_domainkey.www.${domain}`)
    );
    
    if (wwwRecords.length > 0) {
      result.isValid = false;
      wwwRecords.forEach(record => {
        const correctRecord = record.replace(`www.${domain}`, domain);
        result.errors.push({
          type: 'wrongSubdomain',
          message: 'DKIM record published for incorrect subdomain',
          actual: record,
          expected: correctRecord
        });
      });
    }
    
    // Check for duplicate domain in record
    const duplicateDomainRecords = Object.keys(records).filter(k => 
      k.includes(`_domainkey.${domain}.${domain}`)
    );
    
    if (duplicateDomainRecords.length > 0) {
      result.isValid = false;
      duplicateDomainRecords.forEach(record => {
        const correctRecord = record.replace(`${domain}.${domain}`, domain);
        result.errors.push({
          type: 'duplicateDomain',
          message: 'DKIM record contains duplicate domain',
          actual: record,
          expected: correctRecord
        });
      });
    }
    
    return result;
  }
}

/**
 * DMARC Validator to check DMARC records
 */
export class DmarcValidator {
  /**
   * Validates DMARC records
   */
  validate(records: string[]): DmarcValidationResult {
    const result: DmarcValidationResult = {
      isValid: false,
      errors: []
    };
    
    // Filter records that contain v=DMARC1
    const dmarcRecords = records.filter(r => r.includes('v=DMARC1'));
    
    if (dmarcRecords.length === 0) {
      result.errors.push({
        type: 'missingRecord',
        message: 'No DMARC record found'
      });
      return result;
    }
    
    if (dmarcRecords.length > 1) {
      result.errors.push({
        type: 'multipleRecords',
        message: 'Multiple DMARC records found'
      });
      return result;
    }
    
    // We have exactly one DMARC record, validate it
    const dmarcRecord = dmarcRecords[0];
    
    // Validate policy
    const pMatch = dmarcRecord.match(/p=(reject|quarantine|none)/i);
    if (!pMatch) {
      result.errors.push({
        type: 'invalidSyntax',
        message: 'DMARC record missing required policy (p=) tag'
      });
      return result;
    }
    
    // Basic validation passed
    result.isValid = true;
    return result;
  }
}

/**
 * Analyzes results from multiple DNS providers for consistency
 */
export class ResultAnalyzer {
  /**
   * Check if DNS results are consistent across providers
   */
  checkConsistency(results: DnsResult): ConsistencyResult {
    const result: ConsistencyResult = {
      consistent: true,
      hasSuccessfulResults: false
    };
    
    // Get all unique record names across all providers
    const recordNames = new Set<string>();
    Object.values(results).forEach(providerResults => {
      Object.keys(providerResults).forEach(name => recordNames.add(name));
    });
    
    // Check each record for consistency
    for (const recordName of recordNames) {
      const recordValues = new Map<string, string>();
      let hasValidResults = false;
      
      // Collect values from each provider
      Object.entries(results).forEach(([provider, providerResults]) => {
        const value = JSON.stringify(providerResults[recordName] || []);
        recordValues.set(provider, value);
        
        // Check if we have any valid results
        if (providerResults[recordName] && providerResults[recordName].length > 0) {
          hasValidResults = true;
        }
      });
      
      // If we have any valid results for this record
      if (hasValidResults) {
        result.hasSuccessfulResults = true;
        
        // Check if all providers return the same value
        const uniqueValues = new Set(recordValues.values());
        if (uniqueValues.size > 1) {
          result.consistent = false;
        }
      }
    }
    
    return result;
  }

  /**
   * Validate all aspects of DNS results
   */
  validateResults(domain: string, results: DnsResult): ValidationSummary {
    // Initialize services
    const dkimValidator = new DkimValidator();
    const dmarcValidator = new DmarcValidator();
    
    // Normalize results into a single record set
    // Prefer records from authoritative nameserver if available
    const consolidatedRecords: Record<string, string[]> = {};
    
    // First, add all records from all providers
    Object.values(results).forEach(providerResults => {
      Object.entries(providerResults).forEach(([recordName, values]) => {
        if (!consolidatedRecords[recordName]) {
          consolidatedRecords[recordName] = [];
        }
        consolidatedRecords[recordName].push(...values);
      });
    });
    
    // Deduplicate records
    Object.keys(consolidatedRecords).forEach(key => {
      consolidatedRecords[key] = [...new Set(consolidatedRecords[key])];
    });
    
    // Validate DKIM
    const dkimResult = dkimValidator.validate(domain, consolidatedRecords);
    const dkimErrors = dkimValidator.checkCommonErrors(domain, consolidatedRecords);
    
    if (!dkimResult.isValid) {
      dkimResult.errors.push(...dkimErrors.errors);
    }
    
    // Validate DMARC
    const dmarcRecords = consolidatedRecords[`_dmarc.${domain}`] || [];
    const dmarcResult = dmarcValidator.validate(dmarcRecords);
    
    // Check consistency
    const consistencyResult = this.checkConsistency(results);
    
    // Overall validation result
    const isValid = dkimResult.isValid && dmarcResult.isValid && consistencyResult.consistent;
    
    return {
      isValid,
      dkim: dkimResult,
      dmarc: dmarcResult,
      consistency: consistencyResult
    };
  }
}

/**
 * Throttle requests by IP
 */
export class RequestThrottler {
  private defaultLimit: number;
  private overrides: Record<string, number>;
  private ipCounts: Map<string, { count: number, resetTime: number }>;
  
  constructor(defaultLimit: number = 30, overrides: Record<string, number> = {}) {
    this.defaultLimit = defaultLimit;
    this.overrides = overrides;
    this.ipCounts = new Map();
  }
  
  /**
   * Get the rate limit for a given IP
   */
  private getLimitForIp(ip: string): number {
    // Check if we have an override for this specific IP
    if (this.overrides[ip]) {
      return this.overrides[ip];
    }
    
    // Check for CIDR ranges (simplified implementation)
    // In a production app, you'd want a proper CIDR matcher
    const ipParts = ip.split('.');
    if (ipParts.length === 4) {
      // Check for Class C network override (e.g., 192.168.1.0/24)
      const classC = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.*`;
      if (this.overrides[classC]) {
        return this.overrides[classC];
      }
      
      // Could add Class B and Class A checks as well
    }
    
    return this.defaultLimit;
  }
  
  /**
   * Check if a request from a given IP is allowed
   */
  async checkAllowed(ip: string): Promise<boolean> {
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;
    const limit = this.getLimitForIp(ip);
    
    // Get or initialize tracking for this IP
    let ipTracking = this.ipCounts.get(ip);
    if (!ipTracking || ipTracking.resetTime < now) {
      // Reset if it's a new IP or the hour has passed
      ipTracking = { count: 0, resetTime: now + hourInMs };
      this.ipCounts.set(ip, ipTracking);
    }
    
    // Check if we're under the limit
    if (ipTracking.count < limit) {
      ipTracking.count++;
      return true;
    }
    
    return false;
  }
  
  /**
   * Reset counts for all IPs
   */
  resetAllCounts(): void {
    this.ipCounts.clear();
  }
}