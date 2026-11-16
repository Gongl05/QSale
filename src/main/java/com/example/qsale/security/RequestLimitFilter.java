package com.example.qsale.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

@RequiredArgsConstructor
public class RequestLimitFilter extends OncePerRequestFilter {
    private final RequestLimits limits;
    private final int apiLimit;
    private final int authLimit;
    private final String scope;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!request.getRequestURI().startsWith("/api/v1/") || request.getMethod().equals("OPTIONS")) {
            chain.doFilter(request, response); return;
        }
        boolean auth = request.getRequestURI().startsWith("/api/v1/auth/");
        var principal = SecurityContextHolder.getContext().getAuthentication();
        String identity = !auth && principal != null && !(principal instanceof AnonymousAuthenticationToken)
                ? "user:" + principal.getName() : "ip:" + request.getRemoteAddr();
        RequestLimits.Budget budget;
        if (auth) {
            boolean session = request.getRequestURI().equals("/api/v1/auth/refresh") || request.getRequestURI().equals("/api/v1/auth/logout");
            budget = limits.consume(scope + (session ? ":session:" : ":auth:") + identity, session ? apiLimit : authLimit);
        }
        else {
            budget = limits.consume(scope + ":all:" + identity, Math.toIntExact(Math.min((long)apiLimit * 5, 1000000)));
            if (budget.allowed()) {
                String route = request.getRequestURI().replaceAll("/\\d+(?=/|$)", "/:id")
                        .replaceAll("/join/[^/]+", "/join/:code")
                        .replaceAll("/admin/jobs/[^/]+", "/admin/jobs/:id");
                budget = limits.consume(scope + ":route:" + identity + ':' + request.getMethod() + ':' + route, apiLimit);
            }
        }
        if (!budget.allowed()) {
            response.setStatus(429);
            response.setHeader("Retry-After", Long.toString(budget.retryAfter()));
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":429,\"message\":\"Too many requests. Please retry later.\"}");
            return;
        }
        if (request.getContentLengthLong() > 65536) { tooLarge(response); return; }
        if (java.util.Set.of("POST", "PUT", "PATCH").contains(request.getMethod())) {
            try { chain.doFilter(new BoundedRequest(request), response); }
            catch (BoundedRequest.TooLarge ex) { tooLarge(response); }
        } else chain.doFilter(request, response);
    }

    private void tooLarge(HttpServletResponse response) throws IOException {
        response.setStatus(413); response.setContentType("application/json");
        response.getWriter().write("{\"status\":413,\"message\":\"Request body is too large\"}");
    }
}
