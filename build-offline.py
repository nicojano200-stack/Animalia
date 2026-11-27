"""Optional maintainer helper; no build is needed to play the shipped project."""
from pathlib import Path
import re,json
root=Path(__file__).resolve().parent
level=root/'src/level.js'
maps=[json.loads((root/'levels'/f'{name}.json').read_text()) for name in ['tutorial-01','tutorial-02','tutorial-03']]
level.write_text(re.sub(r'/\* MAP_DATA_START \*/.*?/\* MAP_DATA_END \*/',lambda _: '/* MAP_DATA_START */ '+json.dumps(maps,separators=(',',':'))+' /* MAP_DATA_END */',level.read_text(),flags=re.S))
order='config input physics player level parkour adventure shaman camera emotes chat bubbles background audio particles debug tutorial ui sprites main'.split()
parts=[]
for name in order:
    s=(root/'src'/f'{name}.js').read_text()
    s=re.sub(r'^import .*?;\s*$', '', s, flags=re.M)
    s=re.sub(r'\bexport\s+(?=(?:async\s+)?(?:const|function|let|class)\b)', '', s)
    parts.append(f'\n// ===== {name}.js =====\n'+s)
(root/'offline.js').write_text('(function(){"use strict";\n'+''.join(parts)+'\nboot().catch(e=>{console.error(e);document.getElementById("loading").textContent="Unable to start Animalia.";});\n})();\n')
