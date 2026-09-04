const cfg = window.APP_CONFIG || {};
const state = { empresas:[], equiposTipos:[], certificadoras:[], competencias:[], equipos:[], personal:[], buenas:[], mapData:[], eqBatch:[], peBatch:[], charts:{} };

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const fmtDate = v => { if(!v) return ''; const d=new Date(v); return isNaN(d)?v:d.toLocaleDateString('es-PE'); };
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const qs = new URLSearchParams(location.search);

async function api(action, payload={}){
  if(!cfg.API_URL || cfg.API_URL.includes('PEGA_AQUI')) throw new Error('Configura API_URL en config.js');
  const res = await fetch(cfg.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})});
  const txt = await res.text();
  try{const j=JSON.parse(txt); if(j.ok===false) throw new Error(j.error||'Error'); return j.data??j;}catch(e){if(e instanceof SyntaxError) throw new Error('Respuesta inválida del backend. Verifica el despliegue de Apps Script.'); throw e;}
}

async function fileToObj(input){
  const f=input?.files?.[0]; if(!f) return null;
  const b64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(f)});
  return {name:f.name,mimeType:f.type||'application/octet-stream',base64:b64};
}

function showModal(title,text,extra=''){$('#modalTitle').textContent=title;$('#modalText').textContent=text;$('#modalExtra').innerHTML=extra;$('#modal').classList.remove('hidden');}
function closeModal(){$('#modal').classList.add('hidden');}

function switchView(view){$$('.view').forEach(v=>v.classList.remove('active'));$$('.nav-item').forEach(n=>n.classList.remove('active'));$(`#view-${view}`)?.classList.add('active');$(`.nav-item[data-view="${view}"]`)?.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});if(view==='seguimiento') renderSeguimiento();if(view==='mapa') renderMapa();if(view==='buenas') renderBuenas();}

function statusClass(s){const n=norm(s);if(n.includes('aprob')||n.includes('operativo'))return 'aprobado';if(n.includes('revision')||n.includes('evaluacion'))return 'revision';if(n.includes('observ'))return 'observado';if(n.includes('venc'))return 'vencido';if(n.includes('rech'))return 'rechazado';if(n.includes('inoper'))return 'inoperativo';if(n.includes('fuera'))return 'fuera';return 'revision';}
function statusBadge(s){return `<span class="status ${statusClass(s)}">${esc(s||'En revisión')}</span>`}

function setOptions(sel, arr, placeholder){const e=$(sel);if(!e)return;e.innerHTML=`<option value="">${placeholder||'Seleccionar'}</option>`+arr.map(x=>`<option>${esc(typeof x==='string'?x:(x.nombre||x.Empresa||x.valor||''))}</option>`).join('');}

