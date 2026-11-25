import React, { useEffect, useState } from 'react';
import { X, Video, ExternalLink, AlertCircle, Loader2, Users, Shield, Mic, MicOff, VideoOff } from 'lucide-react';
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';

export interface VideoSessionJoinToken {
  roomName: string;
  token: string;
  roomUrlWithToken: string;
  expiresAt?: string;
  providerName?: string;
  isMock: boolean;
}

export interface LiveKitVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  participantCount?: number;
  fetchToken: () => Promise<VideoSessionJoinToken>;
  moduleContext?: 'COACHING' | 'MENTORING';
  aiSummarizationEnabled?: boolean;
}

function extractServerUrl(roomUrlWithToken: string): string {
  try {
    const url = new URL(roomUrlWithToken);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'wss://apid-livekit.home.arpa';
  }
}

export const LiveKitVideoModal: React.FC<LiveKitVideoModalProps> = ({
  isOpen,
  onClose,
  title,
  participantCount = 2,
  fetchToken,
  moduleContext = 'COACHING',
  aiSummarizationEnabled = true,
}) => {
  const [tokenData, setTokenData] = useState<VideoSessionJoinToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock simulator state
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [simulatedDuration, setSimulatedDuration] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setTokenData(null);
      setError(null);
      setSimulatedDuration(0);
      return;
    }

    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchToken();
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

    load();

    return () => {
      isMounted = false;
    };
  }, [isOpen, fetchToken]);

  // Mock timer
  useEffect(() => {
    if (!isOpen || !tokenData?.isMock) return;
    const interval = setInterval(() => {
      setSimulatedDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, tokenData?.isMock]);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isMentoring = moduleContext === 'MENTORING';
  const serverUrl = tokenData ? extractServerUrl(tokenData.roomUrlWithToken) : 'wss://apid-livekit.home.arpa';

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
          maxWidth: '1150px',
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
                {title}
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginTop: '0.2rem',
                  fontSize: '0.78rem',
                  color: '#94a3b8',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Users size={13} /> {participantCount} Participants
                </span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Shield size={13} /> Bank of Abyssinia LiveKit Video Room
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Visual LiveKit Server VAD & Dual-Pass ASR Guarantee Badge */}
            {aiSummarizationEnabled ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '999px',
                  fontSize: '0.74rem',
                  color: '#f8fafc',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '999px',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 10px #10b981',
                    display: 'inline-block',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                />
                <span style={{ fontWeight: 600 }}>
                  LiveKit Server VAD &amp; Dual-Pass ASR (faster-whisper + Amharic ASR) Active
                </span>
                <span style={{ color: '#94a3b8' }}>• Output: 100% English Executive Minutes</span>
              </div>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  backgroundColor: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                }}
              >
                AI Notetaker: Disabled
              </div>
            )}

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
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={14} /> Open LiveKit Link
              </a>
            )}
            <button
              onClick={onClose}
              className="apid-btn apid-btn-icon"
              style={{
                color: '#94a3b8',
                background: 'transparent',
                border: 'none',
                padding: '0.35rem',
                cursor: 'pointer',
              }}
              title="Close Room Modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Room Viewport */}
        <div style={{ flex: 1, position: 'relative', background: '#020617', overflow: 'hidden' }}>
          {loading && (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                color: '#94a3b8',
              }}
            >
              <Loader2 className="animate-spin" size={36} color="#ca8a04" />
              <div>Connecting to Bank of Abyssinia LiveKit server...</div>
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                padding: '2rem',
                textAlign: 'center',
              }}
            >
              <AlertCircle size={44} color="#ef4444" />
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
                Unable to Connect to LiveKit Room
              </div>
              <div style={{ maxWidth: '500px', color: '#94a3b8', fontSize: '0.875rem' }}>{error}</div>
              <button
                onClick={onClose}
                className="apid-btn apid-btn-primary"
                style={{ marginTop: '0.5rem' }}
              >
                Close Room
              </button>
            </div>
          )}

          {!loading && !error && tokenData && (
            tokenData.isMock ? (
              // Simulated Video Room for local offline development
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1.5rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#22c55e',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#22c55e' }}>
                      {/* Preserves matching text for compatibility */}
                      {isMentoring ? 'LiveKit Mentoring Video Session Active' : 'LiveKit Coaching Video Session Active'}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>•</span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {formatTimer(simulatedDuration)}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    Room: <span style={{ color: '#f8fafc', fontWeight: 500 }}>{tokenData.roomName}</span>
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1rem',
                  }}
                >
                  {/* Local Self Video Feed */}
                  <div
                    style={{
                      background: '#1e293b',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f8fafc',
                        fontWeight: 700,
                        fontSize: '1.25rem',
                      }}
                    >
                      YOU
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '0.75rem',
                        left: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.6)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>You (Host)</span>
                      {micMuted && <MicOff size={12} color="#ef4444" />}
                    </div>
                  </div>

                  {/* Remote Participant Video Feed */}
                  <div
                    style={{
                      background: '#1e293b',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: '#ca8a04',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '1.25rem',
                      }}
                    >
                      BOA
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '0.75rem',
                        left: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.6)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                      }}
                    >
                      Remote Colleague (Connected)
                    </div>
                  </div>
                </div>

                {/* Bottom Control Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: '#1e293b',
                    borderRadius: '8px',
                  }}
                >
                  <button
                    onClick={() => setMicMuted(!micMuted)}
                    className="apid-btn"
                    style={{
                      background: micMuted ? '#ef4444' : '#334155',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: 42,
                      height: 42,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title={micMuted ? 'Unmute' : 'Mute'}
                  >
                    {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <button
                    onClick={() => setCameraOff(!cameraOff)}
                    className="apid-btn"
                    style={{
                      background: cameraOff ? '#ef4444' : '#334155',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: 42,
                      height: 42,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title={cameraOff ? 'Turn on camera' : 'Turn off camera'}
                  >
                    {cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
                  </button>
                  <button
                    onClick={onClose}
                    className="apid-btn"
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      padding: '0.6rem 1.5rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Leave Meeting
                  </button>
                </div>
              </div>
            ) : (
              // Live LiveKit Room Conference
              <LiveKitRoom
                serverUrl={serverUrl}
                token={tokenData.token}
                connect={true}
                video={true}
                audio={true}
                data-lk-theme="default"
                style={{ height: '100%' }}
                onDisconnected={onClose}
                onError={(err) => setError(err.message)}
              >
                <VideoConference />
                <RoomAudioRenderer />
              </LiveKitRoom>
            )
          )}
        </div>
      </div>
    </div>
  );
};
