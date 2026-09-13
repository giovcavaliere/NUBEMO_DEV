// NUBEMO — impedisce al sync legacy degli appuntamenti di trattare i draft come patient_id reali.
(() => {
  'use strict';
  const KEY='diario-pro-appts-recovery-v1';
  const proto=Object.getPrototypeOf(window.localStorage);
  if(proto.setItem?.__nubemoDraftSanitizer)return;
  const previousSet=proto.setItem;
  const wrapped=function(key,value){
    if(key===KEY){
      try{
        const rows=JSON.parse(value);
        if(Array.isArray(rows)){
          const clean=rows.map(row=>{
            const patientId=String(row?.patientId||'');
            if(patientId && window.nubemoPatientLifecycleBridge?.isDraft?.(patientId))return {...row,patientId:null};
            return row;
          });
          return previousSet.call(this,key,JSON.stringify(clean));
        }
      }catch(_){ }
    }
    return previousSet.call(this,key,value);
  };
  wrapped.__nubemoDraftSanitizer=true;
  proto.setItem=wrapped;
})();
