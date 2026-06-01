package com.somaticbuilding.aiassistant.interfaces.dto;

import java.util.ArrayList;
import java.util.List;

public class GoalSynthesisResponse {
  private String summary;
  private String recommendation;
  private List<RadarMetric> radar = new ArrayList<>();
  private List<GoalTarget> targets = new ArrayList<>();

  public String getSummary() {
    return summary;
  }

  public void setSummary(String summary) {
    this.summary = summary;
  }

  public String getRecommendation() {
    return recommendation;
  }

  public void setRecommendation(String recommendation) {
    this.recommendation = recommendation;
  }

  public List<RadarMetric> getRadar() {
    return radar;
  }

  public void setRadar(List<RadarMetric> radar) {
    this.radar = radar;
  }

  public List<GoalTarget> getTargets() {
    return targets;
  }

  public void setTargets(List<GoalTarget> targets) {
    this.targets = targets;
  }

  public static class RadarMetric {
    private String subject;
    private Integer score;
    private Integer fullMark;

    public String getSubject() {
      return subject;
    }

    public void setSubject(String subject) {
      this.subject = subject;
    }

    public Integer getScore() {
      return score;
    }

    public void setScore(Integer score) {
      this.score = score;
    }

    public Integer getFullMark() {
      return fullMark;
    }

    public void setFullMark(Integer fullMark) {
      this.fullMark = fullMark;
    }
  }

  public static class GoalTarget {
    private String label;
    private Integer score;
    private String level;

    public String getLabel() {
      return label;
    }

    public void setLabel(String label) {
      this.label = label;
    }

    public Integer getScore() {
      return score;
    }

    public void setScore(Integer score) {
      this.score = score;
    }

    public String getLevel() {
      return level;
    }

    public void setLevel(String level) {
      this.level = level;
    }
  }
}
