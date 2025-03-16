import { NextApiRequest, NextApiResponse } from 'next';
import { DnsResolver, ResultAnalyzer, RequestThrottler } from '../../services/dns';
import { Logger } from '../../services/logger';
import { ValidationSummary } from '../../types';

// Initialize services with configuration
const dnsResolver = new DnsResolver({ timeout: 10000 });
const resultAnalyzer = new ResultAnalyzer();

// Configure throttling: 30 requests per hour per IP by default
const throttler = new RequestThrottler(30, {
  // Example of overriding limits for specific IPs or ranges
  // '127.0.0.1': 1000, // Local development
  // '192.168.1.*': 100 // Internal network
});

// Initialize logger
const logger = new Logger({ 
  logDir: process.env.LOG_DIR || './logs',
  logFile: 'dns-queries.log'
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
    await logger.log({
      domain,
      success: false,
      ip: clientIp,
      errors: [{ type: 'rateLimit', message: 'Rate limit exceeded' }]
    });
    
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please try again later.' 
    });
  }

  try {
    // Get DNS records for all keys
    const domainRecords: any = {};
    
    // Query all DNS providers for each key
    const k1Results = await dnsResolver.queryAllProviders(domain, 'TXT', 'k1._domainkey');
    const k2Results = await dnsResolver.queryAllProviders(domain, 'TXT', 'k2._domainkey');
    const k3Results = await dnsResolver.queryAllProviders(domain, 'TXT', 'k3._domainkey');
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
    const validation = resultAnalyzer.validateResults(domain, results);
    
    // Log the request
    await logger.log({
      domain,
      success: true,
      results,
      ip: clientIp
    });

    // Return results
    return res.status(200).json({
      domain,
      results,
      validation
    });
    
  } catch (error) {
    console.error('Error processing DNS request:', error);
    
    // Log the error
    await logger.log({
      domain,
      success: false,
      ip: clientIp,
      errors: [{ 
        type: 'serverError', 
        message: (error as Error).message || 'Unknown error'
      }]
    });
    
    return res.status(500).json({ 
      error: 'Failed to process DNS lookup request',
      message: (error as Error).message
    });
  }
}