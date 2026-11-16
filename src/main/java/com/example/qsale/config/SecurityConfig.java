package com.example.qsale.config;

import com.example.qsale.auth.components.JwtAuthorizationFilter;
import com.example.qsale.auth.components.SecurityExceptionHandler;
import com.example.qsale.user.domain.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import com.example.qsale.auth.components.MigratingPasswordEncoder;
import com.example.qsale.security.RequestLimits;
import com.example.qsale.security.RequestLimitFilter;
import com.example.qsale.security.TransportSecurityFilter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

import static org.springframework.security.config.http.SessionCreationPolicy.STATELESS;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final UserService userService;
    private final JwtAuthorizationFilter jwtFilter;
    private final SecurityExceptionHandler securityExceptionHandler;

    @Value("${cors.allowed-origins}")
    private List<String> allowedOrigins;

    public SecurityConfig(UserService userService, JwtAuthorizationFilter jwtFilter,
                          SecurityExceptionHandler securityExceptionHandler) {
        this.userService = userService;
        this.jwtFilter = jwtFilter;
        this.securityExceptionHandler = securityExceptionHandler;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new MigratingPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager() {
        return new ProviderManager(List.of(authenticationProvider()));
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(@Value("${security.require-https:false}") boolean requireHttps) {
        if (allowedOrigins.stream().anyMatch(origin -> origin.contains("*") ||
                (requireHttps && !origin.startsWith("https://")))) {
            throw new IllegalStateException("CORS requires explicit origins and HTTPS in production");
        }
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, RequestLimits requestLimits,
            @Value("${security.rate-limit.api-limit:120}") int apiLimit,
            @Value("${security.rate-limit.auth-limit:30}") int authLimit,
            @Value("${security.require-https:false}") boolean requireHttps,
            @Value("${security.scope:default}") String scope) throws Exception {
        return http
                // The API authenticates only explicit Bearer headers; browser cookies terminate at the CSRF-protected web service.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(manager -> manager.sessionCreationPolicy(STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/**", "/error").permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**", "/actuator/health").permitAll()
                        .requestMatchers("/api/v1/admin/**").hasAuthority("ADMIN")
                        .anyRequest().authenticated()
                )
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(securityExceptionHandler)
                        .accessDeniedHandler(securityExceptionHandler)
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new TransportSecurityFilter(requireHttps), JwtAuthorizationFilter.class)
                .addFilterAfter(new RequestLimitFilter(requestLimits, apiLimit, authLimit, scope), JwtAuthorizationFilter.class)
                .build();
    }
}
