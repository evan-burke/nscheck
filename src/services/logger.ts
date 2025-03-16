import fs from 'fs';
import path from 'path';
import { LogEntry, LoggerOptions } from '../types';

/**
 * Logger for storing DNS query results
 */
export class Logger {
  private logDir: string;
  private logFile: string;

  constructor(options: LoggerOptions) {
    this.logDir = options.logDir;
    this.logFile = options.logFile || 'dns-queries.log';
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDir(): Promise<void> {
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
  private formatEntry(entry: LogEntry): string {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
      timestamp,
      ...entry
    }) + '\n';
  }

  /**
   * Log a DNS query
   */
  async log(entry: LogEntry): Promise<void> {
    try {
      // Ensure log directory exists
      await this.ensureLogDir();
      
      const logPath = this.getLogPath();
      const exists = await this.fileExists(logPath);
      const formattedEntry = this.formatEntry(entry);
      
      if (exists) {
        // Append to existing log
        await fs.promises.appendFile(logPath, formattedEntry);
      } else {
        // Create new log file
        await fs.promises.writeFile(logPath, formattedEntry);
      }
    } catch (error) {
      console.error('Error writing to log file:', error);
      // In production, you might want to handle this differently
      // Maybe queue failed log entries for retry or send to a monitoring service
    }
  }

  /**
   * Get log entries (useful for admin panels, etc.)
   */
  async getEntries(limit = 100): Promise<LogEntry[]> {
    try {
      const logPath = this.getLogPath();
      const exists = await this.fileExists(logPath);
      
      if (!exists) {
        return [];
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
      return [];
    }
  }
}