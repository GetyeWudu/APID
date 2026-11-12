package com.boa.apid.coaching.importpms.service;

import com.boa.apid.coaching.importpms.entity.PmsImportGoalStaging;
import com.boa.apid.common.exception.BusinessException;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;

/**
 * Security-hardened Apache POI XLSX parser for PMS appraisal files.
 * <p>
 * Guards: zip-bomb ratio limit, row count cap (50,000), formula rejection on
 * critical columns, leading-zero preservation, BigDecimal numeric parsing.
 */
@Component
public class PmsExcelParser {

    private static final int MAX_ROWS = 50_000;

    // Required columns in the PMS appraisal workbook (order-independent, case-insensitive)
    static final Set<String> REQUIRED_HEADERS = Set.of(
            "employeenumber", "employeefullname", "parentdepartment", "department",
            "job", "position", "gender", "performancedocumentname",
            "year", "quarter", "goalname", "evaluationstatus", "goaltrackingname",
            "target", "actual", "goalscore", "weight", "linescore",
            "overallfinalrating", "roundedoverallfinalrating", "email"
    );

    // Columns where formula cells are strictly rejected
    private static final Set<String> FORMULA_REJECTED_COLUMNS = Set.of(
            "employeenumber", "year", "quarter", "evaluationstatus",
            "overallfinalrating", "roundedoverallfinalrating"
    );

    // Headers that signal this is an org directory file, not a PMS file
    private static final Set<String> ORG_DIRECTORY_INDICATORS = Set.of(
            "manageremployeenumber", "employmentstatus"
    );

    public record ParsedGoalRow(
            int rowNumber,
            String employeeNumber,
            String employeeFullName,
            String parentDepartment,
            String department,
            String job,
            String position,
            String gender,
            String performanceDocumentName,
            String year,
            String quarter,
            String goalName,
            String evaluationStatus,
            String goalTrackingName,
            String targetValue,
            String actualValue,
            BigDecimal goalScore,
            BigDecimal weight,
            BigDecimal lineScore,
            BigDecimal overallFinalRating,
            short roundedOverallFinalRating,
            String email,
            List<String> warnings
    ) {}

    public record ParseOutput(
            int totalRows,
            List<ParsedGoalRow> rows,
            List<String> parserWarnings
    ) {}

    public ParseOutput parse(String originalFilename, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new BusinessException("EMPTY_FILE", "Uploaded file must not be empty", HttpStatus.BAD_REQUEST);
        }

        // Zip-bomb protection: set minimum inflate ratio before opening any ZIP-based workbook
        ZipSecureFile.setMinInflateRatio(0.01d);

        List<ParsedGoalRow> rows = new ArrayList<>();
        List<String> parserWarnings = new ArrayList<>();

        try (ByteArrayInputStream bis = new ByteArrayInputStream(bytes);
             Workbook workbook = new XSSFWorkbook(bis)) {

            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new BusinessException("EMPTY_WORKBOOK", "Workbook contains no sheets", HttpStatus.BAD_REQUEST);
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                throw new BusinessException("MISSING_HEADERS", "First row must contain column headers", HttpStatus.BAD_REQUEST);
            }

            // Build header index map (case-insensitive, trimmed)
            Map<String, Integer> headerIndex = new LinkedHashMap<>();
            for (Cell cell : headerRow) {
                String header = readStringCell(cell, "header", new ArrayList<>()).trim().toLowerCase(Locale.ROOT)
                        .replaceAll("\\s+", "");
                headerIndex.put(header, cell.getColumnIndex());
            }

            // Reject org directory files uploaded by mistake
            for (String indicator : ORG_DIRECTORY_INDICATORS) {
                if (headerIndex.containsKey(indicator)) {
                    throw new BusinessException("WRONG_FILE_TYPE",
                            "This appears to be an Employee Directory file, not a PMS Appraisal file. " +
                            "Please upload the correct appraisal export.", HttpStatus.BAD_REQUEST);
                }
            }

