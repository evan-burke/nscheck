import { DnsResolver, DkimValidator, DmarcValidator, ResultAnalyzer, RequestThrottler } from '../src/services/dns';

// DNS Resolution Service Tests
test('dnsClient resolves records from all configured DNS providers', async () => {
  const resolver = new DnsResolver();
  const results = await resolver.queryAllProviders('example.com', 'TXT', '_dmarc');
  expect(results.google).toBeDefined();
  expect(results.cloudflare).toBeDefined();
  expect(results.openDNS).toBeDefined();
  expect(results.authoritative).toBeDefined();
});

test('dnsClient respects timeout configuration', async () => {
  const resolver = new DnsResolver({ timeout: 5000 });
  const startTime = Date.now();
  await expect(resolver.queryWithTimeout('nonexistent-domain-12345.com', 'TXT')).rejects.toThrow();
  expect(Date.now() - startTime).toBeLessThan(6000);
});

// DKIM Validation Tests
test('validates correct DKIM CNAME records', () => {
  const validator = new DkimValidator();
  const records = {
    'k2._domainkey.example.com': ['dkim2.mcsv.net'],
    'k3._domainkey.example.com': ['dkim3.mcsv.net']
  };
  const result = validator.validate('example.com', records);
  expect(result.isValid).toBe(true);
});

test('validates fallback DKIM CNAME records', () => {
  const validator = new DkimValidator();
  const records = {
    'k1._domainkey.example.com': ['dkim.mcsv.net']
  };
  const result = validator.validate('example.com', records);
  expect(result.isValid).toBe(true);
});

test('detects switched DKIM CNAME records', () => {
  const validator = new DkimValidator();
  const records = {
    'k2._domainkey.example.com': ['dkim3.mcsv.net'],
    'k3._domainkey.example.com': ['dkim2.mcsv.net']
  };
  const result = validator.validate('example.com', records);
  expect(result.isValid).toBe(false);
  expect(result.errors[0].type).toBe('switchedRecords');
});

test('detects www subdomain DKIM publishing error', () => {
  const validator = new DkimValidator();
  const records = {
    'k2._domainkey.www.example.com': ['dkim2.mcsv.net']
  };
  const result = validator.checkCommonErrors('example.com', records);
  expect(result.errors[0].type).toBe('wrongSubdomain');
});

test('detects duplicate domain DKIM publishing error', () => {
  const validator = new DkimValidator();
  const records = {
    'k2._domainkey.example.com.example.com': ['dkim2.mcsv.net']
  };
  const result = validator.checkCommonErrors('example.com', records);
  expect(result.errors[0].type).toBe('duplicateDomain');
});

// DMARC Validation Tests
test('validates correct DMARC record', () => {
  const validator = new DmarcValidator();
  const records = ['v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s; fo=1; rua=mailto:dmarc@example.com'];
  const result = validator.validate(records);
  expect(result.isValid).toBe(true);
});

test('detects multiple DMARC records', () => {
  const validator = new DmarcValidator();
  const records = [
    'v=DMARC1; p=reject; rua=mailto:dmarc@example.com',
    'v=DMARC1; p=none; rua=mailto:dmarc2@example.com'
  ];
  const result = validator.validate(records);
  expect(result.isValid).toBe(false);
  expect(result.errors[0].type).toBe('multipleRecords');
});

test('detects invalid DMARC syntax', () => {
  const validator = new DmarcValidator();
  const records = ['v=DMARC1; p=invalid; rua=mailto:dmarc@example.com'];
  const result = validator.validate(records);
  expect(result.isValid).toBe(false);
  expect(result.errors[0].type).toBe('invalidSyntax');
});

// DNS Result Consistency Tests
test('detects inconsistent DNS results between providers', () => {
  const analyzer = new ResultAnalyzer();
  const results = {
    google: { 'k2._domainkey.example.com': ['dkim2.mcsv.net'] },
    cloudflare: { 'k2._domainkey.example.com': ['dkim2.mcsv.net'] },
    openDNS: { 'k2._domainkey.example.com': [] },
    authoritative: { 'k2._domainkey.example.com': ['dkim2.mcsv.net'] }
  };
  const analysis = analyzer.checkConsistency(results);
  expect(analysis.consistent).toBe(false);
  expect(analysis.hasSuccessfulResults).toBe(true);
});

// Throttling Tests
test('respects per-IP throttling limits', async () => {
  const throttler = new RequestThrottler(30); // 30 requests per hour
  const ip = '192.168.1.1';
  
  // Simulate 30 requests
  for (let i = 0; i < 30; i++) {
    expect(await throttler.checkAllowed(ip)).toBe(true);
  }
  
  // 31st request should be blocked
  expect(await throttler.checkAllowed(ip)).toBe(false);
});

test('allows overriding throttling limits for specific IPs', async () => {
  const throttler = new RequestThrottler(30, { '192.168.1.2': 50 });
  const ip = '192.168.1.2';
  
  // Simulate 40 requests (over default but under override)
  for (let i = 0; i < 40; i++) {
    expect(await throttler.checkAllowed(ip)).toBe(true);
  }
  
  // Still allowed
  expect(await throttler.checkAllowed(ip)).toBe(true);
  
  // Simulate 10 more requests
  for (let i = 0; i < 10; i++) {
    expect(await throttler.checkAllowed(ip)).toBe(true);
  }
  
  // 51st request should be blocked
  expect(await throttler.checkAllowed(ip)).toBe(false);
});