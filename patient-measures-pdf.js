// NUBEMO — PDF Misure Paziente con linguaggio grafico allineato al PDF Diario 3.98.
(() => {
  'use strict';

  const PAGE_W=842, PAGE_H=595;
  const MARGIN=22.68; // 8 mm
  const TABLE_TOP=531;
  const HEADER_H=25;
  const BODY_BOTTOM=44;
  const FONT_SIZE=7;
  const LINE_H=8.2;
  const PAD=4;
  const HEADERS=['Data','Peso','BMI','Vita','Fianchi','Note'];
  const COLUMN_WEIGHTS=[78,72,60,72,82,434];
  const COLORS={dark:[0.086,0.353,0.208],text:[0.133,0.157,0.145],pale:[0.918,0.957,0.925],grid:[0.737,0.784,0.753]};
  const te=new TextEncoder();
  let measureCanvas=null,measureCtx=null;

  function ascii(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7E]/g,' ')}
  function esc(s){return ascii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
  function num(n){return Number(n).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')||'0'}
  function color(arr,stroke=false){return `${arr.map(num).join(' ')} ${stroke?'RG':'rg'}\n`}
  function ensureMeasure(){if(!measureCanvas){measureCanvas=document.createElement('canvas');measureCtx=measureCanvas.getContext('2d')}return measureCtx}
  function textWidth(text,size,bold=false,italic=false){const ctx=ensureMeasure();ctx.font=`${italic?'italic ':''}${bold?'700 ':'400 '}${size}px Helvetica, Arial, sans-serif`;return ctx.measureText(ascii(text)).width}
  function wrap(text,maxWidth,size=FONT_SIZE,bold=false){
    const words=ascii(text).replace(/\s+/g,' ').trim().split(' ').filter(Boolean);if(!words.length)return [''];
    const lines=[];let line='';
    for(const word of words){const next=line?`${line} ${word}`:word;if(line&&textWidth(next,size,bold)>maxWidth){lines.push(line);line=word}else line=next}
    if(line)lines.push(line);return lines;
  }
  function textCmd(text,x,y,size=FONT_SIZE,font='F1'){return `BT /${font} ${num(size)} Tf ${num(x)} ${num(y)} Td (${esc(text)}) Tj ET\n`}
  function centeredTextCmd(text,cx,y,size=FONT_SIZE,font='F1',bold=false,italic=false){return textCmd(text,cx-textWidth(text,size,bold,italic)/2,y,size,font)}
  function imageCmd(x,y,w,h){return `q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm /Im1 Do Q\n`}

  async function loadLogoJpeg(){
    const img=new Image();
    img.src='assets/nubemo-n-icon-512.png';
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject});
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,512,512);ctx.drawImage(img,0,0,512,512);
    const data=canvas.toDataURL('image/jpeg',0.92).split(',')[1];
    const bin=atob(data),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return {bytes,width:512,height:512};
  }

  function prepareLayout(rows){
    const tableW=PAGE_W-MARGIN*2,total=COLUMN_WEIGHTS.reduce((a,b)=>a+b,0),widths=COLUMN_WEIGHTS.map(w=>w*tableW/total);
    const xs=[MARGIN];widths.forEach(w=>xs.push(xs.at(-1)+w));
    const pages=[];let page=[],y=TABLE_TOP-HEADER_H;
    for(const row of rows){
      const wrapped=row.map((cell,i)=>wrap(cell,widths[i]-PAD*2,FONT_SIZE,i===0||i===1));
      const lineCount=Math.max(...wrapped.map(x=>x.length));
      const h=Math.max(21,lineCount*LINE_H+PAD*2);
      if(y-h<BODY_BOTTOM&&page.length){pages.push(page);page=[];y=TABLE_TOP-HEADER_H}
      page.push({wrapped,h,yTop:y});y-=h;
    }
    if(page.length||!pages.length)pages.push(page);
    return {pages,widths,xs};
  }

  function headerStream(period){
    let s='',top=PAGE_H-MARGIN;
    s+=imageCmd(MARGIN,top-36,36,36);
    s+=color(COLORS.text)+textCmd('NUBEMO',MARGIN+40,top-14,17,'F2');
    s+=color(COLORS.dark)+textCmd('Il tuo percorso, ogni giorno.',MARGIN+40,top-26,7,'F3');
    s+=centeredTextCmd('MISURAZIONI',PAGE_W/2,top-12,16,'F2',true);
    s+=`${num(COLORS.dark[0])} ${num(COLORS.dark[1])} ${num(COLORS.dark[2])} RG 0.8 w ${num(PAGE_W/2-92)} ${num(top-32)} 184 13 re S\n`;
    s+=centeredTextCmd(period,PAGE_W/2,top-28,8,'F1');
    s+=imageCmd(PAGE_W-MARGIN-112,top-29,22,22);
    s+=color(COLORS.text)+textCmd('Documento generato',PAGE_W-MARGIN-86,top-16,6.5,'F1');
    s+=textCmd('dal paziente',PAGE_W-MARGIN-86,top-25,6.5,'F1');
    s+=color(COLORS.dark,true)+`1 w ${MARGIN} ${TABLE_TOP+6} m ${PAGE_W-MARGIN} ${TABLE_TOP+6} l S\n`;
    return s;
  }

  function tableHeaderStream(xs){
    let s=color(COLORS.pale)+`${MARGIN} ${TABLE_TOP-HEADER_H} ${PAGE_W-MARGIN*2} ${HEADER_H} re f\n`;
    s+=color(COLORS.grid,true)+'0.45 w\n';
    xs.forEach(x=>{s+=`${num(x)} ${TABLE_TOP-HEADER_H} m ${num(x)} ${TABLE_TOP} l S\n`});
    s+=`${MARGIN} ${TABLE_TOP} m ${PAGE_W-MARGIN} ${TABLE_TOP} l S\n${MARGIN} ${TABLE_TOP-HEADER_H} m ${PAGE_W-MARGIN} ${TABLE_TOP-HEADER_H} l S\n`;
    s+=color(COLORS.dark);
    HEADERS.forEach((label,i)=>s+=centeredTextCmd(label,(xs[i]+xs[i+1])/2,TABLE_TOP-HEADER_H/2-2.1,7,'F2',true));
    return s;
  }

  function rowsStream(items,xs){
    let s='';
    for(const item of items){
      const yBottom=item.yTop-item.h;
      s+=color(COLORS.grid,true)+'0.35 w\n';
      xs.forEach(x=>{s+=`${num(x)} ${num(yBottom)} m ${num(x)} ${num(item.yTop)} l S\n`});
      s+=`${MARGIN} ${num(yBottom)} m ${PAGE_W-MARGIN} ${num(yBottom)} l S\n`;
      item.wrapped.forEach((lines,i)=>{
        const total=(lines.length-1)*LINE_H;let ty=(item.yTop+yBottom)/2+total/2-FONT_SIZE*.3;
        s+=color(COLORS.text);
        for(const line of lines){
          const font=i===0||i===1?'F2':'F1';
          if(i<5)s+=centeredTextCmd(line,(xs[i]+xs[i+1])/2,ty,FONT_SIZE,font,i===0||i===1,false);
          else s+=textCmd(line,xs[i]+PAD,ty,FONT_SIZE,font);
          ty-=LINE_H;
        }
      });
    }
    return s;
  }

  function footerStream(pageNo,pageCount){
    const lineY=MARGIN+14,textY=MARGIN+2;
    let s=color(COLORS.dark,true)+`0.8 w ${MARGIN} ${num(lineY)} m ${PAGE_W-MARGIN} ${num(lineY)} l S\n`;
    s+=imageCmd(MARGIN,textY-3,11,11);
    s+=color(COLORS.text)+textCmd('NUBEMO',MARGIN+14,textY,6.8,'F2');
    s+=color(COLORS.dark)+centeredTextCmd('Il tuo percorso, ogni giorno.',PAGE_W/2,textY,6.5,'F3',false,true);
    s+=color(COLORS.text)+textCmd(`Pagina ${pageNo} di ${pageCount}`,PAGE_W-MARGIN-textWidth(`Pagina ${pageNo} di ${pageCount}`,6.5),textY,6.5,'F1');
    return s;
  }

  function concatBytes(parts){const arrays=parts.map(p=>typeof p==='string'?te.encode(p):p),len=arrays.reduce((n,a)=>n+a.length,0),out=new Uint8Array(len);let o=0;arrays.forEach(a=>{out.set(a,o);o+=a.length});return out}
  function buildPdf(pageStreams,logo){
    const objects=[],add=parts=>{objects.push(Array.isArray(parts)?concatBytes(parts):te.encode(parts));return objects.length};
    const f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'),f3=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');
    const img=add([`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`,logo.bytes,'\nendstream']);
    const pagesObj=add('PAGES_PLACEHOLDER'),pageIds=[];
    pageStreams.forEach(stream=>{const body=te.encode(stream),contentId=add([`<< /Length ${body.length} >>\nstream\n`,body,'endstream']),pageId=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> /XObject << /Im1 ${img} 0 R >> >> /Contents ${contentId} 0 R >>`);pageIds.push(pageId)});
    objects[pagesObj-1]=te.encode(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`);
    const catalog=add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`),chunks=[te.encode('%PDF-1.4\n%NUBEMO\n')],offsets=[0];let pos=chunks[0].length;
    objects.forEach((obj,i)=>{offsets[i+1]=pos;const a=te.encode(`${i+1} 0 obj\n`),b=te.encode('\nendobj\n');chunks.push(a,obj,b);pos+=a.length+obj.length+b.length});
    const xref=pos;let tail=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)tail+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';tail+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;chunks.push(te.encode(tail));
    return new Blob(chunks,{type:'application/pdf'});
  }

  async function createMeasuresPdf(){
    const p=loadProfile();
    const source=visibleMeasures();
    const rows=source.map(r=>[
      fmtShort(r.date),
      r.weight!==''&&r.weight!=null?`${Number(r.weight).toFixed(1).replace('.',',')} kg`:'',
      r.weight!==''&&p.height?bmiFor(r.weight,p.height).toFixed(1).replace('.',','):'',
      r.waist!==''&&r.waist!=null?`${Number(r.waist).toFixed(1).replace('.',',')} cm`:'',
      r.hips!==''&&r.hips!=null?`${Number(r.hips).toFixed(1).replace('.',',')} cm`:'',
      r.notes||''
    ]);
    const period=rows.length?`${rows[0][0]}  -  ${rows.at(-1)[0]}`:'Nessun dato';
    const layout=prepareLayout(rows),logo=await loadLogoJpeg();
    const streams=layout.pages.map((items,i)=>headerStream(period)+tableHeaderStream(layout.xs)+rowsStream(items,layout.xs)+footerStream(i+1,layout.pages.length));
    return buildPdf(streams,logo);
  }

  window.exportMeasuresPDF=async()=>{
    const rows=visibleMeasures();
    if(!rows.length)return alert(measuresCompleteOnly?'Nessuna misurazione completa da esportare.':'Nessuna misurazione da esportare.');
    try{
      const blob=await createMeasuresPdf();
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`Misurazioni_${rows[0].date}_${rows.at(-1).date}.pdf`;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),120000);
    }catch(error){console.error('PDF misure paziente',error);alert('Non riesco a generare il PDF delle misurazioni.');}
  };
})();
