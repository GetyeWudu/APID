package com.boa.apid.core.auth.service;

import com.boa.apid.core.auth.config.LdapProperties;
import com.boa.apid.core.authorization.entity.AuthProvider;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ldap.core.ContextMapper;
import org.springframework.ldap.core.DirContextAdapter;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;
import org.springframework.ldap.query.LdapQuery;
import org.springframework.ldap.support.LdapUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.ldap.query.LdapQueryBuilder.query;

import javax.naming.directory.DirContext;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Active Directory identity authentication provider.
 * Authenticates user credentials against Bank Active Directory via LDAP, verifies account status,
 * maps employeeID to APID PostgreSQL user, and lets APID manage authorization and permissions.
 */
@Service
public class ActiveDirectoryAuthenticationProvider implements IdentityAuthenticationProvider {

    private static final Logger log = LoggerFactory.getLogger(ActiveDirectoryAuthenticationProvider.class);

    // Active Directory userAccountControl bit flags
    private static final int UAC_ACCOUNTDISABLE = 0x0002;
    private static final int UAC_LOCKOUT = 0x0010;

    private final LdapProperties ldapProperties;
    private final LdapContextSource ldapContextSource;
    private final LdapTemplate ldapTemplate;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final ActiveDirectorySyncService activeDirectorySyncService;

    public ActiveDirectoryAuthenticationProvider(
            LdapProperties ldapProperties,
            LdapContextSource ldapContextSource,
            LdapTemplate ldapTemplate,
            UserRepository userRepository,
            EmployeeRepository employeeRepository,
            ActiveDirectorySyncService activeDirectorySyncService
    ) {
        this.ldapProperties = ldapProperties;
        this.ldapContextSource = ldapContextSource;
        this.ldapTemplate = ldapTemplate;
        this.userRepository = userRepository;
        this.employeeRepository = employeeRepository;
        this.activeDirectorySyncService = activeDirectorySyncService;
    }

    @Override
    public boolean supports(AuthProvider provider) {
        return provider == AuthProvider.ACTIVE_DIRECTORY;
    }

    @Override
    @Transactional
    public AuthResult authenticate(String username, String rawPassword) {
        if (!ldapProperties.isEnabled()) {
            log.debug("Active Directory authentication requested but LDAP is disabled");
            return AuthResult.failure(AuthFailureReason.PROVIDER_MISMATCH);
        }

        if (username == null || username.isBlank() || rawPassword == null || rawPassword.isBlank()) {
            return AuthResult.failure(AuthFailureReason.INVALID_PASSWORD);
        }

        String cleanUsername = sanitizeUsername(username);

        // Step 1: Search for user in Active Directory using dedicated read-only service account
        AdUserRecord adUser = searchAdUser(cleanUsername);
        if (adUser == null) {
            log.warn("Active Directory search found no matching user for '{}'", cleanUsername);
            return AuthResult.failure(AuthFailureReason.UNKNOWN_USER);
        }

        // Step 2: Validate AD account flags (Disabled / Locked in AD)
        if ((adUser.userAccountControl() & UAC_ACCOUNTDISABLE) != 0) {
            log.warn("Active Directory account is DISABLED for user '{}'", cleanUsername);
            return AuthResult.failure(AuthFailureReason.ACCOUNT_DISABLED);
        }
        if ((adUser.userAccountControl() & UAC_LOCKOUT) != 0) {
            log.warn("Active Directory account is LOCKED for user '{}'", cleanUsername);
            return AuthResult.failure(AuthFailureReason.ACCOUNT_ADMIN_LOCKED);
        }

        // Step 3: Authenticate credentials against Active Directory via direct LDAP bind
        boolean bindSuccess = validateCredentials(adUser.distinguishedName(), rawPassword);
        if (!bindSuccess) {
            log.warn("Active Directory LDAP bind failed for user '{}' (invalid password)", cleanUsername);
            return AuthResult.failure(AuthFailureReason.INVALID_PASSWORD);
        }

        // Step 4: Resolve matching user in APID PostgreSQL database
        Optional<User> optUser = resolveApidUser(adUser.employeeId(), adUser.samAccountName());
        if (optUser.isEmpty()) {
            log.warn("Active Directory authentication succeeded for user '{}' (employeeID={}), but no APID mapping exists in PostgreSQL",
                    cleanUsername, adUser.employeeId());
            // Strict security: Reject access if user is not authorized/registered in APID
            return AuthResult.failure(AuthFailureReason.UNKNOWN_USER);
        }

        User user = optUser.get();
        Instant now = Instant.now();

        // Step 5: Validate APID application account status
        if (user.getStatus() == UserStatus.DISABLED) {
            log.warn("Login blocked for APID DISABLED user id={}", user.getId());
            return AuthResult.failure(AuthFailureReason.ACCOUNT_DISABLED);
        }
        if (user.getStatus() == UserStatus.ADMIN_LOCKED) {
            log.warn("Login blocked for APID ADMIN_LOCKED user id={}", user.getId());
            return AuthResult.failure(AuthFailureReason.ACCOUNT_ADMIN_LOCKED);
        }
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            log.warn("Login blocked for temporarily locked APID user id={} until {}", user.getId(), user.getLockedUntil());
            return AuthResult.failure(AuthFailureReason.ACCOUNT_TEMP_LOCKED);
        }

