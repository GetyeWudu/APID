package com.boa.apid.core.auth.service;

import com.boa.apid.core.auth.config.LdapProperties;
import com.boa.apid.core.authorization.entity.AuthProvider;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ldap.AuthenticationException;
import org.springframework.ldap.core.ContextMapper;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;
import org.springframework.ldap.query.LdapQuery;

import javax.naming.directory.DirContext;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ActiveDirectoryAuthenticationProviderTest {

    @Mock
    private LdapContextSource ldapContextSource;

    @Mock
    private LdapTemplate ldapTemplate;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @Mock
    private ActiveDirectorySyncService adSyncService;

    @Mock
    private DirContext userDirContext;

    private LdapProperties ldapProperties;
    private ActiveDirectoryAuthenticationProvider provider;

    @BeforeEach
    void setUp() {
        ldapProperties = new LdapProperties();
        ldapProperties.setEnabled(true);
        ldapProperties.setUrl("ldap://10.9.82.23:389");
        ldapProperties.setBaseDn("DC=apid,DC=test");
        ldapProperties.setDomain("apid.test");
        ldapProperties.setUserSearchBase("OU=APID,DC=apid,DC=test");

        provider = new ActiveDirectoryAuthenticationProvider(
                ldapProperties,
                ldapContextSource,
                ldapTemplate,
                userRepository,
                employeeRepository,
                adSyncService
        );
    }

    @Test
    @DisplayName("supports() only returns true for ACTIVE_DIRECTORY")
    void testSupports() {
        assertThat(provider.supports(AuthProvider.ACTIVE_DIRECTORY)).isTrue();
        assertThat(provider.supports(AuthProvider.LOCAL)).isFalse();
    }

    @Test
    @DisplayName("authenticate() returns PROVIDER_MISMATCH when LDAP is disabled")
    void testLdapDisabled() {
        ldapProperties.setEnabled(false);
        var result = provider.authenticate("test0001", "password");
        assertThat(result.authenticated()).isFalse();
        assertThat(result.failureReason()).isEqualTo(IdentityAuthenticationProvider.AuthFailureReason.PROVIDER_MISMATCH);
    }

    @Test
    @DisplayName("authenticate() returns INVALID_PASSWORD for blank credentials")
    void testBlankCredentials() {
        var result1 = provider.authenticate("", "password");
        assertThat(result1.authenticated()).isFalse();
        assertThat(result1.failureReason()).isEqualTo(IdentityAuthenticationProvider.AuthFailureReason.INVALID_PASSWORD);

        var result2 = provider.authenticate("test0001", "");
        assertThat(result2.authenticated()).isFalse();
        assertThat(result2.failureReason()).isEqualTo(IdentityAuthenticationProvider.AuthFailureReason.INVALID_PASSWORD);
    }

    @Test
    @DisplayName("authenticate() returns UNKNOWN_USER when user is not found in AD")
    void testUserNotFoundInAd() {
        when(ldapTemplate.search(any(LdapQuery.class), any(ContextMapper.class)))
                .thenReturn(Collections.emptyList());

        var result = provider.authenticate("nonexistent", "password");
        assertThat(result.authenticated()).isFalse();
        assertThat(result.failureReason()).isEqualTo(IdentityAuthenticationProvider.AuthFailureReason.UNKNOWN_USER);
    }

    @Test
    @DisplayName("authenticate() returns ACCOUNT_DISABLED when AD account has disabled UAC flag")
    void testAdAccountDisabled() {
        var adUser = new ActiveDirectoryAuthenticationProvider.AdUserRecord(
                "CN=Test,OU=APID,DC=apid,DC=test", "test0001", "test0001@apid.test",
                "00020001", "test0001@apid.test", "Test User", "Branch", "Cashier", 0x0002, List.of()
        );
        when(ldapTemplate.search(any(LdapQuery.class), any(ContextMapper.class)))
                .thenReturn(List.of(adUser));

        var result = provider.authenticate("test0001", "password");
        assertThat(result.authenticated()).isFalse();
        assertThat(result.failureReason()).isEqualTo(IdentityAuthenticationProvider.AuthFailureReason.ACCOUNT_DISABLED);
    }

    @Test
    @DisplayName("authenticate() returns INVALID_PASSWORD when AD LDAP bind fails")
    void testAdBindFailed() {
        var adUser = new ActiveDirectoryAuthenticationProvider.AdUserRecord(
                "CN=Test,OU=APID,DC=apid,DC=test", "test0001", "test0001@apid.test",
                "00020001", "test0001@apid.test", "Test User", "Branch", "Cashier", 0, List.of()
        );
        when(ldapTemplate.search(any(LdapQuery.class), any(ContextMapper.class)))
                .thenReturn(List.of(adUser));
        when(ldapContextSource.getContext(eq(adUser.distinguishedName()), eq("wrongpassword")))
                .thenThrow(new AuthenticationException(new javax.naming.AuthenticationException("Invalid credentials")) {});

        var result = provider.authenticate("test0001", "wrongpassword");
        assertThat(result.authenticated()).isFalse();
        assertThat(result.failureReason()).isEqualTo(IdentityAuthenticationProvider.AuthFailureReason.INVALID_PASSWORD);
    }

    @Test
    @DisplayName("authenticate() returns UNKNOWN_USER when AD authentication succeeds but no APID user mapping exists")
    void testAdSuccessNoApidMapping() {
        var adUser = new ActiveDirectoryAuthenticationProvider.AdUserRecord(
                "CN=Test,OU=APID,DC=apid,DC=test", "test0001", "test0001@apid.test",
                "00020001", "test0001@apid.test", "Test User", "Branch", "Cashier", 0, List.of()
        );
        when(ldapTemplate.search(any(LdapQuery.class), any(ContextMapper.class)))
                .thenReturn(List.of(adUser));
        when(ldapContextSource.getContext(eq(adUser.distinguishedName()), eq("validPass")))
                .thenReturn(userDirContext);

        when(userRepository.findByExternalDirectoryIdForUpdate("00020001")).thenReturn(Optional.empty());
        when(employeeRepository.findByEmployeeNumberIgnoreCase("00020001")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameLowerForUpdate("test0001")).thenReturn(Optional.empty());
        when(employeeRepository.findByEmployeeNumberIgnoreCase("test0001")).thenReturn(Optional.empty());

        var result = provider.authenticate("test0001", "validPass");
        assertThat(result.authenticated()).isFalse();
        assertThat(result.failureReason()).isEqualTo(IdentityAuthenticationProvider.AuthFailureReason.UNKNOWN_USER);
    }

    @Test
    @DisplayName("authenticate() succeeds and returns mapped APID user when credentials and mapping are valid")
    void testAdSuccessWithValidMapping() {
        var adUser = new ActiveDirectoryAuthenticationProvider.AdUserRecord(
                "CN=Test,OU=APID,DC=apid,DC=test", "test0001", "test0001@apid.test",
                "00020001", "test0001@apid.test", "Test User", "Branch", "Cashier", 0, List.of()
        );
        when(ldapTemplate.search(any(LdapQuery.class), any(ContextMapper.class)))
                .thenReturn(List.of(adUser));
        when(ldapContextSource.getContext(eq(adUser.distinguishedName()), eq("validPass")))
                .thenReturn(userDirContext);

        User apidUser = new User();
        apidUser.setId(42L);
        apidUser.setUsername("test0001");
        apidUser.setStatus(UserStatus.ACTIVE);

        when(userRepository.findByExternalDirectoryIdForUpdate("00020001")).thenReturn(Optional.of(apidUser));

        var result = provider.authenticate("test0001", "validPass");
        assertThat(result.authenticated()).isTrue();
        assertThat(result.user()).isNotNull();
        assertThat(result.user().getId()).isEqualTo(42L);
        assertThat(result.user().getAuthProvider()).isEqualTo(AuthProvider.ACTIVE_DIRECTORY);
        assertThat(result.user().getExternalDirectoryId()).isEqualTo("00020001");
        verify(userRepository).save(apidUser);
    }
}
