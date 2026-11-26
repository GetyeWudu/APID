package com.boa.apid.mentoring.pairing.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.mentoring.pairing.dto.MentorSessionRatingDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionRatingDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionRatingRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionRating;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionAttendeeRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRatingRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class MentoringSessionRatingService {

    private static final long MINIMUM_RATINGS_FOR_MENTOR_AVERAGE = 5;

    private final MentoringSessionRepository sessionRepository;
    private final MentoringSessionRatingRepository ratingRepository;
    private final MentoringRelationshipMemberRepository memberRepository;
    private final MentoringSessionAttendeeRepository sessionAttendeeRepository;
    private final TrainerAuthorizationRepository authorizationRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserRepository userRepository;

    public MentoringSessionRatingService(
            MentoringSessionRepository sessionRepository,
            MentoringSessionRatingRepository ratingRepository,
            MentoringRelationshipMemberRepository memberRepository,
            MentoringSessionAttendeeRepository sessionAttendeeRepository,
            TrainerAuthorizationRepository authorizationRepository,
            UserRoleRepository userRoleRepository,
            UserRepository userRepository
    ) {
        this.sessionRepository = sessionRepository;
        this.ratingRepository = ratingRepository;
        this.memberRepository = memberRepository;
        this.sessionAttendeeRepository = sessionAttendeeRepository;
        this.authorizationRepository = authorizationRepository;
        this.userRoleRepository = userRoleRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public MentoringSessionRatingDto getMySessionRating(
            Long relationshipId,
            Long sessionId,
            Long menteeUserId
    ) {
        MentoringSession session = requireSession(relationshipId, sessionId);
        requireMentee(session, menteeUserId);
        return ratingRepository.findBySession_IdAndMenteeUser_Id(sessionId, menteeUserId)
                .map(MentoringSessionRatingDto::from)
                .orElse(null);
    }

    @Transactional
    public MentoringSessionRatingDto rateSession(
            Long relationshipId,
            Long sessionId,
            MentoringSessionRatingRequest request,
            Long menteeUserId
    ) {
        MentoringSession session = sessionRepository.findByIdForUpdate(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring session not found."));
        if (!session.getRelationship().getId().equals(relationshipId)) {
            throw new ResourceNotFoundException("Mentoring session not found.");
        }
        requireMentee(session, menteeUserId);
        if ((session.getStatus() != MentoringSessionStatus.SCHEDULED
                && session.getStatus() != MentoringSessionStatus.COMPLETED)
                || Instant.now().isBefore(session.getScheduledEnd())) {
            throw new BusinessException(
                    "MENTORING_SESSION_NOT_ENDED",
                    "You can rate this session after its scheduled end.",
                    HttpStatus.CONFLICT
            );
        }
        if (request == null || request.rating() < 1 || request.rating() > 5) {
            throw new BusinessException("INVALID_MENTORING_SESSION_RATING", "Choose a rating from 1 to 5.");
        }
        if (ratingRepository.findBySession_IdAndMenteeUser_Id(sessionId, menteeUserId).isPresent()) {
            throw new BusinessException(
                    "MENTORING_SESSION_ALREADY_RATED",
                    "You have already rated this session.",
                    HttpStatus.CONFLICT
            );
        }

        MentoringSessionRating rating = new MentoringSessionRating();
        rating.setSession(session);
        rating.setMenteeUser(userRepository.getReferenceById(menteeUserId));
        rating.setRating(request.rating());
        return MentoringSessionRatingDto.from(ratingRepository.save(rating));
    }

    @Transactional(readOnly = true)
    public MentorSessionRatingDto getMyMentorRating(Long mentorUserId) {
        if (!userRoleRepository.existsActiveMentorRoleByUserId(mentorUserId)
                || authorizationRepository.findByUserIdAndStatus(
                        mentorUserId, TrainerAuthorizationStatus.ACTIVE).isEmpty()) {
            throw new AccessDeniedException("Only an active mentor can view a mentor rating.");
        }
        long ratedSessionCount = ratingRepository.countEndedSessionsWithRatingsByMentorUserId(mentorUserId);
        if (ratedSessionCount < MINIMUM_RATINGS_FOR_MENTOR_AVERAGE) {
            return new MentorSessionRatingDto(null);
        }
        return new MentorSessionRatingDto(ratingRepository.averageEndedByMentorUserId(mentorUserId));
    }

    private MentoringSession requireSession(Long relationshipId, Long sessionId) {
        MentoringSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring session not found."));
        if (!session.getRelationship().getId().equals(relationshipId)) {
            throw new ResourceNotFoundException("Mentoring session not found.");
        }
        return session;
    }

    private void requireMentee(MentoringSession session, Long userId) {
        if (session.isGroupSession()) {
            if (session.getCreatedByUser().getId().equals(userId)
                    || !sessionAttendeeRepository.existsBySession_IdAndMember_TraineeUser_Id(
                            session.getId(), userId)) {
                throw new AccessDeniedException("Only a participant in this group session can rate it.");
            }
            return;
        }

        Long relationshipId = session.getRelationship().getId();
        if (session.getTargetTraineeMember() != null
                && !session.getTargetTraineeMember().getTraineeUser().getId().equals(userId)) {
            throw new AccessDeniedException("Only the selected trainee can rate this session.");
        }
        if (session.getRelationship().getMentorUser().getId().equals(userId)
                || !memberRepository.existsByRelationship_IdAndTraineeUser_Id(relationshipId, userId)) {
            throw new AccessDeniedException("Only a mentee in this relationship can rate its session.");
        }
    }
}