        // Step 6: Synchronize directory attributes on successful login
        if (adUser.employeeId() != null && !adUser.employeeId().isBlank() && user.getExternalDirectoryId() == null) {
            user.setExternalDirectoryId(adUser.employeeId());
        }
        user.setAuthProvider(AuthProvider.ACTIVE_DIRECTORY);
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        userRepository.save(user);

        // Step 7: Reconcile role mappings based on Active Directory group memberships
        activeDirectorySyncService.syncRolesForUser(user, adUser.memberOfGroups());

        log.info("Active Directory login succeeded for username='{}', employeeID='{}', userId={}",
                user.getUsername(), adUser.employeeId(), user.getId());

        return AuthResult.success(user);
    }

    private String sanitizeUsername(String username) {
        String clean = username.trim();
        // Handle DOMAIN and NetBIOS format: domain\\account
        if (clean.contains("\\")) {
            clean = clean.substring(clean.lastIndexOf('\\') + 1);
        }
        // Handle user@domain format
        if (clean.contains("@")) {
            clean = clean.substring(0, clean.indexOf('@'));
        }
        return clean.trim();
    }

    private AdUserRecord searchAdUser(String cleanUsername) {
        try {
            String upn = cleanUsername + "@" + ldapProperties.getDomain();

            String searchBase = ldapProperties.getUserSearchBase() != null && !ldapProperties.getUserSearchBase().isBlank()
                    ? ldapProperties.getUserSearchBase()
                    : "";

            String relativeSearchBase = getRelativeSearchBase(searchBase, ldapProperties.getBaseDn());

            LdapQuery ldapQuery = query()
                    .base(relativeSearchBase)
                    .attributes(
                            "distinguishedName", "sAMAccountName", "userPrincipalName",
                            "employeeID", "mail", "displayName", "department", "title", "userAccountControl", "memberOf"
                    )
                    .filter("(&(objectCategory=person)(objectClass=user)(|(sAMAccountName={0})(userPrincipalName={1})(employeeID={2})))",
                            cleanUsername, upn, cleanUsername);

            List<AdUserRecord> results = ldapTemplate.search(
                    ldapQuery,
                    (ContextMapper<AdUserRecord>) ctx -> {
                        DirContextAdapter adapter = (DirContextAdapter) ctx;
                        String dn = adapter.getNameInNamespace();
                        String sam = adapter.getStringAttribute("sAMAccountName");
                        String upnAttr = adapter.getStringAttribute("userPrincipalName");
                        String empId = adapter.getStringAttribute("employeeID");
                        String mail = adapter.getStringAttribute("mail");
                        String display = adapter.getStringAttribute("displayName");
                        String dept = adapter.getStringAttribute("department");
                        String title = adapter.getStringAttribute("title");
                        String uacStr = adapter.getStringAttribute("userAccountControl");
                        int uac = 0;
                        if (uacStr != null) {
                            try {
                                uac = Integer.parseInt(uacStr);
                            } catch (NumberFormatException ignored) {
                            }
                        }
                        String[] memberOfArray = adapter.getStringAttributes("memberOf");
                        List<String> memberOfList = memberOfArray != null ? java.util.Arrays.asList(memberOfArray) : List.of();
                        return new AdUserRecord(dn, sam, upnAttr, empId, mail, display, dept, title, uac, memberOfList);
                    }
            );

            if (results != null && !results.isEmpty()) {
                return results.get(0);
            }
        } catch (Exception ex) {
            log.error("Failed to execute Active Directory search for '{}'", cleanUsername, ex);
        }
        return null;
    }

    private String getRelativeSearchBase(String searchBase, String baseDn) {
        if (searchBase == null || searchBase.isBlank() || baseDn == null || baseDn.isBlank()) {
            return "";
        }
        String cleanSearch = searchBase.trim().toLowerCase(Locale.ROOT);
        String cleanBase = baseDn.trim().toLowerCase(Locale.ROOT);
        if (cleanSearch.endsWith(cleanBase)) {
            String relative = searchBase.substring(0, searchBase.length() - baseDn.length()).trim();
            if (relative.endsWith(",")) {
                relative = relative.substring(0, relative.length() - 1).trim();
            }
            return relative;
        }
        return searchBase;
    }

    private boolean validateCredentials(String userDn, String rawPassword) {
        DirContext context = null;
        try {
            // Attempt LDAP bind with the user's specific Distinguished Name and raw password
            context = ldapContextSource.getContext(userDn, rawPassword);
            return context != null;
        } catch (org.springframework.ldap.AuthenticationException ex) {
            log.debug("LDAP credentials rejected for DN '{}': {}", userDn, ex.getMessage());
            return false;
        } catch (Exception ex) {
            log.warn("LDAP bind check encountered exception for DN '{}': {}", userDn, ex.getMessage());
            return false;
        } finally {
            LdapUtils.closeContext(context);
        }
    }

    private Optional<User> resolveApidUser(String employeeId, String samAccountName) {
        // Priority 1: Match User directly by externalDirectoryId
        if (employeeId != null && !employeeId.isBlank()) {
            Optional<User> byExtId = userRepository.findByExternalDirectoryIdForUpdate(employeeId);
            if (byExtId.isPresent()) {
                return byExtId;
            }
            // Priority 2: Match Employee entity by employeeNumber, then load User
            Optional<Employee> emp = employeeRepository.findByEmployeeNumberIgnoreCase(employeeId);
            if (emp.isPresent() && emp.get().getUserId() != null) {
                return userRepository.findByIdForUpdate(emp.get().getUserId());
            }
        }

        // Priority 3: Match User by sAMAccountName
        if (samAccountName != null && !samAccountName.isBlank()) {
            Optional<User> byUsername = userRepository.findByUsernameLowerForUpdate(samAccountName.toLowerCase(Locale.ROOT));
            if (byUsername.isPresent()) {
                return byUsername;
            }
            // Priority 4: Match Employee entity by username as employeeNumber, then load User
            Optional<Employee> emp = employeeRepository.findByEmployeeNumberIgnoreCase(samAccountName);
            if (emp.isPresent() && emp.get().getUserId() != null) {
                return userRepository.findByIdForUpdate(emp.get().getUserId());
            }
        }

        return Optional.empty();
    }

    public record AdUserRecord(
            String distinguishedName,
            String samAccountName,
            String userPrincipalName,
            String employeeId,
            String mail,
            String displayName,
            String department,
            String title,
            int userAccountControl,
            List<String> memberOfGroups
    ) {}
}
