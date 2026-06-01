from __future__ import annotations

from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont


OUT_DIR = Path(r"D:\somaticBuilding\docs\thesis\figures")

FONT_CN = r"C:\Windows\Fonts\simsun.ttc"


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_CN, size=size)


F_TITLE = font(44)
F_SUB = font(32)
F_LABEL = font(30)
F_SMALL = font(28)

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (92, 92, 92)
BLUE = (236, 244, 255)
GREEN = (236, 248, 238)
ORANGE = (255, 247, 234)
PANEL = (244, 244, 244)


def text_size(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont) -> tuple[int, int]:
    l, t, r, b = draw.multiline_textbbox((0, 0), text, font=f, spacing=4, align="center")
    return r - l, b - t


def draw_center_text(
    draw: ImageDraw.ImageDraw,
    rect: tuple[int, int, int, int],
    text: str,
    f: ImageFont.FreeTypeFont,
    color: tuple[int, int, int] = BLACK,
) -> None:
    x1, y1, x2, y2 = rect
    tw, th = text_size(draw, text, f)
    x = x1 + (x2 - x1 - tw) / 2
    y = y1 + (y2 - y1 - th) / 2
    draw.multiline_text((x, y), text, font=f, fill=color, spacing=4, align="center")


def draw_box(
    draw: ImageDraw.ImageDraw,
    rect: tuple[int, int, int, int],
    title: str,
    subtitle: str = "",
    fill: tuple[int, int, int] = PANEL,
) -> None:
    x1, y1, x2, y2 = rect
    draw.rectangle(rect, fill=fill, outline=BLACK, width=3)
    draw_center_text(draw, (x1 + 10, y1 + 10, x2 - 10, y1 + 80), title, F_TITLE)
    if subtitle:
        draw_center_text(draw, (x1 + 16, y1 + 92, x2 - 16, y2 - 10), subtitle, F_SUB, GRAY)


def arrow(
    draw: ImageDraw.ImageDraw,
    p1: tuple[int, int],
    p2: tuple[int, int],
    label: str = "",
    color: tuple[int, int, int] = BLACK,
    width: int = 4,
) -> None:
    draw.line([p1, p2], fill=color, width=width)
    x1, y1 = p1
    x2, y2 = p2
    ang = math.atan2(y2 - y1, x2 - x1)
    head = 16
    wing = 7
    pl = (x2 - head * math.cos(ang) + wing * math.sin(ang), y2 - head * math.sin(ang) - wing * math.cos(ang))
    pr = (x2 - head * math.cos(ang) - wing * math.sin(ang), y2 - head * math.sin(ang) + wing * math.cos(ang))
    draw.polygon([p2, pl, pr], fill=color)
    if label:
        tw, th = text_size(draw, label, F_SMALL)
        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2
        draw.rectangle((mx - tw / 2 - 4, my - th / 2 - 4, mx + tw / 2 + 4, my + th / 2 + 4), fill=WHITE)
        draw.multiline_text((mx - tw / 2, my - th / 2), label, font=F_SMALL, fill=BLACK, spacing=4, align="center")


def save_png(img: Image.Image, name: str) -> None:
    out = OUT_DIR / name
    img.save(out, format="PNG", optimize=False, compress_level=0)


