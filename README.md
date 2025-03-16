# NSCheck

A simple DNS checking application for validating DKIM and DMARC records.

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

Install dependencies:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom node-mocks-http jest-environment-jsdom @types/jest
```

Configure Jest in your package.json:
```json
  {
    "scripts": {
      "test": "jest",
      "test:watch": "jest --watch"
    },
    "jest": {
      "testEnvironment": "jsdom",
      "setupFilesAfterEnv": ["@testing-library/jest-dom/extend-expect"],
      "moduleNameMapper": {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy"
      }
    }
  }
```



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
