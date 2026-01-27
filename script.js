import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCy2_TVj_AXhu2HUlQBUuL3nUkYWGVzA0U",
    authDomain: "agrolog-f89d7.firebaseapp.com",
    databaseURL: "https://agrolog-f89d7-default-rtdb.firebaseio.com",
    projectId: "agrolog-f89d7",
    storageBucket: "agrolog-f89d7.firebasestorage.app",
    messagingSenderId: "79965062136",
    appId: "1:79965062136:web:1361b2e7001ad850288c0d",
    measurementId: "G-2YKKE82KTD"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const frotaRef = ref(db, 'frota');
const tiposRevRef = ref(db, 'tipos_revisao');
const logsRef = ref(db, 'logs');
const operRef = ref(db, 'operadores');

let myChart = null;
let periodoAtual = 'anual';

// --- Firebase Watchers ---
onValue(frotaRef, (s) => { 
    const data = s.val();
    window.frota = data ? Object.values(data) : []; 
    window.frotaKeys = data ? Object.keys(data) : []; 
    window.render(); 
});
onValue(tiposRevRef, (s) => { window.tiposRev = s.val() || {}; window.render(); });
onValue(logsRef, (s) => { window.logs = s.val() ? Object.values(s.val()).reverse() : []; window.render(); });
onValue(operRef, (s) => { window.oper = s.val() ? Object.values(s.val()) : []; window.render(); });

// --- Global Functions (Attached to window) ---
window.showToast = (msg, type) => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast show glass-card border-l-4 p-4 rounded-2xl shadow-2xl flex items-center gap-3 ${type==='success'?'border-emerald-500':'border-orange-500'}`;
    toast.innerHTML = `<i class="fas ${type==='success'?'fa-check-circle text-emerald-500':'fa-exclamation-triangle text-orange-500'}"></i><span class="text-xs font-bold">${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(()=>toast.remove(), 500); }, 3000);
};

window.toggleMenu = () => { 
    document.getElementById('side-menu').classList.toggle('open'); 
    document.getElementById('overlay').classList.toggle('hidden'); 
};

window.navTo = (id) => { window.toggleMenu(); window.openTab(id); };

window.openTab = (id) => { 
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-tab-' + id)?.classList.add('active');
    window.scrollTo({top: 0, behavior: 'smooth'});
};

window.clearFilters = () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-date').value = '';
    window.render();
};

window.registrarHoras = (tratorId, operadorNome, horas) => {
    const tIdx = window.frota.findIndex(x => x.id == tratorId);
    const tKey = window.frotaKeys[tIdx];
    update(ref(db, `frota/${tKey}`), { horimetro: parseFloat(horas) });
    push(logsRef, { 
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        maquina: window.frota[tIdx].modelo, quem: operadorNome, valor: horas 
    });
    window.showToast("Dados salvos e sincronizados!", "success");
};

window.criarTipoRevisao = (nome, horas) => {
    const id = push(tiposRevRef).key;
    set(ref(db, `tipos_revisao/${id}`), { id, nome, horas: parseFloat(horas) });
    window.showToast("Novo tipo de revisão criado!", "success");
};

window.vincularRevisao = (tratorId, tipoId) => {
    if(!tratorId || !tipoId) return window.showToast("Selecione máquina e plano", "warning");
    const tIdx = window.frota.findIndex(x => x.id == tratorId);
    const tKey = window.frotaKeys[tIdx];
    let planos = window.frota[tIdx].planos || [];
    if (!planos.includes(tipoId)) {
        planos.push(tipoId);
        update(ref(db, `frota/${tKey}`), { planos });
        window.showToast("Revisão associada!", "success");
    }
};

window.marcarRevisaoPronta = (tratorId) => {
    const tIdx = window.frota.findIndex(x => x.id == tratorId);
    if(tIdx === -1) return window.showToast("Máquina não encontrada", "warning");
    const tKey = window.frotaKeys[tIdx];
    const horasAtuais = window.frota[tIdx].horimetro;
    update(ref(db, `frota/${tKey}`), { ultimaRevisao: horasAtuais });
    window.showToast("Revisão marcada como realizada!", "success");
    window.render();
    window.renderRevisoes();
};

