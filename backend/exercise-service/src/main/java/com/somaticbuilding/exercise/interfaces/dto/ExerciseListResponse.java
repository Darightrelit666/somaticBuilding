package com.somaticbuilding.exercise.interfaces.dto;

import java.util.List;

public class ExerciseListResponse {
  private List<ExerciseListItem> list;
  private int page;
  private int pageSize;
  private long total;

  public List<ExerciseListItem> getList() {
    return list;
  }

  public void setList(List<ExerciseListItem> list) {
    this.list = list;
  }

  public int getPage() {
    return page;
  }

  public void setPage(int page) {
    this.page = page;
  }

  public int getPageSize() {
    return pageSize;
  }

  public void setPageSize(int pageSize) {
    this.pageSize = pageSize;
  }

  public long getTotal() {
    return total;
  }

  public void setTotal(long total) {
    this.total = total;
  }
}
