"""Optional art maintainer tool: create optical-flow inbetweens from the original
atlas. Requires Pillow, NumPy and OpenCV; not required to run the game."""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parent
source=np.asarray(Image.open(root/'assets/hamster-sprites.png').convert('RGBA'))
N=96; SUB=4
out=np.zeros((6*N,32*N,4),np.uint8)
y,x=np.mgrid[:N,:N].astype(np.float32)

def prep(im):
    a=im.astype(np.float32)/255
    a[:,:,:3]*=a[:,:,3:4]
    return a

def grey(a):
    # The alpha silhouette contributes to flow even in dark regions.
    return np.uint8(np.clip(cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2GRAY)*.78+a[:,:,3]*.22,0,1)*255)

def morph(a,b,t,ab,ba):
    wa=cv2.remap(a,x-t*ab[:,:,0],y-t*ab[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    wb=cv2.remap(b,x-(1-t)*ba[:,:,0],y-(1-t)*ba[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    v=wa*(1-t)+wb*t
    v[:,:,:3]=np.divide(v[:,:,:3],v[:,:,3:4],out=np.zeros_like(v[:,:,:3]),where=v[:,:,3:4]>1e-6)
    return np.uint8(np.clip(v*255+.5,0,255))

for row,(count,loop) in enumerate([(8,True),(8,True),(7,False),(4,False),(3,True),(8,True)]):
    cells=[source[row*N:(row+1)*N,i*N:(i+1)*N] for i in range(count)]
    for i,cell in enumerate(cells):
        j=(i+1)%count if loop else min(i+1,count-1)
        a,b=prep(cell),prep(cells[j]); ga,gb=grey(a),grey(b)
        def flow(a,b):
            f=cv2.calcOpticalFlowFarneback(a,b,None,.5,3,19,4,7,1.5,0)
            return np.clip(f,-14,14)
        ab,ba=flow(ga,gb),flow(gb,ga)
        for k in range(SUB):
            col=i*SUB+k
            out[row*N:(row+1)*N,col*N:(col+1)*N]=cell if k==0 else morph(a,b,k/SUB,ab,ba)
Image.fromarray(out).save(root/'assets/hamster-smooth.png',optimize=True)
print('Generated 152 atlas slots (including terminal holds); 4 samples per source pose.')