window.confirmarRevisaoIndividual = (tratorId, tipoRevId) => {
    const tIdx = window.frota.findIndex(x => x.id == tratorId);
    if(tIdx === -1) return window.showToast("Máquina não encontrada", "warning");
    
    const tKey = window.frotaKeys[tIdx];
    const horasAtuais = window.frota[tIdx].horimetro;
    const tipoRev = window.tiposRev[tipoRevId];
    
    if(!tipoRev) return window.showToast("Tipo de revisão não encontrado", "warning");
    
    // Marca a revisão como realizada registrando no banco de dados
    push(logsRef, { 
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        maquina: window.frota[tIdx].modelo, 
        quem: 'Sistema', 
        valor: horasAtuais,
        tipo: 'revisao',
        plano: tipoRev.nome
    });
    
    // Também atualiza o ultimaRevisao
    update(ref(db, `frota/${tKey}`), { ultimaRevisao: horasAtuais });
    
    window.showToast(`Revisão "${tipoRev.nome}" confirmada!`, "success");
    window.render();
    window.renderRevisoes();
};

window.salvarTrator = (mod, hor) => {
    if(!mod || !hor) return window.showToast("Preencha todos os campos", "warning");
    const n = push(frotaRef);
    set(n, { id: Date.now(), modelo: mod, horimetro: parseFloat(hor), ultimaRevisao: parseFloat(hor), planos: [] });
    window.showToast("Máquina adicionada!", "success");
};

window.salvarOperador = (nome) => {
    if(!nome) return window.showToast("Digite o nome", "warning");
    push(operRef, { id: Date.now(), nome });
    window.showToast("Operador cadastrado!", "success");
};

window.atualizarPeriodoAtual = () => {
    window.filtrarRelatorio(periodoAtual);
};

window.filtrarRelatorio = (periodo) => {
    periodoAtual = periodo;
    if(periodo !== 'custom') {
        document.getElementById('rel-data-inicio').value = '';
        document.getElementById('rel-data-fim').value = '';
        ['diario', 'mensal', 'anual'].forEach(p => {
            const btn = document.getElementById(`btn-${p}`);
            if(p === periodo) btn.classList.add('bg-purple-600', 'text-white');
            else btn.classList.remove('bg-purple-600', 'text-white');
        });
    } else {
        ['diario', 'mensal', 'anual'].forEach(p => document.getElementById(`btn-${p}`).classList.remove('bg-purple-600', 'text-white'));
    }

    const maquinaSel = document.getElementById('filtro-maquina-rel').value;
    const operSel = document.getElementById('filtro-operador-rel').value;
    const stats = {}; 
    window.frota.forEach(t => { if(maquinaSel === 'todos' || maquinaSel === t.modelo) stats[t.modelo] = 0; });

    const agora = new Date();
    const dInicio = document.getElementById('rel-data-inicio').value ? new Date(document.getElementById('rel-data-inicio').value) : null;
    const dFim = document.getElementById('rel-data-fim').value ? new Date(document.getElementById('rel-data-fim').value) : null;
    if(dFim) dFim.setHours(23,59,59);

    let totalH = 0;
    let topMaq = {nome: '---', valor: 0};

    window.logs.forEach(log => {
        const [d,m,a] = log.data.split('/');
        const logDate = new Date(a, m-1, d);
        let matchP = false;
        if(periodo === 'diario') matchP = logDate.toDateString() === agora.toDateString();
        else if(periodo === 'mensal') matchP = logDate.getMonth() === agora.getMonth() && logDate.getFullYear() === agora.getFullYear();
        else if(periodo === 'anual') matchP = true;
        else if(periodo === 'custom') matchP = (!dInicio || logDate >= dInicio) && (!dFim || logDate <= dFim);

        const matchM = (maquinaSel === 'todos' || maquinaSel === log.maquina);
        const matchO = (operSel === 'todos' || operSel === log.quem);

        if(matchP && matchM && matchO && stats[log.maquina] !== undefined) {
            const valor = parseFloat(log.valor) || 0;
            stats[log.maquina] += valor;
            totalH += valor;
            if(stats[log.maquina] > topMaq.valor) topMaq = {nome: log.maquina, valor: stats[log.maquina]};
        }
    });

    document.getElementById('kpi-total').innerText = totalH.toFixed(1) + 'h';
    document.getElementById('kpi-top').innerText = topMaq.nome;
    window.renderChart(stats);
};

