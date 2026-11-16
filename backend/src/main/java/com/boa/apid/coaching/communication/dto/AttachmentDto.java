package com.boa.apid.coaching.communication.dto;

import com.boa.apid.coaching.communication.entity.AttachmentScanStatus;

import java.time.Instant;

public class AttachmentDto {
    private Long id;
    private Long messageId;
    private String fileName;
    private String mimeType;
    private long fileSizeBytes;
    private String downloadUrl;
    private AttachmentScanStatus scanStatus;
    private Instant createdAt;

    public AttachmentDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getMessageId() { return messageId; }
    public void setMessageId(Long messageId) { this.messageId = messageId; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public long getFileSizeBytes() { return fileSizeBytes; }
    public void setFileSizeBytes(long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; }
    public String getDownloadUrl() { return downloadUrl; }
    public void setDownloadUrl(String downloadUrl) { this.downloadUrl = downloadUrl; }
    public AttachmentScanStatus getScanStatus() { return scanStatus; }
    public void setScanStatus(AttachmentScanStatus scanStatus) { this.scanStatus = scanStatus; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

