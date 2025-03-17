/**
 * Tests for domain extraction functionality
 */
import { extractDomain } from '../src/utils/domain';

describe('extractDomain function', () => {
  test('extracts domain from URLs with protocols', () => {
    expect(extractDomain('https://example.com')).toBe('example.com');
    expect(extractDomain('http://example.com')).toBe('example.com');
    expect(extractDomain('https://example.com/')).toBe('example.com');
    expect(extractDomain('https://example.com/path')).toBe('example.com');
    expect(extractDomain('https://example.com/path?query=123')).toBe('example.com');
    expect(extractDomain('https://example.com/path#hash')).toBe('example.com');
  });

  test('extracts domain from subdomains with protocols', () => {
    expect(extractDomain('https://sub.example.com')).toBe('sub.example.com');
    expect(extractDomain('http://www.example.com')).toBe('www.example.com');
    expect(extractDomain('https://blog.example.com/posts')).toBe('blog.example.com');
  });

  test('extracts domain from URLs without protocols', () => {
    expect(extractDomain('example.com/path')).toBe('example.com');
    expect(extractDomain('example.com/path?query=123')).toBe('example.com');
    expect(extractDomain('example.com/')).toBe('example.com');
  });

  test('handles plain domains correctly', () => {
    expect(extractDomain('example.com')).toBe('example.com');
    expect(extractDomain('sub.example.com')).toBe('sub.example.com');
    expect(extractDomain('www.example.com')).toBe('www.example.com');
  });

  test('trims whitespace from input', () => {
    expect(extractDomain('  example.com  ')).toBe('example.com');
    expect(extractDomain(' https://example.com ')).toBe('example.com');
  });

  test('handles edge cases and invalid inputs gracefully', () => {
    expect(extractDomain('')).toBe('');
    expect(extractDomain('localhost')).toBe('localhost');
    expect(extractDomain('192.168.1.1')).toBe('192.168.1.1');
    expect(extractDomain('invalid/url')).toBe('invalid');
  });
});