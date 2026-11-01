package com.smartcampus.controller;

import com.smartcampus.dto.ClassSessionRequest;
import com.smartcampus.dto.ClassSessionResponse;
import com.smartcampus.service.ClassSessionService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/class-sessions")
public class ClassSessionController {
    private final ClassSessionService service;

    public ClassSessionController(ClassSessionService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClassSessionResponse create(@Valid @RequestBody ClassSessionRequest request) {
        return service.create(request);
    }

    @GetMapping("/{id}")
    public ClassSessionResponse getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @GetMapping
    public List<ClassSessionResponse> list() {
        return service.list();
    }
}
