package com.boa.apid.core.auth.security;

import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.service.UserAuthorityService;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;

/**
 * Validates stateless Bearer JWTs, verifies live account state & token_version,
 * and populates Spring SecurityContext with database-resolved authorities.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final UserAuthorityService userAuthorityService;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            UserRepository userRepository,
            UserAuthorityService userAuthorityService
    ) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.userAuthorityService = userAuthorityService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7).trim();
        if (token.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            JwtService.ParsedAccessToken parsed = jwtService.parseAndValidateAccessToken(token);
            User user = userRepository.findById(parsed.userId()).orElse(null);

            if (user != null && isUserEligible(user, parsed.tokenVersion())) {
                Set<String> roles = userAuthorityService.getActiveRoles(user.getId());
                Set<String> permissions = user.isMustChangePassword()
                        ? Set.of()
                        : userAuthorityService.getActivePermissions(user.getId());

                ApidUserPrincipal principal = new ApidUserPrincipal(
                        user.getId(),
                        user.getUsername(),
                        true,
                        user.isMustChangePassword(),
                        user.getTokenVersion(),
                        roles,
                        permissions
                );

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } else {
                SecurityContextHolder.clearContext();
            }
        } catch (JwtException | IllegalArgumentException ex) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private boolean isUserEligible(User user, int tokenVersion) {
        if (user.getStatus() != UserStatus.ACTIVE) {
            return false;
        }
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
            return false;
        }
        return user.getTokenVersion() == tokenVersion;
    }
}