async function init(){
  $('#fechaHoy').textContent=new Date().toLocaleDateString('es-PE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  bind();
  try{
    const data=await api('bootstrap');
    Object.assign(state,data);
    hydrateSelectors();
    renderAll();
    if(qs.get('review')){ $('.admin-only').classList.remove('hidden'); await loadReview(qs.get('review')); switchView('revision'); }
  }catch(e){showModal('Configuración pendiente',e.message,'<small>El frontend está listo. Completa config.js y ejecuta setupSistema() en Apps Script.</small>');renderAll();}
}

function bind(){
  $$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $$('[data-go]').forEach(b=>b.onclick=()=>switchView(b.dataset.go));
  $('#btnRefresh').onclick=()=>location.reload();$('#modalClose').onclick=closeModal;$('#modalAccept').onclick=closeModal;
  $('#eqCertificadora').onchange=()=>{const other=$('#eqCertificadora').value==='Otro';$('#eqOtraWrap').classList.toggle('hidden',!other);$('#eqWarning').classList.toggle('hidden',!other)};
  $('#btnAddEquipo').onclick=addEquipoBatch;$('#btnClearEquipo').onclick=clearEquipo;$('#btnSaveEquipos').onclick=saveEquipos;
  $('#btnAddPersonal').onclick=addPersonalBatch;$('#btnClearPersonal').onclick=clearPersonal;$('#btnSavePersonal').onclick=savePersonal;
  $('#btnApplyFilters').onclick=renderSeguimiento;$('#fSearch').oninput=renderSeguimiento;
  $('#mapEmpresa').onchange=renderMapa;$('#mapEstado').onchange=renderMapa;$('#mapSearch').oninput=renderMapa;$('#btnReloadMap').onclick=reloadMap;$('#btnFullscreenMap').onclick=toggleMapFullscreen;
  $('#btnAdminBuenas').onclick=unlockBuenas;$('#btnSaveBP').onclick=saveBuenaPractica;
}

function hydrateSelectors(){
  const emp=state.empresas.map(x=>typeof x==='string'?x:(x.Empresa||x.nombre||x.RazonSocial||x['Razón Social'])).filter(Boolean);
  ['#eqEmpresa','#peEmpresa'].forEach(s=>setOptions(s,emp,'Seleccionar empresa'));setOptions('#fEmpresa',emp,'Todas las empresas');setOptions('#mapEmpresa',emp,'Todas las empresas');
  setOptions('#eqTipo',state.equiposTipos,'Seleccionar tipo');setOptions('#fEquipo',state.equiposTipos,'Todos los equipos');setOptions('#eqCertificadora',state.certificadoras,'Seleccionar certificadora');
  setOptions('#peCapacitacion',state.competencias,'Seleccionar competencia');
}

function renderAll(){renderEqBatch();renderPeBatch();renderHome();renderSeguimiento();renderBuenas();renderMapa();}

function addEquipoBatch(){
  const obj={empresa:$('#eqEmpresa').value,sede:$('#eqSede').value,tipo:$('#eqTipo').value,estadoEquipo:$('#eqEstado').value,marca:$('#eqMarca').value.trim(),modelo:$('#eqModelo').value.trim(),serie:$('#eqSerie').value.trim(),capacidad:$('#eqCapacidad').value,lugar:$('#eqLugar').value.trim(),certificadora:$('#eqCertificadora').value,otraCertificadora:$('#eqOtraCertificadora').value.trim(),fechaCert:$('#eqFechaCert').value,vigencia:$('#eqVigencia').value,fileInput:'#eqArchivo'};
  if(!obj.empresa||!obj.sede||!obj.tipo||!obj.marca||!obj.serie||!obj.certificadora||!obj.fechaCert||!$('#eqArchivo').files[0]) return showModal('Faltan datos','Completa los campos obligatorios y adjunta el certificado.');
  if(obj.certificadora==='Otro'&&!obj.otraCertificadora)return showModal('Falta certificadora','Escribe el nombre de la empresa certificadora.');
  obj._file=$('#eqArchivo').files[0];state.eqBatch.push(obj);renderEqBatch();clearEquipo(false);
}
function clearEquipo(all=true){['#eqMarca','#eqModelo','#eqSerie','#eqCapacidad','#eqLugar','#eqOtraCertificadora','#eqFechaCert','#eqVigencia','#eqArchivo'].forEach(s=>{const e=$(s);if(e)e.value=''});if(all){$('#eqEmpresa').value='';$('#eqTipo').value='';$('#eqCertificadora').value='';$('#eqEstado').value='Operativo'}$('#eqOtraWrap').classList.add('hidden');$('#eqWarning').classList.add('hidden');}
function renderEqBatch(){
  $('#eqBatchCount').textContent=`${state.eqBatch.length} equipos`;
  if(!state.eqBatch.length)return $('#eqBatchTable').innerHTML='<div class="notice">Aún no agregas equipos al lote.</div>';
  $('#eqBatchTable').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Empresa</th><th>Equipo</th><th>Serie</th><th>Cap.</th><th>Certificadora</th><th>Fecha</th><th></th></tr></thead><tbody>${state.eqBatch.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.empresa)}</td><td>${esc(x.tipo)}</td><td>${esc(x.serie)}</td><td>${esc(x.capacidad)}</td><td>${esc(x.certificadora==='Otro'?x.otraCertificadora:x.certificadora)}</td><td>${fmtDate(x.fechaCert)}</td><td><button class="btn danger" onclick="removeEqBatch(${i})">Quitar</button></td></tr>`).join('')}</tbody></table></div>`;
}
window.removeEqBatch=i=>{state.eqBatch.splice(i,1);renderEqBatch()};
async function saveEquipos(){
  if(!state.eqBatch.length)return showModal('Sin registros','Agrega al menos un equipo.');
  $('#btnSaveEquipos').disabled=true;
  try{const items=[];for(const x of state.eqBatch){const file=await blobFile(x._file);items.push({...x,_file:undefined,archivo:file})}await api('saveEquipos',{items});state.eqBatch=[];renderEqBatch();await refreshData();showModal('Equipo(s) registrado(s)','La información entregada será revisada por el equipo de UNACEM. La validación se visualizará en Seguimiento y Reportes.');}catch(e){showModal('No se pudo registrar',e.message)}finally{$('#btnSaveEquipos').disabled=false}
}
async function blobFile(f){if(!f)return null;const base64=await new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=ko;r.readAsDataURL(f)});return{name:f.name,mimeType:f.type,base64}}

