package com.smartcampus.controller;

import com.smartcampus.auth.AccessService;
import com.smartcampus.service.StudentIntakeService;
import com.smartcampus.service.StudentIntakeCsvService;
import java.util.List;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/intake/students")
public class StudentIntakeController {
    private final StudentIntakeService service;
    private final StudentIntakeCsvService csv;
    private final AccessService access;
    public StudentIntakeController(StudentIntakeService service, StudentIntakeCsvService csv, AccessService access) {
        this.service = service; this.csv = csv; this.access = access;
    }

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public StudentIntakeCsvService.ImportResult importCsv(@RequestPart("file") MultipartFile file,
            @RequestAttribute("authenticatedUserId") Long adminId) {
        return csv.importFile(file, adminId);
    }

    @GetMapping
    public List<StudentIntakeService.Intake> list(@RequestAttribute("authenticatedUserId") Long adminId) {
        access.requireRole(adminId, "ADMIN");
        return service.list();
    }

    @PostMapping("/{id}/retry")
    public StudentIntakeService.Created retry(@PathVariable Long id,
            @RequestAttribute("authenticatedUserId") Long adminId) {
        access.requireRole(adminId, "ADMIN");
        return service.retry(id, adminId);
    }
}
