package com.boa.apid.coaching.export.service;

import com.boa.apid.coaching.report.dto.BranchAnalyticsDto;
import com.boa.apid.coaching.report.dto.DistrictAnalyticsDto;
import com.boa.apid.coaching.report.dto.DistrictBranchAnalyticsDto;
import com.boa.apid.coaching.report.dto.PmsTalentProgressItemDto;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.List;

@Service
public class ApachePoiExcelExporter {

    public byte[] exportDistrictScorecardExcel(
            DistrictBranchAnalyticsDto analytics,
            List<PmsTalentProgressItemDto> talents,
            String targetDistrictName
    ) {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Styles
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle dataStyle = createDataStyle(workbook);
            CellStyle highlightStyle = createHighlightStyle(workbook);
            CellStyle numStyle = createNumericStyle(workbook);

            // ==========================================================
            // SHEET 1: DISTRICT SUMMARY
            // ==========================================================
            Sheet sheet1 = workbook.createSheet("District Summary");
            sheet1.setDisplayGridlines(true);

            String[] distHeaders = {"District Name", "Monitored Staff", "Coachees in Remediation", "Critical Tier (<2.0)", "Moderate Tier (2.0-2.9)", "Completed Sessions", "Target Sessions", "Delivery Rate (%)", "Primary Skill Gap"};
            Row r0 = sheet1.createRow(0);
            for (int i = 0; i < distHeaders.length; i++) {
                Cell c = r0.createCell(i);
                c.setCellValue(distHeaders[i]);
                c.setCellStyle(headerStyle);
            }

            int rowIdx1 = 1;
            for (DistrictAnalyticsDto d : analytics.districts()) {
                if (targetDistrictName != null && !targetDistrictName.isBlank() && !d.districtName().equalsIgnoreCase(targetDistrictName)) {
                    continue;
                }
                Row row = sheet1.createRow(rowIdx1++);
                row.createCell(0).setCellValue(d.districtName());
                row.createCell(1).setCellValue(d.totalStaff());
                row.createCell(2).setCellValue(d.coacheesCount());
                row.createCell(3).setCellValue(d.criticalCount());
                row.createCell(4).setCellValue(d.moderateCount());
                row.createCell(5).setCellValue(d.completedSessions());
                row.createCell(6).setCellValue(d.targetSessions());
                row.createCell(7).setCellValue(d.completionRate());
                row.createCell(8).setCellValue(d.primarySkillGap());

                for (int c = 0; c < 9; c++) {
                    if (c >= 1 && c <= 7) {
                        row.getCell(c).setCellStyle(c == 7 ? numStyle : dataStyle);
                    } else {
                        row.getCell(c).setCellStyle(dataStyle);
                    }
                }
            }

            for (int i = 0; i < distHeaders.length; i++) {
                sheet1.autoSizeColumn(i);
            }

            // ==========================================================
            // SHEET 2: BRANCH PERFORMANCE MATRIX
            // ==========================================================
            Sheet sheet2 = workbook.createSheet("Branch Matrix");
            sheet2.setDisplayGridlines(true);

            String[] branchHeaders = {"District", "Branch Name", "Enrolled Coachees", "Critical Coachees", "Completed Sessions", "Target Sessions", "Delivery Rate (%)", "Dominant Deficit"};
            Row rBranch0 = sheet2.createRow(0);
            for (int i = 0; i < branchHeaders.length; i++) {
                Cell c = rBranch0.createCell(i);
                c.setCellValue(branchHeaders[i]);
                c.setCellStyle(headerStyle);
            }

            int rowIdx2 = 1;
            for (DistrictAnalyticsDto d : analytics.districts()) {
                if (targetDistrictName != null && !targetDistrictName.isBlank() && !d.districtName().equalsIgnoreCase(targetDistrictName)) {
                    continue;
                }
                for (BranchAnalyticsDto b : d.branches()) {
                    Row row = sheet2.createRow(rowIdx2++);
                    row.createCell(0).setCellValue(d.districtName());
                    row.createCell(1).setCellValue(b.branchName());
                    row.createCell(2).setCellValue(b.coacheesCount());
                    row.createCell(3).setCellValue(b.criticalCount());
                    row.createCell(4).setCellValue(b.completedSessions());
                    row.createCell(5).setCellValue(b.targetSessions());
                    row.createCell(6).setCellValue(b.completionRate());
                    row.createCell(7).setCellValue(b.primarySkillGap());

                    for (int c = 0; c < 8; c++) {
                        row.getCell(c).setCellStyle(c == 3 && b.criticalCount() > 0 ? highlightStyle : dataStyle);
                    }
                }
            }

            for (int i = 0; i < branchHeaders.length; i++) {
                sheet2.autoSizeColumn(i);
            }

            // ==========================================================
            // SHEET 3: REMEDIATION ROSTER
            // ==========================================================
            Sheet sheet3 = workbook.createSheet("Remediation Staff Roster");
            sheet3.setDisplayGridlines(true);

            String[] rosterHeaders = {"Staff ID", "Employee Name", "District", "Branch", "Baseline Rating", "Risk Tier", "Assigned Coach", "Sessions Completed", "Target Sessions", "Trajectory", "Primary Skill Gap"};
            Row rRoster0 = sheet3.createRow(0);
            for (int i = 0; i < rosterHeaders.length; i++) {
                Cell c = rRoster0.createCell(i);
                c.setCellValue(rosterHeaders[i]);
                c.setCellStyle(headerStyle);
            }

            int rowIdx3 = 1;
            for (PmsTalentProgressItemDto t : talents) {
                if (targetDistrictName != null && !targetDistrictName.isBlank() && t.directorate() != null && !t.directorate().equalsIgnoreCase(targetDistrictName)) {
                    continue;
                }
                Row row = sheet3.createRow(rowIdx3++);
                row.createCell(0).setCellValue(t.coacheeStaffId());
                row.createCell(1).setCellValue(t.coacheeName());
                row.createCell(2).setCellValue(t.directorate() != null ? t.directorate() : "—");
                row.createCell(3).setCellValue(t.department() != null ? t.department() : "—");
                row.createCell(4).setCellValue(t.startingRating() != null ? t.startingRating().doubleValue() : 0.0);
                row.createCell(5).setCellValue(t.ratingBand() != null ? t.ratingBand() : "—");
                row.createCell(6).setCellValue(t.coachName() != null ? t.coachName() : "Unassigned");
                row.createCell(7).setCellValue(t.completedSessions());
                row.createCell(8).setCellValue(t.approvedTarget());
                row.createCell(9).setCellValue(t.progressTrajectory() != null ? t.progressTrajectory() : "NOT_STARTED");
                row.createCell(10).setCellValue(t.targetWeaknessKpi() != null ? t.targetWeaknessKpi() : "—");

                for (int c = 0; c < 11; c++) {
                    if (c == 5 && "CRITICAL".equalsIgnoreCase(t.ratingBand())) {
                        row.getCell(c).setCellStyle(highlightStyle);
                    } else if (c == 4) {
                        row.getCell(c).setCellStyle(numStyle);
                    } else {
                        row.getCell(c).setCellStyle(dataStyle);
                    }
                }
            }

            for (int i = 0; i < rosterHeaders.length; i++) {
                sheet3.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new RuntimeException("Failed to export Excel Scorecard: " + ex.getMessage(), ex);
        }
    }

    private CellStyle createHeaderStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        setBorders(style);
        return style;
    }

    private CellStyle createDataStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setFontHeightInPoints((short) 9);
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        setBorders(style);
        return style;
    }

    private CellStyle createNumericStyle(Workbook wb) {
        CellStyle style = createDataStyle(wb);
        DataFormat format = wb.createDataFormat();
        style.setDataFormat(format.getFormat("#,##0.00"));
        style.setAlignment(HorizontalAlignment.RIGHT);
        return style;
    }

    private CellStyle createHighlightStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.DARK_RED.getIndex());
        font.setFontHeightInPoints((short) 9);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.ROSE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        setBorders(style);
        return style;
    }

    private void setBorders(CellStyle style) {
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
    }
}
