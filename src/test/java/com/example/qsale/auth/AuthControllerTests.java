package com.example.qsale.auth;

import com.example.qsale.AbstractContainerBaseTest;
import com.example.qsale.auth.dto.SignInRequest;
import com.example.qsale.auth.dto.SignUpRequest;
import com.example.qsale.auth.dto.TokenResponse;
import com.example.qsale.user.infrastructure.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class AuthControllerTests extends AbstractContainerBaseTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Test
    void shouldReturnCreatedWithTokensWhenSigningUp() throws Exception {
        String email = uniqueEmail();
        String payload = objectMapper.writeValueAsString(signUpRequest(email, "Secret123"));

        String response = mockMvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        TokenResponse tokens = objectMapper.readValue(response, TokenResponse.class);
        assertFalse(tokens.token().isBlank());
        assertFalse(tokens.refreshToken().isBlank());
        assertTrue(userRepository.existsByEmail(email));
    }

    @Test
    void shouldReturnBadRequestWithFieldErrorsWhenSignupIsInvalid() throws Exception {
        String payload = objectMapper.writeValueAsString(signUpRequest("not-an-email", "weak"));

        mockMvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.fieldErrors.password").exists());
    }

    @Test
    void shouldReturnConflictWhenEmailIsAlreadyRegistered() throws Exception {
        String payload = objectMapper.writeValueAsString(signUpRequest(uniqueEmail(), "Secret123"));
        mockMvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldReturnUnauthorizedWithWrongPassword() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(signUpRequest(email, "Secret123"))))
                .andExpect(status().isCreated());
        SignInRequest signIn = new SignInRequest();
        signIn.setEmail(email);
        signIn.setPassword("Wrong1234");

        mockMvc.perform(post("/api/v1/auth/signin").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(signIn)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void shouldReturnUnauthorizedWhenCallingProtectedEndpointWithoutToken() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.path").value("/api/v1/users/me"));
    }

    private SignUpRequest signUpRequest(String email, String password) {
        SignUpRequest request = new SignUpRequest();
        request.setName("Test User");
        request.setEmail(email);
        request.setPassword(password);
        return request;
    }

    private String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@utec.edu.pe";
    }
}
