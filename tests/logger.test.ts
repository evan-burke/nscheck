import { Logger } from '../src/services/logger';
import fs from 'fs';
import path from 'path';

// Mock fs functions
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    appendFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('File does not exist')),
  },
  constants: { F_OK: 0 }
}));

// Logging Service Tests
test('Logger creates log directory if it does not exist', async () => {
  const logger = new Logger({ logDir: '/logs' });
  
  await logger.log({ domain: 'example.com', success: true });
  
  expect(fs.promises.mkdir).toHaveBeenCalledWith('/logs', { recursive: true });
});

test('Logger creates log file if it does not exist', async () => {
  const logger = new Logger({ logDir: '/logs' });
  
  // Mock fs.access to simulate file not existing
  (fs.promises.access as jest.Mock).mockRejectedValue(new Error('File does not exist'));
  
  await logger.log({ domain: 'example.com', success: true });
  
  expect(fs.promises.writeFile).toHaveBeenCalled();
});

test('Logger appends to existing log file', async () => {
  const logger = new Logger({ logDir: '/logs' });
  
  // Mock fs.access to simulate file exists
  (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
  
  await logger.log({ domain: 'example.com', success: true });
  
  expect(fs.promises.appendFile).toHaveBeenCalled();
});

test('Logger formats log entry with timestamp', async () => {
  const logger = new Logger({ logDir: '/logs' });
  
  // Mock Date.now to return a fixed timestamp
  const mockDate = new Date('2023-01-01T12:00:00Z');
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
  
  await logger.log({ domain: 'example.com', success: true });
  
  // Check that the log entry includes the timestamp
  expect((fs.promises.appendFile as jest.Mock).mock.calls[0][1]).toContain('"timestamp":"2023-01-01T12:00:00.000Z"');
});

test('Logger records query results correctly', async () => {
  const logger = new Logger({ logDir: '/logs' });
  
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
  
  // Check that the log entry contains the query data
  const logCall = (fs.promises.appendFile as jest.Mock).mock.calls[0][1];
  expect(logCall).toContain('"domain":"example.com"');
  expect(logCall).toContain('"success":true');
  expect(logCall).toContain('"ip":"192.168.1.1"');
});