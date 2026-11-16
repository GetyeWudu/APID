package com.boa.apid.mentoring.trainer.repository;

import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationSkillStatus;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TrainerAuthorizationSkillStatusRepository
        extends JpaRepository<TrainerAuthorizationSkillStatus, Long> {

    @EntityGraph(attributePaths = "skill")
    List<TrainerAuthorizationSkillStatus> findByAuthorization_IdOrderBySkill_NameAsc(Long authorizationId);

    @EntityGraph(attributePaths = "skill")
    Optional<TrainerAuthorizationSkillStatus> findByAuthorization_IdAndSkill_Id(
            Long authorizationId,
            Long skillId
    );

    boolean existsByAuthorization_IdAndSkill_IdAndStatus(
            Long authorizationId,
            Long skillId,
            TrainerAuthorizationStatus status
    );
}
