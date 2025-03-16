import { createMocks } from 'node-mocks-http';
import domainHandler from '../src/pages/api/domain';
import { RequestThrottler } from '../src/services/dns';

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
  // Mock the DNS resolver to avoid actual DNS lookups in tests
  jest.mock('../src/services/dns', () => {
    const originalModule = jest.requireActual('../src/services/dns');
    return {
      ...originalModule,
      DnsResolver: jest.fn().mockImplementation(() => ({
        queryAllProviders: jest.fn().mockResolvedValue({
          google: {
            'k2._domainkey.example.com': ['dkim2.mcsv.net'],
            'k3._domainkey.example.com': ['dkim3.mcsv.net'],
            '_dmarc.example.com': ['v=DMARC1; p=reject']
          },
          cloudflare: {
            'k2._domainkey.example.com': ['dkim2.mcsv.net'],
            'k3._domainkey.example.com': ['dkim3.mcsv.net'],
            '_dmarc.example.com': ['v=DMARC1; p=reject']
          },
          openDNS: {
            'k2._domainkey.example.com': ['dkim2.mcsv.net'],
            'k3._domainkey.example.com': ['dkim3.mcsv.net'],
            '_dmarc.example.com': ['v=DMARC1; p=reject']
          },
          authoritative: {
            'k2._domainkey.example.com': ['dkim2.mcsv.net'],
            'k3._domainkey.example.com': ['dkim3.mcsv.net'],
            '_dmarc.example.com': ['v=DMARC1; p=reject']
          }
        })
      }))
    };
  });
  
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
  // Mock the RequestThrottler
  jest.mock('../src/services/dns', () => {
    const originalModule = jest.requireActual('../src/services/dns');
    return {
      ...originalModule,
      RequestThrottler: jest.fn().mockImplementation(() => ({
        checkAllowed: jest.fn().mockResolvedValue(false)
      }))
    };
  });
  
  const { req, res } = createMocks({
    method: 'GET',
    query: { domain: 'example.com' },
    headers: { 'x-forwarded-for': '127.0.0.1' }
  });

  await domainHandler(req, res);

  expect(res._getStatusCode()).toBe(429);
  expect(JSON.parse(res._getData())).toEqual(
    expect.objectContaining({
      error: expect.stringContaining('rate limit')
    })
  );
});

test('domain API logs query results', async () => {
  // Mock the logging module
  const mockLogger = {
    log: jest.fn()
  };
  jest.mock('../src/services/logger', () => mockLogger);
  
  const { req, res } = createMocks({
    method: 'GET',
    query: { domain: 'example.com' },
    headers: { 'x-forwarded-for': '127.0.0.1' }
  });

  await domainHandler(req, res);
  
  expect(mockLogger.log).toHaveBeenCalled();
});