import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import DomainChecker from '../components/DomainChecker';
import ResultsGrid from '../components/ResultsGrid';
import ErrorDisplay from '../components/ErrorDisplay';
import { DnsResult, ValidationSummary } from '../types';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [domain, setDomain] = useState<string>('');
  const [results, setResults] = useState<DnsResult | null>(null);
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  // Handle fade-out transition when loading new results
  useEffect(() => {
    if (!isLoading) {
      setIsFadingOut(false);
    }
  }, [isLoading]);

  const handleCheckDomain = async (domainToCheck: string) => {
    // If we already have results or an error, fade them out first
    if (results || error) {
      setIsFadingOut(true);
      // Wait for the fade-out animation to complete before proceeding
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setDomain(domainToCheck);
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/domain?domain=${encodeURIComponent(domainToCheck)}`);
      
      // Log non-success responses
      if (!response.ok) {
        const statusCode = response.status;
        console.error(`[API Error] Status: ${statusCode} for domain: ${domainToCheck}`);
        
        // Handle different error types
        switch (statusCode) {
          case 429:
            throw new Error("Rate limit exceeded. Please try again in a few minutes.");
          case 400:
            throw new Error("Invalid domain format. Please check and try again.");
          case 404:
            throw new Error("API endpoint not found. Please reload the page and try again.");
          case 500:
            throw new Error("Server error while checking domain. Please try again later.");
          default:
            // Try to parse error message from response if possible
            try {
              const errorData = await response.json();
              throw new Error(errorData.error || `Error ${statusCode} while checking domain`);
            } catch (parseError) {
              // If we can't parse the JSON (like when it's HTML), provide a generic message
              throw new Error(`Error ${statusCode} while checking domain. Please try again later.`);
            }
        }
      }
      
      // For successful responses, carefully parse the data
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("[API Error] Failed to parse JSON response:", parseError);
        throw new Error("Received invalid data from server. Please try again.");
      }
      
      // Validate the response has the expected structure
      if (!data || !data.results || !data.validation) {
        console.error("[API Error] Incomplete response:", data);
        throw new Error("Received incomplete data from server. Please try again.");
      }
      
      setResults(data.results);
      setValidation(data.validation);
    } catch (err) {
      const errorMessage = (err as Error).message;
      console.error("[API Error] Request failed:", errorMessage);
      setError(errorMessage);
      setResults(null);
      setValidation(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>d.nscheck</title>
        <meta name="description" content="Check your DNS configuration for proper DKIM and DMARC setup" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </Head>

      <main className={styles.main}>
        <DomainChecker 
          onCheck={handleCheckDomain} 
          isLoading={isLoading} 
        />
        
        {error && (
          <div className={`${styles.error} ${isFadingOut ? styles.fadeOut : ''}`}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8V12" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 16H12.01" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p>{error}</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#666' }}>
              If this issue persists, please try again later or contact support.
            </p>
          </div>
        )}
        
        {results && validation && (
          <div className={`${styles.results} ${isFadingOut ? styles.fadeOut : ''}`}>
            
            {validation.isValid && (
              <div className={styles.success}>
              {/* [DO NOT MODIFY] */}
                <p>✅ You're golden! Everything checks out. 😉</p>
              </div>
            )}
            
            <ResultsGrid 
              results={results} 
              validation={validation} 
            />
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p>
          NSCheck - Verify your domain's mail configuration
        </p>
      </footer>
    </div>
  );
}
