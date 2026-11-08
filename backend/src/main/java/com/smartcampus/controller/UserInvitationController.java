package com.smartcampus.controller;

import com.smartcampus.service.UserInvitationService;
import com.smartcampus.service.UserInvitationService.ActivateRequest;
import com.smartcampus.service.UserInvitationService.InviteRequest;
import com.smartcampus.service.UserInvitationService.InviteResponse;
import com.smartcampus.service.InvitationCsvService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class UserInvitationController {
    private final UserInvitationService service;
    private final InvitationCsvService csv;
    public UserInvitationController(UserInvitationService service, InvitationCsvService csv) { this.service = service; this.csv = csv; }

    @PostMapping(value = "/admin/invitations/import", consumes = "multipart/form-data")
    public InvitationCsvService.ImportResult importCsv(@RequestPart("file") MultipartFile file,
            @RequestAttribute("authenticatedUserId") Long adminId) {
        return csv.importFile(file, adminId);
    }

    @PostMapping("/admin/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InviteResponse invite(@Valid @RequestBody InviteRequest request,
                                 @RequestAttribute("authenticatedUserId") Long adminId) {
        return service.invite(request, adminId);
    }

    @PostMapping("/auth/activate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void activate(@Valid @RequestBody ActivateRequest request) { service.activate(request); }
}
