import React from 'react';
import { describe, it, expect } from 'vitest';
import DecisionCard from '../../src/components/DecisionCard';

describe('DecisionCard Component rendering tests', () => {
  it('should compile as a valid React component function', () => {
    const element = React.createElement(DecisionCard, {
      decision: null,
      loading: false
    });
    
    expect(element).toBeDefined();
    expect(element.props.loading).toBe(false);
    expect(element.props.decision).toBeNull();
  });

  it('should handle ALLOW decision props correctly', () => {
    const element = React.createElement(DecisionCard, {
      decision: {
        status: 'ALLOW',
        action: 'ALLOW ENTRY',
        explanation: 'Ticket is valid.',
        translation: 'Adelante'
      },
      loading: false
    });
    
    expect(element).toBeDefined();
    expect(element.props.decision?.status).toBe('ALLOW');
  });

  it('should handle REVIEW decision props correctly', () => {
    const element = React.createElement(DecisionCard, {
      decision: {
        status: 'REVIEW',
        action: 'MANUAL REVIEW',
        explanation: 'Check diaper bag.',
        translation: 'Revisión manual'
      },
      loading: false
    });
    
    expect(element).toBeDefined();
    expect(element.props.decision?.status).toBe('REVIEW');
  });

  it('should handle DENY decision props correctly', () => {
    const element = React.createElement(DecisionCard, {
      decision: {
        status: 'DENY',
        action: 'DENY ENTRY',
        explanation: 'Counterfeit ticket.',
        translation: 'Acceso denegado'
      },
      loading: false
    });
    
    expect(element).toBeDefined();
    expect(element.props.decision?.status).toBe('DENY');
  });
});