def fig2_7_service_topology() -> None:
    img = Image.new("RGB", (2400, 1320), WHITE)
    d = ImageDraw.Draw(img)

    draw_box(d, (70, 110, 500, 280), "前端入口", "登录 / 首页", BLUE)
    draw_box(d, (70, 330, 500, 500), "目标与评估", "目标解析 / FMS", BLUE)
    draw_box(d, (70, 550, 500, 720), "训练中心", "模板 / 模块 / 执行", BLUE)
    draw_box(d, (70, 770, 500, 940), "成长画像", "目标进度 / 可视化", BLUE)

    draw_box(d, (640, 480, 1060, 740), "网关与应用壳", "鉴权 / 路由 / 状态同步", PANEL)

    draw_box(d, (1220, 70, 1840, 200), "用户与认证服务", "用户信息、登录态、权限", GREEN)
    draw_box(d, (1220, 230, 1840, 360), "AI助手服务", "目标解析、外链识别、建议生成", GREEN)
    draw_box(d, (1220, 390, 1840, 520), "评估与体态服务", "评估流程、体态分析、风险提示", GREEN)
    draw_box(d, (1220, 550, 1840, 680), "训练编排服务", "周计划、模块编排、执行入口", GREEN)
    draw_box(d, (1220, 710, 1840, 840), "动作库服务", "动作检索、动作属性、媒体索引", GREEN)
    draw_box(d, (1220, 870, 1840, 1000), "画像与反馈服务", "成长曲线、建议回写、阶段复盘", GREEN)

    draw_box(d, (1940, 230, 2330, 370), "MySQL", "业务主数据", ORANGE)
    draw_box(d, (1940, 430, 2330, 570), "Redis", "会话与热点缓存", ORANGE)
    draw_box(d, (1940, 630, 2330, 770), "对象存储", "图片 / 视频封面", ORANGE)
    draw_box(d, (1940, 830, 2330, 970), "AI模型侧", "目标与课程语义处理", ORANGE)

    arrow(d, (500, 190), (640, 560), "统一入口")
    arrow(d, (500, 420), (640, 600), "目标与评估请求")
    arrow(d, (500, 640), (640, 640), "训练请求")
    arrow(d, (500, 860), (640, 680), "画像查询")

    arrow(d, (1060, 540), (1220, 130), "鉴权")
    arrow(d, (1060, 570), (1220, 300), "AI解析")
    arrow(d, (1060, 600), (1220, 460), "评估")
    arrow(d, (1060, 630), (1220, 620), "编排")
    arrow(d, (1060, 660), (1220, 780), "动作检索")
    arrow(d, (1060, 690), (1220, 940), "画像回读")

    arrow(d, (1840, 130), (1940, 300), "读写")
    arrow(d, (1840, 300), (1940, 900), "调用")
    arrow(d, (1840, 460), (1940, 300), "写入")
    arrow(d, (1840, 620), (1940, 300), "写入")
    arrow(d, (1840, 620), (1940, 500), "缓存")
    arrow(d, (1840, 780), (1940, 700), "索引")
    arrow(d, (1840, 940), (1940, 300), "回写")

    save_png(img, "fig2_7_service_topology.png")


def draw_lifelines(
    d: ImageDraw.ImageDraw,
    names: list[str],
    top: int,
    bottom: int,
    start_x: int,
    gap: int,
) -> list[int]:
    xs: list[int] = []
    for i, name in enumerate(names):
        x = start_x + i * gap
        xs.append(x)
        d.rectangle((x - 120, top, x + 120, top + 84), fill=PANEL, outline=BLACK, width=2)
        draw_center_text(d, (x - 112, top + 6, x + 112, top + 78), name, F_SMALL)
        y = top + 84
        while y < bottom:
            d.line((x, y, x, min(y + 12, bottom)), fill=BLACK, width=2)
            y += 22
    return xs


def seq(
    d: ImageDraw.ImageDraw,
    x1: int,
    x2: int,
    y: int,
    text: str,
    dashed: bool = False,
) -> None:
    if x1 == x2:
        loop_w = 58
        loop_h = 36
        d.line((x1, y, x1 + loop_w, y), fill=BLACK, width=3)
        d.line((x1 + loop_w, y, x1 + loop_w, y + loop_h), fill=BLACK, width=3)
        d.line((x1 + loop_w, y + loop_h, x1, y + loop_h), fill=BLACK, width=3)
        d.polygon([(x1, y + loop_h), (x1 + 14, y + loop_h - 7), (x1 + 14, y + loop_h + 7)], fill=BLACK)
        tw, th = text_size(d, text, F_SMALL)
        d.rectangle((x1 + loop_w + 8, y - th / 2 - 4, x1 + loop_w + tw + 16, y + th / 2 + 4), fill=WHITE)
        d.text((x1 + loop_w + 12, y - th / 2), text, font=F_SMALL, fill=BLACK)
        return

    if dashed:
        step = 18
        a, b = (x1, x2) if x1 < x2 else (x2, x1)
        cur = a
        while cur < b:
            d.line((cur, y, min(cur + 9, b), y), fill=BLACK, width=2)
            cur += step
    else:
        d.line((x1, y, x2, y), fill=BLACK, width=3)

    if x2 >= x1:
        d.polygon([(x2, y), (x2 - 16, y - 7), (x2 - 16, y + 7)], fill=BLACK)
    else:
        d.polygon([(x2, y), (x2 + 16, y - 7), (x2 + 16, y + 7)], fill=BLACK)

    tw, th = text_size(d, text, F_SMALL)
    mx = (x1 + x2) / 2
    d.rectangle((mx - tw / 2 - 4, y - th - 12, mx + tw / 2 + 4, y - 2), fill=WHITE)
    d.text((mx - tw / 2, y - th - 10), text, font=F_SMALL, fill=BLACK)


