package com.boa.apid.mentoring.trainer.service;

import com.boa.apid.mentoring.trainer.entity.MentorAvailabilityPreference;
import com.boa.apid.mentoring.trainer.repository.MentorAvailabilityPreferenceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MentorAvailabilityService {

    private final MentorAvailabilityPreferenceRepository preferenceRepository;

    public MentorAvailabilityService(MentorAvailabilityPreferenceRepository preferenceRepository) {
        this.preferenceRepository = preferenceRepository;
    }

    @Transactional(readOnly = true)
    public boolean isAcceptingNewPairings(Long userId) {
        return preferenceRepository.findById(userId)
                .map(MentorAvailabilityPreference::isAcceptingNewPairings)
                .orElse(true);
    }

    @Transactional(readOnly = true)
    public Set<Long> notAcceptingNewPairings(Collection<Long> userIds) {
        if (userIds.isEmpty()) {
            return Set.of();
        }
        return preferenceRepository.findAllByUserIdInAndAcceptingNewPairingsFalse(userIds).stream()
                .map(MentorAvailabilityPreference::getUserId)
                .collect(Collectors.toSet());
    }

    @Transactional
    public void setAcceptingNewPairings(Long userId, boolean accepting) {
        MentorAvailabilityPreference preference = preferenceRepository.findById(userId)
                .orElseGet(() -> {
                    MentorAvailabilityPreference created = new MentorAvailabilityPreference();
                    created.setUserId(userId);
                    return created;
                });
        preference.setAcceptingNewPairings(accepting);
        preferenceRepository.save(preference);
    }
}
