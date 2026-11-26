package com.boa.apid.mentoring.pairing.dto;

import java.util.List;

/**
 * Request to bundle 2+ active INDIVIDUAL mentoring relationships (all with the same mentor)
 * into a new GROUP relationship/cohort.
 *
 * @param sourceRelationshipIds  IDs of the existing INDIVIDUAL relationships to merge.
 *                               Must be ≥ 2, all ACTIVE, and all share the same mentor (the caller).
 */
public record CreateGroupPairingRequest(
        List<Long> sourceRelationshipIds
) {}
