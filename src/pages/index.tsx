import React, { useState } from 'react';
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

  const handleCheckDomain = async (domainToCheck: string) => {
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
        <title>NSCheck - Verify Your Mail Domain Configuration</title>
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
          <div className={styles.error}>
            <p>{error}</p>
          </div>
        )}
        
        {results && validation && (
          <div className={styles.results}>
            <h2>Results for {domain}</h2>
            
            {validation.isValid ? (
              <div className={styles.success}>
                <p>✅ All mail configuration checks passed!</p>
              </div>
            ) : (
              <ErrorDisplay validation={validation} />
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