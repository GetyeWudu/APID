import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';

export function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <span className="boa-brand-emblem" style={{ width: 42, height: 42, fontSize: '1rem' }}>BoA</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#ffffff' }}>Bank of Abyssinia</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>APID Credential Security</div>
            </div>
          </div>
          <h2 style={{ fontSize: '1.85rem', margin: '0 0 0.75rem' }}>Password Rotation Required</h2>
          <p style={{ color: '#cbd5e1', maxWidth: 440, lineHeight: 1.55 }}>
            Updating your credentials revokes temporary tokens and unlocks your authorized APID dashboard permissions.
          </p>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          All password changes are logged to the immutable security audit trail.
        </div>
      </section>

      <section className="boa-auth-panel">
        <div className="apid-card apid-auth-card">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--brand)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            <ShieldAlert size={15} />
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
              />
            </div>

            <button type="submit" className="apid-btn apid-btn-primary" disabled={submitting}>
              {submitting ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
