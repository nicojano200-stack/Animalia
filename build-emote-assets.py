"""Extract the ten emote assets from the supplied 1672×941 RGBA sheet.
Usage: python build-emote-assets.py path/to/sheet.png (requires Pillow, numpy, opencv).
"""
from pathlib import Path
from PIL import Image
import numpy as np, cv2, sys
folder=Path(__file__).resolve().parent/'assets/emotes'
folder.mkdir(exist_ok=True,parents=True)
im=np.array(Image.open(sys.argv[1]).convert('RGBA')); assert im.shape[:2]==(941,1672)
a=im[:,:,3]; _,labels,_,_=cv2.connectedComponentsWithStats((a>45).astype('uint8'))
groups={'happy': [1], 'sad': [2], 'laughing': [3, 6, 9, 10, 13, 14], 'crying': [4, 15, 16, 17, 18], 'wow': [5, 7, 8, 11, 12], 'cheer': [22, 27, 28, 29, 30], 'sleeping': [26, 19, 21, 25], 'love': [23], 'angry': [24], 'shock': [20]}
for name,ids in groups.items():
    mask=np.isin(labels,ids).astype('uint8'); expanded=cv2.dilate(mask,np.ones((5,5),np.uint8)); expanded[(labels>0)&(mask==0)]=0
    out=im.copy(); out[:,:,3]=np.where(expanded,a,0); out[out[:,:,3]==0]=0
    img=Image.fromarray(out); img=img.crop(img.getbbox()); img.thumbnail((176,176),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',(192,192)); tile.alpha_composite(img,((192-img.width)//2,(192-img.height)//2)); tile.save(folder/(name+'.png'),optimize=True)
