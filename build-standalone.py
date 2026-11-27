"""Optional: package the same game into a single HTML file with embedded art."""
from pathlib import Path
import base64, sys, json
root=Path(__file__).resolve().parent
html=(root/'index.html').read_text()
css=(root/'style.css').read_text()
js=(root/'offline.js').read_text()
img=base64.b64encode((root/'assets/hamster-smooth.png').read_bytes()).decode()
sky=base64.b64encode((root/'assets/sunset-sky.png').read_bytes()).decode()
clouds=base64.b64encode((root/'assets/sunset-clouds.png').read_bytes()).decode()
emotes=json.dumps({p.stem:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (root/'assets/emotes').glob('*.png')},separators=(',',':'))
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('src="assets/emotes/happy.png"','src="'+json.loads(emotes)['happy']+'"')
html=html[:html.rfind('<script>')]+'<script>globalThis.ANIMALIA_OFFLINE=true;globalThis.ANIMALIA_SPRITES="data:image/png;base64,'+img+'";globalThis.ANIMALIA_SKY="data:image/png;base64,'+sky+'";globalThis.ANIMALIA_CLOUDS="data:image/png;base64,'+clouds+'";globalThis.ANIMALIA_EMOTE_ASSETS='+emotes+';\n'+js.replace('</script','<\\/script')+'</script></body></html>'
Path(sys.argv[1] if len(sys.argv)>1 else root/'Animalia_Play.html').write_text(html)
