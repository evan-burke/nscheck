import { NextApiRequest, NextApiResponse } from 'next';
import { DnsResolver, ResultAnalyzer, RequestThrottler } from '../../services/dns';
import { Logger } from '../../services/logger';
import { ValidationSummary } from '../../types';

// Initialize services with configuration
const dnsResolver = new DnsResolver({ timeout: 10000 });
const resultAnalyzer = new ResultAnalyzer();

// Configure throttling: 120 requests per hour per IP by default
const throttler = new RequestThrottler(120, {
  // Example of overriding limits for specific IPs or ranges
  '127.0.0.1': 1000, // Local development - allows 1000 requests per hour
  '192.168.1.*': 100, // Internal network - allows 100 requests per hour
  // Add your custom IP overrides below
  '76.165.67.45': 1000, // Custom override example - allows 1000 requests per hour
});

// Initialize logger with file logging enabled in dev environment, disabled in production
const logger = new Logger({ 
  logDir: process.env.LOG_DIR || './logs',
  logFile: 'dns-queries.log',
  enableFileLogging: process.env.NODE_ENV === 'development' || process.env.ENABLE_FILE_LOGGING === 'true'
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get domain from query
  const { domain } = req.query;
  
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'A valid domain parameter is required' });
  }

  // Get client IP for rate limiting
  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = typeof forwardedFor === 'string' 
    ? forwardedFor.split(',')[0] 
    : req.socket.remoteAddress || '0.0.0.0';

  // Check rate limit
  const allowed = await throttler.checkAllowed(clientIp);
  if (!allowed) {
    // Log rate limit hit
    try {
      await logger.log({
        domain,
        success: false,
        ip: clientIp,
        errors: [{ type: 'rateLimit', message: 'Rate limit exceeded from ${clientIp}' }]
      });
    } catch (logError) {
      console.error('Error logging rate limit hit:', logError);
    }
    
    return res.status(429).json({ 
      error: `Rate limit exceeded from ${clientIp}. Please try again later or reach out to Evan`
    });
  }

  try {
    // Get DNS records for all keys
    const domainRecords: any = {};
    
    // Query all DNS providers for each key
    // For DKIM keys, we want to check the CNAME records
    const k1Results = await dnsResolver.queryAllProviders(domain, 'CNAME', 'k1._domainkey');
    const k2Results = await dnsResolver.queryAllProviders(domain, 'CNAME', 'k2._domainkey');
    const k3Results = await dnsResolver.queryAllProviders(domain, 'CNAME', 'k3._domainkey');
    // For DMARC, we want the TXT record
    const dmarcResults = await dnsResolver.queryAllProviders(domain, 'TXT', '_dmarc');
    
    // Combine results
    const results = {
      google: {
        ...k1Results.google,
        ...k2Results.google,
        ...k3Results.google,
        ...dmarcResults.google
      },
      cloudflare: {
        ...k1Results.cloudflare,
        ...k2Results.cloudflare,
        ...k3Results.cloudflare,
        ...dmarcResults.cloudflare
      },
      openDNS: {
        ...k1Results.openDNS,
        ...k2Results.openDNS,
        ...k3Results.openDNS,
        ...dmarcResults.openDNS
      },
      authoritative: {
        ...k1Results.authoritative,
        ...k2Results.authoritative,
        ...k3Results.authoritative,
        ...dmarcResults.authoritative
      }
    };
    
    // Validate results
    const validation = await resultAnalyzer.validateResults(domain, results);
    
    // Log the request with validation summary
    try {
      // Extract error types for logging
      const dkimErrors = validation.dkim.errors.map(err => err.type);
      const dmarcErrors = validation.dmarc.errors.map(err => err.type);
      
      await logger.log({
        domain,
        success: true,
        results,
        ip: clientIp,
        validationSummary: {
          isValid: validation.isValid,
          dkimErrors: dkimErrors.length > 0 ? dkimErrors : undefined,
          dmarcErrors: dmarcErrors.length > 0 ? dmarcErrors : undefined,
          consistencyIssue: !validation.consistency.consistent && validation.consistency.hasSuccessfulResults
        }
      });
    } catch (logError) {
      console.error('Error logging successful request:', logError);
    }

    // Return results
    return res.status(200).json({
      domain,
      results,
      validation
    });
    
  } catch (error) {
    console.error('Error processing DNS request:', error);
    
    // Log the error
    try {
      await logger.log({
        domain,
        success: false,
        ip: clientIp,
        errors: [{ 
          type: 'serverError', 
          message: (error as Error).message || 'Unknown error'
        }]
      });
    } catch (logError) {
      console.error('Error logging server error:', logError);
    }
    
    return res.status(500).json({ 
      error: 'Failed to process DNS lookup request',
      message: (error as Error).message
    });
  }
}