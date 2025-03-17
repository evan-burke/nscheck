import React from 'react';
import { DnsResult, ValidationSummary } from '../types';
import ErrorDisplay from './ErrorDisplay';
import styles from '../styles/ResultsGrid.module.css';

interface ResultsGridProps {
  results: DnsResult;
  validation: ValidationSummary;
}

const ResultsGrid: React.FC<ResultsGridProps> = ({ results, validation }) => {
  // Get all unique record names from all providers, excluding special fields
  const allRecordNames = new Set<string>();
  
  Object.values(results).forEach(providerRecords => {
    Object.keys(providerRecords).forEach(recordName => {
      // Skip special metadata fields
      if (recordName !== 'authoritativeServer' && 
          recordName !== 'authoritativeServers') {
        allRecordNames.add(recordName);
      }
    });
  });
  
  // Filter and sort records
  // First, check if k2 and k3 are present and have valid values
  const k2Records = Array.from(allRecordNames).find(name => name.includes('k2._domainkey'));
  const k3Records = Array.from(allRecordNames).find(name => name.includes('k3._domainkey'));
  
  // Check if both k2 and k3 exist and have valid values in at least one provider
  const hasValidK2 = k2Records && Object.values(results).some(provider => 
    provider[k2Records]?.some(value => value === 'dkim2.mcsv.net')
  );
  
  const hasValidK3 = k3Records && Object.values(results).some(provider => 
    provider[k3Records]?.some(value => value === 'dkim3.mcsv.net')
  );
  
  const hasValidK2K3 = hasValidK2 && hasValidK3;
      
  // Filter out k1 records if k2 and k3 are present with valid values
  const filteredRecordNames = hasValidK2K3 
    ? Array.from(allRecordNames).filter(name => !name.includes('k1._domainkey'))
    : Array.from(allRecordNames);

  // Sort records in a specific order: k2, k3, k1, _dmarc, others
  const sortedRecordNames = filteredRecordNames.sort((a, b) => {
    const order: { [key: string]: number } = {
      'k2._domainkey': 1,
      'k3._domainkey': 2,
      'k1._domainkey': 3,
      '_dmarc': 4
    };
    
    // Extract the key part (k2._domainkey, _dmarc, etc.)
    const keyA = Object.keys(order).find(key => a.includes(key)) || '';
    const keyB = Object.keys(order).find(key => b.includes(key)) || '';
    
    return (order[keyA] || 99) - (order[keyB] || 99);
  });
  
  // Check if a specific record value is valid
  const isValidValue = (recordName: string, value: string): boolean => {
    // For DKIM CNAME records, we need exact matches
    if (recordName.includes('k2._domainkey') && value === 'dkim2.mcsv.net') {
      return true;
    } else if (recordName.includes('k3._domainkey') && value === 'dkim3.mcsv.net') {
      return true;
    } else if (recordName.includes('k1._domainkey') && value === 'dkim.mcsv.net') {
      return true;
    } else if (recordName.includes('_dmarc') && value.includes('v=DMARC1')) {
      return true;
    }
    return false;
  };

  // Extract the authoritative server info
  const authoritativeServer = results.authoritative?.authoritativeServer || 'Not available';
  const authoritativeServers = results.authoritative?.authoritativeServers || [];
  
  return (
    <div className={styles.container}>
      {/* Display validation errors */}
      {!validation.isValid && (
        <div className={styles.errorsContainer}>
          <ErrorDisplay validation={validation} />
        </div>
      )}

      {!validation.consistency.consistent && validation.consistency.hasSuccessfulResults && (
        <div className={styles.warning}>
          <span className={styles.warningIcon} data-testid="warning-icon">⚠️</span>
          <p>
            It looks like some recent changes may still be propagating - we recommend 
            waiting to send until results match for all providers.
          </p>
        </div>
      )}
      
      <table className={styles.resultsTable}>
        <thead>
          <tr>
            <th>Record</th>
            <th>Google DNS</th>
            <th>Cloudflare DNS</th>
            <th>OpenDNS</th>
            <th>Authoritative</th>
          </tr>
        </thead>
        <tbody>
          {sortedRecordNames.map(recordName => (
            <tr key={recordName}>
              <td className={styles.recordName}>{recordName}</td>
              
              {/* Google */}
              <td>
                {results.google[recordName]?.length > 0 ? (
                  <div>
                    {results.google[recordName].map((value, i) => (
                      <div key={i} className={styles.recordValue}>
                        {isValidValue(recordName, value) ? (
                          <span className={styles.success} data-testid="success-icon">✓</span>
                        ) : (
                          <span className={styles.error}>✗</span>
                        )}
                        <span className={styles.valueText}>{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={styles.noRecord}>No record</span>
                )}
              </td>
              
              {/* Cloudflare */}
              <td>
                {results.cloudflare[recordName]?.length > 0 ? (
                  <div>
                    {results.cloudflare[recordName].map((value, i) => (
                      <div key={i} className={styles.recordValue}>
                        {isValidValue(recordName, value) ? (
                          <span className={styles.success} data-testid="success-icon">✓</span>
                        ) : (
                          <span className={styles.error}>✗</span>
                        )}
                        <span className={styles.valueText}>{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={styles.noRecord}>No record</span>
                )}
              </td>
              
              {/* OpenDNS */}
              <td>
                {results.openDNS[recordName]?.length > 0 ? (
                  <div>
                    {results.openDNS[recordName].map((value, i) => (
                      <div key={i} className={styles.recordValue}>
                        {isValidValue(recordName, value) ? (
                          <span className={styles.success} data-testid="success-icon">✓</span>
                        ) : (
                          <span className={styles.error}>✗</span>
                        )}
                        <span className={styles.valueText}>{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={styles.noRecord}>No record</span>
                )}
              </td>
              
              {/* Authoritative */}
              <td>
                {recordName !== 'authoritativeServer' && Array.isArray(results.authoritative[recordName]) && results.authoritative[recordName].length > 0 ? (
                  <div>
                    {results.authoritative[recordName].map((value, i) => (
                      <div key={i} className={styles.recordValue}>
                        {isValidValue(recordName, value) ? (
                          <span className={styles.success} data-testid="success-icon">✓</span>
                        ) : (
                          <span className={styles.error}>✗</span>
                        )}
                        <span className={styles.valueText}>{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={styles.noRecord}>No record</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Display authoritative server info - moved below the results table */}
      <div className={styles.authServerInfo}>
        <p><strong>Authoritative nameserver used:</strong> {authoritativeServer}</p>
        {authoritativeServers.length > 0 && (
          <p><strong>All authoritative nameservers:</strong> {authoritativeServers.join(', ')}</p>
        )}
      </div>
    </div>
  );
};

export default ResultsGrid;