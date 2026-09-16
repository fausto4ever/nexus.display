// Temporary compatibility layer for Cloudflare preview builds.
// The public /api/display/state projection omits academic metadata, while
// /api/pickup-requests retains studentId/vehicle and /api/sync-data retains
// the student academic catalog. Production enrollment/auth flow is untouched.
const PREVIEW_SUFFIX='-nexus-display.shindarked.workers.dev';
if(window.location.hostname.toLowerCase().endsWith(PREVIEW_SUFFIX)){
  const nativeFetch=window.fetch.bind(window);
  const cloneJsonResponse=(response,data)=>new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:response.headers});
  const text=v=>String(v??'').trim();
  const first=(...values)=>values.find(v=>text(v))??null;
  const entityId=v=>String(v?.id??v?.levelId??v?.gradeId??v?.groupId??v?.displayId??'');
  const entityName=v=>first(v?.name,v?.levelName,v?.gradeName,v?.groupName,v?.level,v?.grade,v?.group,v?.displayName);
  const academicFrom=(student={},catalogs={})=>{
    const levelId=first(student.levelId,student.idNivel);
    const gradeId=first(student.gradeId,student.idGrade,student.idGrado);
    const groupId=first(student.groupId,student.idGroup,student.idGrupo);
    return{
      levelId,
      levelName:first(student.levelName,student.level,student.nivel,catalogs.levels.get(String(levelId||''))),
      gradeId,
      gradeName:first(student.gradeName,student.grade,student.grado,catalogs.grades.get(String(gradeId||''))),
      groupId,
      groupName:first(student.groupName,student.group,student.grupo,catalogs.groups.get(String(groupId||'')))
    };
  };
  window.fetch=async(input,init)=>{
    const response=await nativeFetch(input,init);
    try{
      const requestUrl=new URL(typeof input==='string'?input:input.url,window.location.href);
      if(requestUrl.pathname!=='/api/display/state'||!response.ok)return response;
      const state=await response.clone().json();
      const items=Array.isArray(state?.items)?state.items:null;
      if(!items?.length)return response;
      const [pickupResponse,syncResponse]=await Promise.all([
        nativeFetch(new URL('/api/pickup-requests',requestUrl.origin),{cache:'no-store'}),
        nativeFetch(new URL('/api/sync-data',requestUrl.origin),{cache:'no-store'})
      ]);
      if(!pickupResponse.ok||!syncResponse.ok)return response;
      const pickupData=await pickupResponse.json(),syncData=await syncResponse.json();
      const requests=Array.isArray(pickupData?.requests)?pickupData.requests:[];
      const students=Array.isArray(syncData?.students)?syncData.students:[];
      const toCatalog=values=>new Map((Array.isArray(values)?values:[]).map(v=>[entityId(v),entityName(v)]).filter(([id,name])=>id&&name));
      const catalogs={levels:toCatalog(syncData?.levels),grades:toCatalog(syncData?.grades),groups:toCatalog(syncData?.groups)};
      const byRequest=new Map(requests.map(r=>[String(r.requestId||''),r]));
      const byStudent=new Map(students.map(s=>[String(s.id||s.studentId||s.idAlumno||''),s]));
      state.items=items.map(item=>{
        const request=byRequest.get(String(item.requestId||''))||{};
        const studentId=first(request.studentId,item.studentId);
        const student=byStudent.get(String(studentId||''))||{};
        const academic=academicFrom(student,catalogs);
        const explicitMode=first(request.arrivalMode,request.travelMode,item.arrivalMode,item.travelMode);
        const arrivalMode=explicitMode||((request.vehicle&&typeof request.vehicle==='object')?'CAR':'WALK');
        return {...item,studentId,studentName:first(item.studentName,item.displayName,request.studentName,student.name),...academic,arrivalMode,travelMode:arrivalMode};
      });
      return cloneJsonResponse(response,state);
    }catch(error){console.warn('Nexus.Display preview metadata enrichment skipped',error);return response;}
  };
}
