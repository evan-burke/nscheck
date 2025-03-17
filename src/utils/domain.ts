/**
 * Utility functions for domain handling
 */

/**
 * Extracts the domain from a URL string
 * @param input - URL or domain string (e.g., "https://example.com/path", "example.com")
 * @returns The extracted domain without protocol, path, or query parameters
 */
export const extractDomain = (input: string): string => {
  try {
    // Remove leading/trailing whitespace
    input = input.trim();
    
    // Empty input check
    if (!input) return '';
    
    // Check if the input has a protocol (http://, https://)
    if (input.match(/^https?:\/\//i)) {
      // Parse as URL to extract hostname
      const url = new URL(input);
      return url.hostname;
    } else if (input.includes('/')) {
      // Handle cases like "example.com/path" without protocol
      return input.split('/')[0];
    }
    
    // Input is already a domain without protocol or path
    return input;
  } catch (error) {
    // If URL parsing fails, return the original input
    // This might happen with invalid URLs or plain IP addresses
    if (input.includes('/')) {
      // At least try to get the domain part before any slash
      return input.split('/')[0];
    }
    return input;
  }
};