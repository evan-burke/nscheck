import React from 'react';
import { ValidationSummary, ValidationError } from '../types';
import styles from '../styles/ErrorDisplay.module.css';

interface ErrorDisplayProps {
  validation: ValidationSummary;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ validation }) => {
  if (validation.isValid) {
    return null;
  }
  
  // Helper to render comparison for common DKIM errors
  const renderComparison = (error: ValidationError) => {
    if (!error.actual || !error.expected) {
      return null;
    }
    
    return (
      <div className={styles.comparison}>
        <div className={styles.incorrectValue}>
          <span>This is what it looks like now:</span>
          <code>{error.actual}</code>
        </div>
        <div className={styles.correctValue}>
          <span>This is what it should look like:</span>
          <code>{error.expected}</code>
        </div>
      </div>
    );
  };
  
  // Check if there's a 'wrongSubdomain' or 'duplicateDomain' error in DKIM errors
  const hasSpecificDkimError = validation.dkim.errors.some(error => 
    error.type === 'wrongSubdomain' || error.type === 'duplicateDomain');

  return (
    <div className={styles.container}>
      {/* DMARC Errors */}
      {validation.dmarc.errors.length > 0 && (
        <div className={styles.errorSection}>
          <h3>DMARC Issues</h3>
          
          {validation.dmarc.errors.map((error, index) => (
            <div key={`dmarc-${index}`} className={styles.error}>
              {error.type === 'multipleRecords' && (
                <div className={styles.errorContent}>
                  <div className={styles.errorIcon}>🚫</div>
                  <div>
                    <p className={styles.errorMessage}>
                      Error: multiple DMARC records found. This will likely result in auth failures and bounced mail.
                    </p>
                  </div>
                </div>
              )}
              
              {error.type === 'invalidSyntax' && (
                <div className={styles.errorContent}>
                  <div className={styles.errorIcon}>⚠️</div>
                  <div>
                    <p className={styles.errorMessage}>
                      We found a DMARC record, but there were errors. Try checking the domain on{' '}
                      <a 
                        href="https://dmarcian.com/dmarc-inspector/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles.link}
                      >
                        Dmarcian's domain inspector
                      </a> for guidance on solving the problem.
                    </p>
                  </div>
                </div>
              )}
              
              {error.type === 'missingRecord' && (
                <div className={styles.errorContent}>
                  <div className={styles.errorIcon}>⚠️</div>
                  <div>
                    <p className={styles.errorMessage}>
                      No DMARC record found. Google and Yahoo require a DMARC record for bulk senders.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* DKIM Errors */}
      {validation.dkim.errors.length > 0 && (
        <div className={styles.errorSection}>
          <h3>DKIM Issues</h3>
          
          {validation.dkim.errors.map((error, index) => (
            <div key={`dkim-${index}`} className={styles.error}>
              {error.type === 'wrongSubdomain' && (
                <div className={styles.errorContent}>
                  <div className={styles.errorIcon}>❌</div>
                  <div>
                    <p className={styles.errorMessage}>
                      DKIM record published for "www" rather than the root domain
                    </p>
                    {renderComparison(error)}
                  </div>
                </div>
              )}
              
              {error.type === 'duplicateDomain' && (
                <div className={styles.errorContent}>
                  <div className={styles.errorIcon}>❌</div>
                  <div>
                    <p className={styles.errorMessage}>
                      DKIM record contains duplicate domain
                    </p>
                    {renderComparison(error)}
                  </div>
                </div>
              )}
              
              {error.type === 'switchedRecords' && (
                <div className={styles.errorContent}>
                  <div className={styles.errorIcon}>❌</div>
                  <div>
                    <p className={styles.errorMessage}>
                      DKIM k2 and k3 records appear to be switched - k2 is pointed to dkim3, and/or k3 pointed to dkim2. Please double check your settings.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Only show missingRecords error if there's no specific DKIM error like wrongSubdomain or duplicateDomain */}
              {error.type === 'missingRecords' && !hasSpecificDkimError && (
                <div className={styles.errorContent}>
                  <div className={styles.errorIcon}>❌</div>
                  <div>
                    <p className={styles.errorMessage}>
                      No DKIM records found. Please <a href="https://mailchimp.com/help/set-up-email-domain-authentication/" target="_blank" rel="noopener noreferrer" className={styles.link}>set up k2/k3 records</a>
                    </p>
                  </div>
                </div>
              )}
              
              {error.type === 'incorrectDestination' && (
                <div className={styles.errorContent}>
                  <div className={styles.errorIcon}>❌</div>
                  <div>
                    <p className={styles.errorMessage}>
                      DKIM records found but they point to incorrect destinations. 
                      k2 should point to dkim2.mcsv.net and k3 should point to dkim3.mcsv.net.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ErrorDisplay;