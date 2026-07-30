from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
OUT = ROOT / 'sagemro-工程师招募海报.pdf'
PREVIEW = ROOT / 'sagemro-工程师招募海报-preview.png'
W, H = 2480, 3508  # A4 at 300 dpi
NAVY, NAVY2, INK = '#081522', '#0e2335', '#10202b'
ORANGE, CREAM, MUTED, PAPER, GRID = '#f59e0b', '#fff8ec', '#a8bbc5', '#f7f2e9', '#193244'

def F(size, bold=False, latin=False):
    if latin:
        path = '/Users/joe/.agents/skills/canvas-design/canvas-fonts/WorkSans-Bold.ttf' if bold else '/Users/joe/.agents/skills/canvas-design/canvas-fonts/WorkSans-Regular.ttf'
        return ImageFont.truetype(path, size)
    return ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', size, index=5 if bold else 2)

im = Image.new('RGB', (W,H), NAVY); d = ImageDraw.Draw(im)
def rect(box, fill, radius=0, outline=None, width=1): d.rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)
def tx(x,y,s,size,fill=CREAM,bold=False,latin=False,anchor=None): d.text((x,y),s,font=F(size,bold,latin),fill=fill,anchor=anchor)
def line(x1,y1,x2,y2,fill,width=1): d.line((x1,y1,x2,y2),fill=fill,width=width)
def wrap(x,y,s,maxw,size,leading,fill=CREAM,bold=False):
    font=F(size,bold); current=''; yy=y
    for char in s:
        test=current+char
        if d.textlength(test,font=font)>maxw and current:
            d.text((x,yy),current,font=font,fill=fill); yy+=leading; current=char
        else: current=test
    if current: d.text((x,yy),current,font=font,fill=fill); yy+=leading
    return yy

# disciplined technical grid
for x in range(-200,W+220,76): line(x,0,x+520,H,GRID,2)
for y in range(0,H+100,132): line(0,y,W,y+360,GRID,2)

# Header
rect((138,188,214,200),ORANGE); tx(250,166,'SAGEMRO',44,bold=True,latin=True)
tx(250,233,'认证服务代表网络',24,MUTED)
tx(2180,188,'中国 · 2026',25,MUTED,anchor='ra')

# A disciplined service-network map: four clear modules around one shared center.
vx, vy, vw, vh = 1565, 505, 710, 830
rect((vx, vy, vx+vw, vy+vh), '#0b1b28', 16, outline='#315064', width=4)
tx(vx+55, vy+48, '服务协作网络', 29, MUTED, bold=True)
tx(vx+vw-55, vy+52, '清晰连接 · 统一记录', 20, '#6f8c9b', anchor='ra')

# Fine construction grid kept inside the diagram only.
for gx in range(vx+55, vx+vw-35, 100):
    line(gx, vy+105, gx, vy+vh-52, '#173143', 2)
for gy in range(vy+115, vy+vh-40, 100):
    line(vx+45, gy, vx+vw-45, gy, '#173143', 2)

card_w, card_h = 210, 150
left_x, right_x = vx+72, vx+vw-72-card_w
top_y, bottom_y = vy+155, vy+vh-155-card_h
center_x, center_y = vx+vw//2, vy+vh//2+12

