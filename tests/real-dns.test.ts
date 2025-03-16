// Real DNS lookup tests for inboxengineering.com
// These tests use actual DNS queries to verify the configuration

import { DnsResolver, DkimValidator, DmarcValidator, ResultAnalyzer } from '../src/services/dns';

// Skip these tests in CI environments if needed (they make real network requests)
const shouldRunRealDnsTests = process.env.SKIP_REAL_DNS_TESTS !== 'true';
const testOrSkip = shouldRunRealDnsTests ? test : test.skip;

// Common test timeout for DNS lookups (increased from default because real DNS can be slow)
const TEST_TIMEOUT = 15000;

// Domain to test that we know has correct configuration
const TEST_DOMAIN = 'inboxengineering.com';

// Test with real DNS resolution against inboxengineering.com
testOrSkip('can resolve real DKIM records for inboxengineering.com', async () => {
  const resolver = new DnsResolver({ timeout: 10000 });
  
  // Query k2 DKIM record
  const k2Results = await resolver.queryAllProviders(TEST_DOMAIN, 'CNAME', 'k2._domainkey');
  
  // Check that we got results from at least Google and Cloudflare
  expect(k2Results.google[`k2._domainkey.${TEST_DOMAIN}`]).toBeDefined();
  expect(k2Results.cloudflare[`k2._domainkey.${TEST_DOMAIN}`]).toBeDefined();
  
  // Check actual content (should be dkim2.mcsv.net)
  expect(k2Results.google[`k2._domainkey.${TEST_DOMAIN}`][0]).toBe('dkim2.mcsv.net');
  expect(k2Results.cloudflare[`k2._domainkey.${TEST_DOMAIN}`][0]).toBe('dkim2.mcsv.net');
  
  // Check that authoritative nameserver result is present
  // Note: We can't guarantee which authoritative nameserver will be used or if it will respond,
  // so we'll just check that the structure is correct
  expect(k2Results.authoritative).toBeDefined();
  expect(k2Results.authoritative.authoritativeServers).toBeDefined();
  
  // Verify authoritativeServers is included
  expect(k2Results.authoritative.authoritativeServers).toBeDefined();
  expect(Array.isArray(k2Results.authoritative.authoritativeServers)).toBe(true);
}, TEST_TIMEOUT);

testOrSkip('can resolve real DMARC records for inboxengineering.com', async () => {
  const resolver = new DnsResolver({ timeout: 10000 });
  
  // Query DMARC record
  const dmarcResults = await resolver.queryAllProviders(TEST_DOMAIN, 'TXT', '_dmarc');
  
  // Check that we got results from at least Google and Cloudflare
  expect(dmarcResults.google[`_dmarc.${TEST_DOMAIN}`]).toBeDefined();
  expect(dmarcResults.cloudflare[`_dmarc.${TEST_DOMAIN}`]).toBeDefined();
  
  // Check that the records contain v=DMARC1
  expect(dmarcResults.google[`_dmarc.${TEST_DOMAIN}`][0]).toContain('v=DMARC1');
  expect(dmarcResults.cloudflare[`_dmarc.${TEST_DOMAIN}`][0]).toContain('v=DMARC1');
  
  // Check that authoritative nameserver structure is present
  // Note: We can't guarantee which authoritative nameserver will be used or if it will respond
  expect(dmarcResults.authoritative).toBeDefined();
  expect(dmarcResults.authoritative.authoritativeServers).toBeDefined();
}, TEST_TIMEOUT);

testOrSkip('can validate complete inboxengineering.com configuration', async () => {
  const resolver = new DnsResolver({ timeout: 10000 });
  const analyzer = new ResultAnalyzer();
  
  // Get all records
  const k1Results = await resolver.queryAllProviders(TEST_DOMAIN, 'CNAME', 'k1._domainkey');
  const k2Results = await resolver.queryAllProviders(TEST_DOMAIN, 'CNAME', 'k2._domainkey');
  const k3Results = await resolver.queryAllProviders(TEST_DOMAIN, 'CNAME', 'k3._domainkey');
  const dmarcResults = await resolver.queryAllProviders(TEST_DOMAIN, 'TXT', '_dmarc');
  
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
  const validation = analyzer.validateResults(TEST_DOMAIN, results);
  
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

testOrSkip('can get authoritative nameservers for inboxengineering.com', async () => {
  const resolver = new DnsResolver();
  
  // Use the private method via function call hack (for testing)
  const getAuthNS = (resolver as any).getAuthoritativeNameservers.bind(resolver);
  const nsRecords = await getAuthNS(TEST_DOMAIN);
  
  // Should get at least one nameserver
  expect(Array.isArray(nsRecords)).toBe(true);
  expect(nsRecords.length).toBeGreaterThan(0);
  
  // Nameservers should be strings
  nsRecords.forEach(ns => {
    expect(typeof ns).toBe('string');
    expect(ns.length).toBeGreaterThan(0);
  });
}, TEST_TIMEOUT);