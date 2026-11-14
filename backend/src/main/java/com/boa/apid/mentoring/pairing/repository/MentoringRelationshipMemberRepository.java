package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MentoringRelationshipMemberRepository extends JpaRepository<MentoringRelationshipMember, Long> {
}
