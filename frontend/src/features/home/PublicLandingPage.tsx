import {
  ArrowRight,
  Award,
  ChevronRight,
  ClipboardCheck,
  HeartHandshake,
  Lock,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { BoaBrandHeader } from '../../shared/components/ui/BoaEmblem';
import './PublicLandingPage.css';

export function PublicLandingPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="apid-landing-root">
      {/* Ambient Dual Glow (Royal Blue & Adey Gold) */}
      <div className="apid-landing-bg-glow" aria-hidden="true" />

      {/* Sticky Navigation Header */}
      <header className="apid-landing-header">
        <div className="apid-landing-header-inner">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <BoaBrandHeader compact light subtitle="People Intelligence Development" />
          </Link>

          <nav className="apid-landing-nav-links" aria-label="Main Navigation">
            <a href="#overview" className="apid-landing-nav-link">
              Overview
            </a>
            <a href="#workspaces" className="apid-landing-nav-link">
              Workspaces
            </a>
            <a href="#performance" className="apid-landing-nav-link">
              Performance &amp; Coaching
            </a>
            <a href="#mentoring" className="apid-landing-nav-link">
              Mentoring
            </a>
            <a href="#security" className="apid-landing-nav-link">
              Security
            </a>
          </nav>

          <div className="apid-landing-header-actions">
            {isAuthenticated && user ? (
              <Link to="/workspace" className="apid-btn-gold">
                <span>Enter Workspace</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <Link to="/login" className="apid-btn-gold">
                <Lock size={15} />
                <span>Employee Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="apid-landing-hero" id="overview">
        <div className="apid-hero-eyebrow">
          <span>Bank of Abyssinia</span>
          <span style={{ opacity: 0.4 }}>&bull;</span>
          <span className="apid-hero-eyebrow-accent">Bank Internal Platform</span>
        </div>

        <h1 className="apid-hero-title">
          Grow People. Improve Performance. <br />
          <span className="apid-hero-title-highlight">Build Knowledge.</span>
        </h1>

        <p className="apid-hero-subtitle">
          A central platform that helps Bank of Abyssinia employees improve their performance,
          develop new skills, share knowledge, and grow together.
        </p>

        {/* 3 Core Value Pillars */}
        <div className="apid-hero-value-pills">
          <div className="apid-value-pill">
            <span className="apid-value-pill-icon gold" />
            <span>Employee Development</span>
          </div>
          <div className="apid-value-pill">
            <span className="apid-value-pill-icon blue" />
            <span>Performance Management</span>
          </div>
          <div className="apid-value-pill">
            <span className="apid-value-pill-icon emerald" />
            <span>Mentoring &amp; Coaching</span>
          </div>
        </div>

        <div className="apid-hero-cta-group">
          {isAuthenticated && user ? (
            <Link to="/workspace" className="apid-btn-gold" style={{ padding: '0.75rem 1.75rem', fontSize: '0.98rem' }}>
              <span>Go to My Growth Workspace</span>
              <ArrowRight size={18} />
            </Link>
          ) : (
            <Link to="/login" className="apid-btn-gold" style={{ padding: '0.75rem 1.75rem', fontSize: '0.98rem' }}>
              <Lock size={16} />
              <span>Sign In to APID</span>
              <ArrowRight size={18} />
            </Link>
          )}
          <a
            href="#workspaces"
            className="apid-btn-blue-outline"
            style={{ padding: '0.75rem 1.6rem', fontSize: '0.98rem' }}
          >
            <span>Explore Workspaces</span>
            <ChevronRight size={17} />
          </a>
        </div>

        {/* Conceptual Device Frame (High-Level Overview, No Fake Data) */}
        <div className="apid-device-wrapper">
          <div className="apid-laptop-screen">
            {/* Mock Topbar */}
            <div className="apid-mock-topbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#FFFFFF' }}>
                  Bank of Abyssinia <span style={{ color: '#F5B700' }}>APID</span>
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    background: 'rgba(29, 78, 216, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '999px',
                    color: '#93C5FD',
                    fontWeight: 500,
                  }}
                >
                  Employee Development &amp; Performance Portal
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#94A3B8',
                  fontWeight: 500,
                }}
              >
                Internal Network
              </span>
            </div>

            {/* Mock Body: 4 Clean Area Showcases */}
            <div className="apid-mock-body">
              <div className="apid-mock-tile">
                <div className="apid-mock-tile-icon gold">
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <h4>Performance &amp; Coaching</h4>
                  <p>
                    Review goals, identify areas for improvement, and engage in constructive coaching to support continuous development.
                  </p>
                </div>
              </div>

              <div className="apid-mock-tile">
                <div className="apid-mock-tile-icon blue">
                  <Award size={20} />
                </div>
                <div>
                  <h4>HR Mentoring</h4>
                  <p>
                    Connect with experienced banking colleagues to build practical capabilities and share knowledge across departments.
                  </p>
                </div>
              </div>

              <div className="apid-mock-tile">
                <div className="apid-mock-tile-icon emerald">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h4>Employee Development</h4>
                  <p>
                    Attend scheduled learning sessions, acquire new professional skills, and keep track of your personal milestones.
                  </p>
                </div>
              </div>

              <div className="apid-mock-tile">
                <div className="apid-mock-tile-icon indigo">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4>System Administration</h4>
                  <p>
                    Maintain organizational structures, ensure secure role-based access, and oversee bank-wide platform health.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="apid-laptop-base" />
        </div>
      </section>

      {/* Workspaces Section: "One platform. Four workspaces." */}
      <section className="apid-workspaces-section" id="workspaces">
        <div className="apid-section-header">
          <div className="apid-section-eyebrow">Platform Capabilities</div>
          <h2 className="apid-section-title">One platform. Four workspaces.</h2>
          <p className="apid-section-desc">
            Organized to provide the right tools for employees, managers, HR coordinators, and
            system administrators.
          </p>
        </div>

        <div className="apid-workspaces-grid">
          {/* Card 1: Performance & Coaching */}
          <div className="apid-workspace-card accent-gold" id="performance">
            <div
              className="apid-workspace-icon"
              style={{
                background: 'rgba(245, 183, 0, 0.1)',
                border: '1px solid rgba(245, 183, 0, 0.25)',
                color: '#F5B700',
              }}
            >
              <ClipboardCheck size={24} />
            </div>
            <h3>Performance &amp; Coaching</h3>
            <p>
              Review employee performance, identify areas for improvement, and support employees through coaching.
            </p>
          </div>

          {/* Card 2: HR Mentoring */}
          <div className="apid-workspace-card accent-blue" id="mentoring">
            <div
              className="apid-workspace-icon"
              style={{
                background: 'rgba(37, 99, 235, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#60A5FA',
              }}
            >
              <Award size={24} />
            </div>
            <h3>HR Mentoring</h3>
            <p>
              Manage mentors, connect employees with experienced colleagues, and support professional development.
            </p>
          </div>

          {/* Card 3: Employee Development */}
          <div className="apid-workspace-card accent-emerald">
            <div
              className="apid-workspace-icon"
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34D399',
              }}
            >
              <HeartHandshake size={24} />
            </div>
            <h3>Employee Development</h3>
            <p>
              Attend learning sessions, develop skills, share knowledge, and track personal growth.
            </p>
          </div>

          {/* Card 4: System Administration */}
          <div className="apid-workspace-card accent-indigo">
            <div
              className="apid-workspace-icon"
              style={{
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                color: '#A5B4FC',
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <h3>System Administration</h3>
            <p>
              Manage employee accounts, organizational information, platform access, and system settings.
            </p>
          </div>
        </div>
      </section>

      {/* Supporting employee growth across the bank */}
      <section className="apid-growth-strip">
        <h3 className="apid-growth-title">Supporting employee growth across the bank</h3>

        <div className="apid-growth-grid">
          <div className="apid-growth-item">
            <div className="apid-growth-value">4</div>
            <div className="apid-growth-label">Connected workspaces</div>
          </div>

          <div className="apid-growth-value blue apid-growth-item">
            <div className="apid-growth-value blue">One</div>
            <div className="apid-growth-label">Central platform</div>
          </div>

          <div className="apid-growth-item">
            <div className="apid-growth-value">Secure</div>
            <div className="apid-growth-label">Bank employee access</div>
          </div>

          <div className="apid-growth-item">
            <div className="apid-growth-value blue">Together</div>
            <div className="apid-growth-label">Learning and knowledge sharing</div>
          </div>
        </div>
      </section>

      {/* Security Section: "A secure platform for Bank of Abyssinia" */}
      <section className="apid-security-section" id="security">
        <div className="apid-security-card">
          <div className="apid-security-icon-wrap">
            <ShieldCheck size={26} />
          </div>

          <h3 className="apid-security-title">A secure platform for Bank of Abyssinia</h3>

          <p className="apid-security-desc">
            APID is an internal Bank of Abyssinia platform. Access is restricted to authorized
            users, and platform activities are monitored in accordance with applicable bank security policies.
          </p>

          <Link to="/login" className="apid-btn-gold" style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}>
            <Lock size={15} />
            <span>Sign In with Your Bank Account</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="apid-landing-footer">
        <div className="apid-footer-inner">
          <div>
            <BoaBrandHeader compact light subtitle="People Intelligence Development" />
            <div className="apid-footer-copyright">
              &copy; {new Date().getFullYear()} Bank of Abyssinia. All rights reserved.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.86rem', color: '#94A3B8' }}>
            <a href="#overview" style={{ color: 'inherit', textDecoration: 'none' }}>
              Overview
            </a>
            <a href="#workspaces" style={{ color: 'inherit', textDecoration: 'none' }}>
              Workspaces
            </a>
            <a href="#security" style={{ color: 'inherit', textDecoration: 'none' }}>
              Security
            </a>
            <Link to="/login" style={{ color: '#F5B700', fontWeight: 600, textDecoration: 'none' }}>
              Sign In &rarr;
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
