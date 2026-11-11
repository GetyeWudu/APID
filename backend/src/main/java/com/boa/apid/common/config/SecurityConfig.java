package com.boa.apid.common.config;

import com.boa.apid.common.response.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.util.List;

/**
 * Stateless JWT + CSRF-protected cookie refresh Spring Security configuration.
 * Depends only on technical OncePerRequestFilter bean (keeping common decoupled from core).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final List<String> allowedOrigins;
    private final int bcryptStrength;
    private final OncePerRequestFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(
            @Value("${apid.cors.allowed-origins}") List<String> allowedOrigins,
            @Value("${apid.security.bcrypt-strength:12}") int bcryptStrength,
            @Qualifier("jwtAuthenticationFilter") OncePerRequestFilter jwtAuthenticationFilter,
            ObjectMapper objectMapper
    ) {
        this.allowedOrigins = allowedOrigins;
        this.bcryptStrength = bcryptStrength;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        CookieCsrfTokenRepository csrfRepo = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepo.setCookiePath("/");

        // Require CSRF validation on cookie-authenticated endpoints (/refresh and /logout)
        OrRequestMatcher cookieEndpointsMatcher = new OrRequestMatcher(
                new AntPathRequestMatcher("/api/v1/core/auth/refresh", "POST"),
                new AntPathRequestMatcher("/api/v1/core/auth/logout", "POST")
        );

        CsrfTokenRequestAttributeHandler requestHandler = new CsrfTokenRequestAttributeHandler();
        requestHandler.setCsrfRequestAttributeName(null);

        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfRepo)
                        .csrfTokenRequestHandler(requestHandler)
                        .requireCsrfProtectionMatcher(cookieEndpointsMatcher)
                )
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            objectMapper.writeValue(response.getWriter(),
                                    ApiError.of("UNAUTHORIZED", "Authentication required"));
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            objectMapper.writeValue(response.getWriter(),
                                    ApiError.of("ACCESS_DENIED", "You do not have permission to perform this action"));
                        })
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/v1/core/health",
                                "/api/v1/core/auth/login",
                                "/api/v1/core/auth/refresh",
                                "/api/v1/core/auth/logout",
                                "/api/v1/core/auth/csrf",
                                "/actuator/health",
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/v3/api-docs/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(bcryptStrength);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-XSRF-TOKEN", "X-Requested-With"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
