import React from 'react';
import { Sliders, Signal, SignalZero, Users } from 'lucide-react';

interface SimulationProfile {
  name: string;
  queueMinutes: number;
  timeToKickoff: number;
  offlineMode: boolean;
  description: string;
  icon: React.ReactNode;
}

interface SimulationPanelProps {
  currentQueue: number;
  currentTimeToKickoff: number;
  isOfflineMode: boolean;
  onChangeTelemetry: (queue: number, kickoff: number, offline: boolean) => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  currentQueue,
  currentTimeToKickoff,
  isOfflineMode,
  onChangeTelemetry
}) => {
  const profiles: SimulationProfile[] = [
    {
      name: 'Normal Gate Entry',
      queueMinutes: 2,
      timeToKickoff: 45,
      offlineMode: false,
      description: 'Standard crowd flow. AI processes requests normally.',
      icon: <Users size={16} aria-hidden="true" />
    },
    {
      name: 'Peak Kickoff Surge',
      queueMinutes: 25,
      timeToKickoff: 10,
      offlineMode: false,
      description: 'Crowded gates, kickoff close. Enables dynamic redirection redirects.',
      icon: <Sliders size={16} aria-hidden="true" />
    },
    {
      name: 'Offline Simulation',
      queueMinutes: 5,
      timeToKickoff: 35,
      offlineMode: true,
      description: 'Cuts server link. Forces client-side local RAG mock fallbacks.',
      icon: <SignalZero size={16} aria-hidden="true" />
    }
  ];

  return (
    <div className="simulation-panel" aria-label="Judge Simulation Panel">
      <div className="panel-header">
        <Sliders className="panel-icon" aria-hidden="true" />
        <h3 className="panel-title">Demo Simulation Controls</h3>
      </div>
      
      <p className="panel-desc">
        Select a profile to simulate real-time stadium states, network drops, and dynamic conditions:
      </p>

      <div className="profiles-list">
        {profiles.map((prof, index) => {
          const isActive = 
            currentQueue === prof.queueMinutes &&
            currentTimeToKickoff === prof.timeToKickoff &&
            isOfflineMode === prof.offlineMode;

          return (
            <button
              key={index}
              type="button"
              className={`btn-profile-preset ${isActive ? 'active' : ''}`}
              onClick={() => onChangeTelemetry(prof.queueMinutes, prof.timeToKickoff, prof.offlineMode)}
              aria-label={`Activate ${prof.name} simulation profile`}
            >
              <div className="profile-btn-header">
                <span className="profile-icon" aria-hidden="true">{prof.icon}</span>
                <span className="profile-name">{prof.name}</span>
              </div>
              <p className="profile-desc">{prof.description}</p>
            </button>
          );
        })}
      </div>

      <div className="telemetry-inputs">
        <h4 className="inputs-title">Manual Telemetry Override</h4>
        <div className="inputs-grid">
          <div className="input-group">
            <label htmlFor="queue-minutes">Queue Line (Min):</label>
            <input
              id="queue-minutes"
              type="number"
              min="0"
              max="120"
              value={currentQueue}
              onChange={(e) => onChangeTelemetry(Number(e.target.value), currentTimeToKickoff, isOfflineMode)}
            />
          </div>
          <div className="input-group">
            <label htmlFor="time-kickoff">Time to Kickoff (Min):</label>
            <input
              id="time-kickoff"
              type="number"
              min="0"
              max="180"
              value={currentTimeToKickoff}
              onChange={(e) => onChangeTelemetry(currentQueue, Number(e.target.value), isOfflineMode)}
            />
          </div>
          <div className="input-group checkbox-group">
            <label htmlFor="offline-checkbox" className="checkbox-label">
              <input
                id="offline-checkbox"
                type="checkbox"
                checked={isOfflineMode}
                onChange={(e) => onChangeTelemetry(currentQueue, currentTimeToKickoff, e.target.checked)}
              />
              <span className="checkbox-text">
                {isOfflineMode ? <SignalZero size={14} className="icon-offline" /> : <Signal size={14} className="icon-online" />}
                Force Offline Mode
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationPanel;
