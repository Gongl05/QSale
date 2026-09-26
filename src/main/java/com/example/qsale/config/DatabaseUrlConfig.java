package com.example.qsale.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;

import java.net.URI;

@Configuration
public class DatabaseUrlConfig {

    @Bean
    @ConditionalOnProperty(name = "DATABASE_URL")
    @ConfigurationProperties(prefix = "spring.datasource.hikari")
    HikariDataSource databaseUrlDataSource(@Value("${DATABASE_URL}") String databaseUrl) {
        URI uri = URI.create(databaseUrl);
        String[] credentials = uri.getUserInfo() == null ? new String[0] : uri.getUserInfo().split(":", 2);
        if (!"postgresql".equals(uri.getScheme()) || uri.getHost() == null || uri.getPort() < 1
                || uri.getPath() == null || uri.getPath().length() < 2 || credentials.length != 2) {
            throw new IllegalArgumentException("DATABASE_URL must be a PostgreSQL connection URL");
        }

        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl("jdbc:postgresql://" + uri.getHost() + ":" + uri.getPort() + uri.getRawPath());
        dataSource.setUsername(credentials[0]);
        dataSource.setPassword(credentials[1]);
        return dataSource;
    }
}
