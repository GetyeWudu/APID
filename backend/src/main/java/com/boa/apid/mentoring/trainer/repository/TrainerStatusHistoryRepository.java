package com.boa.apid.mentoring.trainer.repository;

import com.boa.apid.mentoring.trainer.entity.TrainerStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrainerStatusHistoryRepository extends JpaRepository<TrainerStatusHistory, Long> {
}
