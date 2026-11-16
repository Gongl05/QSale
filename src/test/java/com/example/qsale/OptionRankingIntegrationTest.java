package com.example.qsale;

import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OptionRankingIntegrationTest extends AbstractContainerBaseTest {
    @Autowired MockMvc mvc;
    @Autowired PlanOptionRepository options;

    @Test void aTiedPlaceUsesTheSameProximityRuleInTheListAndTheFinalSelection() throws Exception {
        String owner=account(), guest=account();
        String plan=send("POST","/api/v1/plans",owner,"{\"name\":\"Ranking test\",\"type\":\"OTHER\",\"minParticipants\":2}",201);
        long id=((Number)JsonPath.read(plan,"$.id")).longValue();
        String code=JsonPath.read(plan,"$.inviteCode");
        send("POST","/api/v1/plans/join/"+code,guest,"{}",201);
        String day=LocalDate.now().plusDays(10).toString();
        long date=option(id,owner,"{\"type\":\"DATE\",\"label\":\"Chosen day\",\"startsOn\":\""+day+"\"}");
        long far=option(id,owner,place("Far place")), near=option(id,owner,place("Near place"));
        options.findById(far).orElseThrow().setAvgDistanceKm(15.0);
        options.findById(near).orElseThrow().setAvgDistanceKm(1.0);
        options.flush();
        for(String token:List.of(owner,guest)) {
            send("POST","/api/v1/options/"+date+"/votes",token,"{}",201);
            send("PUT","/api/v1/plans/"+id+"/commitments/me",token,"{\"status\":\"CONFIRMED\"}",200);
            send("POST","/api/v1/plans/"+id+"/availabilities",token,"{\"availableDate\":\""+day+"\"}",201);
        }
        send("POST","/api/v1/options/"+far+"/votes",owner,"{}",201);
        send("POST","/api/v1/options/"+near+"/votes",guest,"{}",201);
        String before=send("GET","/api/v1/plans/"+id+"/options?type=PLACE",owner,null,200);
        assertEquals(near,((Number)JsonPath.read(before,"$[0].id")).longValue());
        String preview=send("GET","/api/v1/plans/"+id,owner,null,200);
        assertEquals("Near place",JsonPath.read(preview,"$.closingPreview.place"));
        assertEquals(day,JsonPath.read(preview,"$.closingPreview.date"));
        send("PATCH","/api/v1/plans/"+id+"/close",owner,"{}",200);
        String confirmed=send("GET","/api/v1/plans/"+id,owner,null,200);
        assertEquals("Near place",JsonPath.read(confirmed,"$.agreement.place"));
        assertEquals(day,JsonPath.read(confirmed,"$.agreement.date"));
        String list=send("GET","/api/v1/plans",owner,null,200);
        assertEquals("Near place",JsonPath.read(list,"$.content[0].agreement.place"));
        String after=send("GET","/api/v1/plans/"+id+"/options?type=PLACE",owner,null,200);
        assertEquals(near,((Number)((List<?>)JsonPath.read(after,"$[?(@.selected == true)].id")).getFirst()).longValue());
    }

    private long option(long id,String token,String body) throws Exception {
        return ((Number)JsonPath.read(send("POST","/api/v1/plans/"+id+"/options",token,body,201),"$.id")).longValue();
    }
    private String place(String label) { return "{\"type\":\"PLACE\",\"label\":\""+label+"\",\"location\":{\"latitude\":-12,\"longitude\":-77}}"; }
    private String account() throws Exception {
        return "Bearer "+JsonPath.read(send("POST","/api/v1/auth/signup",null,"{\"name\":\"Ranking Test\",\"email\":\""+UUID.randomUUID()+"@qsale.test\",\"password\":\"RankingTest2026\"}",201),"$.token");
    }
    private String send(String method,String path,String token,String body,int expected) throws Exception {
        var request=request(org.springframework.http.HttpMethod.valueOf(method),path);
        if(token!=null)request.header("Authorization",token);
        if(body!=null)request.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(request).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }
}
