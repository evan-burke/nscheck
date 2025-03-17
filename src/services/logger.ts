import fs from 'fs';
import path from 'path';
import { LogEntry, LoggerOptions } from '../types';

/**
 * Logger for storing DNS query results
 */
export class Logger {
  private logDir: string;
  private logFile: string;
  private enableFileLogging: boolean;
  private memoryLogs: LogEntry[];

  constructor(options: LoggerOptions) {
    this.logDir = options.logDir;
    this.logFile = options.logFile || 'dns-queries.log';
    // Default to disabled for Vercel compatibility unless explicitly enabled
    this.enableFileLogging = options.enableFileLogging || false;
    this.memoryLogs = [];
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDir(): Promise<void> {
    if (!this.enableFileLogging) return;
    try {
      await fs.promises.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Error creating log directory:', error);
      throw error;
    }
  }

  /**
   * Get full path to log file
   */
  private getLogPath(): string {
    return path.join(this.logDir, this.logFile);
  }

  /**
   * Check if log file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format log entry as JSON string with timestamp
   */
  private formatEntry(entry: LogEntry): LogEntry {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      ...entry
    };
  }

  /**
   * Log a DNS query
   */
  async log(entry: LogEntry): Promise<void> {
    const formattedEntry = this.formatEntry(entry);
    
    // Always log to console for server logs
    console.log(`[DNS Query] ${JSON.stringify(formattedEntry)}`);
    
    // Keep in memory for runtime access
    this.memoryLogs.unshift(formattedEntry);
    // Limit memory logs to recent entries
    if (this.memoryLogs.length > 100) {
      this.memoryLogs.pop();
    }
    
    // Skip file logging if disabled
    if (!this.enableFileLogging) return;
    
    try {
      // Ensure log directory exists
      await this.ensureLogDir();
      
      const logPath = this.getLogPath();
      const exists = await this.fileExists(logPath);
      const logString = JSON.stringify(formattedEntry) + '\n';
      
      if (exists) {
        // Append to existing log
        await fs.promises.appendFile(logPath, logString);
      } else {
        // Create new log file
        await fs.promises.writeFile(logPath, logString);
      }
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  /**
   * Get log entries (useful for admin panels, etc.)
   */
  async getEntries(limit = 100): Promise<LogEntry[]> {
    // If file logging is disabled, return memory logs
    if (!this.enableFileLogging) {
      return this.memoryLogs.slice(0, limit);
    }
    
    try {
      const logPath = this.getLogPath();
      const exists = await this.fileExists(logPath);
      
      if (!exists) {
        return this.memoryLogs.slice(0, limit);
      }
      
      const fileContent = await fs.promises.readFile(logPath, 'utf-8');
      const lines = fileContent.trim().split('\n');
      const entries: LogEntry[] = [];
      
      // Parse from newest to oldest (end of file to start)
      for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          entries.push(entry);
        } catch (e) {
          // Skip malformed entries
          console.error('Error parsing log entry:', e);
        }
      }
      
      return entries;
    } catch (error) {
      console.error('Error reading log file:', error);
      return this.memoryLogs.slice(0, limit);
    }
  }
}