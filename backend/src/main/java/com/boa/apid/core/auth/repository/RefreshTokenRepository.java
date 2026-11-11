package com.boa.apid.core.auth.repository;

import com.boa.apid.core.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    @Query("SELECT rt FROM RefreshToken rt JOIN FETCH rt.user WHERE rt.tokenHash = :tokenHash")
    Optional<RefreshToken> findByTokenHashWithUser(@Param("tokenHash") String tokenHash);

    /**
     * Atomic single-use rotation guard: only updates if not already revoked.
     * Returns 1 on win, 0 if a concurrent request or reuse already revoked it.
     */
    @Modifying
    @Query("""
            UPDATE RefreshToken rt
            SET rt.revoked = true,
                rt.revokedAt = :now,
                rt.revokedReason = 'ROTATED',
                rt.replacedByTokenId = :replacedByTokenId
            WHERE rt.id = :id
              AND rt.revoked = false
            """)
    int markRotatedAtomically(
            @Param("id") Long id,
            @Param("replacedByTokenId") Long replacedByTokenId,
            @Param("now") Instant now
    );

    @Modifying
    @Query("""
            UPDATE RefreshToken rt
            SET rt.revoked = true,
                rt.revokedAt = :now,
                rt.revokedReason = :reason
            WHERE rt.familyId = :familyId
              AND rt.revoked = false
            """)
    int revokeFamily(
            @Param("familyId") UUID familyId,
            @Param("reason") String reason,
            @Param("now") Instant now
    );

    @Modifying
    @Query("""
            UPDATE RefreshToken rt
            SET rt.revoked = true,
                rt.revokedAt = :now,
                rt.revokedReason = :reason
            WHERE rt.user.id = :userId
              AND rt.revoked = false
            """)
    int revokeAllByUserId(
            @Param("userId") Long userId,
            @Param("reason") String reason,
            @Param("now") Instant now
    );
}

