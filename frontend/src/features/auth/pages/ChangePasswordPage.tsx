import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';

export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleUseNewTemporaryPassword = async () => {
    setSigningOut(true);
    let notice = 'Signed out. Sign in with the new temporary password provided by your administrator.';
    try {
      await logout();
    } catch {
      notice =
        'This browser session was cleared, but server sign-out could not be confirmed. If your password was reset, try the new temporary password.';
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
        state: { notice: msg || 'Password updated. Please sign in with your new password.' },
      });
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorPayload>;
      setError(axiosErr.response?.data?.message || 'Unable to change password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="boa-auth-split">
      <section className="boa-auth-hero">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '2.5rem' }}>
            <span
              className="boa-brand-emblem"
              style={{
                width: 46,
                height: 46,
                fontSize: '1.05rem',
                boxShadow: '0 4px 14px rgba(197, 155, 39, 0.35)',
              }}
            >
              BoA
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
                Bank of Abyssinia
              </div>
              <div style={{ fontSize: '0.8rem', color: '#9CA3AF', letterSpacing: '0.01em' }}>
                APID Credential Security
              </div>
            </div>
          </div>
          <h2 style={{ fontSize: '2rem', lineHeight: 1.25, margin: '0 0 0.85rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            Password Rotation <span style={{ color: '#D4AF37' }}>Required</span>
          </h2>
          <p style={{ color: '#9CA3AF', maxWidth: 440, lineHeight: 1.6, fontSize: '0.92rem' }}>
            Updating your credentials revokes temporary tokens and unlocks your authorized APID dashboard permissions.
          </p>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '2rem' }}>
          <ShieldAlert size={15} color="#C59B27" />
          <span>All password changes are logged to the immutable security audit trail.</span>
        </div>
      </section>

      <section className="boa-auth-panel">
        <div className="apid-card apid-auth-card">
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
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.85rem',
            }}
          >
            <ShieldAlert size={14} />
            Account Security
          </div>
          <h1>Change Password</h1>
          <p className="apid-subtitle">
            {user?.mustChangePassword
              ? 'Your account requires a password update before accessing APID modules.'
              : 'Update your account password. You will be asked to sign in again.'}
          </p>

          {error && <div className="apid-alert apid-alert-err">{error}</div>}

          <form onSubmit={handleSubmit} className="apid-form">
            <div className="apid-field">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
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
              <label htmlFor="newPassword">New Password (min 8 chars)</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
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
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
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

            <button
              type="submit"
              className="apid-btn apid-btn-primary"
              disabled={submitting || signingOut}
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
                cursor: submitting || signingOut ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Updating Password...' : 'Update Password'}
            </button>
            {user?.mustChangePassword && (
              <>
                <p className="apid-subtitle" style={{ margin: '0.5rem 0 0', fontSize: '0.82rem' }}>
                  Forgot your current temporary password? Ask an administrator to reset it, then sign
                  in with the new temporary password.
                </p>
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  disabled={submitting || signingOut}
                  onClick={() => void handleUseNewTemporaryPassword()}
                  style={{
                    borderColor: '#E5E7EB',
                    background: '#F7F7F7',
                    color: '#2C3036',
                    borderRadius: '9px',
                    padding: '0.6rem 1rem',
                    fontWeight: 600,
                  }}
                >
                  {signingOut ? 'Signing out...' : 'Back to Sign In'}
                </button>
              </>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
