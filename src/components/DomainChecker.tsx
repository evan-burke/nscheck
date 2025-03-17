import React, { useState, FormEvent } from 'react';
import styles from '../styles/DomainChecker.module.css';

interface DomainCheckerProps {
  onCheck: (domain: string) => void;
  isLoading?: boolean;
}

const DomainChecker: React.FC<DomainCheckerProps> = ({ onCheck, isLoading = false }) => {
  const [domain, setDomain] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [showWwwPrompt, setShowWwwPrompt] = useState<boolean>(false);
  const [rootDomain, setRootDomain] = useState<string>('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const trimmedDomain = domain.trim();
    if (!trimmedDomain) {
      return;
    }
    
    // Check if the domain starts with www.
    if (trimmedDomain.toLowerCase().startsWith('www.')) {
      const stripped = trimmedDomain.substring(4); // Remove 'www.'
      setRootDomain(stripped);
      setShowWwwPrompt(true);
      return;
    }
    
    // Proceed with the check
    setIsChecking(true);
    onCheck(trimmedDomain);
  };
  
  const handleUseRootDomain = () => {
    setDomain(rootDomain);
    setShowWwwPrompt(false);
    setIsChecking(true);
    onCheck(rootDomain);
  };
  
  const handleKeepWww = () => {
    setShowWwwPrompt(false);
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
        authcheck 😇
      </h1>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="domain to check"
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
            ) : "Let's go!"}
          </button>
        </div>
        
        <div className={styles.alphaNote}>
          <p>
            NOTE: this is in ALPHA. feel free to play around with it, but expect there to be bugs at this stage. Report them <a href="https://docs.google.com/forms/d/e/1FAIpQLSfAKJ2jzpZL6bB3nvdw6PG1xH8UCot7B4es6vnPO6lbqX3ziw/viewform?usp=header" target="_blank" rel="noopener noreferrer">here</a> or DM Evan.
            <br />
            This will only work for a specific email service provider's authentication records.
          </p>
        </div>
      </form>
      
      {showWwwPrompt && (
        <div className={styles.wwwPrompt}>
          <p>
            DKIM records are usually published on the root domain, not on www subdomains.
            Would you like to check <strong>{rootDomain}</strong> instead?
          </p>
          <div className={styles.promptButtons}>
            <button 
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={handleUseRootDomain}
            >
              Yes, use {rootDomain}
            </button>
            <button 
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={handleKeepWww}
            >
              No, keep {domain.trim()}
            </button>
          </div>
        </div>
      )}
      
      {isChecking && (
        <div className={styles.loadingIndicator}>
          <p>Checking mail configuration 🧑‍💻🧑‍💻🧑‍💻</p>
          <div className={styles.progress}>
            <div className={styles.progressBar} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainChecker;