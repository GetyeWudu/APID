import React, { useEffect, useState } from 'react';
import { X, Video, ExternalLink, AlertCircle, Loader2, Users, Shield } from 'lucide-react';
import { CoachingSessionItem, SessionJoinToken, coachingSessionApi } from '../api/coachingSessionApi';

interface DailyVideoModalProps {
  session: CoachingSessionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DailyVideoModal: React.FC<DailyVideoModalProps> = ({
  session,
  isOpen,
  onClose,
}) => {
  const [tokenData, setTokenData] = useState<SessionJoinToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !session) {
      setTokenData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await coachingSessionApi.getJoinToken(session.id);
        if (isMounted) {
          setTokenData(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to connect to video meeting room.';
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchToken();

    return () => {
      isMounted = false;
    };
  }, [isOpen, session]);

  if (!isOpen || !session) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="apid-card"
        style={{
          width: '95vw',
          maxWidth: '1100px',
          height: '85vh',
          margin: 0,
          background: '#0f172a',
          color: '#f8fafc',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: '#1e293b',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(202, 138, 4, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ca8a04',
              }}
            >
              <Video size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                {session.title}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Users size={13} /> {session.participants.length} Participants
                </span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Shield size={13} /> Bank of Abyssinia Daily.co Video Room
                </span>
                {tokenData?.isMock && (
                  <span
                    style={{
                      background: 'rgba(234, 179, 8, 0.2)',
                      color: '#fde047',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    Simulated Dev Room
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {tokenData?.roomUrlWithToken && (
              <a
                href={tokenData.roomUrlWithToken}
                target="_blank"
                rel="noreferrer"
                className="apid-btn apid-btn-outline"
                style={{
                  color: '#94a3b8',
                  borderColor: '#475569',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <ExternalLink size={14} /> Open in New Tab
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="apid-btn apid-btn-outline"
              style={{
                color: '#94a3b8',
                borderColor: '#475569',
                padding: '0.35rem 0.5rem',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Video Body */}
        <div style={{ flex: 1, position: 'relative', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading && (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: '#ca8a04' }} />
              <div>Connecting to Daily.co video room...</div>
            </div>
          )}

          {error && (
            <div
              style={{
                maxWidth: 450,
                textAlign: 'center',
                padding: '2rem',
                background: '#1e293b',
                borderRadius: '8px',
                border: '1px solid #ef4444',
              }}
            >
              <AlertCircle size={36} style={{ color: '#ef4444', margin: '0 auto 0.75rem' }} />
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#f8fafc' }}>Unable to Join Video Call</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="apid-btn apid-btn-primary"
                style={{ marginTop: '1rem' }}
              >
                Close Window
              </button>
            </div>
          )}

          {!loading && !error && tokenData && (
            tokenData.isMock ? (
              // Mock Video Call Simulator for local dev without live Daily API keys
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(ellipse at center, #1e293b 0%, #020617 100%)',
                  padding: '2rem',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: '50%',
                    background: 'rgba(202, 138, 4, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ca8a04',
                    marginBottom: '1rem',
                  }}
                >
                  <Video size={44} />
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#f8fafc' }}>
                  Daily.co Video Session Active
                </h3>
                <p style={{ maxWidth: 520, margin: '0 0 1.5rem', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Room: <code style={{ color: '#ca8a04', background: '#334155', padding: '0.2rem 0.4rem', borderRadius: 4 }}>{tokenData.roomName}</code>
                  <br />
                  In production, your live Daily.co camera and mic feed connects here automatically with end-to-end encryption.
                </p>

                {/* Simulated Participant Avatars */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {session.participants.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '0.75rem 1.25rem',
                        textAlign: 'center',
                        minWidth: 160,
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: p.role === 'COACH' ? '#ca8a04' : '#0284c7',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 0.5rem',
                        }}
                      >
                        {p.fullName.charAt(0)}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.fullName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        {p.role} · {p.invitationStatus}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    className="apid-btn"
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      padding: '0.6rem 1.5rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                    }}
                  >
                    Leave Meeting
                  </button>
                </div>
              </div>
            ) : (
              // Live Daily Prebuilt iframe
              <iframe
                src={tokenData.roomUrlWithToken}
                title="Daily.co Coaching Video Room"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

