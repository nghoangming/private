package com.smartcampus.service;

import com.smartcampus.auth.AccessService;
import com.smartcampus.service.UserInvitationService.InviteRequest;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InvitationCsvService {
    private final UserInvitationService invitations;
    private final AccessService access;

    public InvitationCsvService(UserInvitationService invitations, AccessService access) {
        this.invitations = invitations;
        this.access = access;
    }

    public record RowResult(int line, String code, String email, Long id, String error) { }
    public record ImportResult(int total, int created, int failed, List<RowResult> rows) { }
    private record CsvRow(int line, List<String> cells) { }

    public ImportResult importFile(MultipartFile file, Long adminId) {
        access.requireRole(adminId, "ADMIN");
        if (file == null || file.isEmpty() || file.getSize() > 1024 * 1024)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV phải có dữ liệu và không quá 1 MB.");
        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8).replaceFirst("^\uFEFF", "");
            List<CsvRow> parsed = parse(content);
            if (parsed.isEmpty() || !parsed.getFirst().cells().stream().map(String::trim).map(String::toLowerCase)
                    .toList().equals(List.of("code", "name", "email", "role", "faculty")))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dòng đầu phải là: code,name,email,role,faculty");
            List<CsvRow> data = parsed.subList(1, parsed.size()).stream()
                    .filter(row -> row.cells().stream().anyMatch(cell -> !cell.isBlank())).toList();
            if (data.isEmpty() || data.size() > 500)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV cần từ 1 đến 500 tài khoản.");
            Set<String> codes = new HashSet<>();
            Set<String> emails = new HashSet<>();
            List<RowResult> results = new ArrayList<>();
            int created = 0;
            for (CsvRow row : data) {
                List<String> cells = row.cells();
                String code = cells.isEmpty() ? "" : cells.get(0).trim();
                String email = cells.size() < 3 ? "" : cells.get(2).trim().toLowerCase(Locale.ROOT);
                if (cells.size() != 5) {
                    results.add(new RowResult(row.line(), code, email, null, "Cần đúng 5 cột."));
                    continue;
                }
                if (!codes.add(code.toLowerCase(Locale.ROOT)) || !emails.add(email)) {
                    results.add(new RowResult(row.line(), code, email, null, "Mã tài khoản hoặc email bị lặp trong CSV."));
                    continue;
                }
                try {
                    var saved = invitations.invite(new InviteRequest(code, cells.get(1).trim(), email,
                            cells.get(3).trim().toUpperCase(Locale.ROOT), cells.get(4).trim()), adminId);
                    results.add(new RowResult(row.line(), code, email, saved.id(), null));
                    created++;
                } catch (ResponseStatusException ex) {
                    results.add(new RowResult(row.line(), code, email, null, ex.getReason()));
                } catch (RuntimeException ex) {
                    results.add(new RowResult(row.line(), code, email, null, "Không gửi được email hoặc không lưu được tài khoản."));
                }
            }
            return new ImportResult(data.size(), created, data.size() - created, results);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không đọc được file CSV.", ex);
        }
    }

    // CSV quoted fields, escaped quotes and CRLF. The stored line is the first line of each record.
    private List<CsvRow> parse(String text) {
        List<CsvRow> rows = new ArrayList<>();
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        boolean closed = false;
        int line = 1, start = 1;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (quoted) {
                if (ch == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') { cell.append('"'); i++; }
                else if (ch == '"') { quoted = false; closed = true; }
                else { cell.append(ch); if (ch == '\n') line++; }
            } else if (ch == '"' && cell.isEmpty() && !closed) quoted = true;
            else if (ch == '"') throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dấu nháy CSV không hợp lệ tại dòng " + line);
            else if (ch == ',' || ch == '\n' || ch == '\r') {
                cells.add(cell.toString()); cell.setLength(0); closed = false;
                if (ch != ',') {
                    rows.add(new CsvRow(start, List.copyOf(cells))); cells.clear();
                    if (ch == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
                    line++; start = line;
                }
            } else if (closed && !Character.isWhitespace(ch)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV không hợp lệ tại dòng " + line);
            } else cell.append(ch);
        }
        if (quoted) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dấu nháy CSV chưa đóng tại dòng " + start);
        if (!cells.isEmpty() || !cell.isEmpty()) { cells.add(cell.toString()); rows.add(new CsvRow(start, List.copyOf(cells))); }
        return rows;
    }
}
