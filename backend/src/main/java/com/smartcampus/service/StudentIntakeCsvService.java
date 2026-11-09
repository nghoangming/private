package com.smartcampus.service;

import com.smartcampus.auth.AccessService;
import com.smartcampus.service.StudentIntakeService.Submission;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StudentIntakeCsvService {
    private final StudentIntakeService intake;
    private final AccessService access;
    private final JdbcTemplate jdbc;
    public StudentIntakeCsvService(StudentIntakeService intake, AccessService access, JdbcTemplate jdbc) {
        this.intake = intake; this.access = access; this.jdbc = jdbc;
    }
    public record RowResult(int line, String name, String personalEmail, Long intakeId,
            String code, String schoolEmail, String error) { }
    public record ImportResult(int total, int imported, int failed, List<RowResult> rows) { }
    private record CsvRow(int line, List<String> cells) { }

    public ImportResult importFile(MultipartFile file, Long adminId) {
        access.requireRole(adminId, "ADMIN");
        if (file == null || file.isEmpty() || file.getSize() > 1024 * 1024)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV phải có dữ liệu và không quá 1 MB.");
        try {
            List<CsvRow> rows = parse(new String(file.getBytes(), StandardCharsets.UTF_8).replaceFirst("^\uFEFF", ""));
            if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV trống.");
            Map<String,Integer> columns = new HashMap<>();
            List<String> header = rows.getFirst().cells();
            for (int i = 0; i < header.size(); i++) columns.put(header.get(i).trim().toLowerCase(Locale.ROOT), i);
            for (String required : List.of("họ và tên", "số điện thoại", "ngày sinh", "giới tính", "email cá nhân", "khoa", "năm vào trường"))
                if (!columns.containsKey(required))
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thiếu cột Google Form: " + required);
            List<CsvRow> data = rows.subList(1, rows.size()).stream()
                    .filter(row -> row.cells().stream().anyMatch(value -> !value.isBlank())).toList();
            if (data.isEmpty() || data.size() > 500)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV cần từ 1 đến 500 phản hồi.");
            Map<String, String> faculties = new HashMap<>();
            jdbc.query("SELECT faculty_code, faculty_name FROM faculties", rs -> {
                faculties.put(normalizeFaculty(rs.getString(2)), rs.getString(1));
            });
            Set<String> emails = new HashSet<>();
            List<RowResult> results = new ArrayList<>();
            int imported = 0;
            for (CsvRow row : data) {
                String name = value(row, columns, "họ và tên");
                String email = value(row, columns, "email cá nhân").toLowerCase(Locale.ROOT);
                if (row.cells().size() != header.size()) {
                    results.add(new RowResult(row.line(), name, email, null, null, null, "Số cột không khớp tiêu đề."));
                    continue;
                }
                if (!emails.add(email)) {
                    results.add(new RowResult(row.line(), name, email, null, null, null, "Email cá nhân bị lặp trong file."));
                    continue;
                }
                try {
                    String code = facultyCode(value(row, columns, "khoa"), faculties);
                    String genderText = value(row, columns, "giới tính").toLowerCase(Locale.ROOT);
                    String gender = switch (genderText) {
                        case "nam" -> "MALE";
                        case "nữ", "nu" -> "FEMALE";
                        case "khác", "khac" -> "OTHER";
                        default -> null;
                    };
                    if (gender == null) throw new IllegalArgumentException("Giới tính phải là Nam, Nữ hoặc Khác.");
                    var saved = intake.register(new Submission(name, value(row, columns, "số điện thoại"),
                            parseDate(value(row, columns, "ngày sinh")), gender, email, code,
                            parseEntryYear(value(row, columns, "năm vào trường"))), adminId);
                    results.add(new RowResult(row.line(), name, email, saved.intake().id(),
                            saved.code(), saved.schoolEmail(), null));
                    imported++;
                } catch (ResponseStatusException ex) {
                    results.add(new RowResult(row.line(), name, email, null, null, null, ex.getReason()));
                } catch (IllegalArgumentException ex) {
                    results.add(new RowResult(row.line(), name, email, null, null, null, ex.getMessage()));
                }
            }
            return new ImportResult(data.size(), imported, data.size() - imported, results);
        } catch (ResponseStatusException ex) { throw ex; }
        catch (Exception ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không đọc được file CSV.", ex); }
    }

    static String facultyCode(String input, Map<String, String> faculties) {
        String value = input.trim();
        String normalized = normalizeFaculty(value);
        String byName = faculties.get(normalized);
        if (byName != null) return byName;
        var coded = java.util.regex.Pattern.compile("^([A-P])(?:\\s*[-–:]\\s*(.+))?$", java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(value);
        if (coded.matches()) {
            String code = coded.group(1).toUpperCase(Locale.ROOT);
            String label = coded.group(2);
            if (faculties.containsValue(code) && (label == null || code.equals(faculties.get(normalizeFaculty(label)))))
                return code;
        }
        throw new IllegalArgumentException("Khoa không khớp danh sách 16 khoa. Hãy dùng tên khoa trên Form hoặc mã A–P, ví dụ Luật hoặc I - Luật.");
    }

    private static String normalizeFaculty(String value) {
        String folded = Normalizer.normalize(value.trim().toLowerCase(Locale.ROOT).replace('đ', 'd'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return folded.replaceAll("[^a-z0-9]+", " ").trim().replaceAll("\\s+", " ");
    }

    private String value(CsvRow row, Map<String,Integer> columns, String key) {
        int index = columns.get(key);
        return index < row.cells().size() ? row.cells().get(index).trim() : "";
    }
    static int parseEntryYear(String input) {
        String value = input.trim();
        if (!value.matches("\\d{4}"))
            throw new IllegalArgumentException("Năm vào trường phải gồm 4 chữ số, ví dụ 2023.");
        int year = Integer.parseInt(value);
        if (year < 2000 || year > LocalDate.now().getYear())
            throw new IllegalArgumentException("Năm vào trường phải từ 2000 đến năm hiện tại.");
        return year;
    }
    private LocalDate parseDate(String input) {
        try { return LocalDate.parse(input); }
        catch (DateTimeParseException ignored) {
            try { return LocalDate.parse(input, DateTimeFormatter.ofPattern("d/M/uuuu")); }
            catch (DateTimeParseException ex) { throw new IllegalArgumentException("Ngày sinh phải là dd/MM/yyyy."); }
        }
    }
    private List<CsvRow> parse(String text) {
        List<CsvRow> rows = new ArrayList<>();
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false, closed = false;
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
            } else if (closed && !Character.isWhitespace(ch))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV không hợp lệ tại dòng " + line);
            else cell.append(ch);
        }
        if (quoted) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dấu nháy CSV chưa đóng tại dòng " + start);
        if (!cells.isEmpty() || !cell.isEmpty()) { cells.add(cell.toString()); rows.add(new CsvRow(start, List.copyOf(cells))); }
        return rows;
    }
}
