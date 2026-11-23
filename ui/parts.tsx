import {useState} from 'react';

export function LoopyArt({art,name,sheet,frame=0,label,className=''}:{art:string[];name?:string;sheet:string;frame?:number;label:string;className?:string}){
  if(name&&art.includes(name))return <img className={'art '+className} src={'../assets/ui/'+name+'.png'} alt={label}/>;
  return <Sprite sheet={sheet} frame={frame} label={label} className={className}/>;
}
export function Sprite({sheet,frame,label,className}:{sheet:string;frame:number;label:string;className:string}){
  const [frames,setFrames]=useState(0);
  const look=frames?{width:frames*100+'%',transform:`translateX(${-100*Math.min(frame,frames-1)/frames}%)`}:{visibility:'hidden' as const};
  return <span className={'art sprite '+className} role="img" aria-label={label}>
    <img src={'../assets/motions/'+sheet+'.png'} alt="" style={look}
      onLoad={e=>setFrames(Math.max(1,Math.round(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight)))}/></span>;
}
export function Check({done,label,onClick}:{done:boolean;label:string;onClick:()=>void}){
  return <button type="button" className="check" aria-pressed={done} aria-label={label} onClick={onClick}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>;
}
export function Segmented<T extends string>({label,value,options,onChange}:{label:string;value:T;options:[T,string][];onChange:(v:T)=>void}){
  return <fieldset className="field"><legend>{label}</legend><div className="segmented">
    {options.map(([v,text])=><button key={v} type="button" aria-pressed={value===v} onClick={()=>onChange(v)}>{text}</button>)}</div></fieldset>;
}
export function Switch({label,hint,checked,disabled,onChange}:{label:string;hint?:string;checked:boolean;disabled?:boolean;onChange:(v:boolean)=>void}){
  return <label className="switch"><span><span>{label}</span>{hint&&<small>{hint}</small>}</span>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/></label>;
}
