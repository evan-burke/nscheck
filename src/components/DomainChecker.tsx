import React, { useState, FormEvent } from 'react';
import styles from '../styles/DomainChecker.module.css';

interface DomainCheckerProps {
  onCheck: (domain: string) => void;
  isLoading?: boolean;
}

const DomainChecker: React.FC<DomainCheckerProps> = ({ onCheck, isLoading = false }) => {
  const [domain, setDomain] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!domain.trim()) {
      return;
    }
    
    setIsChecking(true);
    onCheck(domain.trim());
  };

  // Update isChecking state when loading state changes
  React.useEffect(() => {
    // If the parent component sets isLoading to false, we should stop checking
    if (!isLoading && isChecking) {
      setIsChecking(false);
    }
  }, [isLoading, isChecking]);

  // Combine CSS classes for animation
  const containerClass = `${styles.container} ${isChecking || isLoading ? styles.checking : ''}`;

  return (
    <div className={containerClass} data-testid="domain-checker-container">
      <h1 className={styles.title}>
        Check your domain's mail configuration
      </h1>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter domain (e.g. example.com)"
            className={styles.input}
            disabled={isLoading}
          />
          
          <button 
            type="submit" 
            className={styles.button}
            disabled={!domain.trim() || isLoading}
          >
            {isLoading ? (
              <span className={styles.spinner} aria-hidden="true"></span>
            ) : 'Check'}
          </button>
        </div>
      </form>
      
      {isChecking && (
        <div className={styles.loadingIndicator}>
          <p>Checking mail configuration...</p>
          <div className={styles.progress}>
            <div className={styles.progressBar} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainChecker;