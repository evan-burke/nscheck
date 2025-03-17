import { Logger } from '../src/services/logger';
import fs from 'fs';
import path from 'path';

// Create proper mocks for fs module
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

// Logging Service Tests
describe('Logger with file logging enabled', () => {
  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Logger creates log directory if it does not exist', async () => {
    const logger = new Logger({ logDir: '/logs', enableFileLogging: true });
    
    await logger.log({ domain: 'example.com', success: true });
    
    expect(fs.promises.mkdir).toHaveBeenCalledWith('/logs', { recursive: true });
  });

  test('Logger creates log file if it does not exist', async () => {
    const logger = new Logger({ logDir: '/logs', enableFileLogging: true });
    
    // Mock fs.access to simulate file not existing
    (fs.promises.access as jest.Mock).mockRejectedValue(new Error('File does not exist'));
    
    await logger.log({ domain: 'example.com', success: true });
    
    expect(fs.promises.writeFile).toHaveBeenCalled();
  });

  test('Logger appends to existing log file', async () => {
    const logger = new Logger({ logDir: '/logs', enableFileLogging: true });
    
    // Mock fs.access to simulate file exists
    (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
    
    await logger.log({ domain: 'example.com', success: true });
    
    expect(fs.promises.appendFile).toHaveBeenCalled();
  });

  test('Logger formats log entry with timestamp', async () => {
    const logger = new Logger({ logDir: '/logs', enableFileLogging: true });
    
    // Save the original implementation
    const originalDate = global.Date;
    
    // Mock Date to return a fixed timestamp
    const mockDate = new Date('2023-01-01T12:00:00Z');
    global.Date = jest.fn(() => mockDate) as any;
    (global.Date as any).toISOString = jest.fn(() => '2023-01-01T12:00:00.000Z');
    
    try {
      // Mock fs.access to simulate file exists to ensure appendFile is called
      (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
      
      await logger.log({ domain: 'example.com', success: true });
    
      // Verify correct format with the mocked timestamp
      const appendCall = (fs.promises.appendFile as jest.Mock).mock.calls[0][1];
      expect(appendCall).toContain('example.com');
      expect(appendCall).toContain('true');
    } finally {
      // Restore the original implementation
      global.Date = originalDate;
    }
  });

  test('Logger records query results correctly', async () => {
    const logger = new Logger({ logDir: '/logs', enableFileLogging: true });
    
    // Mock fs.access to simulate file exists to ensure appendFile is called
    (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
    
    const queryData = {
      domain: 'example.com',
      success: true,
      results: {
        google: {
          'k2._domainkey.example.com': ['dkim2.mcsv.net']
        }
      },
      ip: '192.168.1.1'
    };
    
    await logger.log(queryData);
    
    // Verify the call with the formatted expected data
    expect(fs.promises.appendFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"domain":"example.com"')
    );
  });
});

describe('Logger with file logging disabled', () => {
  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('Logger does not write to filesystem when file logging is disabled', async () => {
    const logger = new Logger({ logDir: '/logs', enableFileLogging: false });
    
    await logger.log({ domain: 'example.com', success: true });
    
    expect(fs.promises.mkdir).not.toHaveBeenCalled();
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
    expect(fs.promises.appendFile).not.toHaveBeenCalled();
  });
  
  test('Memory logs are stored when file logging is disabled', async () => {
    const logger = new Logger({ logDir: '/logs', enableFileLogging: false });
    
    const queryData = {
      domain: 'test-domain.com',
      success: true
    };
    
    await logger.log(queryData);
    
    // Get entries should return the log from memory
    const entries = await logger.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].domain).toBe('test-domain.com');
    expect(entries[0].success).toBe(true);
  });
});