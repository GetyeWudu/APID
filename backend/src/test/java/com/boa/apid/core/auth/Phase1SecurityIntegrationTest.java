package com.boa.apid.core.auth;

import com.boa.apid.core.auth.entity.RefreshToken;
import com.boa.apid.core.auth.repository.RefreshTokenRepository;
import com.boa.apid.core.auth.service.RefreshTokenService;
import com.boa.apid.core.authorization.entity.AuthProvider;
import com.boa.apid.core.authorization.entity.Role;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserRole;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.PermissionRepository;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Phase1SecurityIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PermissionRepository permissionRepository;
    @Autowired private UserRoleRepository userRoleRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @BeforeEach
    void verifySeededData() {
        assertThat(permissionRepository.count()).isEqualTo(19);
        assertThat(roleRepository.findByNameIgnoreCase("Super Admin")).isPresent();
        assertThat(userRepository.countActiveSuperAdmins()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void caseInsensitiveUsernameUniquenessEnforcedByPostgres() {
        User u1 = new User();
        u1.setUsername("UniqueTester");
        u1.setPasswordHash(passwordEncoder.encode("Secret@123"));
        u1.setAuthProvider(AuthProvider.LOCAL);
        u1.setStatus(UserStatus.ACTIVE);
        userRepository.saveAndFlush(u1);

        User u2 = new User();
        u2.setUsername("uniquetester");
        u2.setPasswordHash(passwordEncoder.encode("Secret@123"));
        u2.setAuthProvider(AuthProvider.LOCAL);
        u2.setStatus(UserStatus.ACTIVE);

        assertThatThrownBy(() -> userRepository.saveAndFlush(u2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void disabledAndLockedUsersReceiveGenericLoginFailure() throws Exception {
        createUserWithRole("disabled.user", "Pass@1234", UserStatus.DISABLED, false, "Employee");
        createUserWithRole("adminlocked.user", "Pass@1234", UserStatus.ADMIN_LOCKED, false, "Employee");

        for (String uname : List.of("disabled.user", "adminlocked.user", "nonexistent.user")) {
            mockMvc.perform(post("/api/v1/core/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"" + uname + "\",\"password\":\"Pass@1234\"}"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message").value("Invalid username or password"));
        }
    }

    @Test
    void concurrentFailedLoginsTriggerTemporaryLockoutSafely() throws Exception {
        createUserWithRole("lockout.user", "CorrectPass@1", UserStatus.ACTIVE, false, "Employee");

        ExecutorService pool = Executors.newFixedThreadPool(5);
        List<Callable<Integer>> tasks = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            tasks.add(() -> mockMvc.perform(post("/api/v1/core/auth/login")
                            .header("X-Forwarded-For", "10.0.0." + ThreadLocalRandom.current().nextInt(1, 200))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"lockout.user\",\"password\":\"WrongPass@1\"}"))
                    .andReturn().getResponse().getStatus());
        }

        List<Future<Integer>> results = pool.invokeAll(tasks);
        for (Future<Integer> f : results) {
            assertThat(f.get()).isEqualTo(401);
        }
        pool.shutdown();

        User updated = userRepository.findByUsernameIgnoreCase("lockout.user").orElseThrow();
        assertThat(updated.getFailedLoginAttempts()).isEqualTo(5);
        assertThat(updated.getLockedUntil()).isNotNull();

        // Even with correct password, user is temporarily locked out
        mockMvc.perform(post("/api/v1/core/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"lockout.user\",\"password\":\"CorrectPass@1\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void mustChangePasswordRestrictsEndpointsAndForcesReauthAfterChange() throws Exception {
        createUserWithRole("new.admin", "InitPass@123", UserStatus.ACTIVE, true, "Super Admin");

        MvcResult loginResult = mockMvc.perform(post("/api/v1/core/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"new.admin\",\"password\":\"InitPass@123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.mustChangePassword").value(true))
                .andExpect(jsonPath("$.data.user.permissions").isEmpty())
                .andReturn();

        JsonNode body = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String oldAccessToken = body.get("data").get("accessToken").asText();
        Cookie refreshCookie = loginResult.getResponse().getCookie("apid_refresh_token");
        assertThat(refreshCookie).isNotNull();

        // /me works while mustChangePassword is true
        mockMvc.perform(get("/api/v1/core/auth/me")
                        .header("Authorization", "Bearer " + oldAccessToken))
                .andExpect(status().isOk());

        // Protected admin endpoint is strictly blocked (403) until password is changed
        mockMvc.perform(get("/api/v1/core/admin/ping")
                        .header("Authorization", "Bearer " + oldAccessToken))
                .andExpect(status().isForbidden());

        // Change password
        mockMvc.perform(post("/api/v1/core/auth/change-password")
                        .header("Authorization", "Bearer " + oldAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"InitPass@123\",\"newPassword\":\"NewStrong@2026\"}"))
                .andExpect(status().isOk());

        // Old access token is immediately rejected due to tokenVersion increment
        mockMvc.perform(get("/api/v1/core/auth/me")
                        .header("Authorization", "Bearer " + oldAccessToken))
                .andExpect(status().isUnauthorized());

        // Old refresh token is revoked
        mockMvc.perform(post("/api/v1/core/auth/refresh")
                        .with(csrf())
                        .cookie(refreshCookie))
                .andExpect(status().isUnauthorized());

        // Re-login with new password grants full Super Admin access
        MvcResult relogin = mockMvc.perform(post("/api/v1/core/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"new.admin\",\"password\":\"NewStrong@2026\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.mustChangePassword").value(false))
                .andReturn();

        String newToken = objectMapper.readTree(relogin.getResponse().getContentAsString())
                .get("data").get("accessToken").asText();

        mockMvc.perform(get("/api/v1/core/admin/ping")
                        .header("Authorization", "Bearer " + newToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("authorized"));
    }

    @Test
    void employeeRoleCannotAccessAdminEndpoint() throws Exception {
        createUserWithRole("emp.user", "EmpPass@123", UserStatus.ACTIVE, false, "Employee");

        MvcResult res = mockMvc.perform(post("/api/v1/core/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"emp.user\",\"password\":\"EmpPass@123\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readTree(res.getResponse().getContentAsString())
                .get("data").get("accessToken").asText();

        mockMvc.perform(get("/api/v1/core/admin/ping")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void refreshRotationRequiresCsrfAndDetectsTokenReuse() throws Exception {
        createUserWithRole("refresh.user", "RefPass@123", UserStatus.ACTIVE, false, "Employee");

        MvcResult loginRes = mockMvc.perform(post("/api/v1/core/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"refresh.user\",\"password\":\"RefPass@123\"}"))
                .andExpect(status().isOk())
                .andReturn();

        Cookie cookie1 = loginRes.getResponse().getCookie("apid_refresh_token");
        assertThat(cookie1).isNotNull();

        // Missing CSRF token on /refresh fails with 403
        mockMvc.perform(post("/api/v1/core/auth/refresh")
                        .cookie(cookie1))
                .andExpect(status().isForbidden());

        // Valid CSRF + cookie rotates token successfully
        MvcResult refreshRes = mockMvc.perform(post("/api/v1/core/auth/refresh")
                        .with(csrf())
                        .cookie(cookie1))
                .andExpect(status().isOk())
                .andReturn();

        Cookie cookie2 = refreshRes.getResponse().getCookie("apid_refresh_token");
        assertThat(cookie2).isNotNull();
        assertThat(cookie2.getValue()).isNotEqualTo(cookie1.getValue());

        // Verify replacement tracking in DB
        RefreshToken rt1 = refreshTokenRepository.findByTokenHashWithUser(
                RefreshTokenService.sha256Hex(cookie1.getValue())).orElseThrow();
        assertThat(rt1.isRevoked()).isTrue();
        assertThat(rt1.getRevokedReason()).isEqualTo("ROTATED");
        assertThat(rt1.getReplacedByTokenId()).isNotNull();

        // Reusing already-rotated cookie1 triggers REUSE_DETECTED and invalidates cookie2's family!
        mockMvc.perform(post("/api/v1/core/auth/refresh")
                        .with(csrf())
                        .cookie(cookie1))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/core/auth/refresh")
                        .with(csrf())
                        .cookie(cookie2))
                .andExpect(status().isUnauthorized());
    }

    private User createUserWithRole(String username, String rawPassword, UserStatus status,
                                    boolean mustChangePassword, String roleName) {
        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setAuthProvider(AuthProvider.LOCAL);
        user.setStatus(status);
        user.setMustChangePassword(mustChangePassword);
        User saved = userRepository.save(user);

        Role role = roleRepository.findByNameIgnoreCase(roleName).orElseThrow();
        UserRole ur = new UserRole();
        ur.setUser(saved);
        ur.setRole(role);
        ur.setActive(true);
        userRoleRepository.save(ur);
        return saved;
    }
}