window.renderChart = (stats) => {
    const ctx = document.getElementById('chartProd').getContext('2d');
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, { 
        type:'line', 
        data: { 
            labels: Object.keys(stats), 
            datasets:[{ data: Object.values(stats), borderColor:'#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.1)', fill: true, tension: 0.4, borderWidth: 4, pointRadius: 4 }] 
        }, 
        options: { 
            plugins:{ legend:{display:false} }, 
            scales: { 
                y: { display: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#475569', font: { size: 10 } } }, 
                x: { display: true, grid: { display: false }, ticks: { color: '#475569', font: { size: 10 } } } 
            } 
        } 
    });
    document.getElementById('stats-list').innerHTML = Object.entries(stats).map(([k,v])=>`
        <div class="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
            <span class="text-[10px] font-bold text-slate-400 uppercase">${k}</span>
            <span class="text-sm font-black text-white">${v.toFixed(1)}h</span>
        </div>`).join('');
};

window.render = () => {
    if(!window.frota || !window.tiposRev) return;
    document.getElementById('fleet-count').innerText = window.frota.length;

    // Calcular prioridade de revisão para cada máquina
    const frotaOrdenada = window.frota.map(t => {
        let maxPrioridade = 0; // 0 = em dia, 1 = aviso laranja, 2 = aviso vermelho, 3 = em atraso
        
        (t.planos || []).forEach(pid => {
            const r = window.tiposRev[pid];
            if(!r) return;
            const perc = Math.min(((t.horimetro % r.horas) / r.horas) * 100, 100);
            if(perc >= 100) maxPrioridade = Math.max(maxPrioridade, 3); // Em atraso
            else if(perc > 90) maxPrioridade = Math.max(maxPrioridade, 2); // Muito próximo
            else if(perc > 75) maxPrioridade = Math.max(maxPrioridade, 1); // Próximo
        });
        
        return { ...t, prioridade: maxPrioridade };
    }).sort((a, b) => b.prioridade - a.prioridade); // Ordenar por prioridade decrescente

    // Fleet List
    document.getElementById('fleet-list').innerHTML = frotaOrdenada.map(t => {
        let barras = (t.planos || []).map(pid => {
            const r = window.tiposRev[pid];
            if(!r) return "";
            const resta = r.horas - (t.horimetro % r.horas);
            const perc = Math.min(((t.horimetro % r.horas) / r.horas) * 100, 100);
            const color = perc > 90 ? 'bg-red-500' : perc > 75 ? 'bg-orange-500' : 'bg-emerald-500';
            return `<div class="mt-4"><div class="flex justify-between text-[9px] mb-1"><span class="font-bold text-slate-400 uppercase">${r.nome}</span><span class="text-slate-500 font-bold">${resta.toFixed(1)}h restantes</span></div><div class="w-full bg-slate-950 h-2 rounded-full overflow-hidden"><div class="h-full ${color} transition-all duration-1000" style="width:${perc}%"></div></div><button onclick="window.confirmarRevisaoIndividual('${t.id}', '${pid}')" class="w-full mt-2 bg-cyan-600 hover:bg-cyan-500 text-white py-1 px-2 rounded-lg font-bold uppercase text-[8px] transition-all active:scale-95"><i class="fas fa-check mr-1"></i>OK</button></div>`;
        }).join('');

        return `<div class="glass-card p-6 rounded-[2rem] relative overflow-hidden group">
            <div class="flex justify-between items-start mb-2 relative z-10">
                <div><h3 class="text-lg font-black text-white tracking-tight">${t.modelo}</h3><p class="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Ativo</p></div>
                <div class="text-right"><span class="text-2xl font-black text-yellow-500">${t.horimetro.toFixed(1)}</span><span class="text-[9px] block font-bold text-slate-500 uppercase">Horas</span></div>
            </div>
            <div class="relative z-10">${barras || '<p class="text-[9px] text-slate-600 mt-4 italic">Sem planos ativos</p>'}</div>
        </div>`;
    }).join('');

    // Selects
    const optT = window.frota.map(t => `<option value="${t.id}">${t.modelo}</option>`).join('');
    document.getElementById('sel-t-vinc').innerHTML = `<option value="">Selecionar Máquina...</option>` + optT;
    document.getElementById('sel-t-lan').innerHTML = optT;
    document.getElementById('sel-m-rev').innerHTML = optT;
    document.getElementById('sel-r-vinc').innerHTML = `<option value="">Selecionar Plano...</option>` + Object.values(window.tiposRev).map(r => `<option value="${r.id}">${r.nome} (${r.horas}h)</option>`).join('');
    document.getElementById('sel-o-lan').innerHTML = window.oper.map(o => `<option value="${o.nome}">${o.nome}</option>`).join('');
    
    // Filters
    const selRelM = document.getElementById('filtro-maquina-rel');
    const valM = selRelM.value;
    selRelM.innerHTML = `<option value="todos">Todas Máquinas</option>` + window.frota.map(t => `<option value="${t.modelo}">${t.modelo}</option>`).join('');
    selRelM.value = valM || 'todos';

    const selRelO = document.getElementById('filtro-operador-rel');
    const valO = selRelO.value;
    selRelO.innerHTML = `<option value="todos">Todos Operadores</option>` + window.oper.map(o => `<option value="${o.nome}">${o.nome}</option>`).join('');
    selRelO.value = valO || 'todos';

    // Update revision filters
    window.atualizarFiltrosRevisoes();
    window.renderRevisoes();

    // Logs
    const search = document.getElementById('filter-search').value.toLowerCase();
    const date = document.getElementById('filter-date').value;
    const dateF = date ? date.split('-').reverse().join('/') : "";
    const filtered = window.logs.filter(l => (l.maquina.toLowerCase().includes(search) || l.quem.toLowerCase().includes(search)) && (!date || l.data === dateF));

    document.getElementById('logs-list').innerHTML = filtered.length > 0 ? filtered.map(l => `
        <div class="glass-card p-5 rounded-2xl flex flex-col gap-3 border-l-2 border-yellow-500/30">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2"><span class="text-[9px] text-slate-400 font-extrabold uppercase tracking-tighter">${l.data} | ${l.hora || '--'}</span></div>
                <span class="text-lg font-black text-white">${l.valor}h</span>
            </div>
            <div class="flex justify-between items-end">
                <div><span class="text-[9px] block text-slate-500 font-bold uppercase tracking-widest">Equipamento</span><span class="text-sm font-bold text-yellow-500 uppercase">${l.maquina}</span></div>
                <div class="text-right"><span class="text-[9px] block text-slate-500 font-bold uppercase tracking-widest">Operador</span><span class="text-xs italic text-slate-300">${l.quem}</span></div>
            </div>
        </div>`).join('') : '<div class="text-center py-20 opacity-20"><p class="text-[10px] font-bold uppercase">Nenhum registo</p></div>';
};

