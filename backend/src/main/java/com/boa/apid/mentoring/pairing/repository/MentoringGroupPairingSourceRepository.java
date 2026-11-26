package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringGroupPairingSource;
import com.boa.apid.mentoring.pairing.entity.MentoringGroupPairingSourceId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MentoringGroupPairingSourceRepository extends JpaRepository<MentoringGroupPairingSource, MentoringGroupPairingSourceId> {

    @Query("SELECT s.id.sourceRelationshipId FROM MentoringGroupPairingSource s WHERE s.id.groupRelationshipId = :groupRelationshipId")
    List<Long> findSourceRelationshipIdsByGroupRelationshipId(@Param("groupRelationshipId") Long groupRelationshipId);

    @Query("SELECT s.id.sourceRelationshipId FROM MentoringGroupPairingSource s")
    List<Long> findAllSourceRelationshipIds();

    @Query("""
            SELECT s FROM MentoringGroupPairingSource s
            JOIN FETCH s.sourceRelationship sr
            JOIN FETCH sr.request req
            JOIN FETCH req.mentorUser
            WHERE s.id.groupRelationshipId = :groupRelationshipId
            """)
    List<MentoringGroupPairingSource> findDetailedByGroupRelationshipId(@Param("groupRelationshipId") Long groupRelationshipId);
}
