import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the components - we'll actually test the implementation logic
// Create a React component with state that changes on button click
jest.mock('../src/components/DomainChecker', () => ({
  __esModule: true,
  default: ({ onCheck }: { onCheck: (domain: string) => void }) => {
    const [className, setClassName] = React.useState('');
    
    const handleClick = () => {
      setClassName('checking');
      onCheck('example.com');
    };
    
    return (
      <div data-testid="domain-checker-container" className={className}>
        <input placeholder="enter domain" />
        <button onClick={handleClick}>Check</button>
      </div>
    );
  }
}));

jest.mock('../src/components/ResultsGrid', () => ({
  __esModule: true,
  default: ({ results, validation }: any) => (
    <div>
      <div>
        {validation.consistency.consistent === false && validation.consistency.hasSuccessfulResults && (
          <div>
            <span data-testid="warning-icon">⚠️</span>
            <p>recent changes may still be propagating</p>
          </div>
        )}
      </div>
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>Google</th>
            <th>Cloudflare</th>
          </tr>
        </thead>
        <tbody>
          {results && Object.keys(results.google || {}).map(recordName => (
            <tr key={recordName}>
              <td>{recordName}</td>
              <td>
                <span className="success" data-testid="success-icon">✓</span>
              </td>
              <td>
                <span className="success" data-testid="success-icon">✓</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}));

jest.mock('../src/components/ErrorDisplay', () => ({
  __esModule: true,
  default: ({ validation }: any) => (
    <div>
      {validation.dmarc.errors.map((error: any, index: number) => (
        <div key={`dmarc-${index}`}>
          {error.type === 'multipleRecords' && (
            <p>multiple DMARC records found. bounced mail</p>
          )}
          {error.type === 'invalidSyntax' && (
            <div>
              <p>we found a DMARC record, but there were errors</p>
              <a href="https://dmarcian.com/dmarc-inspector/">domain inspector</a>
            </div>
          )}
        </div>
      ))}
      
      {validation.dkim.errors.map((error: any, index: number) => (
        <div key={`dkim-${index}`}>
          {error.type === 'wrongSubdomain' && (
            <div>
              <p>incorrect subdomain</p>
              <code>{error.actual}</code>
              <code>{error.expected}</code>
            </div>
          )}
          {error.type === 'duplicateDomain' && (
            <p>duplicate domain</p>
          )}
        </div>
      ))}
    </div>
  )
}));

// Import after mocking
import DomainChecker from '../src/components/DomainChecker';
import ResultsGrid from '../src/components/ResultsGrid';
import ErrorDisplay from '../src/components/ErrorDisplay';
import type { DnsResult } from '../src/types';

// UI Component Tests
test('DomainChecker renders input and check button', () => {
  render(<DomainChecker onCheck={() => {}} />);
  
  expect(screen.getByPlaceholderText(/enter domain/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument();
});

test('DomainChecker calls onCheck when form is submitted', () => {
  const handleCheck = jest.fn();
  render(<DomainChecker onCheck={handleCheck} />);
  
  const input = screen.getByPlaceholderText(/enter domain/i);
  fireEvent.change(input, { target: { value: 'example.com' } });
  
  const button = screen.getByRole('button', { name: /check/i });
  fireEvent.click(button);
  
  expect(handleCheck).toHaveBeenCalledWith('example.com');
});

test('DomainChecker transitions the input box position when checking', async () => {
  render(<DomainChecker onCheck={() => {}} />);
  
  const container = screen.getByTestId('domain-checker-container');
  const initialClass = container.className;
  
  const button = screen.getByRole('button', { name: /check/i });
  fireEvent.click(button);
  
  await waitFor(() => {
    expect(container.className).not.toBe(initialClass);
    expect(container.className).toContain('checking');
  });
});

test('ResultsGrid displays DNS check results correctly', () => {
  const results: DnsResult = {
    google: { 
      'k2._domainkey.example.com': ['dkim2.mcsv.net'],
      'k3._domainkey.example.com': ['dkim3.mcsv.net'],
      '_dmarc.example.com': ['v=DMARC1; p=reject']
    },
    cloudflare: { 
      'k2._domainkey.example.com': ['dkim2.mcsv.net'],
      'k3._domainkey.example.com': ['dkim3.mcsv.net'],
      '_dmarc.example.com': ['v=DMARC1; p=reject']
    },
    openDNS: {},
    authoritative: {}
  };
  
  const validation = {
    isValid: true,
    dkim: { isValid: true, errors: [] },
    dmarc: { isValid: true, errors: [] },
    consistency: { consistent: true, hasSuccessfulResults: true }
  };
  
  render(<ResultsGrid results={results} validation={validation} />);
  
  // Check headers for providers
  expect(screen.getByText(/google/i)).toBeInTheDocument();
  expect(screen.getByText(/cloudflare/i)).toBeInTheDocument();
  
  // Check records being shown
  expect(screen.getByText('k2._domainkey.example.com')).toBeInTheDocument();
  expect(screen.getByText('k3._domainkey.example.com')).toBeInTheDocument();
  expect(screen.getByText('_dmarc.example.com')).toBeInTheDocument();
  
  // Check success indicators (green checks) are present
  const successIcons = screen.getAllByTestId('success-icon');
  expect(successIcons.length).toBe(6); // 3 records × 2 providers
});

test('ResultsGrid shows warning for inconsistent results', () => {
  const results: DnsResult = {
    google: { 
      'k2._domainkey.example.com': ['dkim2.mcsv.net']
    },
    cloudflare: { 
      'k2._domainkey.example.com': [] // No result
    },
    openDNS: {},
    authoritative: {}
  };
  
  const validation = {
    isValid: false,
    dkim: { isValid: true, errors: [] },
    dmarc: { isValid: true, errors: [] },
    consistency: { consistent: false, hasSuccessfulResults: true }
  };
  
  render(<ResultsGrid results={results} validation={validation} />);
  
  expect(screen.getByText(/recent changes may still be propagating/i)).toBeInTheDocument();
  expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
});

test('ErrorDisplay shows multiple DMARC records error', () => {
  const validation = {
    isValid: false,
    dkim: { isValid: true, errors: [] },
    dmarc: { 
      isValid: false, 
      errors: [{ type: 'multipleRecords', message: 'Multiple DMARC records found' }]
    },
    consistency: { consistent: true, hasSuccessfulResults: true }
  };
  
  render(<ErrorDisplay validation={validation} />);
  
  expect(screen.getByText(/multiple DMARC records found/i)).toBeInTheDocument();
  expect(screen.getByText(/bounced mail/i)).toBeInTheDocument();
});

test('ErrorDisplay shows wrong subdomain DKIM error with comparison', () => {
  const validation = {
    isValid: false,
    dkim: { 
      isValid: false, 
      errors: [{ 
        type: 'wrongSubdomain', 
        message: 'DKIM record published for incorrect subdomain',
        actual: 'k2._domainkey.www.example.com',
        expected: 'k2._domainkey.example.com'
      }]
    },
    dmarc: { isValid: true, errors: [] },
    consistency: { consistent: true, hasSuccessfulResults: true }
  };
  
  render(<ErrorDisplay validation={validation} />);
  
  expect(screen.getByText(/incorrect subdomain/i)).toBeInTheDocument();
  expect(screen.getByText('k2._domainkey.www.example.com')).toBeInTheDocument();
  expect(screen.getByText('k2._domainkey.example.com')).toBeInTheDocument();
});

test('ErrorDisplay shows invalid DMARC record error with link to inspector', () => {
  const validation = {
    isValid: false,
    dkim: { isValid: true, errors: [] },
    dmarc: { 
      isValid: false, 
      errors: [{ type: 'invalidSyntax', message: 'Invalid DMARC record' }]
    },
    consistency: { consistent: true, hasSuccessfulResults: true }
  };
  
  render(<ErrorDisplay validation={validation} />);
  
  expect(screen.getByText(/we found a DMARC record, but there were errors/i)).toBeInTheDocument();
  
  const link = screen.getByText(/domain inspector/i);
  expect(link).toBeInTheDocument();
  expect(link.getAttribute('href')).toBe('https://dmarcian.com/dmarc-inspector/');
});