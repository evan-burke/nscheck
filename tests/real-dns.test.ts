// Real DNS lookup tests for inboxengineering.com
// These tests use actual DNS queries to verify the configuration

import { DnsResolver, DkimValidator, DmarcValidator, ResultAnalyzer } from '../src/services/dns';

// Skip these tests in CI environments if needed (they make real network requests)
const shouldRunRealDnsTests = process.env.SKIP_REAL_DNS_TESTS !== 'true';
const testOrSkip = shouldRunRealDnsTests ? test : test.skip;

// Common test timeout for DNS lookups (increased from default because real DNS can be slow)
const TEST_TIMEOUT = 15000;

// Domains for testing
const VALID_DOMAIN = 'inboxengineering.com';
const WWW_ERROR_DOMAIN = 'email-delivery.org';

// Test with real DNS resolution against a valid domain
testOrSkip('can resolve real DKIM records for a valid domain', async () => {
  const resolver = new DnsResolver({ timeout: 10000 });
  
  // Query k2 DKIM record
  const k2Results = await resolver.queryAllProviders(VALID_DOMAIN, 'CNAME', 'k2._domainkey');
  
  // Check that we got results from at least Google and Cloudflare
  expect(k2Results.google[`k2._domainkey.${VALID_DOMAIN}`]).toBeDefined();
  expect(k2Results.cloudflare[`k2._domainkey.${VALID_DOMAIN}`]).toBeDefined();
  
  // Check actual content (should be dkim2.mcsv.net)
  expect(k2Results.google[`k2._domainkey.${VALID_DOMAIN}`][0]).toBe('dkim2.mcsv.net');
  expect(k2Results.cloudflare[`k2._domainkey.${VALID_DOMAIN}`][0]).toBe('dkim2.mcsv.net');
  
  // Check that authoritative nameserver result is present
  // Note: We can't guarantee which authoritative nameserver will be used or if it will respond,
  // so we'll just check that the structure is correct
  expect(k2Results.authoritative).toBeDefined();
  expect(k2Results.authoritative.authoritativeServers).toBeDefined();
  
  // Verify authoritativeServers is included
  expect(k2Results.authoritative.authoritativeServers).toBeDefined();
  expect(Array.isArray(k2Results.authoritative.authoritativeServers)).toBe(true);
}, TEST_TIMEOUT);

testOrSkip('can resolve real DMARC records for a valid domain', async () => {
  const resolver = new DnsResolver({ timeout: 10000 });
  
  // Query DMARC record
  const dmarcResults = await resolver.queryAllProviders(VALID_DOMAIN, 'TXT', '_dmarc');
  
  // Check that we got results from at least Google and Cloudflare
  expect(dmarcResults.google[`_dmarc.${VALID_DOMAIN}`]).toBeDefined();
  expect(dmarcResults.cloudflare[`_dmarc.${VALID_DOMAIN}`]).toBeDefined();
  
  // Check that the records contain v=DMARC1
  expect(dmarcResults.google[`_dmarc.${VALID_DOMAIN}`][0]).toContain('v=DMARC1');
  expect(dmarcResults.cloudflare[`_dmarc.${VALID_DOMAIN}`][0]).toContain('v=DMARC1');
  
  // Check that authoritative nameserver structure is present
  // Note: We can't guarantee which authoritative nameserver will be used or if it will respond
  expect(dmarcResults.authoritative).toBeDefined();
  expect(dmarcResults.authoritative.authoritativeServers).toBeDefined();
}, TEST_TIMEOUT);

testOrSkip('can validate complete configuration for a valid domain', async () => {
  const resolver = new DnsResolver({ timeout: 10000 });
  const analyzer = new ResultAnalyzer();
  
  // Get all records
  const k1Results = await resolver.queryAllProviders(VALID_DOMAIN, 'CNAME', 'k1._domainkey');
  const k2Results = await resolver.queryAllProviders(VALID_DOMAIN, 'CNAME', 'k2._domainkey');
  const k3Results = await resolver.queryAllProviders(VALID_DOMAIN, 'CNAME', 'k3._domainkey');
  const dmarcResults = await resolver.queryAllProviders(VALID_DOMAIN, 'TXT', '_dmarc');
  
  // Combine all results for analysis
  const results = {
    google: {
      ...k1Results.google,
      ...k2Results.google,
      ...k3Results.google,
      ...dmarcResults.google
    },
    cloudflare: {
      ...k1Results.cloudflare,
      ...k2Results.cloudflare,
      ...k3Results.cloudflare,
      ...dmarcResults.cloudflare
    },
    openDNS: {
      ...k1Results.openDNS,
      ...k2Results.openDNS,
      ...k3Results.openDNS,
      ...dmarcResults.openDNS
    },
    authoritative: {
      ...k1Results.authoritative,
      ...k2Results.authoritative,
      ...k3Results.authoritative,
      ...dmarcResults.authoritative,
      // Preserve the last authoritative server info
      authoritativeServer: dmarcResults.authoritative.authoritativeServer,
      authoritativeServers: dmarcResults.authoritative.authoritativeServers
    }
  };
  
  // Validate the configuration
  const validation = await analyzer.validateResults(VALID_DOMAIN, results);
  
  // In real world tests, we can't guarantee all providers will be consistent
  // So we're just checking the structure and that we got results
  expect(validation).toBeDefined();
  expect(validation.dkim).toBeDefined();
  expect(validation.dmarc).toBeDefined();
  expect(validation.consistency).toBeDefined();
  expect(validation.consistency.hasSuccessfulResults).toBe(true);
  
  // Log validation results for debugging
  console.log("DKIM validation:", validation.dkim);
  console.log("DMARC validation:", validation.dmarc);
  console.log("Consistency validation:", validation.consistency);
}, TEST_TIMEOUT);

testOrSkip('can get authoritative nameservers for a valid domain', async () => {
  const resolver = new DnsResolver();
  
  // Use the private method via function call hack (for testing)
  const getAuthNS = (resolver as any).getAuthoritativeNameservers.bind(resolver);
  const nsRecords = await getAuthNS(VALID_DOMAIN);
  
  // Should get at least one nameserver
  expect(Array.isArray(nsRecords)).toBe(true);
  expect(nsRecords.length).toBeGreaterThan(0);
  
  // Nameservers should be strings
  nsRecords.forEach(ns => {
    expect(typeof ns).toBe('string');
    expect(ns.length).toBeGreaterThan(0);
  });
}, TEST_TIMEOUT);

// Test to detect records published at www subdomain
testOrSkip('can detect records published at www subdomain for email-delivery.org', async () => {
  const resolver = new DnsResolver({ timeout: 10000 });
  const analyzer = new ResultAnalyzer();
  const dkimValidator = new DkimValidator();
  
  // Check for DKIM records published at www
  const normalK2Results = await resolver.queryAllProviders(WWW_ERROR_DOMAIN, 'CNAME', 'k2._domainkey');
  const wwwDomain = `www.${WWW_ERROR_DOMAIN}`;
  const wwwK2Results = await resolver.queryAllProviders(wwwDomain, 'CNAME', 'k2._domainkey');
  
  // Check expected behavior: normal records don't exist, www records do exist
  expect(normalK2Results.google[`k2._domainkey.${WWW_ERROR_DOMAIN}`].length).toBe(0);
  
  // The www version should return records (if not, the test domain may have been fixed)
  const wwwRecordPath = `k2._domainkey.${wwwDomain}`;
  
  // Create combined result set to check
  const consolidatedRecords: Record<string, string[]> = {};
  
  // Add records from all providers for the "www" version
  Object.values(wwwK2Results).forEach(providerResults => {
    Object.entries(providerResults).forEach(([recordName, values]) => {
      // Skip metadata fields
      if (recordName === 'authoritativeServer' || 
          recordName === 'authoritativeServers' ||
          !Array.isArray(values)) {
        return;
      }
      
      if (!consolidatedRecords[recordName]) {
        consolidatedRecords[recordName] = [];
      }
      consolidatedRecords[recordName].push(...values);
    });
  });
  
  // Check for the error
  const commonErrorCheck = dkimValidator.checkCommonErrors(WWW_ERROR_DOMAIN, consolidatedRecords);
  
  // Log validation results
  console.log("WWW subdomain error check:", commonErrorCheck);
  
  // If records exist at www, error detection should work
  if (Object.keys(consolidatedRecords).some(k => k.includes(`k2._domainkey.${wwwDomain}`)) && 
      wwwK2Results.google[wwwRecordPath] && 
      wwwK2Results.google[wwwRecordPath].length > 0) {
    
    expect(commonErrorCheck.isValid).toBe(false);
    expect(commonErrorCheck.errors.length).toBeGreaterThan(0);
    expect(commonErrorCheck.errors[0].type).toBe('wrongSubdomain');
    expect(commonErrorCheck.errors[0].actual).toContain('www');
    expect(commonErrorCheck.errors[0].expected).not.toContain('www');
    
    // Verify the expected correction message is appropriate
    console.log("Found record:", wwwK2Results.google[wwwRecordPath][0]);
    console.log("Actual record location:", commonErrorCheck.errors[0].actual);
    console.log("Expected record location:", commonErrorCheck.errors[0].expected);
  } else {
    console.log("No www subdomain records found - the domain may have been fixed");
  }
}, TEST_TIMEOUT);