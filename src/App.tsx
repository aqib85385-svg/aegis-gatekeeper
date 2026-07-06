import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertCircle, VolumeX } from 'lucide-react';
import CameraCapture from './components/CameraCapture';
import DecisionCard from './components/DecisionCard';
import QuickActions from './components/QuickActions';
import SimulationPanel from './components/SimulationPanel';
import { aiService } from './services/aiService';
import { speechService } from './services/speechService';
import type { DecisionResponse } from './utils/schema';

export const App: React.FC = () => {
  // Telemetry state (simulated stadium environment)
  const [queueMinutes, setQueueMinutes] = useState<number>(2);
  const [timeToKickoff, setTimeToKickoff] = useState<number>(45);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  // Volunteer inputs
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [volunteerText, setVolunteerText] = useState<string>('');

  // Execution states
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync offline toggle state with AI service configuration
  useEffect(() => {
    aiService.setMockMode(isOfflineMode);
  }, [isOfflineMode]);

  const handleCaptureSuccess = useCallback((blob: Blob, _url: string) => {
    setCapturedBlob(blob);
    setError(null);
  }, []);

  const handleReset = useCallback(() => {
    setCapturedBlob(null);
    setDecision(null);
    setError(null);
    setLoading(false);
    speechService.cancel();
  }, []);

  const handleTelemetryChange = useCallback((queue: number, kickoff: number, offline: boolean) => {
    setQueueMinutes(queue);
    setTimeToKickoff(kickoff);
    setIsOfflineMode(offline);
  }, []);

  const handleQuickActionSelect = useCallback((text: string) => {
    setVolunteerText(text);
  }, []);

  const handleRunAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setLoading(true);
    setError(null);
    speechService.cancel();

    try {
      // Execute the decision reasoning pipeline (Policy Engine -> Serverless Proxy API -> Fallback Mocks)
      const result = await aiService.analyzeGateIncident(
        capturedBlob,
        volunteerText,
        { queueMinutes, timeToKickoff }
      );
      
      setDecision(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Failed to analyze gate incident. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Dynamic Network Status Banner */}
      {isOfflineMode && (
        <div className="offline-banner" role="status" aria-live="polite">
          <VolumeX size={16} aria-hidden="true" />
          <span>Local Simulation Active: Using client RAG fallback engine.</span>
        </div>
      )}

      {/* Accessible Header */}
      <header className="app-header">
        <div className="header-brand">
          <ShieldCheck size={28} className="brand-logo" aria-hidden="true" />
          <div>
            <h1 className="brand-title">Aegis GateKeeper</h1>
            <p className="brand-subtitle">FIFA World Cup 2026 • Volunteer Operational Assist</p>
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="main-layout">
        
        {/* Left Side: Inputs & Scanner Controls */}
        <section className="input-section" aria-label="Scan Controls">
          <div className="section-header">
            <h2 className="section-title">Gate Operations Console</h2>
          </div>

          <div className="card-container">
            {/* 1. Camera Capture & Grayscale Compressor */}
            <CameraCapture
              onCaptureSuccess={handleCaptureSuccess}
              onReset={handleReset}
              onError={(err) => setError(err.message)}
            />

            {/* 2. Manual Description Context */}
            <form onSubmit={handleRunAnalysis} className="analysis-form">
              <div className="input-group">
                <label htmlFor="volunteer-desc" className="label-bold">
                  Volunteer Observations (Context)
                </label>
                <textarea
                  id="volunteer-desc"
                  className="textarea-context"
                  placeholder="Describe ticketing issues, items, or language barriers..."
                  value={volunteerText}
                  onChange={(e) => setVolunteerText(e.target.value)}
                />
              </div>

              {/* Quick Preset Buttons */}
              <QuickActions onSelectAction={handleQuickActionSelect} />

              {/* Trigger Button */}
              <div className="action-buttons-row">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  aria-label="Assess fan situation and context for tournament decision"
                >
                  {loading ? 'Checking Tournament Policies...' : 'Assess Fan Situation'}
                </button>
                {(capturedBlob || volunteerText) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      handleReset();
                      setVolunteerText('');
                    }}
                    disabled={loading}
                    aria-label="Clear active scan and observations"
                  >
                    Reset Form
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        {/* Right Side: Operational Output & Simulation Panel */}
        <section className="output-section" aria-label="Operational Outputs">
          
          {/* Main Error Banner */}
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* AI Decision Card (ALLOW / REVIEW / DENY) */}
          <div className="section-header">
            <h2 className="section-title">Operational Directive</h2>
          </div>
          <DecisionCard decision={decision} loading={loading} />

          {/* Simulation Controls for Judges & Testers */}
          <div className="section-header margin-top-section">
            <h2 className="section-title">Simulation Environment</h2>
          </div>
          <SimulationPanel
            currentQueue={queueMinutes}
            currentTimeToKickoff={timeToKickoff}
            isOfflineMode={isOfflineMode}
            onChangeTelemetry={handleTelemetryChange}
          />
        </section>
      </main>

      {/* Accessible Footer */}
      <footer className="app-footer">
        <p>© 2026 FIFA World Cup Operations Consultant Group. Powered by Gemini 1.5 Flash.</p>
      </footer>
    </div>
  );
};

export default App;
