import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Volume2 } from 'lucide-react';
import type { DecisionResponse } from '../utils/schema';
import { speechService } from '../services/speechService';

interface DecisionCardProps {
  decision: DecisionResponse | null;
  loading: boolean;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, loading }) => {
  if (loading) {
    return (
      <div 
        className="decision-card loading-state"
        role="status" 
        aria-live="polite"
      >
        <div className="spinner" aria-hidden="true"></div>
        <p className="loading-text">Aegis AI is reasoning over security regulations...</p>
      </div>
    );
  }

  if (!decision) {
    return (
      <div 
        className="decision-card empty-state"
        role="status"
        aria-live="polite"
      >
        <p className="empty-text">Awaiting scan capture at gate turnstile.</p>
      </div>
    );
  }

  const { status, action, explanation, translation } = decision;

  // Set up accessibility and visual states
  let cardClass = '';
  let statusIcon = null;
  let labelText = '';

  switch (status) {
    case 'ALLOW':
      cardClass = 'status-allow';
      statusIcon = <ShieldCheck className="icon-status" aria-hidden="true" />;
      labelText = 'Allow Entry';
      break;
    case 'REVIEW':
      cardClass = 'status-review';
      statusIcon = <AlertTriangle className="icon-status" aria-hidden="true" />;
      labelText = 'Manual Review';
      break;
    case 'DENY':
      cardClass = 'status-deny';
      statusIcon = <AlertOctagon className="icon-status" aria-hidden="true" />;
      labelText = 'Deny Entry';
      break;
  }

  const handleSpeak = () => {
    speechService.speak(translation, 'es-ES'); // Play Spanish translation aloud
  };

  return (
    <div 
      className={`decision-card ${cardClass}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="card-header">
        {statusIcon}
        <span className="status-label">{labelText}</span>
      </div>

      <div className="card-body">
        <h2 className="action-title" id="action-heading">
          {action}
        </h2>
        
        <div className="section-block">
          <h3 className="section-label">EXPLANATION (VOLUNTEER VIEW)</h3>
          <p className="explanation-text">{explanation}</p>
        </div>

        <div className="section-block fan-translation-block">
          <h3 className="section-label">SPANISH TRANSLATION (FAN VIEW)</h3>
          <p className="translation-text" lang="es">
            "{translation}"
          </p>
          <button 
            type="button"
            className="btn-speak"
            onClick={handleSpeak}
            aria-label="Speak Spanish translation aloud for the fan"
          >
            <Volume2 size={20} className="icon-speak" aria-hidden="true" />
            <span>Speak Out Loud</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DecisionCard;