            // Validate all required headers present
            List<String> missingHeaders = REQUIRED_HEADERS.stream()
                    .filter(h -> !headerIndex.containsKey(h))
                    .sorted().toList();
            if (!missingHeaders.isEmpty()) {
                throw new BusinessException("MISSING_COLUMNS",
                        "Required columns missing: " + String.join(", ", missingHeaders), HttpStatus.BAD_REQUEST);
            }

            DataFormatter formatter = new DataFormatter();

            int dataRowCount = 0;
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowBlank(row, headerIndex.size())) continue;

                if (++dataRowCount > MAX_ROWS) {
                    throw new BusinessException("TOO_MANY_ROWS",
                            "PMS file exceeds " + MAX_ROWS + " data rows limit", HttpStatus.BAD_REQUEST);
                }

                List<String> rowWarnings = new ArrayList<>();

                // Read and validate critical columns (formula rejected)
                String employeeNumber = readCriticalStringCell(row, "employeenumber", headerIndex, formatter, i, rowWarnings);
                String year = readCriticalStringCell(row, "year", headerIndex, formatter, i, rowWarnings);
                String quarter = readCriticalStringCell(row, "quarter", headerIndex, formatter, i, rowWarnings);
                String evaluationStatus = readCriticalStringCell(row, "evaluationstatus", headerIndex, formatter, i, rowWarnings);
                BigDecimal overallFinalRating = readCriticalDecimalCell(row, "overallfinalrating", headerIndex, i);
                short roundedOverallFinalRating = readCriticalRoundedCell(row, "roundedoverallfinalrating", headerIndex, i);

                // Read non-critical columns
                String fullName = readStringCell(getCell(row, headerIndex, "employeefullname"), "employeefullname", rowWarnings);
                String parentDept = readStringCell(getCell(row, headerIndex, "parentdepartment"), "parentdepartment", rowWarnings);
                String dept = readStringCell(getCell(row, headerIndex, "department"), "department", rowWarnings);
                String job = readStringCell(getCell(row, headerIndex, "job"), "job", rowWarnings);
                String position = readStringCell(getCell(row, headerIndex, "position"), "position", rowWarnings);
                String gender = readStringCell(getCell(row, headerIndex, "gender"), "gender", rowWarnings);
                String docName = readStringCell(getCell(row, headerIndex, "performancedocumentname"), "performancedocumentname", rowWarnings);
                String goalName = readStringCell(getCell(row, headerIndex, "goalname"), "goalname", rowWarnings);
                String goalTracking = readStringCell(getCell(row, headerIndex, "goaltrackingname"), "goaltrackingname", rowWarnings);
                String target = formatter.formatCellValue(getCell(row, headerIndex, "target"));
                String actual = formatter.formatCellValue(getCell(row, headerIndex, "actual"));
                BigDecimal goalScore = readDecimalCell(getCell(row, headerIndex, "goalscore"), rowWarnings);
                BigDecimal weight = readDecimalCell(getCell(row, headerIndex, "weight"), rowWarnings);
                BigDecimal lineScore = readDecimalCell(getCell(row, headerIndex, "linescore"), rowWarnings);
                String email = readStringCell(getCell(row, headerIndex, "email"), "email", rowWarnings);

                rows.add(new ParsedGoalRow(
                        i + 1, // 1-based for display
                        employeeNumber, fullName, parentDept, dept, job, position, gender,
                        docName, year, quarter, goalName, evaluationStatus, goalTracking,
                        target, actual, goalScore, weight, lineScore,
                        overallFinalRating, roundedOverallFinalRating, email, rowWarnings
                ));
            }

            if (rows.isEmpty()) {
                throw new BusinessException("NO_DATA_ROWS", "PMS file contains no data rows", HttpStatus.BAD_REQUEST);
            }

        } catch (BusinessException e) {
            throw e;
        } catch (IOException e) {
            throw new BusinessException("PARSE_ERROR", "Failed to parse XLSX file: " + e.getMessage(), HttpStatus.BAD_REQUEST);
        }

        return new ParseOutput(rows.size(), rows, parserWarnings);
    }

    // ---- Private helpers ----

    private String readCriticalStringCell(Row row, String colKey, Map<String, Integer> headerIndex,
                                           DataFormatter formatter, int rowIdx, List<String> warnings) {
        Cell cell = getCell(row, headerIndex, colKey);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.FORMULA) {
            throw new BusinessException("FORMULA_IN_CRITICAL_COLUMN",
                    String.format("Row %d: Formula cell not allowed in column '%s'. Use plain values.", rowIdx + 1, colKey),
                    HttpStatus.BAD_REQUEST);
        }
        return formatter.formatCellValue(cell).trim();
    }

    private BigDecimal readCriticalDecimalCell(Row row, String colKey, Map<String, Integer> headerIndex, int rowIdx) {
        Cell cell = getCell(row, headerIndex, colKey);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.FORMULA) {
            throw new BusinessException("FORMULA_IN_CRITICAL_COLUMN",
                    String.format("Row %d: Formula cell not allowed in '%s'.", rowIdx + 1, colKey),
                    HttpStatus.BAD_REQUEST);
        }
        if (cell.getCellType() == CellType.NUMERIC) {
            // Use exact string representation to avoid binary double inaccuracies
            return new BigDecimal(Double.toString(cell.getNumericCellValue()));
        }
        String val = cell.getStringCellValue().trim();
        return val.isEmpty() ? null : new BigDecimal(val);
    }

    private short readCriticalRoundedCell(Row row, String colKey, Map<String, Integer> headerIndex, int rowIdx) {
        Cell cell = getCell(row, headerIndex, colKey);
        if (cell == null) {
            throw new BusinessException("MISSING_ROUNDED_RATING",
                    "Row " + (rowIdx + 1) + ": RoundedOverallFinalRating is required.", HttpStatus.BAD_REQUEST);
        }
        if (cell.getCellType() == CellType.FORMULA) {
            throw new BusinessException("FORMULA_IN_CRITICAL_COLUMN",
                    String.format("Row %d: Formula cell not allowed in 'roundedoverallfinalrating'.", rowIdx + 1),
                    HttpStatus.BAD_REQUEST);
        }
        int val;
        if (cell.getCellType() == CellType.NUMERIC) {
            val = (int) cell.getNumericCellValue();
        } else {
            val = Integer.parseInt(cell.getStringCellValue().trim());
        }
        if (val < 1 || val > 5) {
            throw new BusinessException("INVALID_ROUNDED_RATING",
                    "Row " + (rowIdx + 1) + ": RoundedOverallFinalRating must be 1–5, got: " + val, HttpStatus.BAD_REQUEST);
        }
        return (short) val;
    }

    private String readStringCell(Cell cell, String colName, List<String> warnings) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.FORMULA) {
            String cached;
            try { cached = cell.getStringCellValue(); }
            catch (Exception e) { cached = ""; }
            warnings.add("Column '" + colName + "' contains a formula cell; using cached value.");
            return cached.trim();
        }
        return new DataFormatter().formatCellValue(cell).trim();
    }

    private BigDecimal readDecimalCell(Cell cell, List<String> warnings) {
        if (cell == null) return null;
        try {
            if (cell.getCellType() == CellType.NUMERIC || cell.getCellType() == CellType.FORMULA) {
                return new BigDecimal(Double.toString(cell.getNumericCellValue()));
            }
            String val = cell.getStringCellValue().trim();
            return val.isEmpty() ? null : new BigDecimal(val);
        } catch (Exception e) {
            warnings.add("Could not parse numeric cell: " + e.getMessage());
            return null;
        }
    }

    private Cell getCell(Row row, Map<String, Integer> headerIndex, String colKey) {
        Integer idx = headerIndex.get(colKey);
        return (idx != null) ? row.getCell(idx) : null;
    }

    private boolean isRowBlank(Row row, int colCount) {
        for (int c = 0; c < colCount; c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) {
                String val = new DataFormatter().formatCellValue(cell).trim();
                if (!val.isEmpty()) return false;
            }
        }
        return true;
    }
}

