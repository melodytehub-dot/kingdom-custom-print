# Optional development helper: opencv-python-headless==4.9.0.80 and numpy==1.26.4.
# Reads original photos and emits vector outlines; never modifies image assets.
import cv2 as cv, numpy as np, json, pathlib
root=pathlib.Path(__file__).resolve().parent.parent
registrations=json.loads((root/'lib/photo-registration.json').read_text())
output={}
for family in registrations:
 photo=cv.imread(str(root/f'public/img/catalog-models/{family}.png'))
 matte=cv.imread(str(root/f'public/img/catalog-models/{family}-mask.png'),cv.IMREAD_UNCHANGED)[:,:,3]
 h,w=photo.shape[:2];pw=w//3; paths=[]
 for side in range(3):
  image=photo[:,side*pw:(side+1)*pw]
  # The mask panels were generated from these exact photo panels, so applying
  # an additional registration transform shrinks the garment and exposes the
  # original white trim beneath dark color overlays.
  prior=matte[:,side*pw:(side+1)*pw]>127
  # The generated garment alpha already includes bright trims and cuffs.
  # Keep that silhouette intact; GrabCut incorrectly classifies those light
  # fabric edges as background and makes dark colorways leak white pixels.
  selected=cv.morphologyEx(prior.astype(np.uint8)*255,cv.MORPH_CLOSE,np.ones((3,3),np.uint8))
  rgb=image.astype(float); hi=rgb.max(axis=2); lo=rgb.min(axis=2); lum=rgb.mean(axis=2)
  bright_trim=(hi-lo<35)&(lum>205)
  edge=cv.dilate((selected>0).astype(np.uint8),np.ones((31,31),np.uint8))>0
  selected=np.where((selected>0)|(edge&bright_trim),255,0).astype(np.uint8)
  contours,hierarchy=cv.findContours(selected,cv.RETR_CCOMP,cv.CHAIN_APPROX_SIMPLE)
  pieces=[]
  for i,contour in enumerate(contours):
   if abs(cv.contourArea(contour))<50:continue
   poly=cv.approxPolyDP(contour,.6,True).reshape(-1,2)
   if len(poly)<3:continue
   pieces.append('M'+' L'.join(f'{x},{y}' for x,y in poly)+' Z')
  paths.append(' '.join(pieces))
  print(family,side,'vector points',sum(p.count(' L')+1 for p in pieces),flush=True)
 output[family]=paths
(root/'lib/photo-contours.json').write_text(json.dumps(output,indent=2))
