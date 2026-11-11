package com.boa.apid.core.auth.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Authenticated principal stored in Spring SecurityContext.
 * When mustChangePassword is true, authorities are restricted solely to CHANGE_PASSWORD_ONLY.
 */
public class ApidUserPrincipal implements UserDetails {

    public static final String CHANGE_PASSWORD_AUTHORITY = "CHANGE_PASSWORD_ONLY";

    private final Long userId;
    private final String username;
    private final boolean active;
    private final boolean mustChangePassword;
    private final int tokenVersion;
    private final Set<String> roles;
    private final Set<String> permissions;
    private final Collection<? extends GrantedAuthority> authorities;

    public ApidUserPrincipal(
            Long userId,
            String username,
            boolean active,
            boolean mustChangePassword,
            int tokenVersion,
            Set<String> roles,
            Set<String> permissions
    ) {
        this.userId = userId;
        this.username = username;
        this.active = active;
        this.mustChangePassword = mustChangePassword;
        this.tokenVersion = tokenVersion;
        this.roles = Set.copyOf(roles);
        this.permissions = mustChangePassword ? Set.of() : Set.copyOf(permissions);

        if (mustChangePassword) {
            this.authorities = Set.of(new SimpleGrantedAuthority(CHANGE_PASSWORD_AUTHORITY));
        } else {
            this.authorities = permissions.stream()
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toUnmodifiableSet());
        }
    }

    public Long getUserId() { return userId; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public int getTokenVersion() { return tokenVersion; }
    public Set<String> getRoles() { return roles; }
    public Set<String> getPermissions() { return permissions; }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }

    @Override
    public String getPassword() { return null; }

    @Override
    public String getUsername() { return username; }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return active; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return active; }
}

