/**
 * Tests for domain input handling in DomainChecker component
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DomainChecker from '../src/components/DomainChecker';
import '@testing-library/jest-dom';

describe('DomainChecker input field updates', () => {
  // Create a mock for the onCheck function
  const mockOnCheck = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('updates input field with extracted domain from URL', () => {
    render(<DomainChecker onCheck={mockOnCheck} />);
    
    // Get the input field
    const input = screen.getByPlaceholderText('domain to check');
    const button = screen.getByText("Let's go!");
    
    // Enter a URL
    fireEvent.change(input, { target: { value: 'https://example.com/path?query=123' } });
    
    // Submit the form
    fireEvent.click(button);
    
    // Check that the input field has been updated with the extracted domain
    expect(input).toHaveValue('example.com');
    
    // Also verify that onCheck was called with the extracted domain
    expect(mockOnCheck).toHaveBeenCalledWith('example.com');
  });
  
  test('extracts domain from URL for www prompt display', () => {
    render(<DomainChecker onCheck={mockOnCheck} />);
    
    // Get the input field
    const input = screen.getByPlaceholderText('domain to check');
    const button = screen.getByText("Let's go!");
    
    // Enter a URL with www
    fireEvent.change(input, { target: { value: 'https://www.example.com/path?query=123' } });
    
    // Submit the form 
    fireEvent.click(button);
    
    // Check that the input field has been updated with the extracted domain
    expect(input).toHaveValue('www.example.com');
    
    // Check that the www prompt is shown
    expect(screen.getByText(/DKIM records are usually published on the root domain/)).toBeInTheDocument();
    
    // Check that the buttons display the correct domains
    expect(screen.getByText('Yes, use example.com')).toBeInTheDocument();
    expect(screen.getByText('No, keep www.example.com')).toBeInTheDocument();
    
    // Verify that onCheck is not called yet
    expect(mockOnCheck).not.toHaveBeenCalled();
    
    // Now click the "No, keep www.example.com" button
    fireEvent.click(screen.getByText('No, keep www.example.com'));
    
    // Verify onCheck is called with the www domain
    expect(mockOnCheck).toHaveBeenCalledWith('www.example.com');
  });
});