# Orthogonal links are drawn before the modules, so every junction stays crisp.
line(left_x+card_w, top_y+card_h//2, center_x, top_y+card_h//2, '#527284', 5)
line(center_x, top_y+card_h//2, center_x, center_y, '#527284', 5)
line(right_x, top_y+card_h//2, center_x, top_y+card_h//2, '#527284', 5)
line(left_x+card_w, bottom_y+card_h//2, center_x, bottom_y+card_h//2, '#527284', 5)
line(center_x, center_y, center_x, bottom_y+card_h//2, '#527284', 5)
line(right_x, bottom_y+card_h//2, center_x, bottom_y+card_h//2, '#527284', 5)

modules = [
    (left_x, top_y, '工程师', '专业经验'),
    (right_x, top_y, '设备', '现场信息'),
    (left_x, bottom_y, '工单', '明确边界'),
    (right_x, bottom_y, '记录', '持续沉淀'),
]
for x, y, title, note in modules:
    rect((x, y, x+card_w, y+card_h), '#163346', 12, outline='#527284', width=3)
    d.ellipse((x+24, y+28, x+54, y+58), fill='#6f8c9b')
    tx(x+70, y+25, title, 31, CREAM, bold=True)
    tx(x+25, y+91, note, 21, MUTED)

# Shared center: the only saturated node, representing coordinated service.
d.ellipse((center_x-86, center_y-86, center_x+86, center_y+86), fill='#102a3a', outline=ORANGE, width=7)
d.ellipse((center_x-43, center_y-43, center_x+43, center_y+43), fill=ORANGE)
tx(center_x, center_y-17, 'AI', 22, INK, bold=True, latin=True, anchor='mm')
tx(center_x, center_y+18, '协作', 21, INK, bold=True, anchor='mm')
for x, y in ((center_x, top_y+card_h//2), (center_x, bottom_y+card_h//2),
             (left_x+card_w, top_y+card_h//2), (right_x, top_y+card_h//2),
             (left_x+card_w, bottom_y+card_h//2), (right_x, bottom_y+card_h//2)):
    d.ellipse((x-8, y-8, x+8, y+8), fill=ORANGE)

# Hero
tx(138,604,'SAGEMRO 认证服务代表招募',37,ORANGE,bold=True)
tx(138,746,'你的现场经验，',92,bold=True); tx(138,870,'值得被专业对待',92,bold=True)
wrap(138,1004,'我们正在招募真正理解设备问题、现场状况与客户需求的服务工程师，加入激光切割、折弯与钣金设备的认证服务代表网络。',1380,32,54,MUTED)
rect((138,1218,338,1276),ORANGE,29)
tx(238,1247,'招募对象',28,INK,bold=True,anchor='mm')
tx(138,1325,'激光切割机  ·  折弯机  ·  钣金设备',48,bold=True)
tx(138,1392,'有一线维修、调试、故障排查或维护保养经验的工程师',29,MUTED)

# Benefit cards
cards=[('01','派工前资料更完整','清楚了解设备背景、客户现象和已有记录，让判断从信息充分开始。'),('02','减少无效反复沟通','报价边界、服务记录与协作信息沉淀在同一流程，现场更专注。'),('03','专业投入获得回报','清晰合作规则与有竞争力的服务回报，长期可靠者可成长为区域伙伴。')]
cy0,ch,gap=1630,375,30; cw=(W-276-2*gap)//3
for i,(num,title,body) in enumerate(cards):
    x=138+i*(cw+gap); rect((x,cy0,x+cw,cy0+ch),NAVY2,24)
    d.ellipse((x+38,cy0+38,x+102,cy0+102),fill=ORANGE); tx(x+70,cy0+70,num,19,INK,bold=True,latin=True,anchor='mm')
    tx(x+35,cy0+140,title,36,bold=True); wrap(x+35,cy0+204,body,cw-70,25,39,MUTED)

# Process card
py,ph=2110,500; rect((138,py,W-138,py+ph),PAPER,28)
tx(183,py+65,'基本合作流程',53,INK,bold=True); tx(183,py+137,'不是简单“接单”，而是从匹配到记录的清晰协作。',28,'#56646a')
steps=[('01','提交申请'),('02','人工审核'),('03','匹配服务机会'),('04','确认方案后服务'),('05','长期合作')]
sx,sy=214,py+307; unit=(W-428)//4
for i,(num,label) in enumerate(steps):
    x=sx+i*unit; fill=ORANGE if i==0 else INK
    d.ellipse((x-35,sy-35,x+35,sy+35),fill=fill); tx(x,sy,num,18,CREAM,bold=True,latin=True,anchor='mm')
    if i<4: line(x+48,sy,x+unit-48,sy,'#b7c0c1',4)
    tx(x,sy+75,label,24,INK,anchor='ma')

# Action strip
ay,ah=2735,610; rect((138,ay,W-138,ay+ah),ORANGE,28)
tx(184,ay+94,'把专业留在现场，',68,INK,bold=True); tx(184,ay+184,'也让专业走得更远。',68,INK,bold=True)
tx(184,ay+356,'扫码查看完整合作说明',34,INK,bold=True); tx(184,ay+416,'确认有兴趣后，可在线提交申请。',30,'#4a3211')
rect((1840,ay+85,2265,ay+510),CREAM,24)
qr=Image.open(ROOT/'application-qr.png').convert('RGB').resize((355,355),Image.Resampling.NEAREST)
im.paste(qr,(1875,ay+120))
tx(2052,ay+535,'扫码了解详情 · 再决定是否申请',24,INK,bold=True,anchor='ma')

im.save(PREVIEW,quality=95)
im.save(OUT,'PDF',resolution=300.0,title='SAGEMRO 工程师招募海报',author='SAGEMRO')
print(OUT)
