package com.boa.apid.core.auth.service;

import com.boa.apid.core.authorization.entity.AuthProvider;
import com.boa.apid.core.authorization.entity.User;

/**
 * Pluggable identity authentication abstraction allowing Phase 2 Bank Active Directory
 * to integrate cleanly without modifying AuthService.
 */
public interface IdentityAuthenticationProvider {

    boolean supports(AuthProvider provider);

    AuthResult authenticate(String username, String rawPassword);

    enum AuthFailureReason {
        UNKNOWN_USER,
        INVALID_PASSWORD,
        ACCOUNT_DISABLED,
        ACCOUNT_ADMIN_LOCKED,
        ACCOUNT_TEMP_LOCKED,
        PROVIDER_MISMATCH
    }

    record AuthResult(boolean authenticated, User user, AuthFailureReason failureReason) {
        public static AuthResult success(User user) {
            return new AuthResult(true, user, null);
        }

        public static AuthResult failure(AuthFailureReason reason) {
            return new AuthResult(false, null, reason);
        }
    }
}

