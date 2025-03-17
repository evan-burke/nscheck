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
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check domain');
      }
      
      setResults(data.results);
      setValidation(data.validation);
    } catch (err) {
      setError((err as Error).message);
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
            <p>{error}</p>
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
