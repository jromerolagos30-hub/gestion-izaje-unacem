
const cfg=window.APP_CONFIG||{}, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ASSISTANT_WEBHOOK_URL='https://jonathanrl.app.n8n.cloud/webhook/chatbot-sst-docs';
Chart.register(ChartDataLabels);
const DIFFUSION_CATS=['Buenas Prácticas UNACEM PERÚ','Lecciones Aprendidas'];
const OPERATIONAL_CATS=[
'Safety Start IMC',
'Modelo de Plan de Izaje Crítico',
'Cálculo de Tensiones',
'Capacitaciones de Competencias y Autorización IMC',
'Zona de Crecimiento - IMC',
'Izajes Repetitivos críticos con Grúas fijas'
];
const state={empresas:[],tipos:[],competencias:[],certificadoras:[],aprobadores:[],equipos:[],personal:[],buenas:[],controles:[],mapData:[],eqBatch:[],peBatch:[],charts:{},reviewUnlocked:false,statusChartSelection:{company:'',status:''}};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const fmtDate=v=>{if(!v)return'';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleDateString('es-PE')};
const addYears=(v,n)=>{if(!v)return'';const d=new Date(v+'T12:00:00');d.setFullYear(d.getFullYear()+n);return d.toISOString().slice(0,10)};
function statusBadge(v){const n=norm(v);let c=n.includes('aprob')?'aprobado':n.includes('revision')?'revision':n.includes('observ')?'observado':n.includes('operativo')?'operativo':n.includes('inoper')?'inoperativo':n.includes('fuera')?'fuera':n.includes('cumpl')?'cumplido':n.includes('venc')?'vencido':'';return `<span class="status ${c}">${esc(v||'')}</span>`}
async function api(action,payload={}){if(!cfg.API_URL||cfg.API_URL.includes('PEGA_AQUI'))throw new Error('Configura API_URL en config.js con tu URL /exec de Apps Script.');const r=await fetch(cfg.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})});const j=await r.json();if(!j.ok)throw new Error(j.error||'Error del servidor');return j.data}
function go(view){$$('.view').forEach(x=>x.classList.remove('active'));$('#view-'+view)?.classList.add('active');$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));if(view==='equipos')renderEquiposStats();if(view==='personal')renderPersonalStats();if(view==='seguimiento')renderSeguimiento();if(view==='mapa')renderMapa();if(view==='difusion')renderDifusion();if(view==='controles'){renderOperationalMaterials();renderControles();}if(view==='revision'&&state.reviewUnlocked)renderReviewQueue();window.scrollTo({top:0,behavior:'smooth'})}
function assistantEndpoint(){
  return ASSISTANT_WEBHOOK_URL;
}
function setAssistantStatus(text,isError=false){const el=$('#assistantStatus');if(el){el.textContent=text;el.classList.toggle('error',!!isError)}}
function appendAssistantMessage(role,text){
  const root=$('#assistantMessages');if(!root)return;
  const row=document.createElement('div');row.className=`assistant-message ${role==='user'?'user':'bot'}`;
  if(role!=='user'){const av=document.createElement('div');av.className='assistant-avatar';av.textContent='✦';row.appendChild(av)}
  const bubble=document.createElement('div');bubble.className='assistant-bubble';bubble.textContent=String(text||'');row.appendChild(bubble);root.appendChild(row);root.scrollTop=root.scrollHeight;
}
function clearAssistantChat(){
  const root=$('#assistantMessages');if(!root)return;
  root.innerHTML='<div class="assistant-message bot"><div class="assistant-avatar">✦</div><div class="assistant-bubble">Hola, soy tu Asistente IA de Izaje. Puedes preguntarme sobre izajes críticos, competencias del rigger, inspecciones, permisos, grúas, tecles, tirfor, accesorios y otros requisitos disponibles en el repositorio.</div></div>';
  setAssistantStatus('Las respuestas se generan a partir de la documentación disponible.');
}
function configureAssistantEndpoint(){
  return true;
}
async function sendAssistantQuestion(question){
  const q=String(question||$('#assistantInput')?.value||'').trim();if(!q)return;
  const endpoint=assistantEndpoint();
  appendAssistantMessage('user',q);if($('#assistantInput'))$('#assistantInput').value='';
  const btn=$('#btnSendAssistant');if(btn)btn.disabled=true;setAssistantStatus('Consultando el repositorio documental...');
  const loadingId='assistant-loading-'+Date.now();
  const root=$('#assistantMessages');if(root){const row=document.createElement('div');row.id=loadingId;row.className='assistant-message bot';row.innerHTML='<div class="assistant-avatar">✦</div><div class="assistant-bubble assistant-typing">Analizando documentos…</div>';root.appendChild(row);root.scrollTop=root.scrollHeight}
  try{
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatInput:q,message:q,question:q,source:'gestion-izaje-unacem'})});
    const raw=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}: ${raw.slice(0,180)}`);
    let answer=raw;try{const j=JSON.parse(raw);answer=j.output||j.answer||j.response||j.text||raw}catch(_){ }
    $('#'+loadingId)?.remove();appendAssistantMessage('bot',answer||'No se recibió una respuesta del asistente.');setAssistantStatus('Respuesta generada con consulta al repositorio documental.');
  }catch(e){
    $('#'+loadingId)?.remove();appendAssistantMessage('bot','No fue posible consultar el asistente en este momento. Verifica la conexión del webhook de producción.');setAssistantStatus(e.message||'Error de conexión',true);
  }finally{if(btn)btn.disabled=false}
}
function showModal(title,html){$('#modalContent').innerHTML=`<h2>${esc(title)}</h2>${html}`;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}
function disableDuring(btn,fn){return async()=>{if(btn.disabled)return;btn.disabled=true;const old=btn.textContent;btn.textContent='Procesando...';try{await fn()}catch(e){showModal('Error',`<p>${esc(e.message)}</p>`)}finally{btn.disabled=false;btn.textContent=old}}}
async function filesToObjs(input,max=10){const files=[...(input.files||[])].slice(0,max);return Promise.all(files.map(f=>new Promise((res,rej)=>{const rd=new FileReader();rd.onload=()=>res({name:f.name,mimeType:f.type,base64:String(rd.result).split(',')[1]});rd.onerror=rej;rd.readAsDataURL(f)})))}
function setOptions(sel,items,placeholder='Seleccionar'){if(!sel)return;sel.innerHTML=`<option value="">${placeholder}</option>`+items.map(x=>`<option>${esc(x)}</option>`).join('')}
function countBy(arr,key){const o={};arr.forEach(x=>{const k=x[key]||'Sin dato';o[k]=(o[k]||0)+1});return o}
function colors(n){return ['#ed1c24','#3ba0df','#22a05a','#f0ae22','#805ad5','#64748b','#e8793c','#0f766e'].slice(0,Math.max(1,n))}
function drawChart(id,type,data,key,legend=true){const el=$('#'+id);if(!el)return;if(state.charts[key])state.charts[key].destroy();const labels=Object.keys(data),vals=Object.values(data);state.charts[key]=new Chart(el,{type,data:{labels,datasets:[{label:'Cantidad',data:vals,backgroundColor:colors(labels.length),borderWidth:type==='doughnut'?1:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:legend,position:'bottom'},datalabels:{color:type==='doughnut'?'#fff':'#263442',anchor:type==='bar'?'end':'center',align:type==='bar'?'top':'center',font:{weight:'700'},formatter:v=>v||''}},scales:type==='bar'?{y:{beginAtZero:true,ticks:{precision:0}}}:{}}})}
const stackTotalsPlugin={id:'stackTotals',afterDatasetsDraw(chart){const{ctx,scales}=chart;if(!scales?.x||!scales?.y)return;ctx.save();ctx.fillStyle='#172536';ctx.font='700 12px Inter, Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';chart.data.labels.forEach((_,i)=>{const total=chart.data.datasets.reduce((s,ds)=>s+(Number(ds.data[i])||0),0);if(!total)return;ctx.fillText(`Total ${total}`,scales.x.getPixelForValue(i),scales.y.getPixelForValue(total)-5)});ctx.restore()}};

function getStatusChartSelection(){
  state.statusChartSelection=state.statusChartSelection||{company:'',status:''};
  return state.statusChartSelection;
}
function clearStatusChartSelection(){
  state.statusChartSelection={company:'',status:''};
}
function toggleStatusChartSelection(company,status,target){
  const cur=getStatusChartSelection();
  if(cur.company===company&&norm(cur.status)===norm(status)){
    clearStatusChartSelection();
  }else{
    state.statusChartSelection={company,status};
  }
  renderSeguimiento();
  setTimeout(()=>$('#'+target)?.scrollIntoView({behavior:'smooth',block:'start'}),100);
}
function manualStatusFilters(){
  const emp=$('#fEmpresa')?.value||'',eq=$('#fEquipo')?.value||'',st=$('#fEstado')?.value||'',q=norm($('#fSearch')?.value||'');
  return{
    fe:(state.equipos||[]).filter(x=>(!emp||x.empresa===emp)&&(!eq||x.tipo===eq)&&(!st||x.estadoRevision===st)&&(!q||norm(JSON.stringify(x)).includes(q))),
    fp:(state.personal||[]).filter(x=>(!emp||x.empresa===emp)&&(!st||x.estadoRevision===st)&&(!q||norm(JSON.stringify(x)).includes(q)))
  };
}
function applyInteractiveStatusSelection(arr){
  const sel=getStatusChartSelection();
  if(!sel.company&&!sel.status)return arr;
  return arr.filter(x=>(!sel.company||x.empresa===sel.company)&&(!sel.status||norm(x.estadoRevision)===norm(sel.status)));
}
function drawCompanyStatus(id,arr,key,targetTable){
  const el=$('#'+id);if(!el)return;
  if(state.charts[key])state.charts[key].destroy();
  const companies=[...new Set(arr.map(x=>x.empresa||'Sin empresa'))];
  const statuses=['Aprobado','En revisión','Observado'];
  const palette=['#22a05a','#f0ae22','#ed1c24'];
  const selectedColor='#172536';
  const sel=getStatusChartSelection();
  const datasets=statuses.map((s,i)=>({
    label:s,
    data:companies.map(c=>arr.filter(x=>(x.empresa||'Sin empresa')===c&&norm(x.estadoRevision)===norm(s)).length),
    backgroundColor:companies.map(c=>(sel.company===c&&norm(sel.status)===norm(s))?selectedColor:palette[i]),
    borderColor:companies.map(c=>(sel.company===c&&norm(sel.status)===norm(s))?'#172536':'#fff'),
    borderWidth:companies.map(c=>(sel.company===c&&norm(sel.status)===norm(s))?3:1)
  }));
  state.charts[key]=new Chart(el,{
    type:'bar',
    data:{labels:companies,datasets},
    plugins:[stackTotalsPlugin],
    options:{
      responsive:true,maintainAspectRatio:false,layout:{padding:{top:22}},
      onClick:(evt,elements,chart)=>{
        if(!elements.length)return;
        const hit=elements[0];
        toggleStatusChartSelection(
          chart.data.labels[hit.index],
          chart.data.datasets[hit.datasetIndex].label,
          targetTable
        );
      },
      onHover:(evt,elements)=>{if(evt.native?.target)evt.native.target.style.cursor=elements.length?'pointer':'default'},
      plugins:{
        legend:{position:'bottom',labels:{boxWidth:28,padding:14}},
        datalabels:{display:ctx=>Number(ctx.dataset.data[ctx.dataIndex])>0,color:'#fff',anchor:'center',align:'center',clamp:true,font:{weight:'800',size:13},textStrokeColor:'rgba(0,0,0,.22)',textStrokeWidth:2,formatter:v=>v>0?String(v):''},
        tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.raw}`,footer:()=> 'Clic para filtrar las tablas · clic nuevamente para quitar filtro'}}
      },
      scales:{x:{stacked:true,ticks:{autoSkip:false,maxRotation:25,minRotation:0}},y:{stacked:true,beginAtZero:true,ticks:{precision:0,stepSize:1}}}
    }
  });
}
async function refreshData(){const d=await api('getData');Object.assign(state,d);populateSelectors();renderHome();renderEquiposStats();renderPersonalStats();renderSeguimiento();renderDifusion();renderOperationalMaterials();renderControles();renderReviewQueue();renderMapa()}
function populateSelectors(){const emps=(state.empresas||[]).filter(x=>String(x.activo||'SI').toUpperCase()!=='NO').map(x=>x.empresa);['eqEmpresa','peEmpresa','fEmpresa','mapEmpresa','coEmpresa','coFiltroEmpresa','rvEmpresa'].forEach(id=>setOptions($('#'+id),emps,['fEmpresa','mapEmpresa','coFiltroEmpresa','rvEmpresa'].includes(id)?'Todas las empresas':'Seleccionar empresa'));setOptions($('#eqTipo'),state.tipos||[],'Seleccionar equipo');setOptions($('#peCapacitacion'),state.competencias||[],'Seleccionar competencia');setOptions($('#fEquipo'),state.tipos||[],'Todos los equipos');const certBase=[...(state.certificadoras||[])];
const certFallback=['COPMEC','Operatec','Certifica','CS BEAVER','Bureau Veritas','Industry Certificaciones','SGS'];
certFallback.forEach(x=>{if(!certBase.some(v=>norm(v)===norm(x)))certBase.push(x)});
setOptions($('#eqCertificadora'),[...certBase,'Certificado del propio fabricante','Otro'],'Seleccionar certificadora');if($('#dfEmpresa'))setOptions($('#dfEmpresa'),emps,'Todas las empresas');if($('#opBpCategoria'))setOptions($('#opBpCategoria'),OPERATIONAL_CATS,'Seleccionar apartado')}
function renderHome(){renderHomeMapPreview()}
function renderEquiposStats(){const a=state.equipos||[];if($('#eqKpis'))$('#eqKpis').innerHTML=[['Equipos registrados',a.length,'Total'],['Aprobados',a.filter(x=>norm(x.estadoRevision).includes('aprob')).length,'Validados'],['Observados',a.filter(x=>norm(x.estadoRevision).includes('observ')).length,'Por levantar']].map(k=>`<div class="kpi"><div class="label">${k[0]}</div><div class="value">${k[1]}</div><div class="sub">${k[2]}</div></div>`).join('');drawChart('chartEquiposTipo','doughnut',countBy(a,'tipo'),'eqTipo',true);drawChart('chartEquiposRevision','doughnut',countBy(a,'estadoRevision'),'eqRev',true)}
function renderPersonalStats(){const a=state.personal||[];if($('#peKpis'))$('#peKpis').innerHTML=[['Personal registrado',a.length,'Total'],['Aprobados',a.filter(x=>norm(x.estadoRevision).includes('aprob')).length,'Validados'],['Observados',a.filter(x=>norm(x.estadoRevision).includes('observ')).length,'Por levantar']].map(k=>`<div class="kpi"><div class="label">${k[0]}</div><div class="value">${k[1]}</div><div class="sub">${k[2]}</div></div>`).join('');drawChart('chartPersonalCap','doughnut',countBy(a,'capacitacion'),'peCap',true);drawChart('chartPersonalRevision','doughnut',countBy(a,'estadoRevision'),'peRev',true)}
function equipmentCertUI(){const v=$('#eqCertificadora').value,other=v==='Otro',manufacturer=v==='Certificado del propio fabricante';$('#eqOtraWrap').classList.toggle('hidden',!other);$('#eqFabricanteWrap').classList.toggle('hidden',!manufacturer);const special=other||manufacturer;$('#eqArchivoLabel').childNodes[0].nodeValue=special?'Certificado de Operatividad / Ficha Técnica / Orden de Compra*':'Certificado de Operatividad / Ficha Técnica*';$('#eqFechaOptional').textContent=manufacturer?'(opcional si no figura en el certificado)':'';const w=$('#eqWarning');if(other){w.textContent='La empresa certificadora no está en la lista homologada. El registro quedará en evaluación por UNACEM.';w.classList.remove('hidden')}else if(manufacturer){w.textContent='Si el certificado del fabricante no cuenta con fecha de certificación, adjunta la Orden de Compra que valide la fecha de adquisición. El registro quedará en evaluación por UNACEM.';w.classList.remove('hidden')}else w.classList.add('hidden')}
function clearEquipo(){['eqMarca','eqModelo','eqSerie','eqCapacidad','eqLugar','eqOtraCertificadora','eqFabricante','eqFechaCert','eqVigencia'].forEach(id=>$('#'+id).value='');$('#eqArchivo').value=''}
async function addEquipo(){const cert=$('#eqCertificadora').value,manufacturer=cert==='Certificado del propio fabricante',other=cert==='Otro';if(!$('#eqEmpresa').value||!$('#eqTipo').value||!$('#eqSerie').value||!cert)return showModal('Faltan datos','<p>Completa Empresa, Tipo de equipo, N° serie y Empresa certificadora.</p>');if(other&&!$('#eqOtraCertificadora').value.trim())return showModal('Falta certificadora','<p>Indica el nombre de la empresa certificadora.</p>');if(manufacturer&&!$('#eqFabricante').value.trim())return showModal('Falta fabricante','<p>Indica el nombre del fabricante.</p>');if(!manufacturer&&!$('#eqFechaCert').value)return showModal('Falta fecha','<p>La fecha de certificación es obligatoria salvo certificado del fabricante sin fecha.</p>');const files=await filesToObjs($('#eqArchivo'),8);if(!files.length)return showModal('Adjunto requerido','<p>Adjunta al menos un documento.</p>');state.eqBatch.push({empresa:$('#eqEmpresa').value,sede:$('#eqSede').value,tipo:$('#eqTipo').value,estado:$('#eqEstado').value,marca:$('#eqMarca').value,modelo:$('#eqModelo').value,serie:$('#eqSerie').value,capacidad:$('#eqCapacidad').value,lugar:$('#eqLugar').value,certificadora:cert,otraCertificadora:$('#eqOtraCertificadora').value,fabricante:$('#eqFabricante').value,fechaCert:$('#eqFechaCert').value,vigencia:$('#eqFechaCert').value?addYears($('#eqFechaCert').value,1):'',archivos:files});renderEqBatch();clearEquipo()}
function renderEqBatch(){$('#eqBatchCount').textContent=`${state.eqBatch.length} equipos`;$('#eqBatchTable').innerHTML=tableSimple(state.eqBatch,['empresa','tipo','marca','serie','capacidad','certificadora'],['Empresa','Equipo','Marca','Serie','Capacidad','Certificadora'])}
async function saveEquipos(){if(!state.eqBatch.length)return showModal('Sin registros','<p>Agrega al menos un equipo.</p>');const r=await api('saveEquipos',{items:state.eqBatch});state.eqBatch=[];renderEqBatch();await refreshData();showModal('Registro enviado',`<p>Se registraron <b>${r.count}</b> equipos. La información quedó En revisión.</p>`)}
function clearPersonal(){['peNombre','peDni','peFecha','peVigencia'].forEach(id=>$('#'+id).value='');$('#peCapEmpresa').value='ISEM';$('#peArchivo').value=''}
async function addPersonal(){if(!$('#peEmpresa').value||!$('#peNombre').value||!$('#peDni').value||!$('#peCapacitacion').value||!$('#peFecha').value)return showModal('Faltan datos','<p>Completa los campos obligatorios.</p>');const files=await filesToObjs($('#peArchivo'),6);if(!files.length)return showModal('Adjunto requerido','<p>Adjunta el certificado.</p>');state.peBatch.push({empresa:$('#peEmpresa').value,sede:$('#peSede').value,nombre:$('#peNombre').value,dni:$('#peDni').value,capacitacion:$('#peCapacitacion').value,fecha:$('#peFecha').value,vigencia:addYears($('#peFecha').value,2),empresaCapacitadora:'ISEM',archivos:files});renderPeBatch();clearPersonal()}
function renderPeBatch(){$('#peBatchCount').textContent=`${state.peBatch.length} personas`;$('#peBatchTable').innerHTML=tableSimple(state.peBatch,['empresa','nombre','dni','capacitacion','fecha','vigencia'],['Empresa','Nombre','DNI','Competencia','Fecha','Vigencia'])}
async function savePersonal(){if(!state.peBatch.length)return showModal('Sin registros','<p>Agrega al menos una competencia.</p>');const r=await api('savePersonal',{items:state.peBatch});state.peBatch=[];renderPeBatch();await refreshData();showModal('Registro enviado',`<p>Se registraron <b>${r.count}</b> competencias. La información quedó En revisión.</p>`)}
function tableSimple(arr,keys,heads){return `<div class="table-wrap"><table class="data-table"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${arr.map(x=>`<tr>${keys.map(k=>`<td>${esc(x[k]||'')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${heads.length}">Sin registros</td></tr>`}</tbody></table></div>`}

function filtered(){
  const base=manualStatusFilters();
  return{fe:applyInteractiveStatusSelection(base.fe),fp:applyInteractiveStatusSelection(base.fp)};
}
function renderSeguimiento(){
  const base=manualStatusFilters();
  const fe=applyInteractiveStatusSelection(base.fe),fp=applyInteractiveStatusSelection(base.fp);
  const sel=getStatusChartSelection();

  $('#trackKpis').innerHTML=[
    ['Equipos',fe.length,'Inventario filtrado'],
    ['Personal',fp.length,'Competencias filtradas'],
    ['Aprobados',fe.filter(x=>norm(x.estadoRevision).includes('aprob')).length+fp.filter(x=>norm(x.estadoRevision).includes('aprob')).length,'Validados'],
    ['Observados',fe.filter(x=>norm(x.estadoRevision).includes('observ')).length+fp.filter(x=>norm(x.estadoRevision).includes('observ')).length,'Por levantar']
  ].map(k=>`<div class="kpi"><div class="label">${k[0]}</div><div class="value">${k[1]}</div><div class="sub">${k[2]}</div></div>`).join('');

  // Las gráficas conservan TODAS las barras de los filtros superiores.
  drawCompanyStatus('chartEquiposEmpresaStatus',base.fe,'eqCompany','trackEquiposTable');
  drawCompanyStatus('chartPersonalEmpresaStatus',base.fp,'peCompany','trackPersonalTable');

  // Tablas y gráficos secundarios sí responden al clic interactivo.
  drawChart('chartTrackEquiposTipo','doughnut',countBy(fe,'tipo'),'trackEqType',true);
  drawChart('chartTrackPersonalCap','doughnut',countBy(fp,'capacitacion'),'trackPeCap',true);
  $('#trackEquiposTable').innerHTML=trackTable(fe,'equipo');
  $('#trackPersonalTable').innerHTML=trackTable(fp,'personal');

  // Indicador de filtro por clic
  const host=$('#trackKpis')?.parentElement;
  let info=$('#statusChartSelectionInfo');
  if(!info&&host){
    info=document.createElement('div');
    info.id='statusChartSelectionInfo';
    info.className='status-chart-selection-info';
    host.insertBefore(info,$('#trackKpis'));
  }
  if(info){
    if(sel.company||sel.status){
      info.innerHTML=`<span>Selección por gráfico: <b>${esc(sel.company)}</b> · <b>${esc(sel.status)}</b></span><button id="btnClearStatusChartSelection" class="link-btn">Quitar selección</button>`;
      info.classList.add('active');
      $('#btnClearStatusChartSelection')?.addEventListener('click',()=>{clearStatusChartSelection();renderSeguimiento()});
    }else{
      info.innerHTML='Haz clic en una barra para filtrar las tablas. La barra seleccionada se marcará en color oscuro; vuelve a hacer clic para deseleccionarla.';
      info.classList.remove('active');
    }
  }
}
function trackTable(arr,type){const isEq=type==='equipo';const heads=isEq?['Empresa','Equipo','Serie','Capacidad','Certificadora','Vigencia','Estado','Observación','Acciones']:['Empresa','Nombre','DNI','Competencia','Fecha','Vigencia','Estado','Observación','Acciones'];return `<div class="table-wrap"><table class="data-table"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${arr.map(x=>`<tr>${isEq?`<td>${esc(x.empresa)}</td><td>${esc(x.tipo)}</td><td>${esc(x.serie)}</td><td>${esc(x.capacidad)}</td><td>${esc(x.certificadoraFinal||x.certificadora)}</td><td>${fmtDate(x.vigencia)}</td>`:`<td>${esc(x.empresa)}</td><td>${esc(x.nombre)}</td><td>${esc(x.dni)}</td><td>${esc(x.capacitacion)}</td><td>${fmtDate(x.fecha)}</td><td>${fmtDate(x.vigencia)}</td>`}<td>${statusBadge(x.estadoRevision)}</td><td>${esc(x.observacion||'')}</td><td><button class="link-btn" onclick="viewRecord('${type}','${x.id}')">Ver registro</button> <button class="link-btn" onclick="editRecord('${type}','${x.id}')">${norm(x.estadoRevision).includes('observ')?'Levantar observación':'Editar'}</button> <button class="link-btn" onclick="deleteRecord('${type}','${x.id}','${esc(x.empresa)}')">Eliminar</button></td></tr>`).join('')||`<tr><td colspan="9">Sin registros</td></tr>`}</tbody></table></div>`}
function parseUrls(v){if(Array.isArray(v))return v;if(!v)return[];try{return JSON.parse(v)}catch(e){return String(v).split('|').filter(Boolean)}}
function driveId(url){const s=String(url||'');const m=s.match(/\/d\/([\w-]+)/)||s.match(/[?&]id=([\w-]+)/);return m?m[1]:''}
function drivePreview(url){const id=driveId(url);return id?`https://drive.google.com/file/d/${id}/preview`:url}
function driveThumb(url){const id=driveId(url);return id?`https://drive.google.com/thumbnail?id=${id}&sz=w1600`:url}
function attachmentsHtml(v){const urls=parseUrls(v);if(!urls.length)return'<div class="notice">Sin documentos adjuntos.</div>';return `<h3>Documentos adjuntos</h3><div class="attachment-grid">${urls.map((u,i)=>`<div class="attachment-view"><img src="${esc(driveThumb(u))}" alt="Vista previa documento ${i+1}" onerror="this.style.display='none'"><div style="padding:8px"><a class="btn secondary" href="${esc(u)}" target="_blank">Abrir archivo ${i+1}</a></div></div>`).join('')}</div>`}
function recordDetailHtml(x){const omit=['id','archivos','archivoUrls'];const details=Object.entries(x).filter(([k,v])=>!omit.includes(k)&&v!==''&&v!=null).map(([k,v])=>`<div class="detail-item"><b>${esc(k)}</b>${esc(v)}</div>`).join('');return `<div class="detail-grid">${details}</div>${attachmentsHtml(x.archivos||x.archivoUrls||[])}`}
window.viewRecord=(type,id)=>{const x=(type==='equipo'?state.equipos:state.personal).find(r=>r.id===id);if(x)showModal(type==='equipo'?'Detalle del equipo':'Detalle de competencia',recordDetailHtml(x))}
window.deleteRecord=async(type,id,empresa)=>{const key=prompt('Ingrese la clave de eliminación:');if(!key)return;try{await api('deleteRecord',{type,id,key});await refreshData();showModal('Registro eliminado','<p>El registro fue eliminado correctamente.</p>')}catch(e){showModal('No se pudo eliminar',`<p>${esc(e.message)}</p>`)}}
window.editRecord=(type,id)=>{const x=(type==='equipo'?state.equipos:state.personal).find(r=>r.id===id);if(!x)return;const observed=norm(x.estadoRevision).includes('observ');const common=`${observed?`<div class="notice warning"><b>Observación UNACEM:</b> ${esc(x.observacion||'')}</div>`:''}${attachmentsHtml(x.archivos)}`;if(type==='equipo'){showModal(observed?'Levantar observación del equipo':'Editar equipo',`${common}<div class="form-grid form-grid-3" style="margin-top:14px"><label>Marca<input id="editMarca" value="${esc(x.marca)}"></label><label>Modelo<input id="editModelo" value="${esc(x.modelo)}"></label><label>Serie<input id="editSerie" value="${esc(x.serie)}"></label><label>Capacidad TON<input id="editCapacidad" value="${esc(x.capacidad)}"></label><label>Lugar<input id="editLugar" value="${esc(x.lugar)}"></label><label>Fecha certificación<input id="editFechaCert" type="date" value="${dateInput(x.fechaCert)}"></label><label>Vigencia<input id="editVigencia" type="date" value="${dateInput(x.vigencia)}" readonly></label><label class="span-2">Agregar documentos para levantar observación<input id="editFiles" type="file" multiple accept="image/*,.pdf"></label><label class="span-3">Comentario de la empresa<textarea id="editComment" rows="3">${esc(x.observacionEmpresa||'')}</textarea></label></div><button id="btnSaveEdit" class="btn primary full" style="margin-top:12px" onclick="saveFullEdit('equipo','${id}')">Enviar actualización a revisión</button>`);setTimeout(()=>{$('#editFechaCert').onchange=()=>$('#editVigencia').value=$('#editFechaCert').value?addYears($('#editFechaCert').value,1):''},0)}else{showModal(observed?'Levantar observación de competencia':'Editar competencia',`${common}<div class="form-grid form-grid-3" style="margin-top:14px"><label>Nombre<input id="editNombre" value="${esc(x.nombre)}"></label><label>DNI<input id="editDni" value="${esc(x.dni)}"></label><label>Capacitación<input id="editCap" value="${esc(x.capacitacion)}"></label><label>Fecha capacitación<input id="editFecha" type="date" value="${dateInput(x.fecha)}"></label><label>Vigencia<input id="editVigencia" type="date" value="${dateInput(x.vigencia)}" readonly></label><label>Empresa capacitadora<input value="ISEM" readonly></label><label class="span-2">Agregar documentos para levantar observación<input id="editFiles" type="file" multiple accept="image/*,.pdf"></label><label class="span-3">Comentario de la empresa<textarea id="editComment" rows="3">${esc(x.observacionEmpresa||'')}</textarea></label></div><button id="btnSaveEdit" class="btn primary full" style="margin-top:12px" onclick="saveFullEdit('personal','${id}')">Enviar actualización a revisión</button>`);setTimeout(()=>{$('#editFecha').onchange=()=>$('#editVigencia').value=$('#editFecha').value?addYears($('#editFecha').value,2):''},0)}}
function dateInput(v){if(!v)return'';const d=new Date(v);return isNaN(d)?String(v).slice(0,10):d.toISOString().slice(0,10)}
window.saveFullEdit=async(type,id)=>{const btn=$('#btnSaveEdit');if(btn.disabled)return;btn.disabled=true;btn.textContent='Procesando...';try{const newFiles=await filesToObjs($('#editFiles'),8);let updates;if(type==='equipo')updates={Marca:$('#editMarca').value,Modelo:$('#editModelo').value,Serie:$('#editSerie').value,Capacidad:$('#editCapacidad').value,Lugar:$('#editLugar').value,FechaCertificacion:$('#editFechaCert').value,Vigencia:$('#editVigencia').value,ObservacionEmpresa:$('#editComment').value};else updates={Nombre:$('#editNombre').value,DNI:$('#editDni').value,Capacitacion:$('#editCap').value,FechaCapacitacion:$('#editFecha').value,Vigencia:$('#editVigencia').value,EmpresaCapacitadora:'ISEM',ObservacionEmpresa:$('#editComment').value};await api('updateRecord',{type,id,updates,newFiles});closeModal();await refreshData();showModal('Actualización enviada','<p>El registro volvió a estado <b>En revisión</b> con los nuevos documentos adjuntos.</p>')}catch(e){showModal('Error',`<p>${esc(e.message)}</p>`)}finally{if(btn){btn.disabled=false;btn.textContent='Enviar actualización a revisión'}}}
window.exportMasterPDF=(type)=>{const {jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});const arr=type==='equipos'?filtered().fe:filtered().fp;doc.setFontSize(15);doc.text(type==='equipos'?'MASTER DE EQUIPOS DE IZAJE':'MASTER DE COMPETENCIAS DEL PERSONAL',14,13);doc.setFontSize(8);doc.text('UNACEM - Gestión de Izaje Mecánico de Cargas',14,18);let heads,body;if(type==='equipos'){heads=[['Empresa','Sede','Tipo','Marca','Modelo','Serie','Cap. TON','Estado Equipo','Certificadora','Fecha Cert.','Vigencia','Estado Revisión','Observación']];body=arr.map(x=>[x.empresa,x.sede,x.tipo,x.marca,x.modelo,x.serie,x.capacidad,x.estado,x.certificadoraFinal||x.certificadora,fmtDate(x.fechaCert),fmtDate(x.vigencia),x.estadoRevision,x.observacion||''])}else{heads=[['Empresa','Sede','Nombre','DNI','Competencia','Fecha Capacitación','Vigencia','Capacitadora','Estado Revisión','Observación']];body=arr.map(x=>[x.empresa,x.sede,x.nombre,x.dni,x.capacitacion,fmtDate(x.fecha),fmtDate(x.vigencia),'ISEM',x.estadoRevision,x.observacion||''])}doc.autoTable({head:heads,body,startY:22,styles:{fontSize:6.5,cellPadding:1.5},headStyles:{fillColor:[237,28,36]},margin:{left:8,right:8}});doc.save(type==='equipos'?'Master_Equipos_Izaje.pdf':'Master_Competencias_Izaje.pdf')}
function markerClass(s){const n=norm(s);return n.includes('program')?'programado':n.includes('final')?'finalizado':n.includes('ejec')?'ejecucion':'otro'}
function positionOverlayOnContainedImage(container,img,overlay){if(!container||!img||!overlay)return;const cw=container.clientWidth,ch=container.clientHeight,nw=img.naturalWidth||2048,nh=img.naturalHeight||1448;if(!cw||!ch||!nw||!nh)return;const scale=Math.min(cw/nw,ch/nh),rw=nw*scale,rh=nh*scale,left=(cw-rw)/2,top=(ch-rh)/2;overlay.style.left=`${left}px`;overlay.style.top=`${top}px`;overlay.style.width=`${rw}px`;overlay.style.height=`${rh}px`;overlay.style.right='auto';overlay.style.bottom='auto'}
function syncMapOverlays(){positionOverlayOnContainedImage($('#plantMap'),$('#plantMapImg'),$('#mapMarkers'));const home=$('.home-map-preview');if(home)positionOverlayOnContainedImage(home,home.querySelector('img'),$('#homeMapMarkers'))}
function groupMapBySector(arr){const m=new Map();arr.filter(x=>x.x!=null&&x.y!=null).forEach(x=>{const key=`${norm(x.sector||'sin sector')}|${Number(x.x).toFixed(4)}|${Number(x.y).toFixed(4)}`;if(!m.has(key))m.set(key,{sector:x.sector||'Trabajo de izaje',x:Number(x.x),y:Number(x.y),items:[]});m.get(key).items.push(x)});return[...m.values()]}
function groupMarkerState(g){if(g.items.some(x=>norm(x.estado).includes('ejec')))return'ejecucion';if(g.items.some(x=>norm(x.estado).includes('program')))return'programado';if(g.items.every(x=>norm(x.estado).includes('final')))return'finalizado';return'otro'}
function renderHomeMapPreview(){const root=$('#homeMapMarkers');if(!root)return;root.innerHTML='';groupMapBySector(state.mapData||[]).slice(0,50).forEach(g=>{const wrap=document.createElement('div');wrap.className='sector-map-marker home-sector-map-marker';wrap.style.left=`${g.x}%`;wrap.style.top=`${g.y}%`;wrap.innerHTML=`<span class="marker ${groupMarkerState(g)}">${g.items.length}</span><span class="sector-map-label">${esc(g.sector)}</span>`;root.appendChild(wrap)});requestAnimationFrame(syncMapOverlays)}

function jsonpTar(action,params={}){
  return new Promise((resolve,reject)=>{
    if(!cfg.TAR_API_URL)return reject(new Error('TAR_API_URL no configurado.'));
    const cb='tarcb_'+Date.now()+'_'+Math.floor(Math.random()*99999);
    const s=document.createElement('script');
    window[cb]=data=>{try{resolve(data)}finally{delete window[cb];s.remove()}};
    const q=new URLSearchParams({action,callback:cb,...params});
    s.src=cfg.TAR_API_URL+'?'+q.toString();
    s.onerror=()=>{delete window[cb];s.remove();reject(new Error('No se pudo consultar el aplicativo de Alto Riesgo.'))};
    document.body.appendChild(s);
  });
}
function tarArr(v){
  if(Array.isArray(v))return v;
  if(!v)return[];
  try{const p=JSON.parse(v);return Array.isArray(p)?p:[v]}catch(e){return String(v).split(' | ').filter(Boolean)}
}
function tarSectorKey(v){return norm(v).trim().replace(/\s+/g,' ')}
function tarIsActive(r){return norm(r.EstadoOperativo||'ACTIVO')!=='finalizado'}
async function loadTarExact(){
  const res=await jsonpTar('bootstrap');
  if(!res?.ok)throw new Error('El aplicativo de Alto Riesgo no devolvió información.');
  const sectores=(res.data?.sectores||[]).map(s=>({
    nombre:s.nombre||s.Nombre||s.Sector||'',
    x:Number(s.x??s.X??0),
    y:Number(s.y??s.Y??0)
  })).filter(s=>s.nombre&&Number.isFinite(s.x)&&Number.isFinite(s.y));
  const sectorMap=Object.fromEntries(sectores.map(s=>[tarSectorKey(s.nombre),s]));
  const regs=(res.data?.registros||[]).filter(tarIsActive).filter(r=>tarArr(r.TrabajoCritico).some(t=>norm(t).includes('izaje')));
  return regs.map(r=>{
    const sector=sectorMap[tarSectorKey(r.Lugar)]||null;
    return {
      empresa:r.Empresa||'',
      sector:r.Lugar||'',
      actividad:r.Descripcion||tarArr(r.TrabajoCritico).join(', '),
      tipoTrabajo:tarArr(r.TrabajoCritico).join(', '),
      estado:r.EstadoOperativo==='FINALIZADO'?'Finalizado':'En ejecución',
      fecha:r.Fecha||'',
      trabajadores:Number(r.NTrabajadores||0),
      x:sector?sector.x:(Number.isFinite(Number(r.X))?Number(r.X):null),
      y:sector?sector.y:(Number.isFinite(Number(r.Y))?Number(r.Y):null)
    };
  });
}
async function reloadMap(){
  try{
    try{state.mapData=await loadTarExact()}
    catch(exactErr){
      console.warn('Se usará el respaldo del backend de Izaje:',exactErr);
      state.mapData=await api('getIzajesTar');
    }
    renderMapa();renderHomeMapPreview();
  }catch(e){showModal('Error al actualizar mapa',`<p>${esc(e.message)}</p>`)}
}

function getMapSelection(){
  state.mapSelection=state.mapSelection||{type:'',value:''};
  return state.mapSelection;
}
function clearMapSelection(){
  state.mapSelection={type:'',value:''};
}
function filteredMapRows(){
  const emp=$('#mapEmpresa')?.value||'',st=$('#mapEstado')?.value||'',q=norm($('#mapSearch')?.value||'');
  let arr=(state.mapData||[]).filter(x=>(!emp||x.empresa===emp)&&(!st||x.estado===st)&&(!q||norm(JSON.stringify(x)).includes(q)));
  const sel=getMapSelection();
  if(sel.type==='empresa'&&sel.value)arr=arr.filter(x=>x.empresa===sel.value);
  if(sel.type==='sector'&&sel.value)arr=arr.filter(x=>norm(x.sector)===norm(sel.value));
  return arr;
}
function renderMapa(){
  const arr=filteredMapRows(),sel=getMapSelection(),mk=$('#mapMarkers');
  if(!mk)return;
  mk.innerHTML='';

  groupMapBySector(arr).forEach(g=>{
    const wrap=document.createElement('div');
    wrap.className='sector-map-marker'+(sel.type==='sector'&&norm(sel.value)===norm(g.sector)?' selected':'');
    wrap.style.left=`${g.x}%`;wrap.style.top=`${g.y}%`;

    const btn=document.createElement('button');
    btn.className=`marker ${groupMarkerState(g)}`;
    btn.type='button';btn.textContent=String(g.items.length);
    btn.title=`${g.sector}: ${g.items.length} trabajo(s)`;
    btn.onclick=e=>{
      e.stopPropagation();
      const cur=getMapSelection();
      state.mapSelection=(cur.type==='sector'&&norm(cur.value)===norm(g.sector))
        ?{type:'',value:''}
        :{type:'sector',value:g.sector};
      renderMapa();
      showMarkerGroup(g,wrap);
    };

    const lab=document.createElement('span');
    lab.className='sector-map-label';lab.textContent=g.sector;
    wrap.append(btn,lab);mk.appendChild(wrap);
  });

  $('#mapKpis').innerHTML=[
    ['Trabajos',arr.length],
    ['Empresas',new Set(arr.map(x=>x.empresa)).size],
    ['En ejecución',arr.filter(x=>norm(x.estado).includes('ejec')).length]
  ].map(k=>`<div class="kpi"><div class="label">${k[0]}</div><div class="value">${k[1]}</div></div>`).join('');

  drawInteractiveMapCompanyChart(arr);
  $('#mapList').innerHTML=tableSimple(arr,['empresa','sector','actividad','estado'],['Empresa','Sector','Actividad','Estado']);

  const mapSection=$('#view-mapa');
  let info=mapSection?.querySelector('.map-selection-info');
  if(!info&&mapSection){
    info=document.createElement('div');
    info.className='map-selection-info';
    const filters=mapSection.querySelector('.filters')?.parentElement;
    if(filters)filters.insertAdjacentElement('afterend',info);
  }
  if(info){
    if(sel.value){
      info.innerHTML=`<span>Filtro interactivo: <b>${esc(sel.type==='empresa'?'Empresa':'Sector')} · ${esc(sel.value)}</b></span><button type="button" id="btnClearMapSelection" class="link-btn">Quitar filtro</button>`;
      $('#btnClearMapSelection')?.addEventListener('click',()=>{clearMapSelection();renderMapa()});
      info.classList.add('active');
    }else{
      info.innerHTML='Haz clic en un punto del plano o en una barra para filtrar simultáneamente plano, gráfica y tabla.';
      info.classList.remove('active');
    }
  }
  requestAnimationFrame(syncMapOverlays);
}
function drawInteractiveMapCompanyChart(arr){
  const el=$('#chartMapEmpresas');if(!el)return;
  if(state.charts.mapEmp)state.charts.mapEmp.destroy();
  const counts=countBy(arr,'empresa'),labels=Object.keys(counts),values=Object.values(counts);
  const baseColors=['#ed1c24','#3da0da','#22a05a','#f0ae22','#7a5af8','#64748b'];
  const sel=getMapSelection();
  state.charts.mapEmp=new Chart(el,{
    type:'bar',
    data:{labels,datasets:[{label:'Trabajos',data:values,backgroundColor:labels.map((x,i)=>sel.type==='empresa'&&sel.value===x?'#172536':baseColors[i%baseColors.length]),borderRadius:2}]},
    plugins:[ChartDataLabels],
    options:{
      responsive:true,maintainAspectRatio:false,
      onClick:(evt,elements,chart)=>{
        if(!elements.length)return;
        const company=chart.data.labels[elements[0].index],cur=getMapSelection();
        state.mapSelection=(cur.type==='empresa'&&cur.value===company)?{type:'',value:''}:{type:'empresa',value:company};
        renderMapa();
      },
      onHover:(evt,elements)=>{if(evt.native?.target)evt.native.target.style.cursor=elements.length?'pointer':'default'},
      plugins:{
        legend:{display:false},
        datalabels:{anchor:'end',align:'top',color:'#172536',font:{weight:'800'},formatter:v=>v||''},
        tooltip:{callbacks:{footer:()=> 'Clic para filtrar plano y tabla'}}
      },
      scales:{y:{beginAtZero:true,ticks:{precision:0,stepSize:1}}}
    }
  });
}
function showMarkerGroup(g,wrap){$$('.marker-card').forEach(e=>e.remove());const c=document.createElement('div');c.className='marker-card';const left=Math.max(5,Math.min(92,g.x+2)),top=Math.max(5,Math.min(88,g.y+2));c.style.left=`${left}%`;c.style.top=`${top}%`;const companies=[...new Set(g.items.map(x=>x.empresa).filter(Boolean))];c.innerHTML=`<b>${esc(g.sector)}</b><br><b>${g.items.length} trabajo(s)</b><br>Empresa(s): ${esc(companies.join(', '))}<hr>${g.items.slice(0,4).map(x=>`${esc(x.actividad||'Trabajo de izaje')} · ${esc(x.estado||'')}`).join('<br>')}${g.items.length>4?`<br>+ ${g.items.length-4} más`:''}`;$('#mapMarkers').appendChild(c);setTimeout(()=>c.remove(),9000)}


const previewCache=new Map();
let pdfJsModulePromise=null;
async function getPdfJs(){
  if(pdfJsModulePromise)return pdfJsModulePromise;
  pdfJsModulePromise=import(window.PDFJS_CDN).then(mod=>{
    mod.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.mjs";
    return mod;
  });
  return pdfJsModulePromise;
}
async function fetchDrivePreview(url){
  if(!url)return null;
  if(previewCache.has(url))return previewCache.get(url);
  const q=api('getDrivePreview',{url}).then(d=>d||null).catch(()=>null);
  previewCache.set(url,q);return q;
}
function dataUrlToUint8(dataUrl){
  const b64=String(dataUrl||'').split(',')[1]||'',bin=atob(b64),arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return arr;
}
async function renderPdfFirstPage(target,dataUrl){
  const pdfjs=await getPdfJs(),pdf=await pdfjs.getDocument({data:dataUrlToUint8(dataUrl)}).promise,page=await pdf.getPage(1);
  const base=page.getViewport({scale:1}),desired=Math.min(Math.max(target.clientWidth||700,320),1100),vp=page.getViewport({scale:desired/base.width});
  const canvas=document.createElement('canvas');canvas.className='pdf-first-page';
  canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
  await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
  target.innerHTML='';target.appendChild(canvas);
}
async function renderPracticePreviewInto(target,url){
  if(!target||!url)return;
  const d=await fetchDrivePreview(url);
  if(!d?.dataUrl){target.innerHTML='<div class="pdf-tile">Vista previa no disponible. Usa Abrir / descargar.</div>';return}
  if(/^image\//i.test(d.mimeType||'')){target.innerHTML=`<img src="${d.dataUrl}" alt="Vista previa" loading="lazy">`;return}
  if((d.mimeType||'').toLowerCase()==='application/pdf'){
    target.innerHTML='<div class="preview-loading">Generando portada del PDF…</div>';
    try{await renderPdfFirstPage(target,d.dataUrl)}catch(e){target.innerHTML='<div class="pdf-tile">No se pudo generar la portada del PDF. Usa Abrir / descargar.</div>'}
    return;
  }
  target.innerHTML='<div class="pdf-tile">Formato sin vista previa. Usa Abrir / descargar.</div>';
}
function practicePreview(url,id=''){
  const u=String(url||'');if(!u)return'<div class="pdf-tile">Sin archivo cargado</div>';
  const token='bpimg_'+String(id||Math.random()).replace(/[^\w-]/g,'');
  setTimeout(()=>{const el=document.getElementById(token);if(el)renderPracticePreviewInto(el,u)},0);
  return `<div id="${token}" class="preview-loading">Cargando vista previa…</div>`;
}

function materialCode(x){
  if(x.codigo)return x.codigo;
  if(norm(x.categoria)===norm('Lecciones Aprendidas')){
    const m=String(x.titulo||'').match(/UEP-LA-\d{4}\.\d{2}-IMC/i);
    return m?m[0].toUpperCase():'LA-IMC';
  }
  return '';
}
function isDiffusionMaterial(x){return DIFFUSION_CATS.some(c=>norm(c)===norm(x.categoria))}
function isOperationalMaterial(x){return OPERATIONAL_CATS.some(c=>norm(c)===norm(x.categoria))}
function bestCardHtml(x,opt={}){
  const diffusion=!!opt.diffusion,u=parseUrls(x.archivoUrl||[])[0]||x.archivoUrl||'',code=materialCode(x);
  const activeCompanies=(state.empresas||[]).filter(e=>String(e.activo||'SI').toUpperCase()!=='NO').length;
  const records=(state.difusion||[]).filter(d=>d.materialId===x.id&&norm(d.estatus)==='difundido');
  const diffCompanies=new Set(records.map(r=>r.empresa)).size,pct=activeCompanies?Math.round(diffCompanies/activeCompanies*100):0;
  return `<article class="best-card ${diffusion?'diffusion-card':''}">
    <div class="material-card-head">${code?`<span class="material-code">${esc(code)}</span>`:''}<h4>${esc(x.titulo)}</h4></div>
    <div class="best-preview">${practicePreview(u,x.id)}</div>
    <p>${esc(x.detalle||'')}</p>
    ${diffusion?`<div class="diffusion-progress"><div><b>Difusión</b><span>${diffCompanies}/${activeCompanies} empresas · ${pct}%</span></div><div class="progress-track"><span style="width:${pct}%"></span></div></div>`:''}
    <div class="action-row">
      <button class="btn secondary" onclick="viewBestPractice('${x.id}')">Ver más grande</button>
      ${u?`<a class="btn primary" href="${esc(u)}" target="_blank">Abrir / descargar</a>`:''}
      ${diffusion?`<button class="btn diffusion" onclick="openDiffusionForm('${x.id}')">Registrar difusión</button><button class="btn secondary" onclick="viewDiffusionCompliance('${x.id}')">Ver cumplimiento</button>`:''}
    </div>
  </article>`;
}
window.viewBestPractice=async id=>{
  const x=(state.buenas||[]).find(r=>r.id===id);if(!x)return;
  const u=parseUrls(x.archivoUrl||[])[0]||x.archivoUrl||'';
  showModal(x.titulo,`<div id="practiceModalPreview" class="practice-modal-scroll"><div class="preview-loading">Cargando vista previa…</div></div><p>${esc(x.detalle||'')}</p>${u?`<a class="btn primary" href="${esc(u)}" target="_blank">Abrir / descargar archivo</a>`:''}`);
  const root=$('#practiceModalPreview');if(root)await renderPracticePreviewInto(root,u);
}
function renderDifusion(){
  const root=$('#diffusionMaterialSections');if(!root)return;
  const all=(state.buenas||[]).filter(isDiffusionMaterial);
  const type=$('#dfTipo')?.value||'',emp=$('#dfEmpresa')?.value||'',st=$('#dfEstado')?.value||'',q=norm($('#dfSearch')?.value||'');
  let mats=all.filter(x=>(!type||norm(x.categoria)===norm(type))&&(!q||norm(`${x.codigo} ${x.titulo} ${x.detalle}`).includes(q)));
  if(emp||st)mats=mats.filter(x=>{
    const rec=(state.difusion||[]).find(d=>d.materialId===x.id&&(!emp||d.empresa===emp));
    if(st==='Difundido')return !!rec&&norm(rec.estatus)==='difundido';
    if(st==='Pendiente')return !rec||norm(rec.estatus)!=='difundido';
    return true;
  });
  root.innerHTML=DIFFUSION_CATS.map(cat=>{
    const items=mats.filter(x=>norm(x.categoria)===norm(cat));
    return `<div class="practice-section panel"><div class="practice-title"><h3>${esc(cat)}</h3><span class="pill neutral">${items.length} material(es)</span></div>${items.length?`<div class="best-list">${items.map(x=>bestCardHtml(x,{diffusion:true})).join('')}</div>`:`<div class="empty-practice">No hay materiales con los filtros seleccionados.</div>`}</div>`;
  }).join('');
  renderDiffusionKpis(all);renderDiffusionMatrix(all);renderAdminMaterialList('difusion');
}
function renderDiffusionKpis(materials){
  const companies=(state.empresas||[]).filter(e=>String(e.activo||'SI').toUpperCase()!=='NO');
  const expected=materials.length*companies.length;
  const completed=new Set((state.difusion||[]).filter(d=>norm(d.estatus)==='difundido').map(d=>`${d.materialId}|${d.empresa}`)).size;
  const pct=expected?Math.round(completed/expected*100):0;
  const full=materials.filter(m=>companies.length&&companies.every(e=>(state.difusion||[]).some(d=>d.materialId===m.id&&d.empresa===e.empresa&&norm(d.estatus)==='difundido'))).length;
  $('#difusionKpis').innerHTML=[['Materiales publicados',materials.length,'Buenas prácticas + lecciones'],['Cumplimiento global',pct+'%','Difusiones registradas'],['Pendientes',Math.max(0,expected-completed),'Empresa × material'],['100% difundidos',full,'Materiales completos']].map(k=>`<div class="kpi"><div class="label">${k[0]}</div><div class="value">${k[1]}</div><div class="sub">${k[2]}</div></div>`).join('');
}
function renderDiffusionMatrix(materials){
  const root=$('#diffusionMatrix');if(!root)return;
  const companies=(state.empresas||[]).filter(e=>String(e.activo||'SI').toUpperCase()!=='NO').map(e=>e.empresa);
  const type=$('#dfTipo')?.value||'',q=norm($('#dfSearch')?.value||'');
  const mats=materials.filter(x=>(!type||norm(x.categoria)===norm(type))&&(!q||norm(`${x.codigo} ${x.titulo}`).includes(q)));
  root.innerHTML=`<div class="table-wrap"><table class="data-table diffusion-matrix"><thead><tr><th>Código</th><th>Material</th>${companies.map(e=>`<th>${esc(e)}</th>`).join('')}</tr></thead><tbody>${mats.map(m=>`<tr><td><b>${esc(materialCode(m))}</b></td><td>${esc(m.titulo)}</td>${companies.map(e=>{const r=(state.difusion||[]).find(d=>d.materialId===m.id&&d.empresa===e&&norm(d.estatus)==='difundido');return `<td class="${r?'cell-ok':'cell-pending'}">${r?'✓':'Pend.'}</td>`}).join('')}</tr>`).join('')||'<tr><td colspan="99">Sin materiales.</td></tr>'}</tbody></table></div>`;
}
window.openDiffusionForm=id=>{
  const x=(state.buenas||[]).find(r=>r.id===id);if(!x)return;
  const empresas=(state.empresas||[]).filter(e=>String(e.activo||'SI').toUpperCase()!=='NO').map(e=>`<option>${esc(e.empresa)}</option>`).join('');
  showModal('Registrar evidencia de difusión',`<div class="notice info"><b>${esc(materialCode(x))}</b> · ${esc(x.titulo)}</div><div class="form-grid form-grid-3" style="margin-top:12px"><label>Empresa*<select id="diffEmpresa"><option value="">Seleccionar empresa</option>${empresas}</select></label><label>Fecha de difusión*<input id="diffFecha" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Responsable*<input id="diffResponsable" placeholder="Nombre del responsable"></label><label class="span-2">Evidencia de difusión*<input id="diffFiles" type="file" multiple accept="image/*,.pdf"></label><label class="span-3">Observación<textarea id="diffObs" rows="3" placeholder="Opcional"></textarea></label></div><div class="notice">Adjunta al menos una evidencia: registro, fotografía o PDF de difusión.</div><button id="btnSaveDiffusion" class="btn primary full" onclick="saveDiffusionEvidence('${id}')">Guardar evidencia de difusión</button>`);
}
window.saveDiffusionEvidence=async id=>{
  const btn=$('#btnSaveDiffusion');if(btn.disabled)return;
  const empresa=$('#diffEmpresa').value,fecha=$('#diffFecha').value,responsable=$('#diffResponsable').value.trim();
  if(!empresa||!fecha||!responsable)return alert('Empresa, fecha y responsable son obligatorios.');
  const evidencias=await filesToObjs($('#diffFiles'),4);if(!evidencias.length)return alert('Adjunta al menos una evidencia de difusión.');
  btn.disabled=true;btn.textContent='Guardando...';
  try{await api('saveDifusion',{item:{materialId:id,empresa,fechaDifusion:fecha,responsable,observacion:$('#diffObs').value.trim(),evidencias}});closeModal();await refreshData();showModal('Difusión registrada','<p>La evidencia quedó registrada con estatus <b>Difundido</b>.</p>')}
  catch(e){showModal('Error',`<p>${esc(e.message)}</p>`)}
  finally{if(btn){btn.disabled=false;btn.textContent='Guardar evidencia de difusión'}}
}
window.viewDiffusionCompliance=id=>{
  const x=(state.buenas||[]).find(r=>r.id===id);if(!x)return;
  const companies=(state.empresas||[]).filter(e=>String(e.activo||'SI').toUpperCase()!=='NO').map(e=>e.empresa);
  const rows=companies.map(e=>{const r=(state.difusion||[]).find(d=>d.materialId===id&&d.empresa===e);return `<tr><td>${esc(e)}</td><td><span class="status ${r?'cumplido':'revision'}">${r?'Difundido':'Pendiente'}</span></td><td>${r?fmtDate(r.fechaDifusion):'—'}</td><td>${r?esc(r.responsable):'—'}</td><td>${r?`<button class="link-btn" onclick="viewDiffusionEvidence('${r.id}')">Ver evidencia</button>`:'—'}</td></tr>`}).join('');
  showModal(`Cumplimiento · ${materialCode(x)}`,`<h3>${esc(x.titulo)}</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Empresa</th><th>Estado</th><th>Fecha</th><th>Responsable</th><th>Evidencia</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}
window.viewDiffusionEvidence=id=>{
  const r=(state.difusion||[]).find(x=>x.id===id);if(!r)return;
  showModal(`Evidencia de difusión · ${r.empresa}`,`<div class="detail-grid"><div class="detail-item"><b>Fecha</b>${fmtDate(r.fechaDifusion)}</div><div class="detail-item"><b>Responsable</b>${esc(r.responsable)}</div><div class="detail-item"><b>Observación</b>${esc(r.observacion||'—')}</div></div>${attachmentsHtml(r.evidencias)}`);
}
function renderOperationalMaterials(){
  const root=$('#operationalMaterialSections');if(!root)return;
  const arr=(state.buenas||[]).filter(isOperationalMaterial);
  root.innerHTML=OPERATIONAL_CATS.map(cat=>{
    const items=arr.filter(x=>norm(x.categoria)===norm(cat));
    return `<div class="practice-section panel"><div class="practice-title"><h3>${esc(cat)}</h3><span class="pill neutral">${items.length} material(es)</span></div>${items.length?`<div class="best-list">${items.map(x=>bestCardHtml(x)).join('')}</div>`:`<div class="empty-practice">Aún no se ha cargado material en este apartado.</div>`}</div>`;
  }).join('');
  renderAdminMaterialList('operacional');
}
function renderAdminMaterialList(scope){
  const isDiff=scope==='difusion',root=$(isDiff?'#adminDifusionList':'#adminOperacionalesList');if(!root)return;
  const arr=(state.buenas||[]).filter(isDiff?isDiffusionMaterial:isOperationalMaterial);
  root.innerHTML=arr.length?arr.map(x=>`<div class="admin-material-row"><div>${x.codigo?`<span class="material-code">${esc(x.codigo)}</span> `:''}<b>${esc(x.titulo)}</b><br><small>${esc(x.categoria)}</small></div><small>${fmtDate(x.fechaRegistro)}</small><div class="admin-material-actions"><button class="btn secondary" onclick="editMaterial('${x.id}','${scope}')">Editar</button><button class="btn danger" onclick="deleteMaterial('${x.id}')">Eliminar</button></div></div>`).join(''):'<div class="empty-practice">No hay materiales cargados.</div>';
}
window.editMaterial=(id,scope)=>{
  const x=(state.buenas||[]).find(r=>r.id===id);if(!x)return;
  const cats=scope==='difusion'?DIFFUSION_CATS:OPERATIONAL_CATS;
  showModal('Editar material UNACEM',`<div class="form-grid form-grid-3"><label>Apartado*<select id="editBpCategoria">${cats.map(c=>`<option ${norm(c)===norm(x.categoria)?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Título*<input id="editBpTitulo" value="${esc(x.titulo)}"></label><label class="span-2">Reemplazar imagen/PDF (opcional)<input id="editBpArchivo" type="file" accept="image/*,.pdf"></label><label class="span-3">Detalle<textarea id="editBpDetalle" rows="4">${esc(x.detalle||'')}</textarea></label></div><button id="btnUpdateBp" class="btn primary full" onclick="saveMaterialEdit('${id}','${scope}')">Guardar cambios</button>`);
}
window.saveMaterialEdit=async(id,scope)=>{
  const btn=$('#btnUpdateBp');if(btn.disabled)return;btn.disabled=true;
  try{const fs=await filesToObjs($('#editBpArchivo'),1);await api('updateBuenaPractica',{key:cfg.ADMIN_KEY,id,item:{categoria:$('#editBpCategoria').value,titulo:$('#editBpTitulo').value.trim(),detalle:$('#editBpDetalle').value.trim(),archivo:fs[0]||null}});previewCache.clear();closeModal();await refreshData();$(scope==='difusion'?'#adminDifusionPanel':'#adminOperacionalesPanel').classList.remove('hidden');showModal('Material actualizado','<p>Los cambios fueron guardados correctamente.</p>')}
  catch(e){showModal('Error',`<p>${esc(e.message)}</p>`)}finally{if(btn)btn.disabled=false}
}
window.deleteMaterial=async id=>{
  const k=prompt('Ingrese la clave de acceso:');if(!k)return;if(!confirm('¿Deseas eliminar este material?'))return;
  try{await api('deleteBuenaPractica',{key:k,id});previewCache.clear();await refreshData()}catch(e){showModal('No se pudo eliminar',`<p>${esc(e.message)}</p>`)}
}
async function saveMaterialFromPanel(scope){
  const isDiff=scope==='difusion';
  const titulo=$(isDiff?'#dfBpTitulo':'#opBpTitulo').value.trim(),categoria=$(isDiff?'#dfBpCategoria':'#opBpCategoria').value,input=$(isDiff?'#dfBpArchivo':'#opBpArchivo'),detalle=$(isDiff?'#dfBpDetalle':'#opBpDetalle').value.trim();
  if(!categoria||!titulo)return showModal('Faltan datos','<p>Selecciona el apartado e ingresa el título.</p>');
  const fs=await filesToObjs(input,1);if(!fs.length)return showModal('Falta archivo','<p>Adjunta una imagen o PDF.</p>');
  await api('saveBuenaPractica',{key:cfg.ADMIN_KEY,item:{categoria,titulo,detalle,archivo:fs[0]}});
  $(isDiff?'#dfBpTitulo':'#opBpTitulo').value='';$(isDiff?'#dfBpDetalle':'#opBpDetalle').value='';input.value='';
  previewCache.clear();await refreshData();$(isDiff?'#adminDifusionPanel':'#adminOperacionalesPanel').classList.remove('hidden');showModal('Material guardado','<p>El material fue cargado correctamente.</p>');
}
function previewPhotos(input,root){const files=[...(input.files||[])].slice(0,4);root.innerHTML='';files.forEach(f=>{const img=document.createElement('img');img.src=URL.createObjectURL(f);root.appendChild(img)});if((input.files||[]).length>4)showModal('Máximo 4 fotos','<p>Solo se tomarán las primeras 4 fotos.</p>')}
async function saveControles(){const empresa=$('#coEmpresa').value,mes=$('#coMes').value,anio=$('#coAnio').value;if(!empresa||!mes||!anio)return showModal('Faltan datos','<p>Selecciona empresa, mes y año.</p>');const [f1,f2,f3]=await Promise.all([filesToObjs($('#coFotos1'),4),filesToObjs($('#coFotos2'),4),filesToObjs($('#coFotos3'),4)]);if(!f1.length||!f2.length||!f3.length)return showModal('Evidencia mínima requerida','<p>Cada control debe tener al menos 1 fotografía.</p>');await api('saveControles',{item:{empresa,mes,anio:Number(anio),fotos1:f1,fotos2:f2,fotos3:f3}});['coFotos1','coFotos2','coFotos3'].forEach(id=>$('#'+id).value='');['coPrev1','coPrev2','coPrev3'].forEach(id=>$('#'+id).innerHTML='');await refreshData();showModal('Controles registrados','<p>El mes quedó con estatus <b>Cumplido</b>.</p>')}
function renderControles(){const emp=$('#coFiltroEmpresa')?.value||'';const arr=(state.controles||[]).filter(x=>!emp||x.empresa===emp);$('#coTable').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Empresa</th><th>Mes</th><th>Año</th><th>Almacenamiento</th><th>Inspección mensual</th><th>Reunión previa</th><th>Estatus</th><th>Acción</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${esc(x.empresa)}</td><td>${esc(x.mes)}</td><td>${esc(x.anio)}</td><td>${parseUrls(x.fotos1).length} foto(s)</td><td>${parseUrls(x.fotos2).length} foto(s)</td><td>${parseUrls(x.fotos3).length} foto(s)</td><td>${statusBadge(x.estatus)}</td><td><button class="link-btn" onclick="viewControl('${x.id}')">Ver evidencias</button></td></tr>`).join('')||'<tr><td colspan="8">Sin registros.</td></tr>'}</tbody></table></div>`}
window.viewControl=id=>{const x=(state.controles||[]).find(r=>r.id===id);if(!x)return;const labels=['Almacenamiento correcto','Inspección mensual','Reuniones previas de izaje'];showModal(`Controles ${x.empresa} - ${x.mes} ${x.anio}`,['fotos1','fotos2','fotos3'].map((k,i)=>`<h3>${i+1}. ${labels[i]}</h3><div class="control-photo-grid">${parseUrls(x[k]).map(u=>`<div class="control-photo"><img src="${esc(driveThumb(u))}" alt="Evidencia" loading="lazy"><a class="btn secondary" href="${esc(u)}" target="_blank">Abrir original</a></div>`).join('')||'<div class="notice">Sin fotos.</div>'}</div>`).join(''))}
function renderReviewQueue(){if(!state.reviewUnlocked||!$('#reviewQueue'))return;const type=$('#rvTipo')?.value||'',st=$('#rvEstado')?.value||'En revisión',emp=$('#rvEmpresa')?.value||'';let rows=[];(state.equipos||[]).forEach(x=>rows.push({...x,_type:'equipo'}));(state.personal||[]).forEach(x=>rows.push({...x,_type:'personal'}));rows=rows.filter(x=>(!type||x._type===type)&&(!st||x.estadoRevision===st)&&(!emp||x.empresa===emp));$('#reviewQueue').innerHTML=rows.map(x=>`<div class="review-card"><div class="panel-head"><div><b>${x._type==='equipo'?esc(x.tipo):esc(x.nombre)}</b><div style="color:var(--muted);font-size:12px">${esc(x.empresa)} · ${x._type==='equipo'?esc(x.serie):esc(x.dni)}</div></div>${statusBadge(x.estadoRevision)}</div><button class="btn secondary" onclick="openReview('${x._type}','${x.id}')">Ver registro y revisar</button></div>`).join('')||'<div class="notice">No hay registros con los filtros seleccionados.</div>'}
window.openReview=(type,id)=>{const x=(type==='equipo'?state.equipos:state.personal).find(r=>r.id===id);if(!x)return;const options=(state.aprobadores||[]).map(a=>`<option>${esc(a.nombre)}</option>`).join('');showModal('Revisión UNACEM',`<div class="review-grid"><div>${recordDetailHtml(x)}</div><div><label>Revisor UNACEM*<select id="reviewerName"><option value="">Seleccionar</option>${options}</select></label><label>Resultado*<select id="reviewStatus"><option value="Aprobado">Aprobado</option><option value="Observado">Observado</option></select></label><label>Comentarios<textarea id="reviewComment" rows="6" placeholder="Obligatorio si el estado es Observado"></textarea></label><button id="btnSubmitReview" class="btn primary full" onclick="submitInAppReview('${type}','${id}')">Guardar revisión</button></div></div>`)}
window.submitInAppReview=async(type,id)=>{const btn=$('#btnSubmitReview');if(btn.disabled)return;const reviewer=$('#reviewerName').value,status=$('#reviewStatus').value,comment=$('#reviewComment').value.trim();if(!reviewer)return alert('Selecciona tu nombre de la lista.');if(status==='Observado'&&!comment)return alert('Debes ingresar comentarios cuando el registro es Observado.');btn.disabled=true;try{await api('reviewRecord',{type,id,reviewer,status,comment});closeModal();await refreshData();showModal('Revisión guardada',`<p>El registro quedó <b>${esc(status)}</b>.</p>`)}catch(e){showModal('Error',`<p>${esc(e.message)}</p>`)}}
async function init(){document.title=cfg.APP_NAME||document.title;$('#fechaHoy').textContent=new Date().toLocaleDateString('es-PE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});$$('.nav-item').forEach(b=>b.onclick=()=>go(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
$('#btnSendAssistant')?.addEventListener('click',()=>sendAssistantQuestion());$('#btnClearAssistant')?.addEventListener('click',clearAssistantChat);$$('[data-assistant-question]').forEach(b=>b.addEventListener('click',()=>sendAssistantQuestion(b.dataset.assistantQuestion)));$('#assistantInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAssistantQuestion()}});$('#modalClose').onclick=closeModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};$('#btnRefresh').onclick=async()=>{try{await refreshData()}catch(e){showModal('Error',`<p>${esc(e.message)}</p>`)}};$('#eqCertificadora').onchange=equipmentCertUI;$('#eqFechaCert').onchange=()=>$('#eqVigencia').value=$('#eqFechaCert').value?addYears($('#eqFechaCert').value,1):'';$('#btnAddEquipo').onclick=addEquipo;$('#btnClearEquipo').onclick=clearEquipo;$('#btnSaveEquipos').onclick=disableDuring($('#btnSaveEquipos'),saveEquipos);$('#peFecha').onchange=()=>$('#peVigencia').value=addYears($('#peFecha').value,2);$('#btnAddPersonal').onclick=addPersonal;$('#btnClearPersonal').onclick=clearPersonal;$('#btnSavePersonal').onclick=disableDuring($('#btnSavePersonal'),savePersonal);['fEmpresa','fEquipo','fEstado','fSearch'].forEach(id=>$('#'+id).addEventListener('change',()=>{clearStatusChartSelection();renderSeguimiento()}));$('#btnApplyFilters').onclick=()=>{clearStatusChartSelection();renderSeguimiento()};['mapEmpresa','mapEstado','mapSearch'].forEach(id=>$('#'+id).addEventListener('change',()=>{clearMapSelection();renderMapa()}));$('#btnReloadMap').onclick=reloadMap;$('#btnMapFullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():$('#plantMap').requestFullscreen?.();window.addEventListener('resize',()=>requestAnimationFrame(syncMapOverlays));document.addEventListener('fullscreenchange',()=>setTimeout(syncMapOverlays,80));$('#plantMapImg')?.addEventListener('load',()=>requestAnimationFrame(syncMapOverlays));$('.home-map-preview img')?.addEventListener('load',()=>requestAnimationFrame(syncMapOverlays));$('#btnUnlockDifusion').onclick=()=>{const k=prompt('Clave de acceso UNACEM:');if(k===cfg.ADMIN_KEY)$('#adminDifusionPanel').classList.remove('hidden');else if(k)showModal('Clave incorrecta','<p>No se habilitó la edición.</p>')};
$('#btnUnlockOperacionales').onclick=()=>{const k=prompt('Clave de acceso UNACEM:');if(k===cfg.ADMIN_KEY)$('#adminOperacionalesPanel').classList.remove('hidden');else if(k)showModal('Clave incorrecta','<p>No se habilitó la edición.</p>')};
$('#btnSaveDifusionMaterial').onclick=disableDuring($('#btnSaveDifusionMaterial'),()=>saveMaterialFromPanel('difusion'));
$('#btnSaveOperacionalMaterial').onclick=disableDuring($('#btnSaveOperacionalMaterial'),()=>saveMaterialFromPanel('operacional'));
['dfTipo','dfEmpresa','dfEstado','dfSearch'].forEach(id=>$('#'+id)?.addEventListener('change',renderDifusion));
$('#btnDfApply').onclick=renderDifusion;$('#coAnio').value=new Date().getFullYear();$('#coMes').value=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][new Date().getMonth()];[['coFotos1','coPrev1'],['coFotos2','coPrev2'],['coFotos3','coPrev3']].forEach(([i,p])=>$('#'+i).onchange=()=>previewPhotos($('#'+i),$('#'+p)));$('#btnSaveControles').onclick=disableDuring($('#btnSaveControles'),saveControles);$('#coFiltroEmpresa').onchange=renderControles;$('#btnUnlockReview').onclick=()=>{const k=prompt('Clave de acceso UNACEM:');if(k===cfg.ADMIN_KEY){state.reviewUnlocked=true;$('#reviewLocked').classList.add('hidden');$('#reviewArea').classList.remove('hidden');renderReviewQueue()}else if(k)showModal('Clave incorrecta','<p>No se habilitó la revisión.</p>')};$('#btnRenderReview').onclick=renderReviewQueue;try{await refreshData();await reloadMap()}catch(e){showModal('Falta conectar el backend',`<p>${esc(e.message)}</p><p>Conserva en config.js la misma URL /exec que ya utiliza tu implementación.</p>`)}renderEqBatch();renderPeBatch();equipmentCertUI()}
init();
