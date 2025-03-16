# NSCheck

A simple DNS checking application for validating DKIM and DMARC records. This app helps ensure proper email authentication configuration by checking:

- DKIM records (k1, k2, k3) for proper CNAME configuration
- DMARC records for validity and uniqueness
- Record propagation across multiple DNS providers
- Common configuration errors and how to fix them

## Setup and Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Running the Application

Development mode:
```bash
npm run dev
```

Build and run in production mode:
```bash
npm run build
npm run start
```

## Testing

The test suite uses Jest and React Testing Library. Since actual DNS resolution and filesystem operations should be avoided in tests, you should use jest.mock() to create appropriate mocks for your tests.


Run all tests:
```bash
npm run test
```

Run specific tests:
```bash
# Test a specific file
npm test -- tests/dns.test.ts

# Test with a specific name pattern
npm test -- -t "dnsClient resolves records"

# Run tests in watch mode
npm run test:watch
```

### Mock Examples

For DNS service tests:
```javascript
// Create a custom mock for each test
jest.mock('../src/services/dns', () => ({
  DnsResolver: jest.fn().mockImplementation(() => ({
    queryAllProviders: jest.fn().mockResolvedValue({
      google: { /* your test data */ },
      cloudflare: { /* your test data */ },
      openDNS: { /* your test data */ },
      authoritative: { /* your test data */ }
    }),
    queryWithTimeout: jest.fn().mockImplementation((domain) => {
      if (domain === 'nonexistent-domain-12345.com') {
        return Promise.reject(new Error('DNS query timed out'));
      }
      return Promise.resolve(['dkim2.mcsv.net']);
    })
  })),
  // ... other service mocks
}));
```

For API tests:
```javascript
// Mock the http request/response objects
const { req, res } = createMocks({
  method: 'GET',
  query: { domain: 'example.com' }
});

// Call your handler
await domainHandler(req, res);

// Test the response
expect(res._getStatusCode()).toBe(200);
```

## Test Coverage

The test suite covers the following areas:

### DNS Resolution and Validation
- DNS resolution from multiple providers (Google, Cloudflare, OpenDNS, and authoritative nameservers)
- DKIM record validation for both primary (k2/k3) and fallback (k1) scenarios
- DMARC record validation
- Common DKIM configuration errors (wrong subdomain, duplicate domain)
- DNS propagation consistency checks

### UI Components
- Domain input form and animation transitions
- Results grid display
- Error message display with different error types

### API Endpoints
- Basic input validation
- Rate limiting functionality
- Response formatting

### Logging
- Request logging
- Log file management

## License

MIT
