package com.boa.apid;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

/**
 * Entry point for the APID (Abyssinia Personal Intelligence and Development) modular monolith.
 */
@SpringBootApplication
@EnableCaching
public class ApidApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApidApplication.class, args);
    }
}

