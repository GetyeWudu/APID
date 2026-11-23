import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import {
  ArrowRight,
  Award,
  BrainCircuit,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';

export function LoginPage() {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; notice?: string } | null;

  const [isLoginOpen, setIsLoginOpen] = useState(Boolean(state?.from || state?.notice));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (state?.from || state?.notice) {
      setIsLoginOpen(true);
    }
  }, [state]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoginOpen) {
        setIsLoginOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoginOpen]);

  if (isAuthenticated && user) {
    return <Navigate to={user.mustChangePassword ? '/change-password' : '/'} replace />;
  }

  const openLogin = () => {
    setError(null);
    setIsLoginOpen(true);
    setTimeout(() => {
      const input = document.getElementById('username');
      if (input) input.focus();
    }, 60);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

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
    <div className="boa-landing-page">
      {/* Background Header Circles Architecture */}
      <div className="boa-landing-canvas-circle-1" aria-hidden="true" />
      <div className="boa-landing-canvas-circle-2" aria-hidden="true" />

      {/* Floating Glassmorphic Pill Navbar */}
      <div className="boa-floating-nav-wrapper">
        <header className="boa-floating-nav">
          <div className="boa-nav-brand">
            <span
              className="boa-brand-emblem"
              style={{
                width: 38,
                height: 38,
                fontSize: '0.92rem',
                boxShadow: '0 3px 10px rgba(197, 155, 39, 0.35)',
              }}
            >
              BoA
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
              <span className="boa-nav-brand-title">APID System</span>
              <span className="boa-nav-brand-tag">Enterprise Hub</span>
            </div>
          </div>

          <nav aria-label="Main Landing Navigation">
            <ul className="boa-nav-pill-links">
              <li>
                <button
                  type="button"
                  className="boa-nav-pill-item"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  Overview
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="boa-nav-pill-item"
                  onClick={() => scrollToSection('initiatives-section')}
                >
                  Digital Initiatives
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="boa-nav-pill-item"
                  onClick={() => scrollToSection('mentorship-showcase')}
                >
                  Mentorship &amp; Coaching
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="boa-nav-pill-item"
                  onClick={() => window.open('https://www.bankofabyssinia.com', '_blank', 'noopener,noreferrer')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <span>Bank of Abyssinia</span>
                  <ExternalLink size={13} />
                </button>
              </li>
            </ul>
          </nav>

          <button
            type="button"
            className="boa-nav-cta"
            onClick={openLogin}
          >
            <Lock size={13} />
            <span>Sign In</span>
          </button>
        </header>
      </div>

      {/* Hero Section: Centered Editorial Luxury Canvas */}
      <main>
        <section className="boa-editorial-hero">
          <div className="boa-hero-tag-pill">
            <Sparkles size={14} color="#C59B27" />
            <span>A Trusted Platform for Banking Professionals</span>
          </div>

          <h1>
            Elevate Your Career <br />
            <span className="boa-gold-gradient-text">with Expert Guidance</span>
          </h1>

          <p>
            Connect with industry leaders, gain valuable insights, and accelerate your professional growth in the banking sector.
          </p>

          <div className="boa-hero-actions">
            <button
              type="button"
              className="boa-btn-primary-glow"
              onClick={openLogin}
            >
              <Play size={15} fill="#1A1C1E" />
              <span>Get Started</span>
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="boa-btn-secondary-outline"
              onClick={() => scrollToSection('initiatives-section')}
            >
              <span>Explore Strategic Initiatives</span>
            </button>
          </div>

          {/* Key Metrics Telemetry Ribbon */}
          <div className="boa-hero-stats-ribbon">
            <div className="boa-ribbon-stat">
              <strong>11,000<span>+</span></strong>
              <span className="boa-ribbon-label">Active Employees</span>
            </div>
            <div className="boa-ribbon-divider" />
            <div className="boa-ribbon-stat">
              <strong>500<span>+</span></strong>
              <span className="boa-ribbon-label">Branches Nationwide</span>
            </div>
            <div className="boa-ribbon-divider" />
            <div className="boa-ribbon-stat">
              <strong>1,200<span>+</span></strong>
              <span className="boa-ribbon-label">Training Sessions</span>
            </div>
            <div className="boa-ribbon-divider" />
            <div className="boa-ribbon-stat">
              <strong>150<span>+</span></strong>
              <span className="boa-ribbon-label">Expert Mentors</span>
            </div>
          </div>
        </section>

        {/* Section 1: Asymmetric Interactive Bento Showcase */}
        <section id="mentorship-showcase" className="boa-bento-section">
          <div className="boa-bento-grid">
            {/* Dominant Asymmetric Card: 150+ Expert Mentors Hub */}
            <article className="boa-bento-card-main">
              <div>
                <div className="boa-bento-top-badge">
                  <Award size={14} />
                  <span>150+ Expert Mentors · Ready to guide your career</span>
                </div>

                <h3>Executive Guidance &amp; Professional Mentorship</h3>
                <p>
                  Connect directly with certified banking leaders across credit risk, FinTech innovations, branch operations, and enterprise leadership. Receive 1-on-1 advisory tailored to Bank of Abyssinia career advancement.
                </p>

                <div className="boa-bento-domain-tags">
                  <span className="boa-bento-domain-tag">Banking Operations</span>
                  <span className="boa-bento-domain-tag">FinTech &amp; Digital Payments</span>
                  <span className="boa-bento-domain-tag">Credit &amp; Risk Analytics</span>
                  <span className="boa-bento-domain-tag">Branch Leadership</span>
                  <span className="boa-bento-domain-tag">Internal Audit &amp; Compliance</span>
                </div>
              </div>

              <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)' }} />
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1A1C1E' }}>
                    Active Mentorship Network
                  </span>
                </div>

                <button
                  type="button"
                  onClick={openLogin}
                  className="apid-btn apid-btn-outline"
                  style={{
                    borderColor: 'rgba(197, 155, 39, 0.4)',
                    background: '#FFFFFF',
                    color: '#C59B27',
                    fontWeight: 750,
                    fontSize: '0.86rem',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '999px',
                  }}
                >
                  Join as Mentee or Mentor &rarr;
                </button>
              </div>
            </article>

            {/* Sub-Card 1: Performance Coaching Alignment */}
            <article className="boa-bento-card-sub">
              <div>
                <div className="boa-bento-sub-header">
                  <div className="boa-bento-icon-box">
                    <TrendingUp size={22} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#C59B27', background: 'rgba(197, 155, 39, 0.1)', padding: '0.25rem 0.65rem', borderRadius: 999 }}>
                    PMS Alignment
                  </span>
                </div>
                <h4>Performance Coaching Hub</h4>
                <p>
                  Structured appraisal governance tracking development plans, session frequency compliance, and measurable competency improvements.
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 750, color: '#1A1C1E', marginBottom: '0.25rem' }}>
                  <span>Coaching Plan Completion</span>
                  <span style={{ color: '#C59B27' }}>98.4%</span>
                </div>
                <div className="boa-bento-progress-track">
                  <div className="boa-bento-progress-fill" style={{ width: '98.4%' }} />
                </div>
              </div>
            </article>

            {/* Sub-Card 2: Enterprise Leadership Pipeline */}
            <article className="boa-bento-card-sub">
              <div>
                <div className="boa-bento-sub-header">
                  <div className="boa-bento-icon-box" style={{ background: 'rgba(26, 28, 30, 0.06)', borderColor: 'rgba(26, 28, 30, 0.12)', color: '#1A1C1E' }}>
                    <Users size={22} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#5C626A', background: '#F1F3F5', padding: '0.25rem 0.65rem', borderRadius: 999 }}>
                    Enterprise Scope
                  </span>
                </div>
                <h4>Leadership Pipeline &amp; Readiness</h4>
                <p>
                  Multi-branch organizational alignment enabling executive leadership to review talent health, capacity-guarded ratios, and enterprise succession.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid #F3F4F6' }}>
                <CheckCircle2 size={16} color="#C59B27" />
                <span style={{ fontSize: '0.82rem', color: '#5C626A', fontWeight: 600 }}>
                  Centralized across 500+ branches
                </span>
              </div>
            </article>
          </div>
        </section>

        {/* Section 2: Why Choose Our Digital HR Initiatives? (2x2 Bento Architecture) */}
        <section id="initiatives-section" className="boa-initiatives-section">
          <div className="boa-initiatives-inner">
            <div className="boa-section-header-center">
              <div className="boa-section-pill-gold">
                <Sparkles size={13} />
                <span>Strategic Transformation</span>
              </div>
              <h2 className="boa-section-title-large">
                Why Choose Our Digital HR Initiatives?
              </h2>
              <p className="boa-section-desc-lead">
                We leverage modern enterprise technology and centralized digital systems to transform your professional development and career journey.
              </p>
            </div>

            <div className="boa-initiatives-grid">
              {/* Initiative 1 */}
              <article className="boa-initiative-card">
                <div>
                  <div className="boa-initiative-icon-squircle">
                    <GraduationCap size={26} />
                  </div>
                  <h4>Digital Learning Platforms</h4>
                  <p>
                    Access personalized, mobile-ready e-learning modules designed to continuously upgrade your core banking competencies through our digital campus.
                  </p>
                </div>
                <div className="boa-initiative-tags">
                  <span className="boa-initiative-tag">Mobile-Ready Modules</span>
                  <span className="boa-initiative-tag">Digital Campus</span>
                  <span className="boa-initiative-tag">Core Competencies</span>
                </div>
              </article>

              {/* Initiative 2 */}
              <article className="boa-initiative-card">
                <div>
                  <div className="boa-initiative-icon-squircle">
                    <BrainCircuit size={26} />
                  </div>
                  <h4>AI-Driven Talent Mapping</h4>
                  <p>
                    Leverage intelligent algorithms to receive personalized career path recommendations and smart skill-building resources tailored to your role.
                  </p>
                </div>
                <div className="boa-initiative-tags">
                  <span className="boa-initiative-tag">Smart Algorithms</span>
                  <span className="boa-initiative-tag">Career Pathways</span>
                  <span className="boa-initiative-tag">Skill Matching</span>
                </div>
              </article>

              {/* Initiative 3 */}
              <article className="boa-initiative-card">
                <div>
                  <div className="boa-initiative-icon-squircle">
                    <TrendingUp size={26} />
                  </div>
                  <h4>Integrated People Analytics</h4>
                  <p>
                    Utilize transparent, real-time digital dashboards to track performance metrics and empower objective decisions regarding your career advancement.
                  </p>
                </div>
                <div className="boa-initiative-tags">
                  <span className="boa-initiative-tag">Real-Time Telemetry</span>
                  <span className="boa-initiative-tag">Transparent Metrics</span>
                  <span className="boa-initiative-tag">Objective Growth</span>
                </div>
              </article>

              {/* Initiative 4 */}
              <article className="boa-initiative-card">
                <div>
                  <div className="boa-initiative-icon-squircle">
                    <Award size={26} />
                  </div>
                  <h4>Unified Digital Experience</h4>
                  <p>
                    Navigate your entire professional journey through a centralized enterprise portal integrating performance, feedback, and continuous interactive learning.
                  </p>
                </div>
                <div className="boa-initiative-tags">
                  <span className="boa-initiative-tag">Centralized Portal</span>
                  <span className="boa-initiative-tag">Single Sign-On</span>
                  <span className="boa-initiative-tag">Audited Governance</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Section 3: High-Impact Pre-Footer Call to Action */}
        <section className="boa-prefooter-cta-wrapper">
          <div className="boa-prefooter-cta-card">
            <div className="boa-prefooter-content">
              <h3>Ready to Elevate Your Banking Career?</h3>
              <p>
                Join over 11,000 Bank of Abyssinia professionals leveraging APID for structured mentorship, performance coaching, and career excellence.
              </p>
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <button
                type="button"
                className="boa-btn-primary-glow"
                onClick={openLogin}
                style={{ padding: '1rem 2.25rem', fontSize: '1.05rem' }}
              >
                <Lock size={16} />
                <span>Sign In to APID Portal</span>
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Modern Login Modal Dialog (Opens when Get Started or Sign In is clicked) */}
      {isLoginOpen && (
        <div
          className="boa-login-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLoginOpen(false);
          }}
        >
          <div className="boa-login-modal-card">
            <button
              type="button"
              className="boa-modal-close-btn"
              onClick={() => setIsLoginOpen(false)}
              aria-label="Close login dialog"
            >
              <X size={18} />
            </button>

            {/* Top pill badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                color: '#C59B27',
                background: 'rgba(197, 155, 39, 0.08)',
                border: '1px solid rgba(197, 155, 39, 0.22)',
                borderRadius: '20px',
                padding: '0.3rem 0.75rem',
                fontSize: '0.74rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.65rem',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Lock size={12} />
              Secure Portal Access
            </div>

            <h2
              id="login-dialog-title"
              style={{
                margin: '0 0 0.35rem',
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#1A1C1E',
                letterSpacing: '-0.025em',
                position: 'relative',
                zIndex: 1,
              }}
            >
              Sign in to APID
            </h2>
            <p
              style={{
                margin: '0 0 1.35rem',
                fontSize: '0.86rem',
                color: '#5C626A',
                lineHeight: 1.5,
                position: 'relative',
                zIndex: 1,
              }}
            >
              Use your assigned APID credentials to enter your authorized workspace.
            </p>

            {state?.notice && (
              <div className="apid-alert apid-alert-ok" style={{ position: 'relative', zIndex: 1, marginBottom: '1rem' }}>
                {state.notice}
              </div>
            )}
            {error && (
              <div className="apid-alert apid-alert-err" style={{ position: 'relative', zIndex: 1, marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="apid-form" style={{ position: 'relative', zIndex: 1 }}>
              <div className="apid-field">
                <label htmlFor="username" style={{ color: '#2C3036', fontWeight: 650, fontSize: '0.82rem' }}>
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="Enter your username"
                  required
                  style={{
                    padding: '0.65rem 0.85rem',
                    border: '1px solid #E5E7EB',
                    borderRadius: '9px',
                    background: '#FFFFFF',
                    color: '#1A1C1E',
                  }}
                />
              </div>

              <div className="apid-field">
                <label htmlFor="password" style={{ color: '#2C3036', fontWeight: 650, fontSize: '0.82rem' }}>
                  Password
                </label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.85rem',
                      border: '1px solid #E5E7EB',
                      borderRadius: '9px',
                      background: '#FFFFFF',
                      color: '#1A1C1E',
                    }}
                  />
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((s) => !s)}
                    style={{
                      padding: '0 0.8rem',
                      borderColor: '#E5E7EB',
                      background: '#F7F7F7',
                      color: '#5C626A',
                      borderRadius: '9px',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="apid-btn apid-btn-primary"
                disabled={submitting}
                style={{
                  marginTop: '0.5rem',
                  background: 'linear-gradient(135deg, #D4AF37 0%, #C59B27 100%)',
                  color: '#1A1C1E',
                  borderColor: 'transparent',
                  fontWeight: 750,
                  fontSize: '0.95rem',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '10px',
                  boxShadow: '0 4px 14px rgba(197, 155, 39, 0.28)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <div
              style={{
                marginTop: '1.25rem',
                paddingTop: '0.85rem',
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                fontSize: '0.75rem',
                color: '#9CA3AF',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <ShieldCheck size={14} color="#C59B27" />
              <span>Bank of Abyssinia Internal Security · Audited Access</span>
            </div>
          </div>
        </div>
      )}

      {/* Luxury Footer */}
      <footer className="boa-luxury-footer">
        <div className="boa-luxury-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              className="boa-brand-emblem"
              style={{
                width: 36,
                height: 36,
                fontSize: '0.9rem',
              }}
            >
              BoA
            </span>
            <div>
              <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.95rem' }}>
                Bank of Abyssinia · APID System
              </div>
              <div style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
                Abyssinia People Intelligence &amp; Development
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: '#9CA3AF' }}>
            <ShieldCheck size={15} color="#C59B27" />
            <span>Bank of Abyssinia Internal Security · Audited Access</span>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
            &copy; {new Date().getFullYear()} Bank of Abyssinia. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
