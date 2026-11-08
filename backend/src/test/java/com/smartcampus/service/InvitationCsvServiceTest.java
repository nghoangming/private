package com.smartcampus.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smartcampus.auth.AccessService;
import com.smartcampus.service.UserInvitationService.InviteRequest;
import com.smartcampus.service.UserInvitationService.InviteResponse;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class InvitationCsvServiceTest {
    @Mock UserInvitationService invitations;
    @Mock AccessService access;

    @Test
    void importsQuotedNamesAndReportsDuplicateRows() {
        when(invitations.invite(any(InviteRequest.class), eq(7L)))
                .thenReturn(new InviteResponse(42L, "sv@example.com", "STUDENT", "CNTT"));
        String csv = "\uFEFFcode,name,email,role,faculty\r\n"
                + "SV01,\"Nguyễn, Văn A\",sv@example.com,STUDENT,CNTT\r\n"
                + "SV01,Người khác,other@example.com,STUDENT,CNTT\r\n";
        var file = new MockMultipartFile("file", "users.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));
        var result = new InvitationCsvService(invitations, access).importFile(file, 7L);
        assertEquals(2, result.total());
        assertEquals(1, result.created());
        assertEquals(1, result.failed());
        assertEquals(3, result.rows().get(1).line());
        verify(invitations).invite(new InviteRequest("SV01", "Nguyễn, Văn A", "sv@example.com", "STUDENT", "CNTT"), 7L);
    }

    @Test
    void rejectsIncorrectHeaderBeforeCreatingAccounts() {
        var file = new MockMultipartFile("file", "users.csv", "text/csv", "email,name\n".getBytes(StandardCharsets.UTF_8));
        assertThrows(ResponseStatusException.class, () -> new InvitationCsvService(invitations, access).importFile(file, 7L));
    }
}
