from pathlib import Path

p = Path('greenlife-map-v16.html')
s = p.read_text(encoding='utf-8')
assert s.count('id="green-travel-links"') == 1
assert 'id="greenlife-related-links-interactive"' not in s
assert Path('assets/greenlife-related-links.jpg').exists()

links = [
    ('環保集點','https://www.greenpoint.org.tw/',20.2,22.7,12.2,28.8),
    ('資源回收網','https://recycle.moenv.gov.tw/',33.2,22.7,12.2,28.8),
    ('奉茶','https://www.circuplus.org/water-refill-map/',46.2,22.7,12.3,28.8),
    ('環境衛生管理資訊系統','https://esms.moenv.gov.tw/',59.3,22.7,12.9,28.8),
    ('環境智能儀表板','https://env.moenv.gov.tw/',72.9,22.7,12.5,28.8),
    ('環境探索館','https://eeis.moenv.gov.tw/front/',86.2,22.7,12.0,28.8),
    ('低碳永續家園','https://lcss.moenv.gov.tw/',21.5,56.9,13.9,29.2),
    ('產品碳足跡資訊網','https://cfp.moenv.gov.tw/WebPage/Index.aspx',36.1,56.9,13.2,29.2),
    ('海岸清理資訊平台','https://ecolife2.moenv.gov.tw/',50.1,56.9,14.2,29.2),
    ('源頭減量生活行動網','https://sup.moenv.gov.tw/',65.3,56.9,14.4,29.2),
    ('循環採購推動媒合平台','https://tcpip.moenv.gov.tw/',80.6,56.9,16.2,29.2),
]

hotspots = '\n'.join(
    f'<a class="greenlife-related-hotspot" href="{url}" target="_blank" rel="noopener" aria-label="{name}" title="{name}" style="left:{x}%;top:{y}%;width:{w}%;height:{h}%"></a>'
    for name,url,x,y,w,h in links
)

block = f'''\n\n<section class="panel" id="greenlife-related-links-interactive">
<style id="greenlife-related-links-style-20261004">
.greenlife-related-scroll{{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:14px;border-radius:18px}}
.greenlife-related-stage{{position:relative;width:100%;min-width:960px;line-height:0}}
.greenlife-related-stage img{{display:block;width:100%;height:auto;border-radius:18px}}
.greenlife-related-hotspot{{position:absolute;display:block;z-index:2;border-radius:16px;outline-offset:2px}}
.greenlife-related-hotspot:focus-visible{{outline:3px solid #176f46;background:rgba(255,255,255,.14)}}
@media(max-width:650px){{.greenlife-related-stage{{min-width:960px}}.greenlife-related-scroll{{border-radius:14px}}}}
</style>
<div class="greenlife-related-scroll" aria-label="綠生活相關連結，可左右滑動">
<div class="greenlife-related-stage">
<img src="./assets/greenlife-related-links.jpg" alt="綠生活相關連結，共十一項官方服務入口">
{hotspots}
</div>
</div>
</section>'''

start = s.index('<section class="panel" id="green-travel-links">')
end = s.index('</section>', start) + len('</section>')
new = s[:end] + block + s[end:]
assert new.count('id="greenlife-related-links-interactive"') == 1
assert new.count('class="greenlife-related-hotspot"') == 11
assert new.count('assets/greenlife-related-links.jpg') == 1
assert 'greenlife-row-layout-20261004' in new
assert 'green-travel-links-20261004' in new
p.write_text(new, encoding='utf-8')
