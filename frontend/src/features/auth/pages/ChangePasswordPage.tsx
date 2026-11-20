import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { BoaBrandHeader } from '../../../shared/components/ui/BoaEmblem';
import './AuthPages.css';

export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isMinLength = newPassword.length >= 8;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;

  const handleUseNewTemporaryPassword = async () => {
    setSigningOut(true);
    let notice = 'Signed out. Sign in with the new temporary password provided by your administrator.';
    try {
      await logout();
    } catch {
      notice =
        'Browser session was cleared, but server sign-out could not be confirmed. If your password was reset, try the new temporary password.';
    }
    navigate('/login', { replace: true, state: { notice } });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const msg = await changePassword({ currentPassword, newPassword });
      navigate('/login', {
        replace: true,
        state: { notice: msg || 'Password updated successfully. Please sign in with your new password.' },
      });
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorPayload>;
      setError(axiosErr.response?.data?.message || 'Unable to update password. Please check your current password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="boa-auth-container">
      {/* LEFT: Security Explanation Pane */}
      <section className="boa-auth-hero-pane">
        <div className="boa-auth-hero-content">
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: '2.5rem' }}>
            <BoaBrandHeader compact light subtitle="Credential Security" />
          </Link>

          <div className="boa-auth-hero-eyebrow">
            <KeyRound size={14} color="#60A5FA" />
            <span>Account Security Requirement</span>
          </div>

          <h1 className="boa-auth-hero-title">
            Set Your Permanent <br />
            <span className="boa-auth-title-gold">Account Password</span>
          </h1>

          <p className="boa-auth-hero-desc">
            To ensure the security of your performance evaluations, coaching action plans, and employee records,
            you must replace your temporary access credentials with a personal password.
          </p>

          <div className="boa-auth-pillars">
            <div className="boa-auth-pillar-card">
              <div className="boa-auth-pillar-icon gold">
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong>Single-Use Password Invalidation</strong>
                <span>Updating your password immediately revokes your temporary setup token across all devices.</span>
              </div>
            </div>

            <div className="boa-auth-pillar-card">
              <div className="boa-auth-pillar-icon blue">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <strong>Unlock Full Workspace Access</strong>
                <span>Once set, you will be redirected to sign in and immediately access your assigned workspaces.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="boa-auth-hero-footer">
          <ShieldAlert size={15} />
          <span>All credential updates are verified and recorded in compliance with Bank of Abyssinia IT Security Policies.</span>
        </div>
      </section>

      {/* RIGHT: Password Form Console */}
      <section className="boa-auth-form-pane">
        <div className="boa-auth-form-top">
          <button
            type="button"
            className="boa-auth-back-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={handleUseNewTemporaryPassword}
            disabled={signingOut}
          >
            <LogOut size={14} />
            <span>{signingOut ? 'Signing out...' : 'Sign In with Different Credentials'}</span>
          </button>
        </div>

        <div className="boa-auth-card-wrap">
          <div className="boa-auth-header-pill">
            <ShieldAlert size={12} />
            <span>Mandatory Security Update</span>
          </div>

          <h2 className="boa-auth-title">Update Your Password</h2>
          <p className="boa-auth-subtitle">
            {user?.mustChangePassword
              ? 'Your account was provisioned with temporary access. Please set a secure password.'
              : 'Choose a new, secure password for your APID account.'}
          </p>

          {error && (
            <div className="boa-auth-alert err" role="alert">
              <AlertCircle size={18} className="boa-auth-alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="boa-auth-form">
            <div className="boa-input-group">
              <label htmlFor="currentPassword" className="boa-input-label">
                Current (Temporary) Password
              </label>
              <div className="boa-input-wrapper">
                <span className="boa-input-icon">
                  <Lock size={17} />
                </span>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter temporary password"
                  className="boa-auth-input"
                  required
                />
              </div>
            </div>

            <div className="boa-input-group">
              <label htmlFor="newPassword" className="boa-input-label">
                New Permanent Password
              </label>
              <div className="boa-input-wrapper">
                <span className="boa-input-icon">
                  <KeyRound size={17} />
                </span>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  className="boa-auth-input"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <div className="boa-input-group">
              <label htmlFor="confirmPassword" className="boa-input-label">
                Confirm New Password
              </label>
              <div className="boa-input-wrapper">
                <span className="boa-input-icon">
                  <KeyRound size={17} />
                </span>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  className="boa-auth-input"
                  minLength={8}
                  required
                />
              </div>
            </div>

            {/* Validation helper pills */}
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '-0.25rem' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.76rem',
                  color: isMinLength ? '#15803D' : '#64748B',
                }}
              >
                <Check size={13} color={isMinLength ? '#15803D' : '#94A3B8'} />
                <span>At least 8 characters</span>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.76rem',
                  color: isMatching ? '#15803D' : '#64748B',
                }}
              >
                <Check size={13} color={isMatching ? '#15803D' : '#94A3B8'} />
                <span>Passwords match</span>
              </div>
            </div>

            <button
              type="submit"
              className="boa-auth-submit-btn"
              disabled={submitting || signingOut}
            >
              {submitting ? (
                <>
                  <Loader2 size={17} className="apid-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Save Password &amp; Continue</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="boa-auth-form-footer">
            <div>
              Need to cancel and use another account?{' '}
              <button
                type="button"
                onClick={handleUseNewTemporaryPassword}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1D4ED8',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Sign out to login screen
              </button>
            </div>
            <div style={{ marginTop: '0.45rem', fontSize: '0.74rem', color: '#94A3B8' }}>
              Bank of Abyssinia &bull; Security &amp; Identity Management
            </div>
          </div>
        </div>

        <div style={{ height: '1.5rem' }} />
      </section>
    </div>
  );
}
