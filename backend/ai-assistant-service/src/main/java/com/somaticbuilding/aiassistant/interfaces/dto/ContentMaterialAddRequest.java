package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public class ContentMaterialAddRequest {
  @NotEmpty
  private List<@Valid MaterialItem> materials;

  public List<MaterialItem> getMaterials() {
    return materials;
  }

  public void setMaterials(List<MaterialItem> materials) {
    this.materials = materials;
  }

  public static class MaterialItem {
    @NotBlank
    @JsonAlias("asset_type")
    private String assetType;
    @JsonAlias("storage_provider")
    private String storageProvider;
    @JsonAlias("storage_key")
    private String storageKey;
    @JsonAlias("source_url")
    private String sourceUrl;
    @JsonAlias("content_text")
    private String contentText;
    @JsonAlias("duration_sec")
    private BigDecimal durationSec;
    @JsonAlias("metadata")
    private Map<String, Object> metadata;

    public String getAssetType() {
      return assetType;
    }

    public void setAssetType(String assetType) {
      this.assetType = assetType;
    }

    public String getStorageProvider() {
      return storageProvider;
    }

    public void setStorageProvider(String storageProvider) {
      this.storageProvider = storageProvider;
    }

    public String getStorageKey() {
      return storageKey;
    }

    public void setStorageKey(String storageKey) {
      this.storageKey = storageKey;
    }

    public String getSourceUrl() {
      return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
      this.sourceUrl = sourceUrl;
    }

    public String getContentText() {
      return contentText;
    }

    public void setContentText(String contentText) {
      this.contentText = contentText;
    }

    public BigDecimal getDurationSec() {
      return durationSec;
    }

    public void setDurationSec(BigDecimal durationSec) {
      this.durationSec = durationSec;
    }

    public Map<String, Object> getMetadata() {
      return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
      this.metadata = metadata;
    }
  }
}

