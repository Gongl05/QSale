package com.example.qsale.notification.domain;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PublicLinks {
    private final String origin;

    public PublicLinks(@Value("${app.web-url:http://localhost:5173}") String webUrl) {
        URI value = URI.create(webUrl.strip());
        if (!java.util.Set.of("http", "https").contains(value.getScheme()) || value.getHost() == null
                || value.getUserInfo() != null || value.getQuery() != null || value.getFragment() != null
                || !(value.getPath().isEmpty() || value.getPath().equals("/"))) {
            throw new IllegalArgumentException("app.web-url must be an absolute HTTP(S) origin");
        }
        if ("http".equals(value.getScheme())
                && !java.util.Set.of("localhost", "127.0.0.1", "[::1]", "::1").contains(value.getHost())) {
            throw new IllegalArgumentException("app.web-url requires HTTPS outside local development");
        }
        origin = webUrl.strip().replaceAll("/+$", "");
    }

    public String plans() { return origin + "/plans"; }
    public String logo() { return origin + "/qsale.png"; }
    public String plan(Long id) { return origin + "/plans/" + id; }
    public String invitation(String code) { return origin + "/join/" + encode(code); }
    public String passwordReset(String token) { return origin + "/reset-password?token=" + encode(token); }
    private String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
