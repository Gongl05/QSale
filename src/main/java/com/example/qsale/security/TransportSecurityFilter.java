package com.example.qsale.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.filter.OncePerRequestFilter;

@RequiredArgsConstructor
public class TransportSecurityFilter extends OncePerRequestFilter {
    private final boolean requireHttps;
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/api/")) {
            response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
            response.setHeader("Referrer-Policy", "no-referrer");
        }
        if (requireHttps && !request.isSecure() && !request.getRequestURI().equals("/actuator/health")) {
            response.setStatus(426); response.setContentType("application/json");
            response.getWriter().write("{\"status\":426,\"message\":\"HTTPS is required\"}"); return;
        }
        chain.doFilter(request, response);
    }
}
