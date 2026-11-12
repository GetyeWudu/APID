package com.boa.apid.core.organization.service;

import com.boa.apid.common.exception.BusinessException;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.*;
import org.springframework.http.HttpStatus;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

/**
 * Unified, security-hardened parser for CSV and Excel (.xlsx) Employees & Hierarchy Directory files.
 * PMS appraisal exports are explicitly rejected here because directory master data must be managed
 * independently from Phase 4 PMS score uploads.
 */
final class HierarchyTabularParser {

    static final long MAX_IMPORT_BYTES = 10L * 1024 * 1024;
    static final int MAX_IMPORT_ROWS = 50_000;

    private static final String CANONICAL_EMP_NO = "employeeNumber";
    private static final String CANONICAL_FULL_NAME = "fullName";
    private static final String CANONICAL_EMAIL = "email";
    private static final String CANONICAL_GENDER = "gender";
    private static final String CANONICAL_PARENT_DEPT = "parentDepartment";
    private static final String CANONICAL_DEPT = "department";
    private static final String CANONICAL_DEPT_CODE = "departmentCode";
    private static final String CANONICAL_JOB = "job";
    private static final String CANONICAL_POSITION = "position";
    private static final String CANONICAL_MANAGER_NO = "managerEmployeeNumber";
    private static final String CANONICAL_STATUS = "employmentStatus";

    private static final Map<String, String> HEADER_ALIASES = buildHeaderAliases();
    private static final Set<String> PMS_INDICATOR_HEADERS = Set.of(
            "performancedocumentname", "goalname", "goaltrackingname",
            "evaluationstatus", "overallfinalrating", "roundedoverallfinalrating",
            "goalscore", "linescore", "year", "quarter"
    );

    private HierarchyTabularParser() {
    }

    record CellValue(
            String trimmed,
            boolean formulaCell,
            boolean formulaPrefix,
            boolean generalNumericIdentifierRisk,
            boolean scientificOrDecimalIdentifierRisk
    ) {
        static final CellValue EMPTY = new CellValue(null, false, false, false, false);

        boolean isBlank() {
            return (trimmed == null || trimmed.isEmpty()) && !formulaCell;
        }
    }

    record ParsedRow(
            int rowNumber,
            CellValue employeeNumber,
            CellValue fullName,
            CellValue email,
            CellValue gender,
            CellValue parentDepartment,
            CellValue department,
            CellValue departmentCode,
            CellValue job,
            CellValue position,
            CellValue managerEmployeeNumber,
            CellValue employmentStatus
    ) {}

    record ParseOutput(
            String sanitizedFilename,
            String fileFormat,
            String fileHashSha256,
            String detectedSchema,
            Map<String, Boolean> columnPresence,
            List<String> parserWarnings,
            List<ParsedRow> rows
    ) {}

    static ParseOutput parse(String originalFilename, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new BusinessException("EMPTY_IMPORT_FILE", "Uploaded import file must not be empty", HttpStatus.BAD_REQUEST);
        }
        if (bytes.length > MAX_IMPORT_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE", "Import file exceeds 10 MB limit", HttpStatus.BAD_REQUEST);
        }

        String sanitizedName = sanitizeFilename(originalFilename);
        String ext = extractExtension(sanitizedName);
        if (!"csv".equals(ext) && !"xlsx".equals(ext)) {
            throw new BusinessException(
                    "INVALID_FILE_TYPE",
                    "Only .csv and .xlsx files are supported for organization hierarchy import",
                    HttpStatus.BAD_REQUEST
            );
        }

        String fileHash = sha256Hex(bytes);
        List<String> parserWarnings = new ArrayList<>();
        List<List<CellValue>> matrix = "xlsx".equals(ext)
                ? readXlsx(bytes, parserWarnings)
                : readCsv(bytes);

        if (matrix.isEmpty()) {
            throw new BusinessException("EMPTY_IMPORT_FILE", "Import file contains no header row", HttpStatus.BAD_REQUEST);
        }

