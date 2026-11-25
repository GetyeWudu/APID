package com.boa.apid.coaching.export.service;

import com.boa.apid.coaching.report.dto.PmsTalentDossierDto;
import com.boa.apid.coaching.report.dto.SessionProgressLogDto;
import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;

@Service
public class OpenPdfDossierExporter {

    private static final Color BOA_NAVY = new Color(15, 23, 42); // #0f172a
    private static final Color BOA_GOLD = new Color(217, 119, 6); // #d97706
    private static final Color BOA_LIGHT_BG = new Color(248, 250, 252); // #f8fafc
    private static final Color BOA_BORDER = new Color(226, 232, 240); // #e2e8f0
    private static final Color TEXT_DARK = new Color(30, 41, 59); // #1e293b
    private static final Color TEXT_MUTED = new Color(100, 116, 139); // #64748b

    public byte[] exportDossierPdf(PmsTalentDossierDto dossier) {
        Document document = new Document(PageSize.A4, 36, 36, 40, 40);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // Font Styles
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, BOA_NAVY);
            Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 10, BOA_GOLD);
            Font secHeaderFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, BOA_NAVY);
            Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, TEXT_DARK);
            Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 9, TEXT_DARK);
            Font mutedFont = FontFactory.getFont(FontFactory.HELVETICA, 8, TEXT_MUTED);

            // 1. Header Banner
            Paragraph title = new Paragraph("BANK OF ABYSSINIA", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);

            Paragraph subtitle = new Paragraph("PERFORMANCE MANAGEMENT SYSTEM (PMS) — INDIVIDUAL REMEDIATION DOSSIER", subTitleFont);
            subtitle.setAlignment(Element.ALIGN_CENTER);
            subtitle.setSpacingAfter(15);
            document.add(subtitle);

            // 2. Staff & Coach Profile Table
            PdfPTable profileTable = new PdfPTable(4);
            profileTable.setWidthPercentage(100);
            profileTable.setWidths(new float[]{22, 28, 22, 28});
            profileTable.setSpacingAfter(12);

            addCell(profileTable, "Staff Member:", boldFont, BOA_LIGHT_BG);
            addCell(profileTable, dossier.coacheeName(), normalFont, Color.WHITE);
            addCell(profileTable, "Staff ID:", boldFont, BOA_LIGHT_BG);
            addCell(profileTable, dossier.coacheeStaffId(), normalFont, Color.WHITE);

            addCell(profileTable, "Operating District:", boldFont, BOA_LIGHT_BG);
            addCell(profileTable, dossier.directorate(), normalFont, Color.WHITE);
            addCell(profileTable, "Assigned Branch:", boldFont, BOA_LIGHT_BG);
            addCell(profileTable, dossier.department(), normalFont, Color.WHITE);

            addCell(profileTable, "Position / Job:", boldFont, BOA_LIGHT_BG);
            addCell(profileTable, dossier.jobTitle() != null ? dossier.jobTitle() : "Staff Member", normalFont, Color.WHITE);
            addCell(profileTable, "Reporting Quarter:", boldFont, BOA_LIGHT_BG);
            addCell(profileTable, dossier.fiscalQuarterName(), normalFont, Color.WHITE);

            addCell(profileTable, "Assigned Coach:", boldFont, BOA_LIGHT_BG);
            addCell(profileTable, dossier.coachName() != null ? dossier.coachName() : "Unassigned", normalFont, Color.WHITE);
            addCell(profileTable, "Coach Staff ID:", boldFont, BOA_LIGHT_BG);
            addCell(profileTable, dossier.coachStaffId() != null ? dossier.coachStaffId() : "N/A", normalFont, Color.WHITE);

            document.add(profileTable);

            // 3. Performance Gap & Baseline Evaluation
            Paragraph sec1 = new Paragraph("1. Baseline Appraisal & Competency Deficit", secHeaderFont);
            sec1.setSpacingBefore(5);
            sec1.setSpacingAfter(6);
            document.add(sec1);

            PdfPTable gapTable = new PdfPTable(4);
            gapTable.setWidthPercentage(100);
            gapTable.setWidths(new float[]{25, 25, 25, 25});
            gapTable.setSpacingAfter(12);

            addCell(gapTable, "Baseline Rating", boldFont, BOA_LIGHT_BG);
            addCell(gapTable, "Performance Risk Tier", boldFont, BOA_LIGHT_BG);
            addCell(gapTable, "Required Target Score", boldFont, BOA_LIGHT_BG);
            addCell(gapTable, "Remediation Gap Status", boldFont, BOA_LIGHT_BG);

            String ratingStr = dossier.startingRating() != null ? String.format("%.2f", dossier.startingRating()) : "N/A";
            addCell(gapTable, ratingStr, normalFont, Color.WHITE);
            addCell(gapTable, dossier.ratingBand() + " TIER", boldFont, Color.WHITE);
            addCell(gapTable, dossier.targetScore() != null ? dossier.targetScore() : "3.00", normalFont, Color.WHITE);
            addCell(gapTable, dossier.startingRating() != null && dossier.startingRating().doubleValue() < 2.0 ? "CRITICAL GAP (< 2.0)" : "MODERATE GAP", boldFont, Color.WHITE);

            document.add(gapTable);

            // Primary Gap Details
            PdfPTable gapDetailTable = new PdfPTable(2);
            gapDetailTable.setWidthPercentage(100);
            gapDetailTable.setWidths(new float[]{25, 75});
            gapDetailTable.setSpacingAfter(14);

            addCell(gapDetailTable, "Primary Skill Gap:", boldFont, BOA_LIGHT_BG);
            addCell(gapDetailTable, dossier.targetWeaknessKpi() != null ? dossier.targetWeaknessKpi() : "Branch FX & Deposit Mobilization", boldFont, Color.WHITE);

            addCell(gapDetailTable, "Root Cause Analysis:", boldFont, BOA_LIGHT_BG);
            addCell(gapDetailTable, dossier.weaknessRootCause() != null ? dossier.weaknessRootCause() : "Incomplete operational workflows and branch deposit acquisition pipeline management.", normalFont, Color.WHITE);

            document.add(gapDetailTable);

            // 4. Remediation Progress & Pacing
            Paragraph sec2 = new Paragraph("2. Remediation Session Delivery & Pacing", secHeaderFont);
            sec2.setSpacingBefore(5);
            sec2.setSpacingAfter(6);
            document.add(sec2);

            PdfPTable pacingTable = new PdfPTable(4);
            pacingTable.setWidthPercentage(100);
            pacingTable.setWidths(new float[]{25, 25, 25, 25});
            pacingTable.setSpacingAfter(14);

            addCell(pacingTable, "Approved Target Sessions", boldFont, BOA_LIGHT_BG);
            addCell(pacingTable, "Completed Sessions", boldFont, BOA_LIGHT_BG);
            addCell(pacingTable, "Delivery Percentage", boldFont, BOA_LIGHT_BG);
            addCell(pacingTable, "Current Trajectory", boldFont, BOA_LIGHT_BG);

            addCell(pacingTable, dossier.approvedTarget() + " Sessions", normalFont, Color.WHITE);
            addCell(pacingTable, dossier.completedSessions() + " Sessions", normalFont, Color.WHITE);
            addCell(pacingTable, String.format("%.1f%%", dossier.deliveryPercentage()), normalFont, Color.WHITE);
            addCell(pacingTable, dossier.progressTrajectory() != null ? dossier.progressTrajectory() : "NOT_STARTED", boldFont, Color.WHITE);

            document.add(pacingTable);

            // 5. Two-Way Session Log History & AI Synthesis
            Paragraph sec3 = new Paragraph("3. Verified Coaching Session Log & AI Diagnostic Synthesis", secHeaderFont);
            sec3.setSpacingBefore(5);
            sec3.setSpacingAfter(8);
            document.add(sec3);

            if (dossier.sessionLogs() != null && !dossier.sessionLogs().isEmpty()) {
                DateTimeFormatter dtf = DateTimeFormatter.ofPattern("MMM dd, yyyy").withZone(java.time.ZoneId.of("Africa/Addis_Ababa"));
                for (SessionProgressLogDto logItem : dossier.sessionLogs()) {
                    PdfPTable sessionBlock = new PdfPTable(4);
                    sessionBlock.setWidthPercentage(100);
                    sessionBlock.setWidths(new float[]{28, 24, 24, 24});
                    sessionBlock.setSpacingBefore(6);
                    sessionBlock.setSpacingAfter(0);

                    String seq = logItem.sequenceNumber() != null ? "Session #" + logItem.sequenceNumber() : "Session —";
                    String dateStr = logItem.scheduledStartTime() != null ? dtf.format(logItem.scheduledStartTime()) : "Scheduled";
                    String statusStr = logItem.sessionStatus() != null ? logItem.sessionStatus().name() : "SCHEDULED";
                    String assessStr = logItem.coachAssessment() != null ? logItem.coachAssessment().name() : (logItem.feedbackRating() != null ? logItem.feedbackRating() + "/5" : "Pending Evaluation");

                    Font seqFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, BOA_NAVY);
                    Font statusFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, "COMPLETED".equals(statusStr) ? new Color(5, 150, 105) : BOA_GOLD);
                    Color rowBg = new Color(241, 245, 249); // Clean soft slate header

                    addCell(sessionBlock, seq + " (" + logItem.meetingMode() + ")", seqFont, rowBg, BOA_NAVY);
                    addCell(sessionBlock, dateStr, normalFont, rowBg, TEXT_DARK);
                    addCell(sessionBlock, statusStr, statusFont, rowBg, "COMPLETED".equals(statusStr) ? new Color(5, 150, 105) : BOA_GOLD);
                    addCell(sessionBlock, assessStr, boldFont, rowBg, TEXT_DARK);
                    document.add(sessionBlock);

                    // AI Executive Minutes & Agreed Action Items Box
                    if (logItem.sessionDiscussionMinutes() != null && !logItem.sessionDiscussionMinutes().isBlank()) {
                        PdfPTable noteTable = new PdfPTable(1);
                        noteTable.setWidthPercentage(100);
                        noteTable.setSpacingAfter(6);

                        PdfPCell noteCell = new PdfPCell();
                        noteCell.setBackgroundColor(new Color(254, 252, 232)); // soft amber background
                        noteCell.setBorderColor(new Color(253, 230, 138));
                        noteCell.setPadding(8);

                        Paragraph minHeader = new Paragraph("AI EXECUTIVE SUMMARY & DIAGNOSTIC MINUTES (qwen3:8b):", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, BOA_GOLD));
                        minHeader.setSpacingAfter(4);
                        noteCell.addElement(minHeader);

                        // Formal indented layout without bullet dots
                        String[] minuteLines = logItem.sessionDiscussionMinutes().split("\\r?\\n");
                        for (String mLine : minuteLines) {
                            String trimmed = mLine.trim();
                            if (trimmed.isEmpty()) continue;
                            if (trimmed.matches("^\\d+\\.\\s+[A-Z\\s&:-]{4,}.*")) {
                                Paragraph secHead = new Paragraph(trimmed, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, BOA_NAVY));
                                secHead.setSpacingBefore(3);
                                secHead.setSpacingAfter(1);
                                noteCell.addElement(secHead);
                            } else if (trimmed.contains(":") && trimmed.indexOf(":") < 35 && !trimmed.startsWith("http")) {
                                int cIdx = trimmed.indexOf(":");
                                String lbl = trimmed.substring(0, cIdx);
                                String val = trimmed.substring(cIdx + 1);
                                Paragraph kvPara = new Paragraph();
                                kvPara.setIndentationLeft(8);
                                kvPara.add(new Phrase(lbl + ":", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.2f, BOA_GOLD)));
                                kvPara.add(new Phrase(val, FontFactory.getFont(FontFactory.HELVETICA, 7.2f, Color.DARK_GRAY)));
                                noteCell.addElement(kvPara);
                            } else {
                                Paragraph normPara = new Paragraph(trimmed, FontFactory.getFont(FontFactory.HELVETICA, 7.2f, Color.DARK_GRAY));
                                normPara.setIndentationLeft(6);
                                noteCell.addElement(normPara);
                            }
                        }

                        if (logItem.actionItemsAssigned() != null && !logItem.actionItemsAssigned().isBlank()) {
                            Paragraph actHeader = new Paragraph("AGREED ACTION ITEMS & REMEDIATION TARGETS:", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, BOA_NAVY));
                            actHeader.setSpacingBefore(5);
                            actHeader.setSpacingAfter(3);
                            noteCell.addElement(actHeader);

                            String[] actLines = logItem.actionItemsAssigned().split("\\r?\\n");
                            for (String aLine : actLines) {
                                String trimmedAct = aLine.trim();
                                if (trimmedAct.isEmpty()) continue;
                                Paragraph actPara = new Paragraph(trimmedAct, FontFactory.getFont(FontFactory.HELVETICA, 7.2f, Color.DARK_GRAY));
                                actPara.setIndentationLeft(8);
                                noteCell.addElement(actPara);
                            }
                        }

                        noteTable.addCell(noteCell);
                        document.add(noteTable);
                    }
                }
            } else {
                PdfPTable logTable = new PdfPTable(1);
                logTable.setWidthPercentage(100);
                logTable.setSpacingAfter(14);
                PdfPCell emptyCell = new PdfPCell(new Phrase("No completed coaching sessions logged to date. Kickoff session pending assignment.", mutedFont));
                emptyCell.setPadding(10);
                emptyCell.setBorderColor(BOA_BORDER);
                emptyCell.setBackgroundColor(BOA_LIGHT_BG);
                emptyCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                logTable.addCell(emptyCell);
                document.add(logTable);
            }

            // 6. Executive Action Directive & Sign-Off
            Paragraph sec4 = new Paragraph("4. Governance & Administrative Sign-Off", secHeaderFont);
            sec4.setSpacingBefore(5);
            sec4.setSpacingAfter(8);
            document.add(sec4);

            PdfPTable signTable = new PdfPTable(3);
            signTable.setWidthPercentage(100);
            signTable.setWidths(new float[]{33, 34, 33});

            addSignBox(signTable, "Assigned Coach", dossier.coachName() != null ? dossier.coachName() : "Coach Name", boldFont, normalFont);
            addSignBox(signTable, "Branch Operations Manager", "Authorized Branch Manager", boldFont, normalFont);
            addSignBox(signTable, "District HR Business Partner", "Authorized HR BP", boldFont, normalFont);

            document.add(signTable);

            // Footer Notice
            Paragraph footer = new Paragraph("\nOfficial Bank of Abyssinia Performance Remediation Document • Generated by APID Coaching Intelligence Platform", mutedFont);
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
            return out.toByteArray();
        } catch (Exception ex) {
            throw new RuntimeException("Failed to generate PDF Dossier: " + ex.getMessage(), ex);
        }
    }

    private void addCell(PdfPTable table, String text, Font font, Color bgColor) {
        addCell(table, text, font, bgColor, TEXT_DARK);
    }

    private void addCell(PdfPTable table, String text, Font font, Color bgColor, Color textColor) {
        Font cellFont = new Font(font);
        if (textColor != null) {
            cellFont.setColor(textColor);
        }
        PdfPCell cell = new PdfPCell(new Phrase(text != null ? text : "—", cellFont));
        cell.setBackgroundColor(bgColor);
        cell.setBorderColor(BOA_BORDER);
        cell.setPadding(6);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        table.addCell(cell);
    }

    private void addSignBox(PdfPTable table, String role, String name, Font boldFont, Font normalFont) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(8);
        cell.setBorderColor(BOA_BORDER);
        cell.setBackgroundColor(BOA_LIGHT_BG);

        cell.addElement(new Paragraph(role, boldFont));
        cell.addElement(new Paragraph("Signature: ______________________", normalFont));
        cell.addElement(new Paragraph("Name: " + name, normalFont));
        cell.addElement(new Paragraph("Date: ____/____/2026", normalFont));

        table.addCell(cell);
    }
}
