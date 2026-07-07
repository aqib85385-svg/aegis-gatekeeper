// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DecisionCard } from '../../src/components/DecisionCard';
import { speechService } from '../../src/services/speechService';

// Mock speechService
vi.mock('../../src/services/speechService', () => {
  return {
    speechService: {
      speak: vi.fn(),
      cancel: vi.fn()
    },
    default: {
      speak: vi.fn(),
      cancel: vi.fn()
    }
  };
});

describe('DecisionCard Component rendering tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render loading state correctly', () => {
    render(<DecisionCard decision={null} loading={true} />);
    
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('Aegis AI is reasoning over security regulations...')).toBeDefined();
    expect(screen.queryByText('Awaiting scan capture at gate turnstile.')).toBeNull();
  });

  it('should render empty state correctly', () => {
    render(<DecisionCard decision={null} loading={false} />);
    
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('Awaiting scan capture at gate turnstile.')).toBeDefined();
  });

  it('should render ALLOW status correctly', () => {
    const decision = {
      status: 'ALLOW' as const,
      action: 'APPLY GREEN TAG & ADMIT',
      explanation: 'Ticket is valid.',
      translation: 'Puede pasar. Disfrute del partido.'
    };

    const { container } = render(<DecisionCard decision={decision} loading={false} />);
    
    expect(screen.getByText('Allow Entry')).toBeDefined();
    expect(screen.getByText('APPLY GREEN TAG & ADMIT')).toBeDefined();
    expect(screen.getByText('Ticket is valid.')).toBeDefined();
    expect(screen.getByText('"Puede pasar. Disfrute del partido."')).toBeDefined();
    
    const cardElement = container.querySelector('.decision-card');
    expect(cardElement?.className).toContain('status-allow');
  });

  it('should render REVIEW status correctly and handle Speak Out Loud triggers', () => {
    const decision = {
      status: 'REVIEW' as const,
      action: 'EMPTY FLASK & TAG DIAPER BAG',
      explanation: 'Baggage is approved under the childcare exemption but flask must be emptied.',
      translation: 'Vacíe el termo de metal.'
    };

    const { container } = render(<DecisionCard decision={decision} loading={false} />);
    
    expect(screen.getByText('Manual Review')).toBeDefined();
    expect(screen.getByText('EMPTY FLASK & TAG DIAPER BAG')).toBeDefined();
    
    const cardElement = container.querySelector('.decision-card');
    expect(cardElement?.className).toContain('status-review');

    // Trigger Speak Button
    const speakButton = screen.getByRole('button', { name: /Speak Spanish translation/i });
    fireEvent.click(speakButton);
    expect(speechService.speak).toHaveBeenCalledWith('Vacíe el termo de metal.', 'es-ES');
  });

  it('should render DENY status correctly', () => {
    const decision = {
      status: 'DENY' as const,
      action: 'SEND TO TICKET RESOLUTION',
      explanation: 'Ticket shows static screenshot.',
      translation: 'Vaya a la taquilla.'
    };

    const { container } = render(<DecisionCard decision={decision} loading={false} />);
    
    expect(screen.getByText('Deny Entry')).toBeDefined();
    expect(screen.getByText('SEND TO TICKET RESOLUTION')).toBeDefined();
    
    const cardElement = container.querySelector('.decision-card');
    expect(cardElement?.className).toContain('status-deny');
  });
});
