package com.somaticbuilding.assessment.interfaces.dto;

public class JointMetricResponse {
  private String joint;
  private Integer mobility;
  private Integer stability;
  private Integer motorControl;
  private Integer status;

  public String getJoint() {
    return joint;
  }

  public void setJoint(String joint) {
    this.joint = joint;
  }

  public Integer getMobility() {
    return mobility;
  }

  public void setMobility(Integer mobility) {
    this.mobility = mobility;
  }

  public Integer getStability() {
    return stability;
  }

  public void setStability(Integer stability) {
    this.stability = stability;
  }

  public Integer getMotorControl() {
    return motorControl;
  }

  public void setMotorControl(Integer motorControl) {
    this.motorControl = motorControl;
  }

  public Integer getStatus() {
    return status;
  }

  public void setStatus(Integer status) {
    this.status = status;
  }
}
