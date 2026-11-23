package com.boa.apid.core.auth.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import java.io.InputStream;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.Map;

@Configuration
public class LdapConfig {

    private static final Logger log = LoggerFactory.getLogger(LdapConfig.class);

    private final LdapProperties ldapProperties;
    private final ResourceLoader resourceLoader;

    public LdapConfig(LdapProperties ldapProperties, ResourceLoader resourceLoader) {
        this.ldapProperties = ldapProperties;
        this.resourceLoader = resourceLoader;
    }

    @PostConstruct
    public void configureTlsTrust() {
        if (!ldapProperties.isEnabled()) {
            return;
        }

        String certPath = ldapProperties.getTrustCertPath();
        if (certPath == null || certPath.isBlank()) {
            return;
        }

        try {
            Resource certResource = resourceLoader.getResource(certPath);
            if (!certResource.exists()) {
                log.info("LDAP CA certificate not found at {}, relying on system default truststore", certPath);
                return;
            }

            try (InputStream is = certResource.getInputStream()) {
                CertificateFactory cf = CertificateFactory.getInstance("X.509");
                X509Certificate caCert = (X509Certificate) cf.generateCertificate(is);

                KeyStore trustStore = KeyStore.getInstance(KeyStore.getDefaultType());
                trustStore.load(null, null);

                // Preserve standard system trusted CAs
                TrustManagerFactory defaultTmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                defaultTmf.init((KeyStore) null);
                for (TrustManager tm : defaultTmf.getTrustManagers()) {
                    if (tm instanceof X509TrustManager x509Tm) {
                        for (X509Certificate cert : x509Tm.getAcceptedIssuers()) {
                            trustStore.setCertificateEntry(cert.getSubjectX500Principal().getName(), cert);
                        }
                    }
                }

                // Register enterprise root CA
                trustStore.setCertificateEntry("apid-ca", caCert);

                TrustManagerFactory combinedTmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                combinedTmf.init(trustStore);

                SSLContext sslContext = SSLContext.getInstance("TLS");
                sslContext.init(null, combinedTmf.getTrustManagers(), new SecureRandom());
                SSLContext.setDefault(sslContext);

                log.info("Successfully registered enterprise CA into JVM SSLContext: {}", caCert.getSubjectX500Principal());
            }
        } catch (Exception e) {
            log.warn("Failed to load LDAP CA certificate from {}: {}", certPath, e.getMessage());
        }
    }

    @Bean
    public LdapContextSource ldapContextSource() {
        LdapContextSource contextSource = new LdapContextSource();
        contextSource.setUrl(ldapProperties.getUrl());
        contextSource.setBase(ldapProperties.getBaseDn());
        contextSource.setUserDn(ldapProperties.getBindDn());
        contextSource.setPassword(ldapProperties.getBindPassword());
        contextSource.setPooled(false);

        Map<String, Object> baseEnv = new HashMap<>();
        baseEnv.put("com.sun.jndi.ldap.connect.timeout", String.valueOf(ldapProperties.getTimeoutMs()));
        baseEnv.put("com.sun.jndi.ldap.read.timeout", String.valueOf(ldapProperties.getTimeoutMs()));
        // Follow referrals if Active Directory redirects within domain
        baseEnv.put("java.naming.referral", "follow");

        if (ldapProperties.getUrl() != null && ldapProperties.getUrl().toLowerCase().startsWith("ldaps://")) {
            baseEnv.put("java.naming.security.protocol", "ssl");
        }

        contextSource.setBaseEnvironmentProperties(baseEnv);

        try {
            contextSource.afterPropertiesSet();
        } catch (Exception ex) {
            log.warn("LDAP ContextSource initialization notice: {}", ex.getMessage());
        }

        return contextSource;
    }

    @Bean
    public LdapTemplate ldapTemplate(LdapContextSource ldapContextSource) {
        LdapTemplate template = new LdapTemplate(ldapContextSource);
        template.setIgnorePartialResultException(true);
        template.setIgnoreNameNotFoundException(true);
        return template;
    }
}
