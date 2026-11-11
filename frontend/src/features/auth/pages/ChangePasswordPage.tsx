import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
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
    <div className="apid-auth-wrapper">
      <div className="apid-card apid-auth-card">
        <h1>Change Password</h1>
        <p className="apid-subtitle">
          {user?.mustChangePassword
            ? 'Your administrator account requires a password update before accessing APID.'
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
    </div>
  );
}

