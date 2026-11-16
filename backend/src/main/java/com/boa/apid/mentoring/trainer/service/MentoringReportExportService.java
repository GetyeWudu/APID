package com.boa.apid.mentoring.trainer.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.trainer.dto.MentoringHrOverviewDto;
import com.boa.apid.mentoring.trainer.dto.MentoringSkillDemandDto;
import com.boa.apid.mentoring.trainer.dto.TrainerRosterDto;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class MentoringReportExportService {

    private static final String XLSX_CONTENT_TYPE =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final TrainerAuthorizationService authorizationService;
    private final AuditService auditService;

    public MentoringReportExportService(
            TrainerAuthorizationService authorizationService,
            AuditService auditService
    ) {
        this.authorizationService = authorizationService;
        this.auditService = auditService;
    }

    public ExportedReport export(String format, ApidUserPrincipal actor) {
        String normalizedFormat = format == null ? "" : format.trim().toLowerCase();
        MentoringHrOverviewDto overview = authorizationService.getOverview();
        List<TrainerRosterDto> trainers = authorizationService.listRoster();
        ExportedReport report = switch (normalizedFormat) {
            case "xlsx" -> exportExcel(overview, trainers);
            case "pdf" -> exportPdf(overview, trainers);
            default -> throw new BusinessException(
                    "INVALID_MENTORING_REPORT_FORMAT",
                    "Choose xlsx or pdf as the report format.",
                    HttpStatus.BAD_REQUEST
            );
        };
        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                actor.getUserId(),
                "MENTORING",
                "MENTORING_REPORT_EXPORTED",
                "SUCCESS",
                null,
                "MENTORING_REPORT",
                normalizedFormat,
                Map.of("format", normalizedFormat),
                null,
                null
        ));
        return report;
    }

    private ExportedReport exportExcel(MentoringHrOverviewDto overview, List<TrainerRosterDto> trainers) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet summary = workbook.createSheet("Overview");
            String[][] metrics = {
                    {"Metric", "Value"},
                    {"Pending applications", Long.toString(overview.pendingApplications())},
                    {"Approved applications", Long.toString(overview.approvedApplications())},
                    {"Declined applications", Long.toString(overview.declinedApplications())},
                    {"Active trainers", Long.toString(overview.activeTrainers())},
                    {"Suspended trainers", Long.toString(overview.suspendedTrainers())},
                    {"Revoked trainers", Long.toString(overview.revokedTrainers())},
                    {"Active relationships", Long.toString(overview.activeRelationships())},
                    {"Completed relationships", Long.toString(overview.completedRelationships())},
                    {"Total sessions", Long.toString(overview.totalSessions())},
                    {"Completed sessions", Long.toString(overview.completedSessions())},
                    {"Average trainee rating", Double.toString(overview.averageFeedbackRating())},
                    {"Completion rate (%)", Double.toString(overview.completionRatePct())},
                    {"Generated at (UTC)", Instant.now().toString()}
            };
            for (int i = 0; i < metrics.length; i++) {
                Row row = summary.createRow(i);
                row.createCell(0).setCellValue(metrics[i][0]);
                row.createCell(1).setCellValue(metrics[i][1]);
            }
            summary.autoSizeColumn(0);
            summary.autoSizeColumn(1);

            Sheet trainerSheet = workbook.createSheet("Trainers");
            String[] trainerHeaders = {
                    "Employee", "Employee number", "Department", "Authorization status",
                    "Source", "Active trainees", "Pending requests", "Capacity", "Skills"
            };
            addHeader(trainerSheet, trainerHeaders);
            for (int i = 0; i < trainers.size(); i++) {
                TrainerRosterDto trainer = trainers.get(i);
                Row row = trainerSheet.createRow(i + 1);
                row.createCell(0).setCellValue(trainer.fullName());
                row.createCell(1).setCellValue(trainer.employeeNumber());
                row.createCell(2).setCellValue(valueOrEmpty(trainer.departmentName()));
                row.createCell(3).setCellValue(trainer.status().name());
                row.createCell(4).setCellValue(trainer.sourceType().name());
                row.createCell(5).setCellValue(trainer.activeTrainees());
                row.createCell(6).setCellValue(trainer.pendingTrainees());
                row.createCell(7).setCellValue(trainer.maxConcurrentTrainees());
                row.createCell(8).setCellValue(trainer.skills().stream()
                        .map(skill -> skill.name()).reduce((left, right) -> left + ", " + right).orElse(""));
            }
            autoSize(trainerSheet, trainerHeaders.length);

            Sheet skillsSheet = workbook.createSheet("Skill supply and demand");
            String[] skillHeaders = {"Skill", "Active trainers", "Open requests", "Available trainer slots"};
            addHeader(skillsSheet, skillHeaders);
            for (int i = 0; i < overview.skillSupplyDemand().size(); i++) {
                MentoringSkillDemandDto skill = overview.skillSupplyDemand().get(i);
                Row row = skillsSheet.createRow(i + 1);
                row.createCell(0).setCellValue(skill.skillName());
                row.createCell(1).setCellValue(skill.activeTrainers());
                row.createCell(2).setCellValue(skill.openRequests());
                row.createCell(3).setCellValue(skill.availableTrainerSlots());
            }
            autoSize(skillsSheet, skillHeaders.length);

            workbook.write(output);
            return new ExportedReport(output.toByteArray(), XLSX_CONTENT_TYPE, "mentoring-report.xlsx");
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to generate the mentoring Excel report.", exception);
        }
    }

    private ExportedReport exportPdf(MentoringHrOverviewDto overview, List<TrainerRosterDto> trainers) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Document document = new Document();
            PdfWriter.getInstance(document, output);
            document.open();
            Font heading = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
            document.add(new Paragraph("Mentoring HR Report", heading));
            document.add(new Paragraph("Generated: " + Instant.now()));
            document.add(new Paragraph(" "));
            document.add(new Paragraph("Overview", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12)));
            PdfPTable metrics = new PdfPTable(new float[] { 2, 1 });
            addPdfRow(metrics, "Pending applications", overview.pendingApplications());
            addPdfRow(metrics, "Approved applications", overview.approvedApplications());
            addPdfRow(metrics, "Declined applications", overview.declinedApplications());
            addPdfRow(metrics, "Active trainers", overview.activeTrainers());
            addPdfRow(metrics, "Suspended trainers", overview.suspendedTrainers());
            addPdfRow(metrics, "Revoked trainers", overview.revokedTrainers());
            addPdfRow(metrics, "Active relationships", overview.activeRelationships());
            addPdfRow(metrics, "Completed relationships", overview.completedRelationships());
            addPdfRow(metrics, "Total sessions", overview.totalSessions());
            addPdfRow(metrics, "Completed sessions", overview.completedSessions());
            addPdfRow(metrics, "Average trainee rating", overview.averageFeedbackRating());
            addPdfRow(metrics, "Completion rate (%)", overview.completionRatePct());
            document.add(metrics);

            document.add(new Paragraph(" "));
            document.add(new Paragraph("Skill supply and demand", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12)));
            PdfPTable skills = new PdfPTable(new float[] { 3, 1, 1, 1 });
            for (String header : List.of("Skill", "Active trainers", "Open requests", "Available slots")) {
                skills.addCell(new Phrase(header, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9)));
            }
            for (MentoringSkillDemandDto skill : overview.skillSupplyDemand()) {
                skills.addCell(skill.skillName());
                skills.addCell(Long.toString(skill.activeTrainers()));
                skills.addCell(Long.toString(skill.openRequests()));
                skills.addCell(Long.toString(skill.availableTrainerSlots()));
            }
            document.add(skills);

            document.add(new Paragraph(" "));
            document.add(new Paragraph("Trainer roster", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12)));
            PdfPTable roster = new PdfPTable(new float[] { 2, 1, 1, 1, 1, 1 });
            for (String header : List.of("Employee", "Department", "Status", "Active", "Pending", "Capacity")) {
                roster.addCell(new Phrase(header, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9)));
            }
            for (TrainerRosterDto trainer : trainers) {
                roster.addCell(trainer.fullName());
                roster.addCell(valueOrEmpty(trainer.departmentName()));
                roster.addCell(trainer.status().name());
                roster.addCell(Integer.toString(trainer.activeTrainees()));
                roster.addCell(Integer.toString(trainer.pendingTrainees()));
                roster.addCell(Integer.toString(trainer.maxConcurrentTrainees()));
            }
            document.add(roster);
            document.close();
            return new ExportedReport(output.toByteArray(), "application/pdf", "mentoring-report.pdf");
        } catch (DocumentException | IOException exception) {
            throw new IllegalStateException("Unable to generate the mentoring PDF report.", exception);
        }
    }

    private void addHeader(Sheet sheet, String[] headers) {
        Row header = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            header.createCell(i).setCellValue(headers[i]);
        }
    }

    private void autoSize(Sheet sheet, int columns) {
        for (int i = 0; i < columns; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void addPdfRow(PdfPTable table, String label, Object value) {
        table.addCell(label);
        table.addCell(String.valueOf(value));
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }

    public record ExportedReport(byte[] content, String contentType, String fileName) {
    }
}
