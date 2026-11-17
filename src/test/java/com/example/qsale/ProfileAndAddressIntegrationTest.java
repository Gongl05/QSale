package com.example.qsale;

import com.example.qsale.notification.domain.EmailService;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Base64;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ProfileAndAddressIntegrationTest extends AbstractContainerBaseTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private EmailService emailService;

    @Test
    void profileKeepsTheEmailAndRejectsNamesWithNumbers() throws Exception {
        String token = signUp();
        mvc.perform(put("/api/v1/users/me/profile").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"María José","surname":"Pérez-Díaz","nickname":"Majo",
                                 "phone":"+51 987654321","birthDate":"2004-02-01","gender":"FEMALE"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("Majo"))
                .andExpect(jsonPath("$.surname").value("Pérez-Díaz"))
                .andExpect(jsonPath("$.gender").value("FEMALE"));
        mvc.perform(put("/api/v1/users/me/profile").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"R2D2\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void avatarIsStoredAndServedToItsOwner() throws Exception {
        String token = signUp();
        byte[] picture = {1, 2, 3, 4};
        String me = mvc.perform(put("/api/v1/users/me/avatar").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contentType\":\"image/png\",\"data\":\"%s\"}"
                                .formatted(Base64.getEncoder().encodeToString(picture))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarVersion").isNumber())
                .andReturn().getResponse().getContentAsString();
        long userId = ((Number) JsonPath.read(me, "$.id")).longValue();
        mvc.perform(get("/api/v1/users/{id}/avatar", userId).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(picture));
        // Someone who shares no plan with this user cannot see the picture.
        mvc.perform(get("/api/v1/users/{id}/avatar", userId).header("Authorization", signUp()))
                .andExpect(status().isNotFound());
    }

    @Test
    void theMainAddressBecomesTheDefaultStartingPointAndPlansCanUseAnother() throws Exception {
        String token = signUp();
        String home = mvc.perform(post("/api/v1/users/me/addresses").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(address("Casa", "HOME", -12.12, -77.03, false)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.main").value(true))
                .andReturn().getResponse().getContentAsString();
        String office = mvc.perform(post("/api/v1/users/me/addresses").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(address("Oficina", "WORK", -12.09, -77.05, false)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.main").value(false))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/v1/users/me").header("Authorization", token))
                .andExpect(jsonPath("$.location.latitude").value(-12.12));

        long officeId = ((Number) JsonPath.read(office, "$.id")).longValue();
        String plan = mvc.perform(post("/api/v1/plans").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Almuerzo\",\"type\":\"DINNER\",\"minParticipants\":2}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long planId = ((Number) JsonPath.read(plan, "$.id")).longValue();
        mvc.perform(put("/api/v1/plans/{id}/participants/me/origin", planId).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"addressId\":" + officeId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.originAddressId").value(officeId));
        mvc.perform(get("/api/v1/plans/{id}", planId).header("Authorization", token))
                .andExpect(jsonPath("$.currentUserOriginAddressId").value(officeId));

        // Deleting the main address promotes the other one and plans fall back to it.
        long homeId = ((Number) JsonPath.read(home, "$.id")).longValue();
        mvc.perform(delete("/api/v1/users/me/addresses/{id}", homeId).header("Authorization", token))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/users/me/addresses").header("Authorization", token))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].main").value(true));
        mvc.perform(get("/api/v1/users/me").header("Authorization", token))
                .andExpect(jsonPath("$.location.latitude").value(-12.09));
        mvc.perform(delete("/api/v1/users/me/addresses/{id}", officeId).header("Authorization", token))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/plans/{id}", planId).header("Authorization", token))
                .andExpect(jsonPath("$.currentUserOriginAddressId").doesNotExist());
    }

    @Test
    void aPlanStoresSpecificDaysButNotTogetherWithARange() throws Exception {
        String token = signUp();
        LocalDate first = LocalDate.now().plusDays(10);
        LocalDate second = LocalDate.now().plusDays(3);
        mvc.perform(post("/api/v1/plans").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Viaje\",\"type\":\"TRIP\",\"minParticipants\":2,\"tentativeDates\":[\"%s\",\"%s\",\"%s\"]}"
                                .formatted(first, second, first)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tentativeDates.length()").value(2))
                .andExpect(jsonPath("$.tentativeDates[0]").value(second.toString()));
        mvc.perform(post("/api/v1/plans").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Viaje\",\"type\":\"TRIP\",\"minParticipants\":2,\"tentativeStartDate\":\"%s\",\"tentativeDates\":[\"%s\"]}"
                                .formatted(second, first)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void editingAPlanWithoutSendingDaysKeepsThemAndARangeReplacesThem() throws Exception {
        String token = signUp();
        LocalDate day = LocalDate.now().plusDays(5);
        String created = mvc.perform(post("/api/v1/plans").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Cena\",\"type\":\"DINNER\",\"minParticipants\":2,\"tentativeDates\":[\"%s\"]}"
                                .formatted(day)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(created, "$.id")).longValue();
        long version = ((Number) JsonPath.read(created, "$.version")).longValue();
        // A client that does not know about specific days (the web app) only changes the budget.
        String updated = mvc.perform(put("/api/v1/plans/{id}", id).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Cena\",\"type\":\"DINNER\",\"minParticipants\":2,\"budget\":40,\"version\":%d}"
                                .formatted(version)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tentativeDates[0]").value(day.toString()))
                .andReturn().getResponse().getContentAsString();
        long next = ((Number) JsonPath.read(updated, "$.version")).longValue();
        mvc.perform(put("/api/v1/plans/{id}", id).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Cena\",\"type\":\"DINNER\",\"minParticipants\":2,\"tentativeStartDate\":\"%s\",\"version\":%d}"
                                .formatted(day, next)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tentativeDates.length()").value(0))
                .andExpect(jsonPath("$.tentativeStartDate").value(day.toString()));
    }

    @Test
    void theWebReferenceLocationIsTheMainAddress() throws Exception {
        String token = signUp();
        mvc.perform(put("/api/v1/users/me").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Perfil Test\",\"location\":{\"latitude\":-12.1,\"longitude\":-77.0}}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/me/addresses").header("Authorization", token))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].main").value(true))
                .andExpect(jsonPath("$[0].location.latitude").value(-12.1));
        mvc.perform(put("/api/v1/users/me").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Perfil Test\",\"location\":{\"latitude\":-12.2,\"longitude\":-77.0}}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/me/addresses").header("Authorization", token))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].location.latitude").value(-12.2));
        mvc.perform(put("/api/v1/users/me").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Perfil Test\",\"removeLocation\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location").doesNotExist());
        mvc.perform(get("/api/v1/users/me/addresses").header("Authorization", token))
                .andExpect(jsonPath("$.length()").value(0));
    }

    private String signUp() throws Exception {
        String response = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Perfil Test\",\"email\":\"%s@qsale.test\",\"password\":\"ProfileTest2026\"}"
                                .formatted(UUID.randomUUID())))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return "Bearer " + JsonPath.read(response, "$.token");
    }

    private String address(String label, String type, double latitude, double longitude, boolean main) {
        return "{\"label\":\"%s\",\"type\":\"%s\",\"favorite\":true,\"main\":%s,\"location\":{\"latitude\":%s,\"longitude\":%s,\"address\":\"Av. Prueba 123\"}}"
                .formatted(label, type, main, latitude, longitude);
    }
}