window.renderRevisoes = () => {
    const maquinaSel = document.getElementById('filtro-rev-maquina').value;
    const planoSel = document.getElementById('filtro-rev-plano').value;
    const dInicio = document.getElementById('rev-data-inicio').value ? new Date(document.getElementById('rev-data-inicio').value) : null;
    const dFim = document.getElementById('rev-data-fim').value ? new Date(document.getElementById('rev-data-fim').value) : null;
    if(dFim) dFim.setHours(23,59,59);

    const revisoes = {};
    window.frota.forEach(trator => {
        const planosIds = trator.planos || [];
        planosIds.forEach(pid => {
            const plano = window.tiposRev[pid];
            if(!plano) return;
            if(!revisoes[trator.modelo]) revisoes[trator.modelo] = {};
            if(!revisoes[trator.modelo][plano.nome]) revisoes[trator.modelo][plano.nome] = [];
            
            const ultimaRevisao = trator.ultimaRevisao || 0;
            const proxRevisao = ultimaRevisao + plano.horas;
            const diasRestantes = Math.max(0, Math.ceil((proxRevisao - trator.horimetro) / 24));
            
            revisoes[trator.modelo][plano.nome].push({
                ultimaRevisao: ultimaRevisao.toFixed(1),
                proximaRevisao: proxRevisao.toFixed(1),
                horasRestantes: Math.max(0, (proxRevisao - trator.horimetro)).toFixed(1),
                diasRestantes: diasRestantes,
                planoHoras: plano.horas,
                maquinaHoras: trator.horimetro
            });
        });
    });

    let revisoesFiltradas = [];
    Object.keys(revisoes).forEach(maquina => {
        if(maquinaSel !== 'todas' && maquinaSel !== maquina) return;
        
        Object.keys(revisoes[maquina]).forEach(plano => {
            if(planoSel !== 'todos' && planoSel !== plano) return;
            
            revisoes[maquina][plano].forEach(rev => {
                revisoesFiltradas.push({maquina, plano, ...rev});
            });
        });
    });

    const container = document.getElementById('revisoes-list');
    container.innerHTML = revisoesFiltradas.length > 0 ? revisoesFiltradas.map(rev => {
        const emAtraso = parseFloat(rev.horasRestantes) <= 0;
        const proximoVencimento = emAtraso ? 'text-red-500' : parseFloat(rev.horasRestantes) <= 50 ? 'text-orange-500' : 'text-emerald-500';
        const icon = emAtraso ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-check-circle"></i>';
        
        return `
        <div class="glass-card p-5 rounded-2xl flex flex-col gap-3 border-l-2 ${emAtraso ? 'border-red-500' : proximoVencimento.includes('orange') ? 'border-orange-500' : 'border-emerald-500'}">
            <div class="flex justify-between items-start">
                <div>
                    <span class="text-[9px] text-slate-400 font-extrabold uppercase tracking-tighter">${rev.maquina}</span>
                    <p class="text-sm font-bold text-cyan-400 uppercase">${rev.plano}</p>
                </div>
                <span class="${proximoVencimento} text-lg">${icon}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 bg-slate-950/30 p-3 rounded-xl">
                <div>
                    <span class="text-[8px] text-slate-500 font-bold uppercase">Última Revisão</span>
                    <p class="text-xs font-black text-white">${rev.ultimaRevisao}h</p>
                </div>
                <div>
                    <span class="text-[8px] text-slate-500 font-bold uppercase">Próxima em</span>
                    <p class="text-xs font-black text-white">${rev.proximaRevisao}h</p>
                </div>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-slate-800">
                <div>
                    <span class="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Faltam</span>
                    <p class="text-sm font-black ${proximoVencimento}">${rev.horasRestantes}h</p>
                </div>
                <div class="text-right">
                    <span class="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Horimetro</span>
                    <p class="text-sm font-black text-yellow-500">${rev.maquinaHoras.toFixed(1)}h</p>
                </div>
            </div>
        </div>`;
    }).join('') : '<div class="text-center py-20 opacity-20"><p class="text-[10px] font-bold uppercase">Nenhuma revisão encontrada</p></div>';
};

