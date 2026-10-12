import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { TRANSLATIONS } from './translations';
export type Language='en'|'ru';
export type Theme='light'|'dark';
export const PALETTES=[
 ['Forest','#147B53'],['Lavanda','#7952B3'],['Coffee','#795548'],['Ocean','#196B92'],['Indigo','#4F46B5'],
 ['Rose','#B23D65'],['Terracotta','#A34C35'],['Olive','#64732B'],['Slate','#526477'],['Teal','#087F78'],
 ['Amber','#946200'],['Ruby','#AD334B'],['Plum','#86467E'],['Sage','#507C60'],['Cobalt','#345EC0'],
 ['Copper','#A05C2E'],['Graphite','#50545B'],['Orchid','#9651A6'],['Pine','#27635C'],['Berry','#9A416A'],
].map(([name,hex])=>({name,hex}));
interface Preferences {language:Language;theme:Theme;palette:string;setLanguage(v:Language):void;setTheme(v:Theme):void;setPalette(v:string):void;t(value:string):string;style:CSSProperties}
const Context=createContext<Preferences|null>(null);
function saved(key:string,fallback:string){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
export function PreferencesProvider({children}:{children:ReactNode}){
 const [language,setLanguage]=useState<Language>(()=>saved('recorda-language','en')==='ru'?'ru':'en');
 const [theme,setTheme]=useState<Theme>(()=>saved('recorda-theme','light')==='dark'?'dark':'light');
 const [palette,setPalette]=useState(()=>{const value=saved('recorda-palette','Forest');return PALETTES.some(p=>p.name===value)?value:'Forest';});
 useEffect(()=>{localStorage.setItem('recorda-language',language);document.documentElement.lang=language;},[language]);
 useEffect(()=>{localStorage.setItem('recorda-theme',theme);localStorage.setItem('recorda-palette',palette);},[theme,palette]);
 useEffect(()=>{
  const elements=[document.documentElement,document.body];
  const previous=elements.map(element=>({background:element.style.background,colorScheme:element.style.colorScheme}));
  for(const element of elements){element.style.background=theme==='dark'?'#101513':'#f7f8f7';element.style.colorScheme=theme;}
  return ()=>elements.forEach((element,index)=>{element.style.background=previous[index].background;element.style.colorScheme=previous[index].colorScheme;});
 },[theme]);
 const value=useMemo(()=>{
  const hex=PALETTES.find(p=>p.name===palette)!.hex;
  const brand=theme==='dark'?`color-mix(in srgb, ${hex} 55%, white)` : hex;
  const style={colorScheme:theme,'--brand':brand,'--mint':`color-mix(in srgb, ${hex} ${theme==='dark'?'25%':'10%'}, ${theme==='dark'?'#17211d':'white'})`,'--bg':theme==='dark'?'#101513':'#f7f8f7','--paper':theme==='dark'?'#19211e':'#ffffff','--ink':theme==='dark'?'#edf4f0':'#14211d','--muted':theme==='dark'?'#a9b9b0':'#66786e','--line':theme==='dark'?'#344039':'#e7ece9','--light':theme==='dark'?'#26312b':'#f1f5f2','--strong':theme==='dark'?'#edf4f0':'#1b3127','--rail':'#121b18','--input':theme==='dark'?'#202b25':'#f9fbf9','--warn':theme==='dark'?'#f9bb70':'#ac6c2b','--warning-bg':theme==='dark'?'#3b2d1e':'#fff5e6','--red':theme==='dark'?'#f48d85':'#c3554f','--red-bg':theme==='dark'?'#392523':'#fff0ed'} as CSSProperties;
  return {language,theme,palette,setLanguage,setTheme,setPalette,style,t:(text:string)=>TRANSLATIONS[text]?.[language]??text};
 },[language,theme,palette]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePreferences(){const value=useContext(Context);if(!value)throw Error('PreferencesProvider missing');return value;}
