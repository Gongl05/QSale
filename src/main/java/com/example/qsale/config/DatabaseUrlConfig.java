package com.example.qsale.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.URI;

@Configuration
public class DatabaseUrlConfig {

    @Bean
    @ConditionalOnProperty(name = "DATABASE_URL")
    @ConfigurationProperties(prefix = "spring.datasource.hikari")
    HikariDataSource databaseUrlDataSource(@Value("${DATABASE_URL}") String databaseUrl) {
        URI uri = URI.create(databaseUrl);
        String[] credentials = uri.getUserInfo() == null ? new String[0] : uri.getUserInfo().split(":", 2);
        if (!("postgresql".equals(uri.getScheme()) || "postgres".equals(uri.getScheme()))
                || uri.getHost() == null
                || uri.getPath() == null || uri.getPath().length() < 2 || credentials.length != 2) {
            throw new IllegalArgumentException("DATABASE_URL must be a PostgreSQL connection URL");
        }

        HikariDataSource dataSource = new HikariDataSource();
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        String query = uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery();
        dataSource.setJdbcUrl("jdbc:postgresql://" + uri.getHost() + ":" + port + uri.getRawPath() + query);
        dataSource.setUsername(credentials[0]);
        dataSource.setPassword(credentials[1]);
        return dataSource;
    }
}
