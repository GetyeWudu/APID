package com.boa.apid.common.storage;

import java.util.Set;

/**
 * Defines allowed file extensions, size limits, and storage subfolders per upload purpose.
 */
public enum FilePurpose {
    PMS_REPORT("COACHING", "pms-reports", 25L * 1024 * 1024, Set.of("xlsx")),
    SKILL_DEV_DOC("COACHING", "skill-dev-docs", 10L * 1024 * 1024, Set.of("pdf", "docx", "xlsx", "png", "jpg", "jpeg")),
    COACHING_RESOURCE("COACHING", "coaching-resources", 25L * 1024 * 1024, Set.of("pdf", "pptx", "docx", "xlsx", "png", "jpg", "jpeg")),
    TRAINER_CERT("MENTORING", "trainer-certs", 10L * 1024 * 1024, Set.of("pdf", "png", "jpg", "jpeg", "docx")),
    MENTORING_RESOURCE("MENTORING", "mentoring-resources", 25L * 1024 * 1024, Set.of("pdf", "pptx", "docx", "xlsx", "png", "jpg", "jpeg")),
    CHAT_ATTACHMENT("SHARED", "chat-attachments", 10L * 1024 * 1024, Set.of("pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg")),
    HIERARCHY_CSV("CORE", "hierarchy-imports", 10L * 1024 * 1024, Set.of("csv", "xlsx"));

    private final String module;
    private final String folder;
    private final long maxSizeBytes;
    private final Set<String> allowedExtensions;

    FilePurpose(String module, String folder, long maxSizeBytes, Set<String> allowedExtensions) {
        this.module = module;
        this.folder = folder;
        this.maxSizeBytes = maxSizeBytes;
        this.allowedExtensions = allowedExtensions;
    }

    public String getModule() { return module; }
    public String getFolder() { return folder; }
    public long getMaxSizeBytes() { return maxSizeBytes; }
    public Set<String> getAllowedExtensions() { return allowedExtensions; }
}

