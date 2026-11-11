package com.boa.apid.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3 / Swagger specification metadata for APID modular contracts.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI apidOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("APID — Abyssinia Personal Intelligence and Development API")
                        .version("v1")
                        .description("Modular monolith REST API covering Core, Coaching (PMS), and Mentoring (HR)."));
    }
}

