import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  HeartHandshake,
  Loader2,
  Lock,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { BoaBrandHeader } from '../../../shared/components/ui/BoaEmblem';
import './AuthPages.css';

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
      setError(
        axiosErr.response?.data?.message ||
          'Unable to sign in. Please check your credentials or contact IT support.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="boa-auth-container">
      {/* LEFT: Welcoming Brand & Growth Pillars Pane */}
      <section className="boa-auth-hero-pane">
        <div className="boa-auth-hero-content">
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: '2.5rem' }}>
            <BoaBrandHeader compact light subtitle="People Intelligence Development" />
          </Link>

          <div className="boa-auth-hero-eyebrow">
            <ShieldCheck size={14} color="#60A5FA" />
            <span>Bank of Abyssinia Internal Portal</span>
          </div>

          <h1 className="boa-auth-hero-title">
            Grow People. <br />
            Improve Performance. <br />
            <span className="boa-auth-title-gold">Build Knowledge.</span>
          </h1>

          <p className="boa-auth-hero-desc">
            A unified internal platform that helps Bank of Abyssinia employees develop their skills,
            collaborate with certified mentors, and excel in their roles.
          </p>

          <div className="boa-auth-pillars">
            <div className="boa-auth-pillar-card">
              <div className="boa-auth-pillar-icon gold">
                <ClipboardCheck size={18} />
              </div>
              <div>
                <strong>Performance &amp; Coaching</strong>
                <span>Continuous appraisal reviews, goal tracking, and constructive coaching guidance.</span>
              </div>
            </div>

            <div className="boa-auth-pillar-card">
              <div className="boa-auth-pillar-icon blue">
                <Award size={18} />
              </div>
              <div>
                <strong>HR Mentoring</strong>
                <span>Direct knowledge transfer with experienced banking colleagues across departments.</span>
              </div>
            </div>

            <div className="boa-auth-pillar-card">
              <div className="boa-auth-pillar-icon emerald">
                <HeartHandshake size={18} />
              </div>
              <div>
                <strong>Employee Development</strong>
                <span>Personalized growth milestones, learning agendas, and developmental support.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="boa-auth-hero-footer">
          <ShieldCheck size={15} />
          <span>Protected under Bank of Abyssinia Information Security Policies &bull; Audited Access</span>
        </div>
      </section>

      {/* RIGHT: Modern Sign-In Console Pane */}
      <section className="boa-auth-form-pane">
        <div className="boa-auth-form-top">
          <Link to="/" className="boa-auth-back-link">
            <ArrowLeft size={15} />
            <span>Back to Platform Overview</span>
          </Link>

          {/* Mobile-only logo display */}
          <div style={{ display: 'none' }} className="boa-auth-mobile-logo">
            <BoaBrandHeader compact subtitle="APID Portal" />
          </div>
        </div>

        <div className="boa-auth-card-wrap">
          <div className="boa-auth-header-pill">
            <Lock size={12} />
            <span>Secure Portal Access</span>
          </div>

          <h2 className="boa-auth-title">Sign in to APID</h2>
          <p className="boa-auth-subtitle">
            Enter your bank credentials to access your personalized employee growth workspace.
          </p>

          {/* Notice Feedback Banner (e.g. from password update) */}
          {state?.notice && (
            <div className="boa-auth-alert ok">
              <CheckCircle2 size={18} className="boa-auth-alert-icon" />
              <span>{state.notice}</span>
            </div>
          )}

          {/* Error Feedback Banner */}
          {error && (
            <div className="boa-auth-alert err" role="alert">
              <AlertCircle size={18} className="boa-auth-alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="boa-auth-form">
            <div className="boa-input-group">
              <label htmlFor="username" className="boa-input-label">
                Username or Employee ID
              </label>
              <div className="boa-input-wrapper">
                <span className="boa-input-icon">
                  <User size={17} />
                </span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="e.g. abebe.bekele"
                  className="boa-auth-input"
                  required
                />
              </div>
            </div>

            <div className="boa-input-group">
              <label htmlFor="password" className="boa-input-label">
                Password
              </label>
              <div className="boa-input-wrapper">
                <span className="boa-input-icon">
                  <Lock size={17} />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="boa-auth-input"
                  required
                  style={{ paddingRight: '2.8rem' }}
                />
                <button
                  type="button"
                  className="boa-input-action-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="boa-auth-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={17} className="apid-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="boa-auth-form-footer">
            <div>
              Having difficulty signing in? Contact your manager or the{' '}
              <span style={{ color: '#0F172A', fontWeight: 600 }}>Bank IT Service Desk</span>.
            </div>
            <div style={{ marginTop: '0.45rem', fontSize: '0.74rem', color: '#94A3B8' }}>
              Bank of Abyssinia &bull; Authorized Personnel Only
            </div>
          </div>
        </div>

        {/* Empty bottom space to maintain vertical balance */}
        <div style={{ height: '1.5rem' }} />
      </section>
    </div>
  );
}
