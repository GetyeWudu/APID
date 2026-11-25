import { useState } from 'react';
import { ArrowRight, CalendarDays, GraduationCap, HeartHandshake } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, StatusPill } from '../../../shared/components/ui';
import type { MentoringRelationshipPair } from '../api/mentoringPairingApi';

type ConnectionRole = 'MENTOR' | 'TRAINEE';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function statusTone(status: string): 'ok' | 'warn' | 'neutral' {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'PAUSED') return 'warn';
  return 'neutral';
}

export function MentoringConnectionsPanel({
  role,
  relationships,
}: {
  role: ConnectionRole;
  relationships: MentoringRelationshipPair[];
}) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const isMentor = role === 'MENTOR';
  const counterpartLabel = isMentor ? 'trainee' : 'mentor';
  const counterpartPlural = isMentor ? 'Trainees' : 'Mentors';
  const roleRelationships = relationships.filter((item) => item.currentUserRole === role);
  const connectionsByUser = new Map<number, {
    userId: number;
    name: string;
    relationships: MentoringRelationshipPair[];
  }>();

  roleRelationships.forEach((item) => {
    const userId = isMentor ? item.traineeUserId : item.mentorUserId;
    const name = isMentor ? item.traineeName : item.mentorName;
    const existing = connectionsByUser.get(userId);
    if (existing) {
      existing.relationships.push(item);
    } else {
      connectionsByUser.set(userId, { userId, name, relationships: [item] });
    }
  });

  const connections = [...connectionsByUser.values()]
    .map((connection) => ({
      ...connection,
      relationships: connection.relationships.sort(
        (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const selectedConnection = connections.find((item) => item.userId === selectedUserId);

  return (
    <section className="mentoring-connections" aria-label={`My ${counterpartPlural.toLowerCase()}`}>
      <aside className="mentoring-connections__people">
        <header className="mentoring-connections__people-header">
          <div>
            <h2>{counterpartPlural}</h2>
            <p>Select a person to see your pairings.</p>
          </div>
          <span className="mentoring-dashboard__count">{connections.length}</span>
        </header>
        {connections.length === 0 ? (
          <EmptyState
            title={`No ${counterpartPlural.toLowerCase()} yet`}
            description={
              isMentor
                ? 'Trainees with an approved mentorship pairing will appear here.'
                : 'Mentors with an approved mentorship pairing will appear here.'
            }
            icon={isMentor ? <GraduationCap size={30} /> : <HeartHandshake size={30} />}
          />
        ) : (
          <div className="mentoring-connections__people-list" aria-label={counterpartPlural}>
            {connections.map((connection) => (
              <button
                key={connection.userId}
                type="button"
                className={`mentoring-connections__person${selectedUserId === connection.userId ? ' is-selected' : ''}`}
                aria-pressed={selectedUserId === connection.userId}
                onClick={() => setSelectedUserId(connection.userId)}
              >
                <span className="mentoring-connections__avatar" aria-hidden="true">
                  {connection.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="mentoring-connections__person-copy">
                  <strong>{connection.name}</strong>
                  <span>
                    {connection.relationships.length} pairing{connection.relationships.length === 1 ? '' : 's'}
                  </span>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </aside>

      <div className="mentoring-connections__details" aria-live="polite">
        {selectedConnection ? (
          <>
            <header className="mentoring-connections__details-header">
              <div>
                <span>{isMentor ? 'Your trainee' : 'Your mentor'}</span>
                <h2>{selectedConnection.name}</h2>
                <p>
                  {selectedConnection.relationships.length} mentorship pairing
                  {selectedConnection.relationships.length === 1 ? '' : 's'}
                </p>
              </div>
            </header>
            <div className="mentoring-connections__pairings">
              {selectedConnection.relationships.map((pairing) => {
                const status = pairing.relationshipStatus === 'ACTIVE'
                  ? pairing.memberStatus
                  : pairing.relationshipStatus;
                return (
                  <article className="mentoring-connections__pairing" key={pairing.memberId}>
                    <div className="mentoring-connections__pairing-icon" aria-hidden="true">
                      {pairing.requestType === 'GROUP'
                        ? <GraduationCap size={18} />
                        : <HeartHandshake size={18} />}
                    </div>
                    <div className="mentoring-connections__pairing-copy">
                      <h3>{pairing.skillName || (pairing.requestType === 'GROUP' ? 'Mentoring class' : 'General mentorship')}</h3>
                      <p>
                        {pairing.requestType === 'GROUP' ? 'Class pairing' : 'One-to-one pairing'}
                        {' · '}
                        <CalendarDays size={14} aria-hidden="true" />
                        {' Started '}
                        {formatDate(pairing.startedAt)}
                      </p>
                      {pairing.message && <p className="mentoring-connections__message">{pairing.message}</p>}
                    </div>
                    <div className="mentoring-connections__pairing-actions">
                      <StatusPill label={status} tone={statusTone(status)} />
                      <Link
                        to={`/mentoring/pairing/${pairing.relationshipId}`}
                        className="apid-btn apid-btn-outline apid-btn-sm"
                      >
                        View pairing <ArrowRight size={15} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyState
            title={`Choose a ${counterpartLabel}`}
            description={`Select a ${counterpartLabel} from the list to see all mentorship pairings with them.`}
            icon={isMentor ? <GraduationCap size={30} /> : <HeartHandshake size={30} />}
          />
        )}
      </div>
    </section>
  );
}
