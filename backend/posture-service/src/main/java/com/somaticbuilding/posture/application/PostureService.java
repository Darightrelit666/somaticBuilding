package com.somaticbuilding.posture.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.somaticbuilding.posture.domain.PostureJointState;
import com.somaticbuilding.posture.domain.PostureSnapshot;
import com.somaticbuilding.posture.infrastructure.mapper.PostureJointStateMapper;
import com.somaticbuilding.posture.infrastructure.mapper.PostureSnapshotMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class PostureService {
  private final PostureSnapshotMapper snapshotMapper;
  private final PostureJointStateMapper jointStateMapper;

  public PostureService(PostureSnapshotMapper snapshotMapper, PostureJointStateMapper jointStateMapper) {
    this.snapshotMapper = snapshotMapper;
    this.jointStateMapper = jointStateMapper;
  }

  @Transactional
  public PostureSnapshot createSnapshot(Long sessionId, String summary, List<PostureJointState> joints) {
    LocalDateTime now = LocalDateTime.now();
    PostureSnapshot snapshot = new PostureSnapshot();
    snapshot.setSessionId(sessionId);
    snapshot.setSnapshotTime(now);
    snapshot.setSummary(summary);
    snapshot.setIsDeleted(0);
    snapshot.setCreateTime(now);
    snapshot.setUpdateTime(now);
    snapshotMapper.insert(snapshot);
    if (joints != null) {
      for (PostureJointState joint : joints) {
        joint.setSnapshotId(snapshot.getId());
        joint.setIsDeleted(0);
        joint.setCreateTime(now);
        joint.setUpdateTime(now);
        jointStateMapper.insert(joint);
      }
    }
    return snapshot;
  }

  public List<PostureSnapshot> listSnapshots(Long sessionId) {
    return snapshotMapper.selectList(
      new LambdaQueryWrapper<PostureSnapshot>()
        .eq(PostureSnapshot::getSessionId, sessionId)
        .eq(PostureSnapshot::getIsDeleted, 0)
        .orderByDesc(PostureSnapshot::getSnapshotTime)
    );
  }

  public List<PostureJointState> listJointStates(List<Long> snapshotIds) {
    if (snapshotIds == null || snapshotIds.isEmpty()) {
      return new ArrayList<>();
    }
    return jointStateMapper.selectList(
      new LambdaQueryWrapper<PostureJointState>()
        .in(PostureJointState::getSnapshotId, snapshotIds)
        .eq(PostureJointState::getIsDeleted, 0)
    );
  }
}
