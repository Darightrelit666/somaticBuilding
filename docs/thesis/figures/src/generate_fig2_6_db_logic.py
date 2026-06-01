from __future__ import annotations

from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont


OUT_DIR = Path(r"D:\somaticBuilding\docs\thesis\figures")
PNG_OUT = OUT_DIR / "fig2_6_db_logic_relationship.png"
BMP_OUT = OUT_DIR / "fig2_6_db_logic_relationship.bmp"

FONT_CN = r"C:\Windows\Fonts\simsun.ttc"
FONT_EN = r"C:\Windows\Fonts\times.ttf"


def f_cn(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_CN, size=size)


def f_en(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_EN, size=size)


F_GROUP = f_cn(44)
F_TABLE = f_en(36)
F_FIELD = f_en(30)
F_LABEL = f_en(28)
F_NOTE = f_cn(28)

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (88, 88, 88)
G1 = (242, 246, 255)
G2 = (240, 249, 242)
G3 = (255, 249, 238)
G4 = (246, 243, 255)
G5 = (247, 247, 247)


def ts(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    l, t, r, b = draw.multiline_textbbox((0, 0), text, font=font, spacing=4, align="center")
    return r - l, b - t


def ctext(
    draw: ImageDraw.ImageDraw,
    rect: tuple[int, int, int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int] = BLACK,
) -> None:
    x1, y1, x2, y2 = rect
    tw, th = ts(draw, text, font)
    x = x1 + (x2 - x1 - tw) / 2
    y = y1 + (y2 - y1 - th) / 2
    draw.multiline_text((x, y), text, font=font, fill=fill, spacing=4, align="center")


def draw_group(
    draw: ImageDraw.ImageDraw,
    rect: tuple[int, int, int, int],
    title: str,
    fill: tuple[int, int, int],
) -> None:
    x1, y1, x2, y2 = rect
    draw.rounded_rectangle(rect, radius=20, fill=fill, outline=BLACK, width=2)
    draw.rectangle((x1 + 1, y1 + 1, x2 - 1, y1 + 72), fill=WHITE, outline=BLACK, width=2)
    ctext(draw, (x1 + 8, y1 + 6, x2 - 8, y1 + 66), title, F_GROUP)


def draw_table(
    draw: ImageDraw.ImageDraw,
    rect: tuple[int, int, int, int],
    title: str,
    rows: list[str],
) -> dict[str, tuple[int, int]]:
    x1, y1, x2, y2 = rect
    draw.rectangle(rect, fill=WHITE, outline=BLACK, width=2)
    hh = 56
    draw.rectangle((x1 + 1, y1 + 1, x2 - 1, y1 + hh), fill=(236, 236, 236), outline=BLACK, width=2)
    ctext(draw, (x1 + 8, y1 + 6, x2 - 8, y1 + hh - 4), title, F_TABLE)

    n = max(1, len(rows))
    rh = (y2 - y1 - hh - 4) // n
    y = y1 + hh
    for _ in rows:
        y += rh
        draw.line((x1, y, x2, y), fill=(170, 170, 170), width=1)

    y = y1 + hh
    for row in rows:
        _, th = ts(draw, row, F_FIELD)
        draw.text((x1 + 12, y + (rh - th) / 2), row, font=F_FIELD, fill=GRAY)
        y += rh

    return {
        "left": (x1, (y1 + y2) // 2),
        "right": (x2, (y1 + y2) // 2),
        "top": ((x1 + x2) // 2, y1),
        "bottom": ((x1 + x2) // 2, y2),
    }


def arrow(draw: ImageDraw.ImageDraw, p1: tuple[int, int], p2: tuple[int, int], width: int = 3) -> None:
    draw.line([p1, p2], fill=BLACK, width=width)
    x1, y1 = p1
    x2, y2 = p2
    ang = math.atan2(y2 - y1, x2 - x1)
    head = 14
    wing = 6
    pl = (x2 - head * math.cos(ang) + wing * math.sin(ang), y2 - head * math.sin(ang) - wing * math.cos(ang))
    pr = (x2 - head * math.cos(ang) - wing * math.sin(ang), y2 - head * math.sin(ang) + wing * math.cos(ang))
    draw.polygon([p2, pl, pr], fill=BLACK)


def link(
    draw: ImageDraw.ImageDraw,
    p1: tuple[int, int],
    p2: tuple[int, int],
    label: str,
) -> None:
    arrow(draw, p1, p2, 3)
    tw, th = ts(draw, label, F_LABEL)
    mx = (p1[0] + p2[0]) / 2
    my = (p1[1] + p2[1]) / 2 - th - 4
    draw.rectangle((mx - tw / 2 - 4, my - 2, mx + tw / 2 + 4, my + th + 2), fill=WHITE)
    draw.text((mx - tw / 2, my), label, font=F_LABEL, fill=BLACK)


def elbow(
    draw: ImageDraw.ImageDraw,
    p1: tuple[int, int],
    mid_x: int,
    p2: tuple[int, int],
    label: str,
) -> None:
    x1, y1 = p1
    x2, y2 = p2
    draw.line((x1, y1, mid_x, y1), fill=BLACK, width=3)
    draw.line((mid_x, y1, mid_x, y2), fill=BLACK, width=3)
    arrow(draw, (mid_x, y2), (x2, y2), 3)
    tw, th = ts(draw, label, F_LABEL)
    lx = mid_x - tw / 2
    ly = min(y1, y2) - th - 6
    draw.rectangle((lx - 4, ly - 2, lx + tw + 4, ly + th + 2), fill=WHITE)
    draw.text((lx, ly), label, font=F_LABEL, fill=BLACK)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (3000, 2300), WHITE)
    d = ImageDraw.Draw(img)

    # main 2x2 groups
    g1 = (60, 60, 1450, 1010)
    g2 = (1550, 60, 2940, 1010)
    g3 = (60, 1080, 1450, 1960)
    g4 = (1550, 1080, 2940, 1960)
    draw_group(d, g1, "账户与画像", G1)
    draw_group(d, g2, "评估与体态", G2)
    draw_group(d, g3, "动作与编排", G3)
    draw_group(d, g4, "执行与反馈", G4)

    ua = draw_table(d, (120, 170, 740, 500), "user_account", ["PK id", "email", "status"])
    up = draw_table(d, (780, 170, 1390, 500), "user_profile", ["PK id", "FK user_id", "train_level"])
    ap = draw_table(d, (120, 560, 740, 920), "ability_profile", ["PK id", "FK user_id", "mobility_score"])
    ah = draw_table(d, (780, 560, 1390, 920), "ability_history", ["PK id", "FK user_id", "snapshot_date"])

    asn = draw_table(d, (1610, 170, 2250, 500), "assessment_session", ["PK id", "FK user_id", "status"])
    ar = draw_table(d, (2300, 170, 2880, 500), "assessment_result", ["PK id", "FK session_id", "score"])
    ps = draw_table(d, (1900, 560, 2650, 920), "posture_snapshot", ["PK id", "FK session_id", "risk_level"])

    ex = draw_table(d, (120, 1180, 700, 1500), "exercise", ["PK id", "name", "difficulty"])
    wt = draw_table(d, (740, 1180, 1390, 1500), "workout_template", ["PK id", "goal_type", "level"])
    te = draw_table(d, (400, 1560, 1080, 1900), "template_exercise", ["PK id", "FK template_id", "FK exercise_id"])
    ws = draw_table(d, (1120, 1560, 1390, 1900), "workout_session", ["PK id", "FK user_id", "FK template_id"])

    tr = draw_table(d, (1610, 1180, 2260, 1500), "training_run", ["PK id", "FK session_id", "FK user_id"])
    sl = draw_table(d, (2300, 1180, 2880, 1500), "set_log", ["PK id", "FK run_id", "FK exercise_id"])
    hl = draw_table(d, (1910, 1560, 2560, 1900), "history_log", ["PK id", "FK user_id", "event_type"])

    # relations
    link(d, ua["right"], up["left"], "1:1")
    link(d, ua["bottom"], ap["top"], "1:1")
    link(d, up["bottom"], ah["top"], "1:N")

    link(d, asn["right"], ar["left"], "1:N")
    link(d, asn["bottom"], ps["top"], "1:N")

    link(d, wt["bottom"], te["top"], "1:N")
    link(d, ex["bottom"], te["left"], "1:N")
    link(d, wt["right"], ws["top"], "1:N")

    link(d, tr["right"], sl["left"], "1:N")
    link(d, tr["bottom"], hl["top"], "1:N")

    elbow(d, ua["right"], 1500, asn["left"], "1:N")
    elbow(d, ua["bottom"], 1500, ws["left"], "1:N")
    elbow(d, ws["right"], 1500, tr["left"], "1:N")
    elbow(d, ar["bottom"], 2820, hl["right"], "回写")

    # content-analysis strip (no "新增" wording)
    ext = (60, 2010, 2940, 2230)
    draw_group(d, ext, "内容解析链路关键表", G5)
    boxes = [
        (120, 2100, 640, 2210, "content_analysis_job"),
        (690, 2100, 1210, 2210, "content_analysis_asset"),
        (1260, 2100, 1840, 2210, "content_movement_candidate"),
        (1890, 2100, 2460, 2210, "content_exercise_mapping"),
        (2510, 2100, 2880, 2210, "content_plan_draft"),
    ]
    for x1, y1, x2, y2, t in boxes:
        d.rectangle((x1, y1, x2, y2), fill=WHITE, outline=BLACK, width=2)
        ctext(d, (x1 + 8, y1 + 8, x2 - 8, y2 - 8), t, f_en(24), GRAY)
    for i in range(len(boxes) - 1):
        x1 = boxes[i][2]
        y1 = (boxes[i][1] + boxes[i][3]) // 2
        x2 = boxes[i + 1][0]
        y2 = (boxes[i + 1][1] + boxes[i + 1][3]) // 2
        arrow(d, (x1, y1), (x2, y2), 3)

    # concise legend
    d.rectangle((60, 2240, 2940, 2290), fill=WHITE, outline=BLACK, width=2)
    ctext(d, (80, 2246, 2920, 2286), "注：PK 表示主键，FK 表示外键，关系标注采用 1:1 与 1:N。", F_NOTE, GRAY)

    img.save(PNG_OUT, format="PNG", compress_level=0, optimize=False)
    img.save(BMP_OUT, format="BMP")
    print(str(PNG_OUT))
    print(str(BMP_OUT))


if __name__ == "__main__":
    main()
