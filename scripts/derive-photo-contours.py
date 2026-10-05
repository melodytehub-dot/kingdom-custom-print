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
  image=photo[:,side*pw:(side+1)*pw];prior=matte[:,side*pw:(side+1)*pw];t=registrations[family][side]
  affine=np.float32([[t['sx'],0,pw/2*(1-t['sx'])+t['dx']],[0,t['sy'],t['dy']]])
  prior=cv.warpAffine(prior,affine,(pw,h))>127
  near=cv.dilate(prior.astype(np.uint8),np.ones((61,61),np.uint8))>0
  rgb=image.astype(float);lo=rgb.min(axis=2);hi=rgb.max(axis=2);lum=rgb.mean(axis=2)
  background=np.maximum(rgb[:,4].mean(axis=1),rgb[:,-5].mean(axis=1))[:,None]
  seeds=np.full((h,pw),cv.GC_PR_BGD,np.uint8)
  seeds[prior]=cv.GC_PR_FGD
  seeds[near&(hi-lo<30)&(lum>background+12)]=cv.GC_FGD
  seeds[prior&(hi-lo<25)&(lum>80)]=cv.GC_FGD
  seeds[(~near)|(hi-lo>40)|(lum<80)]=cv.GC_BGD
  bg=np.zeros((1,65),np.float64);fg=np.zeros((1,65),np.float64)
  cv.grabCut(image,seeds,None,bg,fg,5,cv.GC_INIT_WITH_MASK)
  selected=np.where((seeds==cv.GC_FGD)|(seeds==cv.GC_PR_FGD),255,0).astype(np.uint8)
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
