# SomaticBuilding / Physical OS - 建表顺序（含外键依赖）

更新时间：2026-04-06（Asia/Shanghai）

> 说明：按依赖顺序创建，避免外键错误。

1. `user_account`
2. `user_profile`
3. `user_oauth`

4. `assessment_session`
5. `assessment_step`
6. `assessment_test`
7. `assessment_result`
8. `joint_metric`
9. `risk_alert`
10. `posture_snapshot`
11. `posture_joint_state`

12. `exercise`
13. `exercise_tag`
14. `exercise_media`
15. `exercise_tag_map`

16. `exercise_cart`
17. `cart_item`

18. `workout_template`
19. `template_exercise`

20. `workout_session`
21. `workout_block`
22. `workout_group`
23. `workout_exercise`

24. `training_run`
25. `set_log`
26. `timer_log`
27. `exercise_log`

28. `recovery_log`

29. `goal_input`
30. `goal_parsed`

31. `ability_profile`
32. `ability_history`

33. `recommendation`
34. `history_log`

35. `content_analysis_job`
36. `content_analysis_asset`
37. `content_movement_candidate`
38. `content_exercise_mapping`
39. `content_plan_draft`