        List<CellValue> headerRow = matrix.get(0);
        HeaderMapping mapping = mapHeaders(headerRow);
        if (mapping.pmsHeaderDetected) {
            throw new BusinessException(
                    "PMS_FILE_NOT_ALLOWED_IN_ORG_IMPORT",
                    "PMS appraisal report files cannot be uploaded to Organization Import. Upload the standard Employees & Hierarchy Directory file first, and upload PMS Appraisal Reports in the PMS Coaching module (Phase 4).",
                    HttpStatus.BAD_REQUEST
            );
        }
        if (!mapping.hasField(CANONICAL_EMP_NO) || !mapping.hasField(CANONICAL_FULL_NAME)) {
            throw new BusinessException(
                    "INVALID_IMPORT_HEADER",
                    "Header row must include EmployeeNumber and FullName (or EmployeeFullName) columns",
                    HttpStatus.BAD_REQUEST
            );
        }

        List<ParsedRow> rows = new ArrayList<>();
        for (int r = 1; r < matrix.size(); r++) {
            List<CellValue> rawRow = matrix.get(r);
            if (isBlankRow(rawRow)) {
                continue;
            }
            if (rows.size() >= MAX_IMPORT_ROWS) {
                throw new BusinessException(
                        "IMPORT_ROW_LIMIT_EXCEEDED",
                        "Import exceeds maximum allowed rows (" + MAX_IMPORT_ROWS + ")",
                        HttpStatus.BAD_REQUEST
                );
            }
            rows.add(new ParsedRow(
                    r + 1,
                    cellAt(rawRow, mapping.indexOf(CANONICAL_EMP_NO)),
                    cellAt(rawRow, mapping.indexOf(CANONICAL_FULL_NAME)),
                    cellAt(rawRow, mapping.indexOf(CANONICAL_EMAIL)),
                    cellAt(rawRow, mapping.indexOf(CANONICAL_GENDER)),
                    cellAt(rawRow, mapping.indexOf(CANONICAL_PARENT_DEPT)),
                    cellAt(rawRow, mapping.indexOf(CANONICAL_DEPT)),
                    cellAt(rawRow, mapping.indexOf(CANONICAL_DEPT_CODE)),
                    cellAt(rawRow, mapping.indexOf(CANONICAL_JOB)),
                    cellAt(rawRow, mapping.indexOf(CANONICAL_POSITION)),
                    cellAt(rawRow, mapping.indexOf(CANONICAL_MANAGER_NO)),
                    cellAt(rawRow, mapping.indexOf(CANONICAL_STATUS))
            ));
        }

        if (rows.isEmpty()) {
            throw new BusinessException("EMPTY_IMPORT_FILE", "Import file contains no employee data rows", HttpStatus.BAD_REQUEST);
        }