window.atualizarFiltrosRevisoes = () => {
    const selMaq = document.getElementById('filtro-rev-maquina');
    const valMaq = selMaq.value;
    selMaq.innerHTML = `<option value="todas">Todas Máquinas</option>` + window.frota.map(t => `<option value="${t.modelo}">${t.modelo}</option>`).join('');
    selMaq.value = valMaq || 'todas';

    const selPlan = document.getElementById('filtro-rev-plano');
    const valPlan = selPlan.value;
    const tiposUnicos = {};
    Object.values(window.tiposRev || {}).forEach(t => { tiposUnicos[t.nome] = true; });
    selPlan.innerHTML = `<option value="todos">Todos Planos</option>` + Object.keys(tiposUnicos).map(n => `<option value="${n}">${n}</option>`).join('');
    selPlan.value = valPlan || 'todos';
};

// Event Listeners
document.getElementById('form-h').onsubmit = (e) => {
    e.preventDefault();
    const trator = document.getElementById('sel-t-lan').value;
    const operador = document.getElementById('sel-o-lan').value;
    const valor = document.getElementById('h-input').value;
    if(!valor) return window.showToast("Insira o horímetro", "warning");
    window.registrarHoras(trator, operador, valor);
    e.target.reset(); window.openTab('dashboard');
};
