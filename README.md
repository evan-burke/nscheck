# NSCheck

A simple DNS checking application for validating DKIM and DMARC records. This app helps ensure proper email authentication configuration by checking:

- DKIM records (k1, k2, k3) for proper CNAME configuration
- DMARC records for validity and uniqueness
- Record propagation across multiple DNS providers
- Common configuration errors and how to fix them

## Features

- **URL to Domain Extraction**: Automatically extracts the domain from URLs, allowing users to paste full URLs like `https://example.com/path?query=123` and we'll extract just `example.com` for DNS lookups
- **www Subdomain Detection**: Identifies when users enter www subdomains and suggests checking the root domain instead
- **Multi-DNS Provider Checks**: Compares results across Google, Cloudflare, OpenDNS, and authoritative nameservers

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

## Logging

### Development Environment
File logging is automatically enabled in development mode. Logs are written to:
- `./logs/dns-queries.log`

### Production Environment
By default, file logging is disabled in production for Vercel compatibility. 
To enable file logging in any environment, set the environment variable:
```
ENABLE_FILE_LOGGING=true
```

You can also customize the log directory:
```
LOG_DIR=/custom/path/to/logs
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

### Domain Processing
- URL to domain extraction for various formats (https://, http://, paths, query parameters)
- Subdomain handling
- Edge cases and error handling for invalid inputs

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
