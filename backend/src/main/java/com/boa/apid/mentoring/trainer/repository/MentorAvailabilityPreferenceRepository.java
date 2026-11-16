package com.boa.apid.mentoring.trainer.repository;

import com.boa.apid.mentoring.trainer.entity.MentorAvailabilityPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface MentorAvailabilityPreferenceRepository
        extends JpaRepository<MentorAvailabilityPreference, Long> {

    List<MentorAvailabilityPreference> findAllByUserIdInAndAcceptingNewPairingsFalse(
            Collection<Long> userIds
    );
}
