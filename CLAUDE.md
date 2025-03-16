# nscheck scope

## Overview

This is a simple DNS checking app. It will be hosted on Vercel.

### Design

UI will be very minimal but with clean, modern design.
Warm greys, rounded UI elements - a bit inspired by the design of the Claude web UI itself, but with a bit more space between UI elements.
Font will be Inter. https://rsms.me/inter/

Main page will be one horizontally/vertically centered text box for a domain, and a 'check' button.

### Functionality

User enters a domain (say `example.com`) and clicks a 'check' button.
CSS transition the domain box toward the top, at 75% of the height of the window. Show a "working" type animation. Show results in realtime as they come in.

We will do dns lookups of TXT values for:
k1._domainkey.example.com
k2._domainkey.example.com 
k3._domainkey.example.com
_dmarc.example.com

DNS lookups should be performed asynchronously against:
* google DNS (8.8.8.8)
* cloudflare DNS (1.1.1.1)
* openDNS
* authoritative nameservers for the domain.

The success case is:
The k2/k3 should return CNAMEs for dkim2.mcsv.net and dkim3.mcsv.net, respectively.
  Fallback success case: If k2/k3 are not present, look for k1 returning CNAME for dkim.mcsv.net.
Value at _dmarc.example.com should be a valid DMARC record, and there should only be one result containing "v=DMARC1".
All of the above nameservers return the same result.

Display grid of results, with hostnames as rows, and DNS providers as columns - green check for correct records, red X otherwise.

If not all nameservers return the same result, but some results are correct:
Display warning text with a yellow exlamation point icon: "It looks like some recent changes may still be propagating - we recommend waiting to send until results match for all providers."


DMARC error cases:
1. Multiple records containing "v=DMARC1": display error: "Error: multiple DMARC records found. This will likely result in auth failures and bounced mail". Highlight this in light red.
2. Record containing v=DMARC1 but invalid: "We found a DMARC record, but there were errors. Try checking the domain on Dmarcian's domain inspector" and link "domain inspector" to https://dmarcian.com/dmarc-inspector/ 


DKIM (k1/k2/k3) error cases:
If no results found:
* check if user accidentally published the record for 'www', like k2._domainkey.www.example.com
* check if user accidentally published with the domain root twice, like k2._domainkey.example.com.example.com

If results returned for k2/k3 but do not resolve to dkim2/dkim3:
* check if k2/k3 were switched, or both records point to the same place.



# NSCheck Development Guidelines

## Build & Run Commands
```bash
npm install        # Install dependencies
npm run start      # Run the application
npm run build      # Build the application
npm run dev        # Start with hot-reload for development
```

## Test Commands
```bash
npm run test             # Run all tests
npm test -- -t "test name"  # Run a specific test
npm run test:watch      # Run tests in watch mode
```

## Lint & Format Commands
```bash
npm run lint       # Run ESLint
npm run lint:fix   # Run ESLint with automatic fixes
npm run format     # Run Prettier to format code
```

## Code Style Guidelines
- **Naming**: Use camelCase for variables/functions, PascalCase for classes/components
- **Imports**: Group imports by external/internal, sort alphabetically
- **Types**: Use TypeScript types/interfaces, avoid 'any'
- **Error Handling**: Use try/catch blocks with specific error types
- **Formatting**: 2-space indentation, max 100 chars per line
- **Comments**: JSDoc for public API, inline comments for complex logic