        String detectedSchema = "HIERARCHY_STANDARD";
        return new ParseOutput(
                sanitizedName,
                ext.toUpperCase(Locale.ROOT),
                fileHash,
                detectedSchema,
                mapping.presenceMap(),
                parserWarnings,
                rows
        );
    }

    private static List<List<CellValue>> readCsv(byte[] bytes) {
        for (byte b : bytes) {
            if (b == 0) {
                throw new BusinessException("FILE_SIGNATURE_MISMATCH", "CSV file contains invalid binary NUL bytes", HttpStatus.BAD_REQUEST);
            }
        }

        String text;
        try {
            text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (CharacterCodingException ex) {
            throw new BusinessException("INVALID_CSV_ENCODING", "CSV file must be valid UTF-8 encoded text", HttpStatus.BAD_REQUEST);
        }

        if (!text.isEmpty() && text.charAt(0) == '\uFEFF') {
            text = text.substring(1);
        }

        List<List<String>> records = parseCsvRecords(text);
        List<List<CellValue>> matrix = new ArrayList<>(records.size());
        for (List<String> rec : records) {
            List<CellValue> row = new ArrayList<>(rec.size());
            for (String raw : rec) {
                row.add(toTextCellValue(raw));
            }
            matrix.add(row);
        }
        return matrix;
    }

    private static List<List<CellValue>> readXlsx(byte[] bytes, List<String> warnings) {
        if (bytes.length < 4 || bytes[0] != 0x50 || bytes[1] != 0x4B || bytes[2] != 0x03 || bytes[3] != 0x04) {
            throw new BusinessException("FILE_SIGNATURE_MISMATCH", "File contents do not match '.xlsx' workbook format", HttpStatus.BAD_REQUEST);
        }

        ZipSecureFile.setMinInflateRatio(0.01d);
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            int sheetCount = workbook.getNumberOfSheets();
            if (sheetCount == 0) {
                throw new BusinessException("EMPTY_IMPORT_FILE", "Workbook contains no worksheets", HttpStatus.BAD_REQUEST);
            }
            Sheet sheet = workbook.getSheetAt(0);
            if (sheetCount > 1) {
                warnings.add("Workbook contains " + sheetCount + " sheets; only Sheet 1 ('" + sheet.getSheetName() + "') was read.");
            }

            DataFormatter formatter = new DataFormatter(Locale.ROOT);
            int lastRow = sheet.getLastRowNum();
            if (lastRow > MAX_IMPORT_ROWS + 500) {
                throw new BusinessException(
                        "IMPORT_ROW_LIMIT_EXCEEDED",
                        "Workbook row count exceeds maximum supported rows (" + MAX_IMPORT_ROWS + ")",
                        HttpStatus.BAD_REQUEST
                );
            }

            List<List<CellValue>> matrix = new ArrayList<>();
            int maxCols = 0;
            Row headerRow = sheet.getRow(0);
            if (headerRow != null && headerRow.getLastCellNum() > 0) {
                maxCols = headerRow.getLastCellNum();
            }

            for (int r = 0; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null) {
                    if (!matrix.isEmpty()) {
                        matrix.add(List.of());
                    }
                    continue;
                }
                int rowCols = Math.max(maxCols, Math.max(0, (int) row.getLastCellNum()));
                if (r == 0) {
                    maxCols = rowCols;
                }
                List<CellValue> cells = new ArrayList<>(rowCols);
                for (int c = 0; c < rowCols; c++) {
                    cells.add(readPoiCell(row.getCell(c), formatter));
                }
                matrix.add(cells);
            }
            return matrix;
        } catch (BusinessException ex) {
            throw ex;
        } catch (IOException | RuntimeException ex) {
            throw new BusinessException("INVALID_WORKBOOK", "Unable to read Excel workbook: " + ex.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    private static CellValue readPoiCell(Cell cell, DataFormatter formatter) {
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            return CellValue.EMPTY;
        }
        CellType type = cell.getCellType();
        if (type == CellType.FORMULA) {
            String formula = cell.getCellFormula();
            return new CellValue("=" + (formula == null ? "" : formula), true, true, false, false);
        }
        if (type == CellType.NUMERIC) {
            String displayed = formatter.formatCellValue(cell);
            String trimmed = normalizeOptionalText(displayed);
            boolean formulaPrefix = hasFormulaPrefix(displayed, trimmed);

            double numericVal = cell.getNumericCellValue();
            String fmt = cell.getCellStyle() != null ? cell.getCellStyle().getDataFormatString() : null;
            boolean isWhole = Double.isFinite(numericVal) && BigDecimal.valueOf(numericVal).stripTrailingZeros().scale() <= 0;
            boolean scientific = (displayed != null && (displayed.contains("E+") || displayed.contains("e+") || displayed.contains("E-") || displayed.contains("e-")))
                    || !isWhole;
            boolean generalNumeric = isWhole && !scientific && isUnpaddedNumericFormat(fmt);

            return new CellValue(trimmed, false, formulaPrefix, generalNumeric, scientific);
        }
        String raw = formatter.formatCellValue(cell);
        return toTextCellValue(raw);
    }

    private static boolean isUnpaddedNumericFormat(String fmt) {
        if (fmt == null || fmt.isBlank()) {
            return true;
        }
        String lower = fmt.trim().toLowerCase(Locale.ROOT);
        if ("general".equals(lower) || "0".equals(lower) || "#,##0".equals(lower)) {
            return true;
        }
        return !lower.contains("00") && !lower.startsWith("@");
    }

    private static CellValue toTextCellValue(String raw) {
        String trimmed = normalizeOptionalText(raw);
        if (trimmed == null) {
            return CellValue.EMPTY;
        }
        return new CellValue(trimmed, false, hasFormulaPrefix(raw, trimmed), false, false);
    }

    private static boolean hasFormulaPrefix(String raw, String trimmed) {
        if (raw != null && (!raw.isEmpty() && (raw.charAt(0) == '\t' || raw.charAt(0) == '\r'))) {
            return true;
        }
        if (trimmed == null || trimmed.isEmpty()) {
            return false;
        }
        char first = trimmed.charAt(0);
        return first == '=' || first == '@' || first == '+' || first == '-';
    }

    private static HeaderMapping mapHeaders(List<CellValue> headerRow) {
        Map<String, Integer> fieldIndices = new LinkedHashMap<>();
        Set<String> seenRawNormalized = new HashSet<>();
        boolean pmsDetected = false;

        for (int i = 0; i < headerRow.size(); i++) {
            CellValue cell = headerRow.get(i);
            if (cell.formulaCell() || cell.formulaPrefix()) {
                throw new BusinessException("INVALID_IMPORT_HEADER", "Formula cells are not allowed in header row", HttpStatus.BAD_REQUEST);
            }
            String norm = normalizeHeader(cell.trimmed());
            if (norm.isEmpty()) {
                continue;
            }
            if (!seenRawNormalized.add(norm)) {
                throw new BusinessException("DUPLICATE_IMPORT_HEADER", "Duplicate header column detected: " + cell.trimmed(), HttpStatus.BAD_REQUEST);
            }
            if (PMS_INDICATOR_HEADERS.contains(norm)) {
                pmsDetected = true;
            }
            String canonical = HEADER_ALIASES.get(norm);
            if (canonical != null) {
                Integer previous = fieldIndices.putIfAbsent(canonical, i);
                if (previous != null) {
                    throw new BusinessException(
                            "DUPLICATE_IMPORT_HEADER",
                            "Multiple header columns map to '" + canonical + "' (column " + (previous + 1) + " and " + (i + 1) + ")",
                            HttpStatus.BAD_REQUEST
                    );
                }
            }
        }
        return new HeaderMapping(fieldIndices, pmsDetected);
    }

    private static Map<String, String> buildHeaderAliases() {
        Map<String, String> m = new HashMap<>();
        m.put("employeenumber", CANONICAL_EMP_NO);
        m.put("empno", CANONICAL_EMP_NO);
        m.put("empnumber", CANONICAL_EMP_NO);

        m.put("fullname", CANONICAL_FULL_NAME);
        m.put("employeefullname", CANONICAL_FULL_NAME);
        m.put("name", CANONICAL_FULL_NAME);
        m.put("employeename", CANONICAL_FULL_NAME);

        m.put("email", CANONICAL_EMAIL);
        m.put("emailaddress", CANONICAL_EMAIL);
        m.put("workemail", CANONICAL_EMAIL);

        m.put("gender", CANONICAL_GENDER);
        m.put("sex", CANONICAL_GENDER);

        m.put("parentdepartment", CANONICAL_PARENT_DEPT);
        m.put("parentdepartmentname", CANONICAL_PARENT_DEPT);
        m.put("parentdirectorate", CANONICAL_PARENT_DEPT);

        m.put("department", CANONICAL_DEPT);
        m.put("departmentname", CANONICAL_DEPT);

        m.put("departmentcode", CANONICAL_DEPT_CODE);
        m.put("deptcode", CANONICAL_DEPT_CODE);

        m.put("job", CANONICAL_JOB);
        m.put("jobtitle", CANONICAL_JOB);

        m.put("position", CANONICAL_POSITION);
        m.put("positiontitle", CANONICAL_POSITION);
        m.put("title", CANONICAL_POSITION);

        m.put("manageremployeenumber", CANONICAL_MANAGER_NO);
        m.put("managernumber", CANONICAL_MANAGER_NO);
        m.put("managerempno", CANONICAL_MANAGER_NO);

        m.put("employmentstatus", CANONICAL_STATUS);
        m.put("status", CANONICAL_STATUS);
        return Collections.unmodifiableMap(m);
    }

    private record HeaderMapping(Map<String, Integer> indices, boolean pmsHeaderDetected) {
        boolean hasField(String field) {
            return indices.containsKey(field);
        }

        Integer indexOf(String field) {
            return indices.get(field);
        }

        Map<String, Boolean> presenceMap() {
            Map<String, Boolean> map = new LinkedHashMap<>();
            map.put(CANONICAL_EMAIL, hasField(CANONICAL_EMAIL));
            map.put(CANONICAL_GENDER, hasField(CANONICAL_GENDER));
            map.put(CANONICAL_PARENT_DEPT, hasField(CANONICAL_PARENT_DEPT));
            map.put(CANONICAL_DEPT, hasField(CANONICAL_DEPT));
            map.put(CANONICAL_DEPT_CODE, hasField(CANONICAL_DEPT_CODE));
            map.put(CANONICAL_JOB, hasField(CANONICAL_JOB));
            map.put(CANONICAL_POSITION, hasField(CANONICAL_POSITION));
            map.put(CANONICAL_MANAGER_NO, hasField(CANONICAL_MANAGER_NO));
            map.put(CANONICAL_STATUS, hasField(CANONICAL_STATUS));
            return map;
        }
    }

    private static List<List<String>> parseCsvRecords(String text) {
        List<List<String>> records = new ArrayList<>();
        List<String> currentRow = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean inQuotes = false;

        int len = text.length();
        for (int i = 0; i < len; i++) {
            char c = text.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < len && text.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field.append(c);
                }
            } else {
                if (c == '"') {
                    if (field.isEmpty()) {
                        inQuotes = true;
                    } else {
                        field.append(c);
                    }
                } else if (c == ',') {
                    currentRow.add(field.toString());
                    field.setLength(0);
                } else if (c == '\r') {
                    if (i + 1 < len && text.charAt(i + 1) == '\n') {
                        i++;
                    }
                    currentRow.add(field.toString());
                    field.setLength(0);
                    records.add(currentRow);
                    currentRow = new ArrayList<>();
                } else if (c == '\n') {
                    currentRow.add(field.toString());
                    field.setLength(0);
                    records.add(currentRow);
                    currentRow = new ArrayList<>();
                } else {
                    field.append(c);
                }
            }
        }

        if (inQuotes) {
            throw new BusinessException("MALFORMED_CSV", "CSV contains an unclosed quoted field", HttpStatus.BAD_REQUEST);
        }

        if (!field.isEmpty() || !currentRow.isEmpty()) {
            currentRow.add(field.toString());
            records.add(currentRow);
        }
        return records;
    }

    private static boolean isBlankRow(List<CellValue> cells) {
        for (CellValue cell : cells) {
            if (!cell.isBlank()) {
                return false;
            }
        }
        return true;
    }

    private static CellValue cellAt(List<CellValue> cells, Integer index) {
        if (index == null || index < 0 || index >= cells.size()) {
            return CellValue.EMPTY;
        }
        return cells.get(index);
    }

    private static String normalizeHeader(String raw) {
        return raw == null ? "" : raw.trim().replaceAll("[_\\s-]+", "").toLowerCase(Locale.ROOT);
    }

    private static String normalizeOptionalText(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String sanitizeFilename(String raw) {
        if (raw == null || raw.isBlank()) {
            return "import.csv";
        }
        String base = java.nio.file.Paths.get(raw).getFileName().toString().trim();
        return base.replaceAll("[\\r\\n\\\\/:\"*?<>|]", "_");
    }

    private static String extractExtension(String filename) {
        int idx = filename.lastIndexOf('.');
        if (idx < 0 || idx == filename.length() - 1) {
            return "";
        }
        return filename.substring(idx + 1).toLowerCase(Locale.ROOT);
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}

