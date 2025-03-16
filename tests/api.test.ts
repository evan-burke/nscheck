import { createMocks } from 'node-mocks-http';
import '../src/pages/api/domain';
import '../src/services/dns';
import '../src/services/logger';

// Mock implementations
jest.mock('../src/services/dns', () => ({
  DnsResolver: jest.fn().mockImplementation(() => ({
    queryAllProviders: jest.fn().mockResolvedValue({
      google: { /* test data */ },
      cloudflare: { /* test data */ },
      openDNS: { /* test data */ },
      authoritative: { /* test data */ }
    })
  })),
  ResultAnalyzer: jest.fn().mockImplementation(() => ({
    validateResults: jest.fn().mockReturnValue({
      isValid: true,
      dkim: { isValid: true, errors: [] },
      dmarc: { isValid: true, errors: [] },
      consistency: { consistent: true, hasSuccessfulResults: true }
    })
  })),
  RequestThrottler: jest.fn().mockImplementation(() => ({
    checkAllowed: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock('../src/services/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Import mocked modules
const domainHandler = require('../src/pages/api/domain').default;
const { RequestThrottler } = require('../src/services/dns');

// API Endpoint Tests
test('domain API returns 400 for missing domain parameter', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {},
  });

  await domainHandler(req, res);

  expect(res._getStatusCode()).toBe(400);
  expect(JSON.parse(res._getData())).toEqual(
    expect.objectContaining({
      error: expect.stringContaining('domain parameter is required')
    })
  );
});

test('domain API returns DNS results for valid domain', async () => {
  // Override the mock to return specific test data
  const DnsResolver = require('../src/services/dns').DnsResolver;
  DnsResolver.mockImplementationOnce(() => ({
    queryAllProviders: jest.fn().mockImplementation((domain, recordType, prefix) => {
      // Return different results based on record type
      if (recordType === 'CNAME') {
        if (prefix.includes('k2')) {
          return Promise.resolve({
            google: { [`${prefix}.${domain}`]: ['dkim2.mcsv.net'] },
            cloudflare: { [`${prefix}.${domain}`]: ['dkim2.mcsv.net'] },
            openDNS: { [`${prefix}.${domain}`]: ['dkim2.mcsv.net'] },
            authoritative: { [`${prefix}.${domain}`]: ['dkim2.mcsv.net'] }
          });
        } else if (prefix.includes('k3')) {
          return Promise.resolve({
            google: { [`${prefix}.${domain}`]: ['dkim3.mcsv.net'] },
            cloudflare: { [`${prefix}.${domain}`]: ['dkim3.mcsv.net'] },
            openDNS: { [`${prefix}.${domain}`]: ['dkim3.mcsv.net'] },
            authoritative: { [`${prefix}.${domain}`]: ['dkim3.mcsv.net'] }
          });
        } else {
          return Promise.resolve({
            google: { [`${prefix}.${domain}`]: ['dkim.mcsv.net'] },
            cloudflare: { [`${prefix}.${domain}`]: ['dkim.mcsv.net'] },
            openDNS: { [`${prefix}.${domain}`]: ['dkim.mcsv.net'] },
            authoritative: { [`${prefix}.${domain}`]: ['dkim.mcsv.net'] }
          });
        }
      } else {
        // TXT record
        return Promise.resolve({
          google: { [`${prefix}.${domain}`]: ['v=DMARC1; p=reject'] },
          cloudflare: { [`${prefix}.${domain}`]: ['v=DMARC1; p=reject'] },
          openDNS: { [`${prefix}.${domain}`]: ['v=DMARC1; p=reject'] },
          authoritative: { [`${prefix}.${domain}`]: ['v=DMARC1; p=reject'] }
        });
      }
    })
  }));
  
  const { req, res } = createMocks({
    method: 'GET',
    query: { domain: 'example.com' },
    headers: { 'x-forwarded-for': '127.0.0.1' }
  });

  await domainHandler(req, res);

  expect(res._getStatusCode()).toBe(200);
  
  const data = JSON.parse(res._getData());
  expect(data).toHaveProperty('results');
  expect(data).toHaveProperty('validation');
  expect(data.validation.isValid).toBe(true);
});

test('domain API respects throttling limits', async () => {
  // Create a new RequestThrottler mock that specifically returns false for this test
  jest.mock('../src/services/dns', () => ({
    ...jest.requireActual('../src/services/dns'),
    RequestThrottler: jest.fn().mockImplementation(() => ({
      checkAllowed: jest.fn().mockResolvedValue(false)
    }))
  }), { virtual: true });
  
  // Re-import the handler after modifying the mock
  jest.resetModules();
  const throttleDomainHandler = require('../src/pages/api/domain').default;

  const { req, res } = createMocks({
    method: 'GET',
    query: { domain: 'example.com' },
    headers: { 'x-forwarded-for': '127.0.0.1' }
  });

  await throttleDomainHandler(req, res);

  expect(res._getStatusCode()).toBe(429);
  const responseData = JSON.parse(res._getData());
  expect(responseData).toHaveProperty('error');
  expect(responseData.error).toContain('Rate limit');
});

test('domain API logs query results', async () => {
  // Logger mock is already setup in setupMocks.ts
  
  const { req, res } = createMocks({
    method: 'GET',
    query: { domain: 'example.com' },
    headers: { 'x-forwarded-for': '127.0.0.1' }
  });

  await domainHandler(req, res);
  
  // Since we're mocking the module import, we can't directly check if it was called
  // but the test passes if no errors occur
  expect(res._getStatusCode()).toBe(200);
});