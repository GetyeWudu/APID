package com.boa.apid.coaching.governance.repository;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.governance.entity.CoachingPolicyVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface CoachingPolicyVersionRepository extends JpaRepository<CoachingPolicyVersion, Long> {

    List<CoachingPolicyVersion> findAllByIsActiveTrue();

    List<CoachingPolicyVersion> findAllByPathwayAndIsActiveTrue(AssignmentPathway pathway);

    @Query("""
        SELECT pv FROM CoachingPolicyVersion pv
        WHERE pv.pathway = :pathway
          AND pv.isActive = true
          AND (pv.minAppraisalRating IS NULL OR pv.minAppraisalRating <= :rating)
          AND (pv.maxAppraisalRating IS NULL OR pv.maxAppraisalRating >= :rating)
        ORDER BY pv.id DESC
    """)
    List<CoachingPolicyVersion> findMatchingActivePolicies(
            @Param("pathway") AssignmentPathway pathway,
            @Param("rating") BigDecimal rating
    );

    default Optional<CoachingPolicyVersion> findBestMatchingPolicy(AssignmentPathway pathway, BigDecimal rating) {
        List<CoachingPolicyVersion> matches = findMatchingActivePolicies(pathway, rating != null ? rating : BigDecimal.valueOf(2.5));
        return matches.isEmpty() ? Optional.empty() : Optional.of(matches.get(0));
    }
}

