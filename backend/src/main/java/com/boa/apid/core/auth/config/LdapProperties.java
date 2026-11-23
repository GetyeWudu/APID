package com.boa.apid.core.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Type-safe configuration properties for Active Directory / LDAP authentication.
 */
@Component
@ConfigurationProperties(prefix = "apid.ldap")
public class LdapProperties {

    private boolean enabled = false;
    private String url = "ldap://10.9.82.23:389";
    private String baseDn = "DC=apid,DC=test";
    private String domain = "apid.test";
    private String userSearchBase = "OU=APID,DC=apid,DC=test";
    private String userSearchFilter = "(&(objectCategory=person)(objectClass=user)(|(sAMAccountName={0})(userPrincipalName={1})(employeeID={2})))";
    private String bindDn = "CN=APID LDAP Service Account,OU=Service Accounts,OU=APID,DC=apid,DC=test";
    private String bindPassword = "";
    private int timeoutMs = 5000;
    private String trustCertPath = "classpath:certs/apid-ca.crt";
    private boolean syncEnabled = true;
    private String syncCron = "0 */30 * * * *";
    private long syncInitialDelayMs = 15000;

    public boolean isSyncEnabled() {
        return syncEnabled;
    }

    public void setSyncEnabled(boolean syncEnabled) {
        this.syncEnabled = syncEnabled;
    }

    public String getSyncCron() {
        return syncCron;
    }

    public void setSyncCron(String syncCron) {
        this.syncCron = syncCron;
    }

    public long getSyncInitialDelayMs() {
        return syncInitialDelayMs;
    }

    public void setSyncInitialDelayMs(long syncInitialDelayMs) {
        this.syncInitialDelayMs = syncInitialDelayMs;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getBaseDn() {
        return baseDn;
    }

    public void setBaseDn(String baseDn) {
        this.baseDn = baseDn;
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public String getUserSearchBase() {
        return userSearchBase;
    }

    public void setUserSearchBase(String userSearchBase) {
        this.userSearchBase = userSearchBase;
    }

    public String getUserSearchFilter() {
        return userSearchFilter;
    }

    public void setUserSearchFilter(String userSearchFilter) {
        this.userSearchFilter = userSearchFilter;
    }

    public String getBindDn() {
        return bindDn;
    }

    public void setBindDn(String bindDn) {
        this.bindDn = bindDn;
    }

    public String getBindPassword() {
        return bindPassword;
    }

    public void setBindPassword(String bindPassword) {
        this.bindPassword = bindPassword;
    }

    public int getTimeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(int timeoutMs) {
        this.timeoutMs = timeoutMs;
    }

    public String getTrustCertPath() {
        return trustCertPath;
    }

    public void setTrustCertPath(String trustCertPath) {
        this.trustCertPath = trustCertPath;
    }
}