function addPersonalBatch(){const obj={empresa:$('#peEmpresa').value,sede:$('#peSede').value,nombre:$('#peNombre').value.trim(),dni:$('#peDni').value.trim(),capacitacion:$('#peCapacitacion').value,fecha:$('#peFecha').value,vigencia:$('#peVigencia').value,empresaCapacitadora:$('#peCapEmpresa').value.trim(),_file:$('#peArchivo').files[0]};if(!obj.empresa||!obj.nombre||!obj.dni||!obj.capacitacion||!obj.fecha||!obj._file)return showModal('Faltan datos','Completa los campos obligatorios y adjunta el certificado.');state.peBatch.push(obj);renderPeBatch();clearPersonal(false)}
function clearPersonal(all=true){['#peNombre','#peDni','#peFecha','#peVigencia','#peCapEmpresa','#peArchivo'].forEach(s=>$(s).value='');if(all){$('#peEmpresa').value='';$('#peCapacitacion').value=''}}
function renderPeBatch(){
  $('#peBatchCount').textContent=`${state.peBatch.length} personas`;
  if(!state.peBatch.length)return $('#peBatchTable').innerHTML='<div class="notice">Aún no agregas personal al lote.</div>';
  $('#peBatchTable').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Empresa</th><th>Nombre</th><th>DNI</th><th>Competencia</th><th>Fecha</th><th></th></tr></thead><tbody>${state.peBatch.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.empresa)}</td><td>${esc(x.nombre)}</td><td>${esc(x.dni)}</td><td>${esc(x.capacitacion)}</td><td>${fmtDate(x.fecha)}</td><td><button class="btn danger" onclick="removePeBatch(${i})">Quitar</button></td></tr>`).join('')}</tbody></table></div>`;
}
window.removePeBatch=i=>{state.peBatch.splice(i,1);renderPeBatch()};
async function savePersonal(){if(!state.peBatch.length)return showModal('Sin registros','Agrega al menos una persona.');$('#btnSavePersonal').disabled=true;try{const items=[];for(const x of state.peBatch)items.push({...x,_file:undefined,archivo:await blobFile(x._file)});await api('savePersonal',{items});state.peBatch=[];renderPeBatch();await refreshData();showModal('Personal registrado','La información será revisada por el equipo de UNACEM. La aprobación u observación se visualizará en Seguimiento y Reportes.');}catch(e){showModal('No se pudo registrar',e.message)}finally{$('#btnSavePersonal').disabled=false}}

