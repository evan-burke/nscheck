// Setup mock for DNS services
jest.mock('../src/services/dns', () => {
  return {
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
      }),
      queryWithTimeout: jest.fn().mockResolvedValue(['dkim2.mcsv.net'])
    })),
    DkimValidator: jest.fn().mockImplementation(() => ({
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      checkCommonErrors: jest.fn().mockReturnValue({ isValid: true, errors: [] })
    })),
    DmarcValidator: jest.fn().mockImplementation(() => ({
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] })
    })),
    ResultAnalyzer: jest.fn().mockImplementation(() => ({
      checkConsistency: jest.fn().mockReturnValue({ consistent: true, hasSuccessfulResults: true }),
      validateResults: jest.fn().mockReturnValue({
        isValid: true,
        dkim: { isValid: true, errors: [] },
        dmarc: { isValid: true, errors: [] },
        consistency: { consistent: true, hasSuccessfulResults: true }
      })
    })),
    RequestThrottler: jest.fn().mockImplementation(() => ({
      checkAllowed: jest.fn().mockResolvedValue(true),
      getLimitForIp: jest.fn().mockReturnValue(30),
      resetAllCounts: jest.fn()
    }))
  };
});

// Setup mock for Logger
jest.mock('../src/services/logger', () => {
  return {
    Logger: jest.fn().mockImplementation(() => ({
      log: jest.fn().mockResolvedValue(undefined),
      getEntries: jest.fn().mockResolvedValue([])
    }))
  };
});

// Mock fs for testing
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    appendFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(''),
    access: jest.fn().mockRejectedValue(new Error('File does not exist'))
  },
  constants: { F_OK: 0 }
}));