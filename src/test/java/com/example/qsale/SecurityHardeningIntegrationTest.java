package com.example.qsale;

import com.example.qsale.auth.domain.LoginProtectionService;
import com.example.qsale.notification.domain.EmailService;
import com.example.qsale.security.RequestLimitFilter;
import com.example.qsale.security.RequestLimits;
import com.example.qsale.security.SecurityKeys;
import com.example.qsale.security.TransportSecurityFilter;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.infrastructure.UserRepository;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityHardeningIntegrationTest extends AbstractContainerBaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired RequestLimits limits;
    @Autowired LoginProtectionService login;
    @MockitoBean EmailService mail;
    private static final String PASSWORD = "SecurityCheck2026";

    @Test void storesArgon2idAndUpgradesExistingBcryptOnlyAfterSuccessfulLogin() throws Exception {
        String fresh = address(); signup(fresh);
        assertTrue(users.findByEmail(fresh).orElseThrow().getPassword().startsWith("$argon2id$"));
        String legacy = address();
        String bcrypt = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(4).encode(PASSWORD);
        users.save(new User("Legacy member", legacy, bcrypt, Role.USER));
        signin(legacy, "WrongPassword2026", 401);
        assertEquals(bcrypt, users.findByEmail(legacy).orElseThrow().getPassword());
        signin(legacy, PASSWORD, 200);
        assertTrue(users.findByEmail(legacy).orElseThrow().getPassword().startsWith("$argon2id$"));
    }

    @Test void fiveFailuresPersistLockoutAndExpiredLocksAllowRecovery() throws Exception {
        String email = address(); signup(email);
        for (int i=0; i<5; i++) signin(email, "WrongPassword2026", 401);
        signin(email, PASSWORD, 401);
        String key = SecurityKeys.hash("login:"+email);
        assertEquals(5, jdbc.queryForObject("SELECT failures FROM login_guards WHERE account_key=?",Integer.class,key));
        jdbc.update("UPDATE login_guards SET locked_until=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE account_key=?",key);
        signin(email,PASSWORD,200);
        assertEquals(0,jdbc.queryForObject("SELECT failures FROM login_guards WHERE account_key=?",Integer.class,key));
    }

    @Test void simultaneousFailuresCannotLoseTheAccountLockoutCounter() throws Exception {
        String email=address();signup(email);
        try(var executor=Executors.newFixedThreadPool(5)) {
            List<Future<?>> calls=new ArrayList<>();
            for(int i=0;i<5;i++) calls.add(executor.submit(() ->
                    assertThrows(org.springframework.security.core.AuthenticationException.class,
                            () -> login.authenticate(email,"WrongPassword2026"))));
            for(Future<?> call:calls) call.get(20,TimeUnit.SECONDS);
        }
        signin(email,PASSWORD,401);
    }

    @Test void concurrentHttpLoginsDoNotExhaustTheConnectionPoolWithNestedTransactions() throws Exception {
        String email=address();signup(email);
        try(var executor=Executors.newFixedThreadPool(12)) {
            List<Future<?>> calls=new ArrayList<>();
            for(int i=0;i<12;i++) calls.add(executor.submit(() -> {
                try { signin(email,PASSWORD,200); }
                catch(Exception ex) { throw new RuntimeException(ex); }
            }));
            for(Future<?> call:calls) call.get(20,TimeUnit.SECONDS);
        }
    }

    @Test void databaseRateBudgetIsAtomicAcrossConcurrentRequests() throws Exception {
        String identity="test:"+UUID.randomUUID();
        AtomicInteger accepted=new AtomicInteger();
        try(var executor=Executors.newFixedThreadPool(8)) {
            List<Future<?>> calls=new ArrayList<>();
            for(int i=0;i<12;i++) calls.add(executor.submit(() -> {
                if(limits.consume(identity,5).allowed()) accepted.incrementAndGet();
            }));
            for(Future<?> call:calls) call.get(10,TimeUnit.SECONDS);
        }
        assertEquals(5,accepted.get());
        jdbc.update("UPDATE security_rate_buckets SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE bucket_key=?",SecurityKeys.hash(identity));
        assertTrue(limits.consume(identity,5).allowed());
    }

    @Test void filterReturns429AndDoesNotTrustClientForwardedAddresses() throws Exception {
        var filter=new RequestLimitFilter(limits,2,2,UUID.randomUUID().toString());
        AtomicInteger reached=new AtomicInteger();
        for(int i=0;i<3;i++) {
            var request=new MockHttpServletRequest("GET","/api/v1/users/me");
            request.setRemoteAddr("198.51.100.20"); request.addHeader("X-Forwarded-For","198.51.100."+(30+i));
            var response=new MockHttpServletResponse();
            filter.doFilter(request,response,(req,res)->reached.incrementAndGet());
            if(i==2) {assertEquals(429,response.getStatus());assertNotNull(response.getHeader("Retry-After"));}
        }
        assertEquals(2,reached.get());
    }

    @Test void oversizedAndChunkedBodiesAreRejectedBeforeControllerProcessing() throws Exception {
        byte[] content=("{\"password\":\""+"x".repeat(70000)+"\"}").getBytes(StandardCharsets.UTF_8);
        mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(content))
                .andExpect(status().isPayloadTooLarge());
        var request=new MockHttpServletRequest("POST","/api/v1/auth/signup"); request.setContent(content);
        var chunked=new jakarta.servlet.http.HttpServletRequestWrapper(request) {
            @Override public long getContentLengthLong(){return -1;}
        };
        var response=new MockHttpServletResponse();
        new RequestLimitFilter(limits,10,10,UUID.randomUUID().toString()).doFilter(chunked,response,
                (req,res)->fail("Oversized chunked body reached the application"));
        assertEquals(413,response.getStatus());
    }

    @Test void endpointBudgetsAllowNormalMultiEndpointFlowsWithoutLosingRepeatedRequestProtection() throws Exception {
        var filter=new RequestLimitFilter(limits,2,2,UUID.randomUUID().toString());
        AtomicInteger reached=new AtomicInteger();
        for(String path:List.of("/api/v1/plans/1","/api/v1/plans/2","/api/v1/plans/1/options","/api/v1/plans/2/options")) {
            var response=new MockHttpServletResponse();
            filter.doFilter(new MockHttpServletRequest("GET",path),response,(req,res)->reached.incrementAndGet());
            assertEquals(200,response.getStatus());
        }
        var blocked=new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET","/api/v1/plans/3"),blocked,(req,res)->fail("Normalized route limit bypassed"));
        assertEquals(429,blocked.getStatus()); assertEquals(4,reached.get());
        var overall=new RequestLimitFilter(limits,2,2,UUID.randomUUID().toString());
        for(int i=0;i<11;i++) {
            var response=new MockHttpServletResponse();
            overall.doFilter(new MockHttpServletRequest("GET","/api/v1/route"+i),response,(req,res)->{});
            assertEquals(i<10 ? 200 : 429,response.getStatus());
        }
    }

    @Test void sessionRenewalsHaveTheirOwnBudgetAndCannotConsumeCredentialAttempts() throws Exception {
        var filter=new RequestLimitFilter(limits,5,2,UUID.randomUUID().toString());
        for(int i=0;i<6;i++) {
            var response=new MockHttpServletResponse();
            filter.doFilter(new MockHttpServletRequest("POST","/api/v1/auth/refresh"),response,(req,res)->{});
            assertEquals(i<5 ? 200 : 429,response.getStatus());
        }
        for(int i=0;i<3;i++) {
            var response=new MockHttpServletResponse();
            filter.doFilter(new MockHttpServletRequest("POST","/api/v1/auth/signin"),response,(req,res)->{});
            assertEquals(i<2 ? 200 : 429,response.getStatus());
        }
    }

    @Test void productionTransportRejectsSpoofedHttpsAndAddsApiHeaders() throws Exception {
        var request=new MockHttpServletRequest("GET","/api/v1/plans"); request.addHeader("X-Forwarded-Proto","https");
        var response=new MockHttpServletResponse();
        new TransportSecurityFilter(true).doFilter(request,response,(req,res)->fail("Insecure request accepted"));
        assertEquals(426,response.getStatus());
        assertEquals("default-src 'none'; frame-ancestors 'none'; base-uri 'none'",response.getHeader("Content-Security-Policy"));
        request=new MockHttpServletRequest("GET","/api/v1/plans");request.setSecure(true);
        new TransportSecurityFilter(true).doFilter(request,new MockHttpServletResponse(),(req,res)->{});
        mvc.perform(get("/api/v1/users/me").secure(true)).andExpect(status().isUnauthorized())
                .andExpect(header().exists("Strict-Transport-Security"));
    }

    @Test void usersCannotAccessOtherPlansAdminRoutesOrInjectSearchSql() throws Exception {
        String first=signup(address()), second=signup(address());
        String plan=mvc.perform(post("/api/v1/plans").header("Authorization","Bearer "+second)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Private group\",\"type\":\"OTHER\",\"minParticipants\":2}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        Number id=JsonPath.read(plan,"$.id");
        mvc.perform(get("/api/v1/plans/"+id).header("Authorization","Bearer "+first)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/jobs").header("Authorization","Bearer "+first)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/plans").param("search","' OR 1=1 --").header("Authorization","Bearer "+first))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
        mvc.perform(post("/api/v1/plans").header("Authorization","Bearer "+first).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Invalid budget\",\"type\":\"OTHER\",\"minParticipants\":2,\"budget\":-3}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/plans").header("Authorization","Bearer "+first).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Infinite budget\",\"type\":\"OTHER\",\"minParticipants\":2,\"budget\":1e309}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/plans").header("Authorization","Bearer "+first)
                .contentType(MediaType.APPLICATION_OCTET_STREAM).content("<?php echo 'blocked'; ?>"))
                .andExpect(status().isUnsupportedMediaType());
    }

    private String address(){return UUID.randomUUID()+"@qsale.test";}
    private String signup(String email)throws Exception {
        String body=mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Security member\",\"email\":\"%s\",\"password\":\"%s\"}".formatted(email,PASSWORD)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body,"$.token");
    }
    private void signin(String email,String password,int expected)throws Exception {
        mvc.perform(post("/api/v1/auth/signin").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email,password)))
                .andExpect(status().is(expected));
    }
}
