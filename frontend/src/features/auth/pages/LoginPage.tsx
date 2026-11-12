import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';

export function LoginPage() {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; notice?: string } | null;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && user) {
    return <Navigate to={user.mustChangePassword ? '/change-password' : '/'} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const profile = await login({ username: username.trim(), password });
      if (profile.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(state?.from || '/', { replace: true });
      }
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorPayload>;
      setError(axiosErr.response?.data?.message || 'Unable to sign in. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="boa-auth-split">
      <section className="boa-auth-hero">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.25rem' }}>
            <span className="boa-brand-emblem" style={{ width: 42, height: 42, fontSize: '1rem' }}>BoA</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#ffffff' }}>Bank of Abyssinia</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Abyssinia Personal Intelligence &amp; Development</div>
            </div>
          </div>

          <h2 style={{ fontSize: '2rem', lineHeight: 1.2, margin: '0 0 0.85rem', maxWidth: 460 }}>
            Performance Intelligence, Coaching &amp; Mentoring Portal
          </h2>
          <p style={{ color: '#cbd5e1', maxWidth: 450, lineHeight: 1.55, margin: '0 0 2rem' }}>
            Unified capability governance across HR Mentoring, PMS Performance Coaching, and organizational reporting lines.
          </p>

          <div className="boa-auth-pillars">
            <div className="boa-auth-pillar">
              <strong>Permission-Driven Governance</strong>
              <span>Role matrices and adaptive workspaces strictly enforced at API and session layers.</span>
            </div>
            <div className="boa-auth-pillar">
              <strong>Precision Appraisal Rules</strong>
              <span>Tracks unrounded OverallFinalRating eligibility (&lt; 3.0000) and coaching exit readiness.</span>
            </div>
            <div className="boa-auth-pillar">
              <strong>Structured Knowledge Transfer</strong>
              <span>Certified Trainer pipelines, capacity-guarded mentoring matches, and session oversight.</span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          Protected by Bank of Abyssinia Internal Security Policies · Audited Access
        </div>
      </section>

      <section className="boa-auth-panel">
        <div className="apid-card apid-auth-card">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--brand)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            <Lock size={14} />
            Secure Portal Access
          </div>
          <h1>Sign in to APID</h1>
          <p className="apid-subtitle">
            Use your assigned APID credentials to enter your authorized workspace.
          </p>

          {state?.notice && <div className="apid-alert apid-alert-ok">{state.notice}</div>}
          {error && <div className="apid-alert apid-alert-err">{error}</div>}

          <form onSubmit={handleSubmit} className="apid-form">
            <div className="apid-field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="apid-field">
              <label htmlFor="password">Password</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((s) => !s)}
                  style={{ padding: '0 0.7rem' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="apid-btn apid-btn-primary" disabled={submitting} style={{ marginTop: '0.25rem' }}>
              {submitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