def fig3_2_builder_writeback() -> None:
    img = Image.new("RGB", (2400, 1240), WHITE)
    d = ImageDraw.Draw(img)

    names = ["用户", "前端训练页", "网关", "编排服务", "训练服务", "画像服务", "MySQL"]
    xs = draw_lifelines(d, names, top=70, bottom=1180, start_x=170, gap=340)

    seq(d, xs[0], xs[1], 210, "发起训练")
    seq(d, xs[1], xs[2], 275, "提交模块与目标")
    seq(d, xs[2], xs[3], 340, "创建训练会话")
    seq(d, xs[3], xs[6], 410, "写入会话与计划")
    seq(d, xs[6], xs[3], 475, "返回会话ID", dashed=True)
    seq(d, xs[3], xs[4], 540, "下发执行上下文")
    seq(d, xs[4], xs[6], 610, "按组写入执行日志")
    seq(d, xs[1], xs[2], 680, "上传完成数据")
    seq(d, xs[2], xs[4], 750, "触发统计与归档")
    seq(d, xs[4], xs[5], 820, "提交能力变化量")
    seq(d, xs[5], xs[6], 890, "回写画像快照")
    seq(d, xs[6], xs[5], 960, "返回最新画像", dashed=True)
    seq(d, xs[5], xs[1], 1030, "返回成长曲线数据")
    seq(d, xs[1], xs[0], 1100, "展示训练反馈")

    save_png(img, "fig3_2_builder_writeback.png")


def fig3_3_link_to_plan_sequence() -> None:
    img = Image.new("RGB", (2400, 1240), WHITE)
    d = ImageDraw.Draw(img)

    names = ["用户", "前端外链入口", "链接解析服务", "推荐与编排服务", "训练模块服务", "画像/目标服务"]
    xs = draw_lifelines(d, names, top=70, bottom=1180, start_x=170, gap=340)

    seq(d, xs[0], xs[1], 210, "提交视频链接")
    seq(d, xs[1], xs[2], 275, "请求解析链接内容")
    seq(d, xs[2], xs[2], 340, "抽取标题/标签/时长")
    seq(d, xs[2], xs[3], 405, "传递结构化特征")
    seq(d, xs[3], xs[5], 470, "读取当前目标与能力")
    seq(d, xs[5], xs[3], 535, "返回目标约束", dashed=True)
    seq(d, xs[3], xs[4], 600, "生成候选模块组合")
    seq(d, xs[4], xs[3], 665, "返回可执行模块", dashed=True)
    seq(d, xs[3], xs[1], 730, "返回推荐方案")
    seq(d, xs[1], xs[0], 795, "展示候选计划")
    seq(d, xs[0], xs[1], 860, "确认并应用计划")
    seq(d, xs[1], xs[4], 925, "创建训练任务")
    seq(d, xs[4], xs[5], 990, "记录计划应用结果")
    seq(d, xs[5], xs[1], 1060, "返回更新后的目标进度", dashed=True)

    save_png(img, "fig3_3_link_to_plan_sequence.png")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fig2_7_service_topology()
    fig3_2_builder_writeback()
    fig3_3_link_to_plan_sequence()
    print(str(OUT_DIR))


if __name__ == "__main__":
    main()
