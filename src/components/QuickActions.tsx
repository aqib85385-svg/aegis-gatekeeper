import React from 'react';
import { HelpCircle, Sparkles, Navigation, Shield } from 'lucide-react';

interface QuickActionsProps {
  onSelectAction: (text: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onSelectAction }) => {
  const actions = [
    {
      label: 'Ticket Redirect Check',
      icon: <Navigation size={16} aria-hidden="true" />,
      text: 'Fan ticket indicates Gate C, but Gate C is showing an overloaded line. Kickoff is close.'
    },
    {
      label: 'Diaper Bag Review',
      icon: <HelpCircle size={16} aria-hidden="true" />,
      text: 'Reviewing a large baby diaper bag containing a metal flask, baby wipes, and dynamic items.'
    },
    {
      label: 'Screenshot Check',
      icon: <Shield size={16} aria-hidden="true" />,
      text: 'Fan is attempting to enter using a static ticket screenshot on their phone.'
    },
    {
      label: 'Emergency: Injury near Gate',
      icon: <Sparkles size={16} aria-hidden="true" />,
      text: 'A fan has tripped and is bleeding near the turnstiles. Dispatched medical requested.'
    }
  ];

  return (
    <div className="quick-actions-panel" aria-label="Volunteer Quick Actions">
      <h3 className="panel-title">Quick Operational Queries</h3>
      <div className="quick-actions-grid">
        {actions.map((act, index) => (
          <button
            key={index}
            type="button"
            className="btn-quick-action"
            onClick={() => onSelectAction(act.text)}
            aria-label={`Insert template: ${act.label}`}
          >
            <span className="action-icon" aria-hidden="true">{act.icon}</span>
            <span className="action-label">{act.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
