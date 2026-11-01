// Pixi represents each projected axis with its own sine/cosine pair. CSS skew
// uses a tangent shear instead, which stretches near 90° and loses back flips.
export function previewMatrix(rotation:number,skewX=0,skewY=0,width=1,height=1) {
  const sx=width<0?-1:1,sy=height<0?-1:1;
  return [Math.cos(rotation+skewY)*sx,Math.sin(rotation+skewY)*sx,-Math.sin(rotation-skewX)*sy,Math.cos(rotation-skewX)*sy,0,0] as const;
}
