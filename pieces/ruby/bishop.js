import { carvedPiece, ringLoft } from './carved-piece.js';
import { ringCenters, setGemVeins } from './glow-veins.js';

// B4: two unequal carved mitre lobes with a real, curved diagonal opening.
export function createRubyBishop(renderer) {
  const { group, add } = carvedPiece(renderer,'Ruby bishop — split flame mitre / B4','bishop');
  // y, center x, width, depth, slit x. Broad lower facets taper to a swept tip.
  const sections=[
    [.86,-.025,.13,.115,-.17],
    [.96,-.025,.16,.145,-.145],
    [1.17,-.005,.218,.178,-.035],
    [1.39,.025,.168,.12,.077],
    [1.52,.055,.105,.067,.12],
    [1.68,.108,.001,.001,.13],
  ];
  // Clipped elliptical sections have a flat interior cut and faceted exterior.
  // Sampling both lips independently gives a bent slit, not a painted stripe.
  function lobe(side) {
    const rows=side<0 ? sections.slice(1) : sections.slice(1,5);
    const rings=rows.map(([y,cx,w,d,cut],index)=>{
      let edge=cut+side*.033;
      if(side>0 && index===rows.length-1) edge=cx+w-.002;
      edge=Math.max(cx-w+.001,Math.min(cx+w-.001,edge));
      const angle=Math.acos((edge-cx)/w);
      const start=side<0 ? angle : -angle;
      const end=side<0 ? 2*Math.PI-angle : angle;
      return Array.from({length:7},(_,j)=>{
        const a=start+(end-start)*j/6;
        return [cx+w*Math.cos(a),y,d*Math.sin(a)];
      });
    });
    const blade=add(ringLoft(rings),side<0?'Tall swept mitre blade':'Short mitre blade',null,true);
    const centers=ringCenters(rings);
    centers[0].lerp(centers[1],.18);
    centers.at(-1).lerp(centers.at(-2),.16);
    setGemVeins(blade.material,[centers],{type:'bishop',width:.006});
  }
  const root=sections.slice(0,2).map(([y,cx,w,d])=>
    Array.from({length:16},(_,j)=>{
      const a=j*Math.PI/8;
      return [cx+w*Math.cos(a),y,d*Math.sin(a)];
    }));
  add(ringLoft(root),'Solid mitre root beneath the slit',null,true);
  lobe(-1);lobe(1);
  group.rotation.y=Math.PI/6;
  return group;
}
