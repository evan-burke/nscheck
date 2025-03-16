import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DomainChecker from '../src/components/DomainChecker';
import ResultsGrid from '../src/components/ResultsGrid';
import ErrorDisplay from '../src/components/ErrorDisplay';
import { DnsResult } from '../src/types';

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
  const results = {
    google: { 
      'k2._domainkey.example.com': ['dkim2.mcsv.net'],
      'k3._domainkey.example.com': ['dkim3.mcsv.net'],
      '_dmarc.example.com': ['v=DMARC1; p=reject']
    },
    cloudflare: { 
      'k2._domainkey.example.com': ['dkim2.mcsv.net'],
      'k3._domainkey.example.com': ['dkim3.mcsv.net'],
      '_dmarc.example.com': ['v=DMARC1; p=reject']
    }
  } as DnsResult;
  
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
  const results = {
    google: { 
      'k2._domainkey.example.com': ['dkim2.mcsv.net']
    },
    cloudflare: { 
      'k2._domainkey.example.com': [] // No result
    }
  } as DnsResult;
  
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