async function refreshData(){try{const data=await api('bootstrap');Object.assign(state,data);hydrateSelectors();renderAll()}catch(e){console.warn(e)}}
function renderHome(){
  const e=state.equipos||[],p=state.personal||[];
  const standard=$('#standardLink'); if(standard){const url=state.standardUrl||cfg.STANDARD_URL||''; standard.href=url||'#'; standard.onclick=url?null:(ev=>{ev.preventDefault();showModal('Documento pendiente','Configura STANDARD_URL en config.js o DSHIU_S_006_URL en la pestaña Configuracion de Apps Script.');});}
  $('#homeKpis').innerHTML=[['Equipos registrados',e.length,`${e.filter(x=>norm(x.estadoRevision).includes('aprob')).length} aprobados`],['Personal registrado',p.length,`${p.filter(x=>norm(x.estadoRevision).includes('aprob')).length} aprobados`],['Registros en revisión',e.filter(x=>norm(x.estadoRevision).includes('revision')).length+p.filter(x=>norm(x.estadoRevision).includes('revision')).length,'Pendientes de evaluación'],['Observados',e.filter(x=>norm(x.estadoRevision).includes('observ')).length+p.filter(x=>norm(x.estadoRevision).includes('observ')).length,'Requieren levantamiento']].map(k=>`<div class="kpi"><div class="label">${k[0]}</div><div class="value">${k[1]}</div><div class="sub">${k[2]}</div></div>`).join('');
  renderTable('#homeEquiposTable',e.slice(-5).reverse(),['empresa','tipo','serie','estadoRevision'],['Empresa','Equipo','Serie','Estado']);renderTable('#homePersonalTable',p.slice(-5).reverse(),['empresa','nombre','capacitacion','estadoRevision'],['Empresa','Nombre','Capacitación','Estado']);
  drawChart('chartHomeEquipos','doughnut',countBy(e,'tipo'),'chartHomeEquipos');drawChart('chartHomePersonal','doughnut',countBy(p,'capacitacion'),'chartHomePersonal');
  $('#homeBuenas').innerHTML=(state.buenas||[]).slice(0,4).map(x=>`<div class="best-card"><b>${esc(x.titulo)}</b><p>${esc(x.resumen)}</p></div>`).join('')||'<div class="notice">Aún no hay buenas prácticas cargadas.</div>';
  renderHomeMapPreview();
}
function countBy(arr,key){return arr.reduce((a,x)=>{const k=x[key]||'Sin dato';a[k]=(a[k]||0)+1;return a},{})}
function drawChart(canvasId,type,obj,key){const el=document.getElementById(canvasId);if(!el)return;if(state.charts[key])state.charts[key].destroy();state.charts[key]=new Chart(el,{type,data:{labels:Object.keys(obj),datasets:[{data:Object.values(obj)}]},options:{responsive:true,plugins:{legend:{position:'bottom'}},scales:type==='bar'?{y:{beginAtZero:true}}:{}}})}
function renderTable(sel,arr,keys,heads){const e=$(sel);if(!e)return;e.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${arr.map(x=>`<tr>${keys.map(k=>`<td>${k.toLowerCase().includes('estado')?statusBadge(x[k]):esc(x[k]||'')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${heads.length}">Sin registros</td></tr>`}</tbody></table></div>`}

function filtered(){const emp=$('#fEmpresa')?.value||'',eq=$('#fEquipo')?.value||'',st=$('#fEstado')?.value||'',q=norm($('#fSearch')?.value||'');const fe=(state.equipos||[]).filter(x=>(!emp||x.empresa===emp)&&(!eq||x.tipo===eq)&&(!st||x.estadoRevision===st)&&(!q||norm(JSON.stringify(x)).includes(q)));const fp=(state.personal||[]).filter(x=>(!emp||x.empresa===emp)&&(!st||x.estadoRevision===st)&&(!q||norm(JSON.stringify(x)).includes(q)));return{fe,fp}}
function renderSeguimiento(){const {fe,fp}=filtered();$('#trackKpis').innerHTML=[['Equipos',fe.length,'Inventario filtrado'],['Personal',fp.length,'Competencias filtradas'],['Aprobados',fe.filter(x=>norm(x.estadoRevision).includes('aprob')).length+fp.filter(x=>norm(x.estadoRevision).includes('aprob')).length,'Validados'],['Observados',fe.filter(x=>norm(x.estadoRevision).includes('observ')).length+fp.filter(x=>norm(x.estadoRevision).includes('observ')).length,'Pendientes de levantar']].map(k=>`<div class="kpi"><div class="label">${k[0]}</div><div class="value">${k[1]}</div><div class="sub">${k[2]}</div></div>`).join('');drawChart('chartEquiposStatus','bar',countBy(fe,'estadoRevision'),'eqStatus');drawChart('chartPersonalStatus','bar',countBy(fp,'estadoRevision'),'peStatus');renderTrackEquipos(fe);renderTrackPersonal(fp)}
function renderTrackEquipos(arr){$('#trackEquiposTable').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Empresa</th><th>Equipo</th><th>Serie</th><th>Cap.</th><th>Certificadora</th><th>Vigencia</th><th>Estado</th><th>Observación</th><th>Acciones</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${esc(x.empresa)}</td><td>${esc(x.tipo)}</td><td>${esc(x.serie)}</td><td>${esc(x.capacidad)}</td><td>${esc(x.certificadoraFinal||x.certificadora)}</td><td>${fmtDate(x.vigencia)}</td><td>${statusBadge(x.estadoRevision)}</td><td>${esc(x.observacion||'')}</td><td><button class="link-btn" onclick="editRecord('equipo','${x.id}')">Editar</button> <button class="link-btn" onclick="deleteRecord('equipo','${x.id}','${esc(x.empresa)}')">Eliminar</button></td></tr>`).join('')||'<tr><td colspan="9">Sin registros</td></tr>'}</tbody></table></div>`}
function renderTrackPersonal(arr){$('#trackPersonalTable').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Empresa</th><th>Nombre</th><th>DNI</th><th>Capacitación</th><th>Fecha</th><th>Vigencia</th><th>Estado</th><th>Observación</th><th>Acciones</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${esc(x.empresa)}</td><td>${esc(x.nombre)}</td><td>${esc(x.dni)}</td><td>${esc(x.capacitacion)}</td><td>${fmtDate(x.fecha)}</td><td>${fmtDate(x.vigencia)}</td><td>${statusBadge(x.estadoRevision)}</td><td>${esc(x.observacion||'')}</td><td><button class="link-btn" onclick="editRecord('personal','${x.id}')">Editar</button> <button class="link-btn" onclick="deleteRecord('personal','${x.id}','${esc(x.empresa)}')">Eliminar</button></td></tr>`).join('')||'<tr><td colspan="9">Sin registros</td></tr>'}</tbody></table></div>`}
window.deleteRecord=async(type,id,empresa)=>{const key=prompt(`Para eliminar, ingresa la clave de ${empresa}.`);if(!key)return;try{await api('deleteRecord',{type,id,empresa,key});await refreshData();showModal('Registro eliminado','El registro fue eliminado correctamente.')}catch(e){showModal('No se pudo eliminar',e.message)}};
window.editRecord=(type,id)=>{const arr=type==='equipo'?state.equipos:state.personal;const x=arr.find(r=>r.id===id);if(!x)return;showModal('Edición rápida','Para mantener trazabilidad, la edición reabre el registro en estado “En revisión”.',`<div style="text-align:left"><label>Observación / ajuste<textarea id="quickEditText" rows="4">${esc(x.observacionEmpresa||'')}</textarea></label><button class="btn primary full" style="margin-top:10px" onclick="saveQuickEdit('${type}','${id}')">Enviar actualización</button></div>`)};
window.saveQuickEdit=async(type,id)=>{try{await api('updateRecord',{type,id,updates:{observacionEmpresa:$('#quickEditText').value}});closeModal();await refreshData();showModal('Actualización enviada','El registro volvió a estado En revisión y será notificado al equipo de UNACEM.')}catch(e){showModal('Error',e.message)}};


function renderHomeMapPreview(){
  const root=$('#homeMapMarkers'); if(!root) return; root.innerHTML='';
  const arr=(state.mapData||[]).filter(x=>x.x!=null&&x.y!=null).slice(0,25);
  arr.forEach(x=>{const b=document.createElement('span');b.className=`marker mini ${norm(x.estado).includes('ejec')?'ejecucion':norm(x.estado).includes('program')?'programado':norm(x.estado).includes('final')?'finalizado':'otro'}`;b.style.left=`${Number(x.x)}%`;b.style.top=`${Number(x.y)}%`;b.title=`${x.empresa||''} - ${x.sector||''}`;root.appendChild(b)});
}
function toggleMapFullscreen(){
  const el=$('#plantMap'); if(!el) return;
  if(!document.fullscreenElement){el.requestFullscreen?.();}else{document.exitFullscreen?.();}
}

async function reloadMap(){try{state.mapData=await api('getIzajesTar');renderMapa()}catch(e){showModal('No se pudo actualizar el mapa',e.message)}}
function renderMapa(){const img=state.mapImageUrl||cfg.MAP_IMAGE_URL||'assets/mapa_planta_nueva.png';$('#plantMapImg').src=img;$('#mapEmpty').classList.toggle('hidden',!!img);const emp=$('#mapEmpresa')?.value||'',st=$('#mapEstado')?.value||'',q=norm($('#mapSearch')?.value||'');const arr=(state.mapData||[]).filter(x=>(!emp||x.empresa===emp)&&(!st||x.estado===st)&&(!q||norm(JSON.stringify(x)).includes(q)));const mk=$('#mapMarkers');mk.innerHTML='';arr.forEach((x,i)=>{if(x.x==null||x.y==null)return;const b=document.createElement('button');b.className=`marker ${norm(x.estado).includes('ejec')?'ejecucion':norm(x.estado).includes('program')?'programado':norm(x.estado).includes('final')?'finalizado':'otro'}`;b.style.left=`${Number(x.x)}%`;b.style.top=`${Number(x.y)}%`;b.title=`${x.empresa} - ${x.sector}`;b.onclick=()=>showMarker(x,b);mk.appendChild(b)});$('#mapKpis').innerHTML=[['Trabajos',arr.length],['Empresas',new Set(arr.map(x=>x.empresa)).size],['En ejecución',arr.filter(x=>norm(x.estado).includes('ejec')).length]].map(k=>`<div class="kpi"><div class="label">${k[0]}</div><div class="value">${k[1]}</div></div>`).join('');drawChart('chartMapEmpresas','bar',countBy(arr,'empresa'),'mapEmp');$('#mapList').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Empresa</th><th>Sector</th><th>Actividad</th><th>Estado</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${esc(x.empresa)}</td><td>${esc(x.sector)}</td><td>${esc(x.actividad)}</td><td>${statusBadge(x.estado)}</td></tr>`).join('')||'<tr><td colspan="4">Sin trabajos de izaje.</td></tr>'}</tbody></table></div>`}
function showMarker(x,b){$$('.marker-card').forEach(e=>e.remove());const c=document.createElement('div');c.className='marker-card';c.style.left=`calc(${b.style.left} + 15px)`;c.style.top=`calc(${b.style.top} + 15px)`;c.innerHTML=`<b>${esc(x.sector||'Trabajo de izaje')}</b><br>Empresa: ${esc(x.empresa)}<br>${esc(x.actividad||'')}<br>Estado: ${esc(x.estado||'')}`;$('#plantMap').appendChild(c);setTimeout(()=>c.remove(),6000)}

function renderBuenas(){const arr=(state.buenas||[]).sort((a,b)=>(a.orden||0)-(b.orden||0));if(!arr.length){$('#bestPracticeHero').innerHTML='<div class="notice">No hay buenas prácticas cargadas.</div>';$('#bestPracticeList').innerHTML='';return}const f=arr[0];$('#bestPracticeHero').innerHTML=`<h3>${esc(f.titulo)}</h3><p>${esc(f.resumen)}</p>${f.archivoUrl?`<a class="btn primary" target="_blank" href="${esc(f.archivoUrl)}">Ver documento</a>`:''}`;$('#bestPracticeList').innerHTML=arr.slice(1).map(x=>`<div class="best-card"><b>${esc(x.titulo)}</b><p>${esc(x.resumen)}</p>${x.archivoUrl?`<p><a target="_blank" href="${esc(x.archivoUrl)}">Abrir recurso</a></p>`:''}</div>`).join('')}
function unlockBuenas(){const key=prompt('Clave de acceso a la zona restringida:');if(key==='Unacem2026'){$('#adminBuenasPanel').classList.remove('hidden')}else if(key)showModal('Clave incorrecta','No se habilitó la zona restringida.')}
async function saveBuenaPractica(){const titulo=$('#bpTitulo').value.trim(),resumen=$('#bpResumen').value.trim();if(!titulo||!resumen)return showModal('Faltan datos','Completa título y resumen.');try{const archivo=await fileToObj($('#bpArchivo'));await api('saveBuenaPractica',{key:'Unacem2026',item:{titulo,codigo:$('#bpCodigo').value.trim(),orden:Number($('#bpOrden').value||1),resumen,detalle:$('#bpDetalle').value.trim(),archivo}});await refreshData();showModal('Buena práctica guardada','La nueva buena práctica ya está disponible.')}catch(e){showModal('Error',e.message)}}

async function loadReview(token){try{const x=await api('getReview',{token});$('#reviewRecord').innerHTML=`<div class="review-box"><div><h3>${esc(x.tipoLabel||x.tipo)}</h3>${Object.entries(x.data||{}).filter(([k])=>!k.startsWith('_')).map(([k,v])=>`<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join('')}</div><div><h3>Acción de revisión</h3><label>Comentarios<textarea id="reviewComment"></textarea></label><div class="review-actions"><button class="btn primary" onclick="submitReview('${token}','Aprobado')">Aprobar</button><button class="btn danger" onclick="submitReview('${token}','Observado')">Observar</button></div></div></div>`}catch(e){$('#reviewRecord').innerHTML=`<div class="notice warning">${esc(e.message)}</div>`}}
window.submitReview=async(token,status)=>{const comment=$('#reviewComment').value.trim();if(status==='Observado'&&!comment)return showModal('Comentario requerido','Indica por qué el registro queda observado.');try{await api('reviewRecord',{token,status,comment});showModal('Revisión guardada',`El registro quedó como ${status}.`);await loadReview(token)}catch(e){showModal('Error',e.message)}};

init();
