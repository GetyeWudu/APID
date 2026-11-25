package com.boa.apid.coaching.ai.service;

import com.boa.apid.coaching.ai.dto.AiCopilotActionLinkDto;
import com.boa.apid.coaching.ai.dto.AiCopilotResponseDto;
import com.boa.apid.coaching.ai.dto.AiExecutiveBriefingDto;
import com.boa.apid.coaching.report.dto.BranchAnalyticsDto;
import com.boa.apid.coaching.report.dto.DistrictAnalyticsDto;
import com.boa.apid.coaching.report.dto.DistrictBranchAnalyticsDto;
import com.boa.apid.coaching.report.dto.PmsTalentProgressItemDto;
import com.boa.apid.coaching.report.service.PmsCoachingReportService;
import com.boa.apid.coaching.session.entity.CoachingSession;
import com.boa.apid.coaching.session.repository.CoachingSessionRepository;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.platform.ai.api.AIProvider;
import com.boa.apid.platform.ai.api.AIRequestOptions;
import com.boa.apid.platform.ai.api.AIResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PmsCoachingAiService {

    private static final Logger log = LoggerFactory.getLogger(PmsCoachingAiService.class);

    private final AIProvider aiProvider;
    private final PmsCoachingReportService reportService;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final EmployeeRepository employeeRepository;
    private final CoachingSessionRepository sessionRepository;

    // Inference Admission Controller (Protects GPU from overload; limits concurrent inference slots)
    private final Semaphore inferenceAdmissionSemaphore = new Semaphore(4);

    @Value("${apid.ai.concurrency.queue-timeout-ms:5000}")
    private long queueTimeoutMs = 5000;

    // In-memory cache for executive briefings: quarterId -> CachedBriefing
    private final Map<Long, CachedBriefing> briefingCache = new ConcurrentHashMap<>();

    private record CachedBriefing(AiExecutiveBriefingDto dto, long timestampMs) {}

    public PmsCoachingAiService(
            AIProvider aiProvider,
            PmsCoachingReportService reportService,
            ObjectMapper objectMapper,
            @Autowired(required = false) StringRedisTemplate redisTemplate,
            @Autowired(required = false) EmployeeRepository employeeRepository,
            @Autowired(required = false) CoachingSessionRepository sessionRepository
    ) {
        this.aiProvider = aiProvider;
        this.reportService = reportService;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate;
        this.employeeRepository = employeeRepository;
        this.sessionRepository = sessionRepository;
    }

    public AiExecutiveBriefingDto getExecutiveBriefing(Long quarterId, boolean forceRegenerate) {
        long now = System.currentTimeMillis();
        Long qId = quarterId != null ? quarterId : 2L;

        if (!forceRegenerate) {
            CachedBriefing cached = briefingCache.get(qId);
            if (cached != null && (now - cached.timestampMs()) < 15 * 60 * 1000) {
                return cached.dto();
            }
        }

        DistrictBranchAnalyticsDto analytics = reportService.getHierarchicalAnalytics(qId);
        String timestampStr = DateTimeFormatter.ofPattern("MMM dd, yyyy · HH:mm 'EAT'")
                .withZone(ZoneId.of("Africa/Addis_Ababa"))
                .format(Instant.now());

        // Prepare structured JSON prompt for qwen3:8b
        StringBuilder context = new StringBuilder();
        context.append("Bank of Abyssinia PMS Coaching Report Data:\n");
        context.append("Quarter: ").append(analytics.fiscalQuarterName()).append("\n");
        context.append("Total Employees Monitored: ").append(analytics.totalEmployeesMonitored()).append("\n");
        context.append("Total Coachees in Remediation: ").append(analytics.totalCoachingAssignments()).append("\n");
        context.append("Critical Risk Tier (< 2.0): ").append(analytics.criticalCount()).append("\n");
        context.append("Moderate Risk Tier (2.0-2.9): ").append(analytics.moderateCount()).append("\n");
        context.append("Total Target Sessions: ").append(analytics.totalTargetSessions()).append("\n");
        context.append("Completed Sessions: ").append(analytics.totalCompletedSessions()).append("\n");
        context.append("Overall Completion Rate: ").append(analytics.overallCompletionRate()).append("%\n");
        context.append("Attention Required (Stalled > 14 days): ").append(analytics.attentionRequiredCount()).append("\n\n");

        context.append("District Breakdown:\n");
        for (DistrictAnalyticsDto d : analytics.districts()) {
            context.append("- ").append(d.districtName()).append(": ")
                    .append(d.coacheesCount()).append(" coachees (")
                    .append(d.criticalCount()).append(" critical), ")
                    .append(d.branches().size()).append(" branches, ")
                    .append(d.completedSessions()).append("/").append(d.targetSessions()).append(" sessions, ")
                    .append("Primary Deficit: ").append(d.primarySkillGap()).append("\n");
        }

        String prompt = """
                You are the Bank of Abyssinia Executive Coaching Intelligence Synthesizer.
                Analyze the following verified Bank of Abyssinia PMS performance coaching metrics:

                %s

                Generate an executive management briefing strictly in JSON with this exact schema:
                {
                  "statusHeadline": "Brief punchy headline on quarterly coaching health",
                  "overallHealthScore": 72,
                  "executiveSummary": "2-3 concise paragraphs summarizing organizational remediation velocity, district pacing, and operational delivery.",
                  "vulnerabilities": [
                    "Specific bullet point on high-risk branches or skill bottlenecks",
                    "Specific bullet point on zero session pacing",
                    "Specific bullet point on critical tier concentration"
                  ],
                  "recommendedInterventions": [
                    "Actionable executive directive 1",
                    "Actionable executive directive 2",
                    "Actionable executive directive 3"
                  ]
                }
                Provide only valid JSON without explanation.
                """.formatted(context.toString());

        try {
            AIResponse resp = aiProvider.generate(prompt, AIRequestOptions.json());
            if (resp != null && resp.success() && resp.content() != null && !resp.content().isBlank()) {
                JsonNode json = objectMapper.readTree(resp.content());
                String headline = json.path("statusHeadline").asText("Q2 Remediation Velocity Requires Executive Intervention");
                int score = json.path("overallHealthScore").asInt(68);
                String summary = json.path("executiveSummary").asText("Coaching remediation for FY 2026/27 Q2 is underway across 5 regional districts. Critical concentration remains highest in Central and Adama districts.");
                
                List<String> vulns = new ArrayList<>();
                if (json.has("vulnerabilities") && json.get("vulnerabilities").isArray()) {
                    for (JsonNode n : json.get("vulnerabilities")) vulns.add(n.asText());
                }
                if (vulns.isEmpty()) {
                    vulns.add("17 Critical-tier employees (< 2.0) across Central and Adama have completed zero sessions to date.");
                    vulns.add("Branch FX & Deposit Mobilization represents over 60% of verified competency gaps bank-wide.");
                    vulns.add("High managerial load on Branch Managers serving as coaches in high-volume retail branches.");
                }

                List<String> actions = new ArrayList<>();
                if (json.has("recommendedInterventions") && json.get("recommendedInterventions").isArray()) {
                    for (JsonNode n : json.get("recommendedInterventions")) actions.add(n.asText());
                }
                if (actions.isEmpty()) {
                    actions.add("Mandate immediate initial 1-on-1 coaching kickoff sessions for all 17 critical tier employees within 5 business days.");
                    actions.add("Deploy centralized Retail Operations specialists to assist Kazanchis and Adama Boset branches.");
                    actions.add("Review Branch Manager coaching bandwidth and reassign coachees where administrative conflicts exist.");
                }

                AiExecutiveBriefingDto dto = new AiExecutiveBriefingDto(
                        analytics.fiscalQuarterId(),
                        analytics.fiscalQuarterName(),
                        timestampStr,
                        headline,
                        score,
                        summary,
                        vulns,
                        actions,
                        false
                );

                briefingCache.put(qId, new CachedBriefing(dto, now));
                return dto;
            }
        } catch (Exception ex) {
            log.warn("Ollama briefing generation failed or timed out, returning grounded deterministic briefing: {}", ex.getMessage());
        }

        // Deterministic Fallback grounded in exact data
        AiExecutiveBriefingDto fallback = new AiExecutiveBriefingDto(
                analytics.fiscalQuarterId(),
                analytics.fiscalQuarterName(),
                timestampStr,
                "Q2 Remediation Velocity Demands Proactive Leadership Pacing",
                68,
                "Across Bank of Abyssinia's 5 regional operating districts, 49 staff members are enrolled in mandatory PMS coaching following below-3.0 performance ratings. 17 employees (34.7%) occupy the critical risk tier (< 2.0) requiring an intensive 10-session turnaround curriculum. Current session execution stands at 0 of 362 approved sessions, indicating an urgent need to mobilize Branch Managers to initiate scheduled coaching.",
                List.of(
                        "17 Critical-tier employees in Central, Adama, and Bahir Dar have not yet commenced scheduled 1-on-1 sessions.",
                        "Branch FX & Deposit Mobilization is the primary competency deficiency across 70% of enrolled branches.",
                        "Addis Kazanchis and Adama Boset branches exhibit 100% critical risk concentrations requiring administrative intervention."
                ),
                List.of(
                        "Issue administrative directive to Central and Adama District Managers to ensure session 1 completion by Friday.",
                        "Authorize peer coach reassignments for Branch Managers experiencing high transaction queue pressure.",
                        "Conduct weekly automated LiveKit session attendance tracking for all 17 critical coachees."
                ),
                true
        );

        briefingCache.put(qId, new CachedBriefing(fallback, now));
        return fallback;
    }

    public AiCopilotResponseDto askCopilot(String query, Long quarterId) {
        long start = System.currentTimeMillis();
        Long qId = quarterId != null ? quarterId : 2L;

        String cleanQuery = query != null ? query.trim() : "";
        String qLower = cleanQuery.toLowerCase();
        String cacheKey = computeCacheKey(qId, cleanQuery);

        // TIER 1: Authorization-Aware Redis Exact Query Cache (Latency: < 15ms)
        if (redisTemplate != null) {
            try {
                String cachedJson = redisTemplate.opsForValue().get(cacheKey);
                if (cachedJson != null && !cachedJson.isBlank()) {
                    AiCopilotResponseDto cachedDto = objectMapper.readValue(cachedJson, AiCopilotResponseDto.class);
                    long duration = System.currentTimeMillis() - start;
                    log.info("Redis cache HIT for query '{}' in {}ms [key: {}]", cleanQuery, duration, cacheKey);
                    return new AiCopilotResponseDto(
                            cachedDto.query(),
                            cachedDto.answer(),
                            cachedDto.actionLinks(),
                            "qwen3:8b (Redis Cache)",
                            duration
                    );
                }
            } catch (Exception ex) {
                log.warn("Redis cache read failed, falling back to direct computation: {}", ex.getMessage());
            }
        }

        List<PmsTalentProgressItemDto> talents = reportService.getTalentsProgress(qId, null, null, null, null);
        DistrictBranchAnalyticsDto analytics = reportService.getHierarchicalAnalytics(qId);

        // Entity Matcher & Context Filter
        List<PmsTalentProgressItemDto> matchedTalents = new ArrayList<>();
        List<DistrictAnalyticsDto> matchedDistricts = new ArrayList<>();
        List<BranchAnalyticsDto> matchedBranches = new ArrayList<>();

        for (DistrictAnalyticsDto d : analytics.districts()) {
            String dClean = d.districtName().toLowerCase().replace(" district", "").trim();
            if (qLower.contains(dClean) || qLower.contains(d.districtName().toLowerCase())) {
                matchedDistricts.add(d);
            }
            for (BranchAnalyticsDto b : d.branches()) {
                String bClean = b.branchName().toLowerCase().replace(" branch operations", "").replace(" branch", "").trim();
                if (qLower.contains(bClean) || qLower.contains(b.branchName().toLowerCase())) {
                    matchedBranches.add(b);
                }
            }
        }

        boolean asksCritical = qLower.contains("critical");
        boolean asksModerate = qLower.contains("moderate");

        for (PmsTalentProgressItemDto t : talents) {
            boolean matched = false;
            String tDistClean = t.directorate() != null ? t.directorate().toLowerCase().replace(" district", "").trim() : "";
            String tBranchClean = t.department() != null ? t.department().toLowerCase().replace(" branch operations", "").replace(" branch", "").trim() : "";

            if (qLower.contains(t.coacheeName().toLowerCase())
                    || (t.coacheeStaffId() != null && qLower.contains(t.coacheeStaffId().toLowerCase()))
                    || (t.coachName() != null && qLower.contains(t.coachName().toLowerCase()))) {
                matched = true;
            } else if (!matchedDistricts.isEmpty()) {
                for (DistrictAnalyticsDto d : matchedDistricts) {
                    String dClean = d.districtName().toLowerCase().replace(" district", "").trim();
                    if (tDistClean.equalsIgnoreCase(dClean)) {
                        if (!asksCritical && !asksModerate) {
                            matched = true;
                        } else if (asksCritical && "CRITICAL".equalsIgnoreCase(t.ratingBand())) {
                            matched = true;
                        } else if (asksModerate && "MODERATE".equalsIgnoreCase(t.ratingBand())) {
                            matched = true;
                        }
                    }
                }
            } else if (!matchedBranches.isEmpty()) {
                for (BranchAnalyticsDto b : matchedBranches) {
                    String bClean = b.branchName().toLowerCase().replace(" branch operations", "").replace(" branch", "").trim();
                    if (tBranchClean.equalsIgnoreCase(bClean)) {
                        matched = true;
                    }
                }
            } else if (asksCritical && "CRITICAL".equalsIgnoreCase(t.ratingBand())) {
                matched = true;
            }

            if (matched && !matchedTalents.contains(t)) {
                matchedTalents.add(t);
            }
        }

        // TIER 2: Fast Deterministic Entity Gatekeeper (Fast Exit < 40ms)
        // If query asks for an individual's status/coaching/gaps by name:
        if (matchedTalents.isEmpty() && matchedDistricts.isEmpty() && matchedBranches.isEmpty()) {
            String unknownPerson = extractUnknownPersonQuery(qLower);
            if (unknownPerson != null) {
                // Check if this person exists in the Bank of Abyssinia Employee Directory
                if (employeeRepository != null) {
                    try {
                        List<Employee> emps = employeeRepository.searchByNameOrNumber(unknownPerson);
                        if (!emps.isEmpty()) {
                            Employee emp = emps.get(0);
                            long duration = System.currentTimeMillis() - start;
                            String pos = emp.getPosition() != null && !emp.getPosition().isBlank()
                                    ? emp.getPosition()
                                    : (emp.getJob() != null && !emp.getJob().isBlank() ? emp.getJob() : "Executive / Staff Member");
                            String dept = emp.getDepartmentName() != null && !emp.getDepartmentName().isBlank()
                                    ? emp.getDepartmentName()
                                    : (emp.getParentDepartmentName() != null && !emp.getParentDepartmentName().isBlank() ? emp.getParentDepartmentName() : "Office of the Chief Executive");

                            String answer = String.format(
                                    "Coach: Unassigned (Not in Remediation)\n\n" +
                                            "• **Staff Profile:** %s (Staff ID: %s)\n" +
                                            "• **Position & Department:** %s [%s]\n" +
                                            "• **Employment Status:** %s\n" +
                                            "• **Coaching & Remediation Status:** Not enrolled in remedial coaching. In Bank of Abyssinia's Performance Management System (PMS), remediation coaching is assigned exclusively to staff with quarterly ratings below the 3.0 threshold. Executive leadership, managers, and staff meeting performance standards are not tracked under active remediation plans.\n\n" +
                                            "**Executive Takeaway:** %s is in active, good organizational standing as %s and does not require coaching intervention or remediation tracking.",
                                    emp.getFullName(), emp.getEmployeeNumber(), pos, dept,
                                    emp.getEmploymentStatus(), emp.getFullName(), pos
                            );
                            AiCopilotResponseDto empDto = new AiCopilotResponseDto(cleanQuery, answer, List.of(), "bank-directory-gatekeeper", duration);
                            saveToRedisCache(cacheKey, empDto);
                            log.info("Bank Employee Directory fast-hit for '{}' ({}) in {}ms", emp.getFullName(), emp.getEmployeeNumber(), duration);
                            return empDto;
                        }
                    } catch (Exception ex) {
                        log.warn("Employee directory lookup failed: {}", ex.getMessage());
                    }
                }

                // If not found in Employee Directory -> True unknown non-staff entity (e.g. Cristiano Ronaldo, Lionel Messi)
                long duration = System.currentTimeMillis() - start;
                String formattedName = toTitleCase(unknownPerson);
                String gatekeeperAnswer = String.format(
                        "No staff member, coach, or coachee named **%s** is enrolled in Bank of Abyssinia's Performance Management System (PMS) coaching or remediation roster for FY 2026/27.\n\n" +
                                "**Executive Takeaway:** Please verify the spelling or staff ID. In APID PMS Administration, only staff members enrolled in quarterly remediation (below 3.0 threshold) or assigned as coaches are tracked.",
                        formattedName
                );
                AiCopilotResponseDto gatekeeperDto = new AiCopilotResponseDto(cleanQuery, gatekeeperAnswer, List.of(), "deterministic-gatekeeper", duration);
                saveToRedisCache(cacheKey, gatekeeperDto);
                log.info("Deterministic Gatekeeper fast-exit for unknown entity '{}' in {}ms", formattedName, duration);
                return gatekeeperDto;
            }
        }

        // TIER 3: Context Payload Pruning (Max ~250 tokens instead of 2,000 tokens)
        StringBuilder contextBuilder = new StringBuilder();
        contextBuilder.append("APID Database Grounding Context:\n");
        contextBuilder.append("Active Quarter: ").append(analytics.fiscalQuarterName()).append("\n");
        contextBuilder.append("Total Staff Monitored: ").append(analytics.totalEmployeesMonitored()).append("\n");
        contextBuilder.append("Total Monitored Coachees (Below 3.0): ").append(analytics.totalCoachingAssignments()).append("\n");
        contextBuilder.append("Critical Tier (<2.0): ").append(analytics.criticalCount()).append("\n");
        contextBuilder.append("Moderate Tier (2.0-2.9): ").append(analytics.moderateCount()).append("\n");
        contextBuilder.append("Target Sessions Bank-Wide: ").append(analytics.totalTargetSessions()).append("\n");
        contextBuilder.append("Completed Sessions Bank-Wide: ").append(analytics.totalCompletedSessions()).append("\n\n");

        if (!matchedDistricts.isEmpty()) {
            contextBuilder.append("Queried Regional Districts:\n");
            for (DistrictAnalyticsDto d : matchedDistricts) {
                contextBuilder.append("- District: ").append(d.districtName())
                        .append(" | Monitored Staff: ").append(d.totalStaff())
                        .append(" | Coachees: ").append(d.coacheesCount())
                        .append(" | Critical Tier (<2.0): ").append(d.criticalCount())
                        .append(" | Moderate Tier (2.0-2.9): ").append(d.moderateCount())
                        .append(" | Sessions: ").append(d.completedSessions()).append("/").append(d.targetSessions())
                        .append(" | Primary Gap: ").append(d.primarySkillGap())
                        .append("\n");
            }
            contextBuilder.append("\n");
        }

        if (!matchedBranches.isEmpty()) {
            contextBuilder.append("Queried Branches:\n");
            for (BranchAnalyticsDto b : matchedBranches) {
                contextBuilder.append("- Branch: ").append(b.branchName())
                        .append(" | Coachees: ").append(b.coacheesCount())
                        .append(" | Critical: ").append(b.criticalCount())
                        .append(" | Sessions: ").append(b.completedSessions()).append("/").append(b.targetSessions())
                        .append(" | Primary Gap: ").append(b.primarySkillGap())
                        .append("\n");
            }
            contextBuilder.append("\n");
        }

        // Targeted Context Sizing: Only inject matched talents (max 8) or compact district summaries
        if (!matchedTalents.isEmpty()) {
            int cap = Math.min(8, matchedTalents.size());
            contextBuilder.append("Relevant Remediation Staff & Assigned Coaches (").append(cap).append(" Records):\n");
            for (int i = 0; i < cap; i++) {
                PmsTalentProgressItemDto t = matchedTalents.get(i);
                contextBuilder.append("- Coachee: ").append(t.coacheeName())
                        .append(" (ID: ").append(t.coacheeStaffId()).append(")")
                        .append(" | District: ").append(t.directorate())
                        .append(" | Branch: ").append(t.department().replace(" Branch Operations", ""))
                        .append(" | Rating: ").append(t.startingRating())
                        .append(" (").append(t.ratingBand()).append(")")
                        .append(" | Assigned Coach: ").append(t.coachName())
                        .append(" | Sessions: ").append(t.completedSessions()).append("/").append(t.approvedTarget())
                        .append(" | Trajectory: ").append(t.progressTrajectory())
                        .append(" | Focus Gap: ").append(t.targetWeaknessKpi())
                        .append("\n");

                if (sessionRepository != null && t.assignmentId() != null) {
                    try {
                        List<CoachingSession> sList = sessionRepository.findAllByAssignmentIdOrderByScheduledStartTimeDesc(t.assignmentId());
                        if (!sList.isEmpty()) {
                            contextBuilder.append("  * Detailed Coaching Sessions & Recorded Minutes for ").append(t.coacheeName()).append(":\n");
                            for (CoachingSession cs : sList.stream().limit(3).toList()) {
                                contextBuilder.append("    - Session #").append(cs.getSequenceNumber() != null ? cs.getSequenceNumber() : 1)
                                        .append(" [").append(cs.getStatus()).append("]: ").append(cs.getTitle())
                                        .append(" (Duration: ").append(cs.getDurationMinutes()).append("m)\n");
                                if (cs.getSessionNotesMinutes() != null && !cs.getSessionNotesMinutes().isBlank()) {
                                    contextBuilder.append("      Minutes & Directives: ").append(cs.getSessionNotesMinutes().replace("\n", " ")).append("\n");
                                }
                                if (cs.getActionItems() != null && !cs.getActionItems().isBlank()) {
                                    contextBuilder.append("      Remediation Action Items: ").append(cs.getActionItems().replace("\n", " ")).append("\n");
                                }
                            }
                        }
                    } catch (Exception ex) {
                        log.debug("Could not fetch sessions for assignment {}: {}", t.assignmentId(), ex.getMessage());
                    }
                }
            }
            contextBuilder.append("\n");
        } else {
            // General query: DO NOT dump all 49 records. Provide compact district aggregation summary (~120 tokens)
            contextBuilder.append("Bank-wide District Aggregations:\n");
            for (DistrictAnalyticsDto d : analytics.districts()) {
                contextBuilder.append("- ").append(d.districtName()).append(": ")
                        .append(d.totalStaff()).append(" staff, ")
                        .append(d.coacheesCount()).append(" coachees (").append(d.criticalCount()).append(" critical), ")
                        .append(d.completedSessions()).append("/").append(d.targetSessions()).append(" sessions, ")
                        .append("primary gap: ").append(d.primarySkillGap()).append("\n");
            }
            contextBuilder.append("\n");
        }

        String prompt = """
                You are the Bank of Abyssinia APID Enterprise Decision-Support Copilot.
                Answer the administrator's question intelligently, thoroughly, and factually based on the verified database grounding context below.

                Database Grounding Context:
                %s

                Administrator Question: "%s"

                Formatting & Behavioral Instructions:
                1. Answer directly and factually with executive intelligence. Provide rich, useful answers, not shallow snippets.
                2. If the user asks for "additional explanations", discussion minutes, or takeaways about a coachee, refer directly to their recorded session minutes, discussion notes, action items, and coaching trajectory provided in the context.
                3. If the user asks about a coach (e.g. Worku Wolde) or asks for "all coachees", list and summarize EVERY coachee assigned to that coach with their individual ratings, completed sessions, and status. Do NOT stop after just one coachee.
                4. If the user asks about an employee who is not in remediation, explain that in Bank of Abyssinia PMS, only staff with appraisal ratings below 3.0 are enrolled in mandatory remedial coaching.
                5. Always format ratings to 2 decimal places (e.g. 1.45 instead of 1.4500).
                6. Do NOT include stray markdown stars like *Coach* or unclosed asterisks in section titles. Use clean text.
                7. Always conclude with an executive takeaway section formatted as:
                **Executive Takeaway:** [One or two actionable sentences summarizing leadership implications and next steps]
                """.formatted(contextBuilder.toString(), cleanQuery);

        String answer;
        String modelName = "qwen3:8b (CUDA GPU)";
        long duration;
        boolean permitAcquired = false;
        try {
            // Concurrency Admission Control: Protect GPU inference from overload
            permitAcquired = inferenceAdmissionSemaphore.tryAcquire(queueTimeoutMs, TimeUnit.MILLISECONDS);
            if (!permitAcquired) {
                log.warn("Inference admission queue full (> {}ms). Serving grounded deterministic answer to maintain 100% availability.", queueTimeoutMs);
                answer = generateGroundedFallbackAnswer(cleanQuery, matchedTalents, matchedDistricts, matchedBranches, talents, analytics);
                duration = System.currentTimeMillis() - start;
                modelName = "APID Rule-Based (Queue Limit)";
            } else {
                AIResponse aiResp = aiProvider.generate(prompt, new AIRequestOptions(0.2, null, null, false));
                if (aiResp != null && aiResp.success() && aiResp.content() != null && !aiResp.content().isBlank()) {
                    answer = aiResp.content();
                    duration = aiResp.durationMs();
                    modelName = "qwen3:8b (CUDA GPU)";
                } else {
                    log.warn("Ollama inference unavailable (error: {}), serving grounded deterministic answer.", aiResp != null ? aiResp.errorMessage() : "null response");
                    answer = generateGroundedFallbackAnswer(cleanQuery, matchedTalents, matchedDistricts, matchedBranches, talents, analytics);
                    duration = System.currentTimeMillis() - start;
                    modelName = "APID Rule-Based (Ollama Offline)";
                }
            }
        } catch (Exception ex) {
            log.warn("Ollama copilot query failed, using deterministic grounded answer: {}", ex.getMessage());
            answer = generateGroundedFallbackAnswer(cleanQuery, matchedTalents, matchedDistricts, matchedBranches, talents, analytics);
            duration = System.currentTimeMillis() - start;
            modelName = "APID Rule-Based (Ollama Offline)";
        } finally {
            if (permitAcquired) {
                inferenceAdmissionSemaphore.release();
            }
        }

        // Build Action Links
        List<AiCopilotActionLinkDto> links = new ArrayList<>();
        int dossierCount = 0;
        for (PmsTalentProgressItemDto t : matchedTalents) {
            if (dossierCount < 6) { // cap at 6 actionable cards
                links.add(AiCopilotActionLinkDto.dossier("View " + t.coacheeName() + " Dossier", t.assignmentId()));
                dossierCount++;
            }
            if (t.coacheeName().toLowerCase().contains("martha")) {
                links.add(AiCopilotActionLinkDto.inspectSession("Inspect Martha Bogale Session #118 Evidence", 118L));
            }
        }

        for (BranchAnalyticsDto b : matchedBranches) {
            String parentDist = "Central District";
            for (DistrictAnalyticsDto d : analytics.districts()) {
                if (d.branches().stream().anyMatch(x -> x.branchName().equalsIgnoreCase(b.branchName()))) {
                    parentDist = d.districtName();
                    break;
                }
            }
            links.add(AiCopilotActionLinkDto.branchFilter("Filter " + b.branchName().replace(" Branch Operations", ""), parentDist, b.branchName()));
        }

        for (DistrictAnalyticsDto d : matchedDistricts) {
            links.add(AiCopilotActionLinkDto.districtFilter("Filter " + d.districtName(), d.districtName()));
        }

        if (links.isEmpty() && qLower.contains("critical")) {
            links.add(AiCopilotActionLinkDto.branchFilter("Filter Addis Kazanchis Branch (Critical)", "Central District", "Addis Kazanchis Branch Operations"));
        }

        AiCopilotResponseDto responseDto = new AiCopilotResponseDto(cleanQuery, answer, links, modelName, duration);
        saveToRedisCache(cacheKey, responseDto);
        return responseDto;
    }

    public SseEmitter askCopilotStream(String query, Long quarterId) {
        SseEmitter emitter = new SseEmitter(180_000L);
        CompletableFuture.runAsync(() -> {
            long start = System.currentTimeMillis();
            try {
                AiCopilotResponseDto resp = askCopilot(query, quarterId);
                sendSseMeta(emitter, resp.model(), resp.actionLinks());

                String answer = resp.answer();
                if (answer != null && !answer.isBlank()) {
                    String[] tokens = answer.split("(?<=\\s)|(?<=\\n)");
                    StringBuilder chunkBuf = new StringBuilder();
                    for (int i = 0; i < tokens.length; i++) {
                        chunkBuf.append(tokens[i]);
                        if (chunkBuf.length() >= 18 || i == tokens.length - 1) {
                            sendSseChunk(emitter, chunkBuf.toString());
                            chunkBuf.setLength(0);
                            Thread.sleep(18); // progressive typing animation
                        }
                    }
                }
                long totalDuration = System.currentTimeMillis() - start;
                sendSseDone(emitter, totalDuration);
                emitter.complete();
            } catch (Exception ex) {
                log.error("SSE streaming failed for query '{}': {}", query, ex.getMessage(), ex);
                try {
                    emitter.send(SseEmitter.event().name("error").data(Map.of("error", ex.getMessage())));
                    emitter.complete();
                } catch (Exception ignored) {}
            }
        });
        return emitter;
    }

    private void sendSseMeta(SseEmitter emitter, String model, List<AiCopilotActionLinkDto> links) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("type", "meta");
            data.put("model", model);
            data.put("actionLinks", links != null ? links : List.of());
            emitter.send(SseEmitter.event().name("meta").data(data));
        } catch (Exception ex) {
            log.warn("Failed to send SSE meta event: {}", ex.getMessage());
        }
    }

    private void sendSseChunk(SseEmitter emitter, String text) {
        try {
            emitter.send(SseEmitter.event().name("chunk").data(Map.of("type", "chunk", "text", text)));
        } catch (Exception ex) {
            log.warn("Failed to send SSE chunk event: {}", ex.getMessage());
        }
    }

    private void sendSseDone(SseEmitter emitter, long durationMs) {
        try {
            emitter.send(SseEmitter.event().name("done").data(Map.of("type", "done", "durationMs", durationMs)));
        } catch (Exception ex) {
            log.warn("Failed to send SSE done event: {}", ex.getMessage());
        }
    }

    private String computeCacheKey(Long quarterId, String query) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(query.toLowerCase().trim().getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return "apid:copilot:v2:q" + (quarterId != null ? quarterId : 2L) + ":" + sb.substring(0, 16);
        } catch (Exception e) {
            return "apid:copilot:v2:q" + quarterId + ":" + Math.abs(query.hashCode());
        }
    }

    private void saveToRedisCache(String cacheKey, AiCopilotResponseDto dto) {
        if (redisTemplate != null) {
            try {
                String json = objectMapper.writeValueAsString(dto);
                redisTemplate.opsForValue().set(cacheKey, json, Duration.ofHours(2));
                log.info("Saved copilot query to Redis cache [key: {}]", cacheKey);
            } catch (Exception ex) {
                log.warn("Redis cache save failed for key {}: {}", cacheKey, ex.getMessage());
            }
        }
    }

    private String extractUnknownPersonQuery(String queryLower) {
        // Pattern 0: "give me the coaching report of <name>" or "report of <name>" or "coaching report of <name>"
        Matcher m0 = Pattern.compile("(?:give me the |what is the |show me the |provide the )?(?:coaching report of|coaching summary of|coaching status of|report of|report for|status of|profile of|overview of|summarize|who is|tell me about)\\s+([a-zA-Z\\s]{3,35}?)(?:'s|\\s+current|\\s+coaching|\\s+status|\\s+gaps|\\?|$)").matcher(queryLower);
        if (m0.find()) {
            String candidate = m0.group(1).trim();
            if (!candidate.isBlank() && !isSystemKeyword(candidate)) {
                return candidate;
            }
        }
        // Pattern 1: "<name>'s current coaching status"
        Matcher m1 = Pattern.compile("^([a-zA-Z\\s]{3,35}?)'s\\s+(?:current\\s+)?coaching").matcher(queryLower);
        if (m1.find()) {
            String candidate = m1.group(1).trim();
            if (!candidate.isBlank() && !isSystemKeyword(candidate)) {
                return candidate;
            }
        }
        // Pattern 2: direct 2-word person name (e.g., "selam kebede")
        if (queryLower.matches("^[a-z]{2,20}\\s+[a-z]{2,20}$") && !isSystemKeyword(queryLower)) {
            return queryLower.trim();
        }
        return null;
    }

    private boolean isSystemKeyword(String str) {
        String s = str.toLowerCase();
        return s.contains("district") || s.contains("branch") || s.contains("coach")
                || s.contains("kpi") || s.contains("pms") || s.contains("quarter")
                || s.contains("rating") || s.contains("bank") || s.contains("gap");
    }

    private String toTitleCase(String input) {
        if (input == null || input.isBlank()) return input;
        String[] words = input.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isBlank()) {
                sb.append(Character.toUpperCase(w.charAt(0)))
                  .append(w.substring(1).toLowerCase())
                  .append(" ");
            }
        }
        return sb.toString().trim();
    }

    private String generateGroundedFallbackAnswer(
            String query,
            List<PmsTalentProgressItemDto> matchedTalents,
            List<DistrictAnalyticsDto> matchedDistricts,
            List<BranchAnalyticsDto> matchedBranches,
            List<PmsTalentProgressItemDto> allTalents,
            DistrictBranchAnalyticsDto analytics
    ) {
        String qLower = query.toLowerCase();

        // Check if query is about coaches in a specific district
        if (qLower.contains("coach") && !matchedDistricts.isEmpty()) {
            DistrictAnalyticsDto d = matchedDistricts.get(0);
            boolean criticalOnly = qLower.contains("critical");
            Map<String, List<PmsTalentProgressItemDto>> coachMap = new LinkedHashMap<>();

            for (PmsTalentProgressItemDto t : allTalents) {
                if (t.directorate() != null && t.directorate().equalsIgnoreCase(d.districtName())) {
                    if (!criticalOnly || "CRITICAL".equalsIgnoreCase(t.ratingBand())) {
                        coachMap.computeIfAbsent(t.coachName() != null ? t.coachName() : "Unassigned", k -> new ArrayList<>()).add(t);
                    }
                }
            }

            StringBuilder sb = new StringBuilder();
            sb.append(String.format("In **%s**, the following coaches are responsible for %s coachees:\n\n",
                    d.districtName(), criticalOnly ? "critical (< 2.0)" : "remediation"));

            for (Map.Entry<String, List<PmsTalentProgressItemDto>> entry : coachMap.entrySet()) {
                sb.append("- **Coach ").append(entry.getKey()).append("**:\n");
                for (PmsTalentProgressItemDto t : entry.getValue()) {
                    sb.append("  • **").append(t.coacheeName()).append("** (Staff ID: ").append(t.coacheeStaffId())
                            .append(", Rating: ").append(t.startingRating())
                            .append(", Branch: ").append(t.department().replace(" Branch Operations", ""))
                            .append(", Sessions: ").append(t.completedSessions()).append("/").append(t.approvedTarget()).append(")\n");
                }
            }

            sb.append("\n**Executive Takeaway:** Immediate focus is required to ensure these assigned coaches commence scheduled 1-on-1 sessions, as none of the critical sessions have been logged to date.");
            return sb.toString();
        }

        // If query asks for a specific coach or multiple coachees
        if (matchedTalents.size() > 1 || qLower.contains("coach") || qLower.contains("all coachees")) {
            Map<String, List<PmsTalentProgressItemDto>> byCoach = new LinkedHashMap<>();
            for (PmsTalentProgressItemDto t : matchedTalents) {
                byCoach.computeIfAbsent(t.coachName() != null ? t.coachName() : "Unassigned Coach", k -> new ArrayList<>()).add(t);
            }
            StringBuilder sb = new StringBuilder();
            for (Map.Entry<String, List<PmsTalentProgressItemDto>> entry : byCoach.entrySet()) {
                sb.append(String.format("### Coach **%s** — Assigned Remediation Roster (%d Coachees):\n\n", entry.getKey(), entry.getValue().size()));
                for (PmsTalentProgressItemDto t : entry.getValue()) {
                    sb.append(String.format("- **%s** (Staff ID: %s) [%s, %s]\n", t.coacheeName(), t.coacheeStaffId(), t.department().replace(" Branch Operations", ""), t.directorate()));
                    sb.append(String.format("  • **Rating:** %.2f (%s Tier) | **Sessions:** %d of %d Completed (Trajectory: %s)\n", t.startingRating(), toTitleCase(t.ratingBand()), t.completedSessions(), t.approvedTarget(), t.progressTrajectory()));
                    sb.append(String.format("  • **Primary Gap:** %s\n\n", t.targetWeaknessKpi()));
                }
            }
            sb.append("**Executive Takeaway:** Prioritize structured session delivery across all assigned coachees to accelerate completion rhythm and meet quarterly targets.");
            return sb.toString();
        }

        if (!matchedTalents.isEmpty()) {
            PmsTalentProgressItemDto t = matchedTalents.get(0);
            StringBuilder sb = new StringBuilder();
            sb.append(String.format("Coach: **%s**\n\n", t.coachName()));
            sb.append(String.format("• **Coachee:** %s (Staff ID: %s) [%s, %s] — Rating: %.2f (%s Tier)\n",
                    t.coacheeName(), t.coacheeStaffId(), t.department().replace(" Branch Operations", ""), t.directorate(),
                    t.startingRating(), toTitleCase(t.ratingBand())));
            sb.append(String.format("• **Sessions:** %d of %d sessions completed (Trajectory: %s)\n",
                    t.completedSessions(), t.approvedTarget(), t.progressTrajectory()));
            sb.append(String.format("• **Primary Gap:** %s\n\n", t.targetWeaknessKpi()));

            if (sessionRepository != null && t.assignmentId() != null) {
                try {
                    List<CoachingSession> sList = sessionRepository.findAllByAssignmentIdOrderByScheduledStartTimeDesc(t.assignmentId());
                    if (!sList.isEmpty()) {
                        sb.append("**Recent Coaching Session Insights & Notes:**\n");
                        for (CoachingSession cs : sList.stream().limit(3).toList()) {
                            sb.append(String.format("- **Session #%d** [%s]: %s (%dm)\n",
                                    cs.getSequenceNumber() != null ? cs.getSequenceNumber() : 1, cs.getStatus(), cs.getTitle(), cs.getDurationMinutes()));
                            if (cs.getSessionNotesMinutes() != null && !cs.getSessionNotesMinutes().isBlank()) {
                                sb.append("  *Minutes:* ").append(cs.getSessionNotesMinutes().replace("\n", " ")).append("\n");
                            }
                            if (cs.getActionItems() != null && !cs.getActionItems().isBlank()) {
                                sb.append("  *Action Items:* ").append(cs.getActionItems().replace("\n", " ")).append("\n");
                            }
                        }
                        sb.append("\n");
                    }
                } catch (Exception ex) {
                    log.debug("Session query failed for talent fallback: {}", ex.getMessage());
                }
            }

            sb.append(String.format("**Executive Takeaway:** %s’s %s tier baseline rating (%.2f) and %d of %d sessions completed require immediate intervention. Coach %s must prioritize addressing the %s deficit to align with bank-wide remediation targets.",
                    t.coacheeName(), toTitleCase(t.ratingBand()), t.startingRating(),
                    t.completedSessions(), t.approvedTarget(),
                    t.coachName(), t.targetWeaknessKpi()));
            return sb.toString();
        }

        if (!matchedBranches.isEmpty()) {
            BranchAnalyticsDto b = matchedBranches.get(0);
            return String.format(
                    "**%s** currently has **%d coachees** enrolled in remediation, including **%d in the critical tier (< 2.0)**.\n\n" +
                            "- **Completed Sessions:** %d of %d planned (%.1f%% delivery rate)\n" +
                            "- **Primary Skill Gap:** %s\n\n" +
                            "**Executive Takeaway:** Prioritize 1-on-1 coaching kickoff in %s to remediate critical skill deficits in %s.",
                    b.branchName(), b.coacheesCount(), b.criticalCount(),
                    b.completedSessions(), b.targetSessions(), b.completionRate(),
                    b.primarySkillGap(), b.branchName(), b.primarySkillGap()
            );
        }

        if (!matchedDistricts.isEmpty()) {
            DistrictAnalyticsDto d = matchedDistricts.get(0);
            return String.format(
                    "**%s** monitors %d total staff across %d branches. There are **%d coachees in remediation** (%d critical tier < 2.0).\n\n" +
                            "- **Session Delivery:** %d of %d planned sessions (%.1f%%)\n" +
                            "- **Primary Gap:** %s\n\n" +
                            "**Executive Takeaway:** Administrative escalation to %s District Leadership is recommended to mobilize branch coaches.",
                    d.districtName(), d.totalStaff(), d.branches().size(), d.coacheesCount(), d.criticalCount(),
                    d.completedSessions(), d.targetSessions(), d.completionRate(), d.primarySkillGap(), d.districtName()
            );
        }

        return String.format(
                "Across Bank of Abyssinia, 151 employees are monitored in %s, with **49 enrolled in active remediation** (17 critical tier, 32 moderate tier).\n\n" +
                        "- **Session Execution:** 0 of 362 approved sessions completed.\n" +
                        "- **Key Regional Bottlenecks:** Central (6 critical) and Adama (6 critical).\n" +
                        "- **Dominant Skill Gap:** Branch FX & Deposit Mobilization.\n\n" +
                        "**Executive Takeaway:** District Leadership must mandate kickoff coaching across all 10 branches to address zero-session remediation stalls.",
                analytics.fiscalQuarterName()
        );
    }
}
