// Variáveis globais para dados
let globalData2024_raw = [];
let globalData2025_raw = [];
let masterVendedorList = new Set();
let masterGrupoList = new Set();

// Aguarda o carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loadAndProcessButton').addEventListener('click', loadAndProcessFiles);
    document.getElementById('vendedorFilter').addEventListener('change', applyFiltersAndRedraw);
    document.getElementById('grupoFilter').addEventListener('change', applyFiltersAndRedraw);
    document.getElementById('clearFiltersButton').addEventListener('click', clearFilters);
});

// Função para ler um arquivo JSON
function readFileAsJson(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('Nenhum arquivo selecionado.'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                resolve(json);
            } catch (error) {
                reject(new Error('Erro ao processar o arquivo JSON.'));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}

// Função para limpar nome do vendedor
function cleanVendedorName(vendedorStr) {
    if (!vendedorStr) return 'N/A';
    if (vendedorStr.includes(' - ')) {
        const parts = vendedorStr.split(' - ');
        if (parts.length > 1) return parts[1].trim();
    }
    return vendedorStr.trim();
}

// 1. CARREGAR E PROCESSAR ARQUIVOS
async function loadAndProcessFiles() {
    const file2024 = document.getElementById('file2024').files[0];
    const file2025 = document.getElementById('file2025').files[0];

    if (!file2024 || !file2025) {
        alert('Por favor, selecione os dois arquivos JSON.');
        return;
    }

    try {
        const json2024 = await readFileAsJson(file2024);
        const json2025 = await readFileAsJson(file2025);

        masterVendedorList.clear();
        masterGrupoList.clear();

        // Processa e armazena dados brutos
        globalData2024_raw = json2024.map(item => {
            const vendedorNome = cleanVendedorName(item.VENDEDOR);
            const grupoGerencial = item['GRUPO GERENCIAL'] ? item['GRUPO GERENCIAL'].trim() : 'N/A';
            masterVendedorList.add(vendedorNome);
            masterGrupoList.add(grupoGerencial);
            return { ...item, VENDEDOR_NOME: vendedorNome, 'GRUPO GERENCIAL': grupoGerencial };
        });

        globalData2025_raw = json2025.map(item => {
            const vendedorNome = cleanVendedorName(item.VENDEDOR);
            const grupoGerencial = item['GRUPO GERENCIAL'] ? item['GRUPO GERENCIAL'].trim() : 'N/A';
            masterVendedorList.add(vendedorNome);
            masterGrupoList.add(grupoGerencial);
            return { ...item, VENDEDOR_NOME: vendedorNome, 'GRUPO GERENCIAL': grupoGerencial };
        });

        populateFilters();

        document.getElementById('vendedorFilter').disabled = false;
        document.getElementById('grupoFilter').disabled = false;
        document.getElementById('clearFiltersButton').disabled = false;

        applyFiltersAndRedraw();
        document.getElementById('dashboardContainer').style.display = 'block';

    } catch (error) {
        console.error('Erro ao carregar o dashboard:', error);
        alert(error.message);
    }
}

// 2. POPULAR OS FILTROS
function populateFilters() {
    const vendedorSelect = document.getElementById('vendedorFilter');
    const grupoSelect = document.getElementById('grupoFilter');

    vendedorSelect.innerHTML = '';
    grupoSelect.innerHTML = '';

    vendedorSelect.add(new Option('Todos os Vendedores', 'Todos'));
    grupoSelect.add(new Option('Todos os Grupos', 'Todos'));

    Array.from(masterVendedorList).sort().forEach(vendedor => {
        vendedorSelect.add(new Option(vendedor, vendedor));
    });

    Array.from(masterGrupoList).sort().forEach(grupo => {
        grupoSelect.add(new Option(grupo, grupo));
    });
}

// 3. LIMPAR FILTROS
function clearFilters() {
    document.getElementById('vendedorFilter').value = 'Todos';
    document.getElementById('grupoFilter').value = 'Todos';
    applyFiltersAndRedraw();
}

// 4. APLICAR FILTROS E REDESENHAR
function applyFiltersAndRedraw() {
    const selectedVendedor = document.getElementById('vendedorFilter').value;
    const selectedGrupo = document.getElementById('grupoFilter').value;

    const filtered2024 = globalData2024_raw.filter(item => 
        (selectedVendedor === 'Todos' || item.VENDEDOR_NOME === selectedVendedor) &&
        (selectedGrupo === 'Todos' || item['GRUPO GERENCIAL'] === selectedGrupo)
    );

    const filtered2025 = globalData2025_raw.filter(item => 
        (selectedVendedor === 'Todos' || item.VENDEDOR_NOME === selectedVendedor) &&
        (selectedGrupo === 'Todos' || item['GRUPO GERENCIAL'] === selectedGrupo)
    );

    const processedData = processData(filtered2024, filtered2025);

    updateKPIs(processedData.kpis);
    
    // MUDANÇA AQUI: Chamando as novas funções de tabela
    renderVendedorTable(processedData.sales_by_vendedor);
    renderProdutoTable(processedData.sales_by_produto);
}

// 5. PROCESSAR DADOS (AGREGAR)
// ** MUDANÇA AQUI: Agora processa QTDE além de FAT **
function processData(data2024, data2025) {
    const allData = [
        ...data2024.map(item => ({ ...item, ANO: '2024' })),
        ...data2025.map(item => ({ ...item, ANO: '2025' }))
    ];

    const kpiData = { '2024': { TOTAL_FAT: 0, TOTAL_QTDE: 0, TOTAL_META: 0 }, '2025': { TOTAL_FAT: 0, TOTAL_QTDE: 0, TOTAL_META: 0 } };
    const salesVendedorMap = new Map();
    const salesProdutoMap = new Map();

    allData.forEach(item => {
        const ano = item.ANO;

        // KPIs
        kpiData[ano].TOTAL_FAT += item.FAT;
        kpiData[ano].TOTAL_QTDE += item.QTDE;
        kpiData[ano].TOTAL_META += item.META;

        // Vendedor Map
        const vendedorKey = item.VENDEDOR_NOME;
        if (!salesVendedorMap.has(vendedorKey)) {
            salesVendedorMap.set(vendedorKey, { VENDEDOR_NOME: vendedorKey, FAT_2024: 0, FAT_2025: 0, QTDE_2024: 0, QTDE_2025: 0 });
        }
        const vendedorEntry = salesVendedorMap.get(vendedorKey);
        vendedorEntry[ano === '2024' ? 'FAT_2024' : 'FAT_2025'] += item.FAT;
        vendedorEntry[ano === '2024' ? 'QTDE_2024' : 'QTDE_2025'] += item.QTDE;

        // Produto Map
        const produtoKey = item['GRUPO GERENCIAL'];
        if (!salesProdutoMap.has(produtoKey)) {
            salesProdutoMap.set(produtoKey, { 'GRUPO GERENCIAL': produtoKey, FAT_2024: 0, FAT_2025: 0, QTDE_2024: 0, QTDE_2025: 0 });
        }
        const produtoEntry = salesProdutoMap.get(produtoKey);
        produtoEntry[ano === '2024' ? 'FAT_2024' : 'FAT_2025'] += item.FAT;
        produtoEntry[ano === '2024' ? 'QTDE_2024' : 'QTDE_2025'] += item.QTDE;
    });

    kpiData['2024']['ATENDIMENTO_%'] = kpiData['2024'].TOTAL_META > 0 ? (kpiData['2024'].TOTAL_QTDE / kpiData['2024'].TOTAL_META) * 100 : 0;
    kpiData['2025']['ATENDIMENTO_%'] = kpiData['2025'].TOTAL_META > 0 ? (kpiData['2025'].TOTAL_QTDE / kpiData['2025'].TOTAL_META) * 100 : 0;

    return {
        kpis: kpiData,
        sales_by_vendedor: Array.from(salesVendedorMap.values()),
        sales_by_produto: Array.from(salesProdutoMap.values())
    };
}

// --- Funções de Formatação e Helpers ---

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatNumber = (value, decimals = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(value);

const calculateKpiDelta = (current, previous, isPercentage = false) => {
    if (previous === 0) return { text: (current > 0 ? 'Crescimento' : '...'), className: '' };
    let delta = isPercentage ? (current - previous) : ((current - previous) / previous) * 100;
    let text = `${delta.toFixed(1)}${isPercentage ? ' pp' : '%'}`;
    let className = delta >= 0 ? 'positive' : 'negative';
    text = delta >= 0 ? `+${text}` : text;
    return { text, className };
};

// ** NOVO HELPER: Para calcular deltas da tabela (azul/vermelho) **
const calculateTableDeltaPercent = (current, previous) => {
    if (previous === 0) {
        if (current > 0) return { text: 'Novo', className: 'delta-positive' };
        return { text: '-', className: '' };
    }
    if (current === 0) {
        if (previous > 0) return { text: '-100.0%', className: 'delta-negative' };
    }
    
    const delta = ((current - previous) / previous) * 100;
    const text = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
    const className = delta > 0 ? 'delta-positive' : (delta < 0 ? 'delta-negative' : '');
    return { text, className };
};

// --- Funções de Renderização (KPIs e Tabelas) ---

function updateKPIs(kpiData) {
    const kpi2025 = kpiData['2025'];
    const kpi2024 = kpiData['2024'];

    document.getElementById('fat-2025').textContent = formatCurrency(kpi2025.TOTAL_FAT);
    document.getElementById('fat-2024').textContent = `${formatCurrency(kpi2024.TOTAL_FAT)} (Anterior)`;
    const fatDelta = calculateKpiDelta(kpi2025.TOTAL_FAT, kpi2024.TOTAL_FAT);
    document.getElementById('fat-delta').textContent = fatDelta.text;
    document.getElementById('fat-delta').className = `kpi-delta ${fatDelta.className}`;

    document.getElementById('qtde-2025').textContent = formatNumber(kpi2025.TOTAL_QTDE);
    document.getElementById('qtde-2024').textContent = `${formatNumber(kpi2024.TOTAL_QTDE)} (Anterior)`;
    const qtdeDelta = calculateKpiDelta(kpi2025.TOTAL_QTDE, kpi2024.TOTAL_QTDE);
    document.getElementById('qtde-delta').textContent = qtdeDelta.text;
    document.getElementById('qtde-delta').className = `kpi-delta ${qtdeDelta.className}`;

    document.getElementById('meta-2025').textContent = `${formatNumber(kpi2025['ATENDIMENTO_%'], 1)}%`;
    document.getElementById('meta-2024').textContent = `${formatNumber(kpi2024['ATENDIMENTO_%'], 1)}% (Anterior)`;
    const metaDelta = calculateKpiDelta(kpi2025['ATENDIMENTO_%'], kpi2024['ATENDIMENTO_%'], true);
    document.getElementById('meta-delta').textContent = metaDelta.text;
    document.getElementById('meta-delta').className = `kpi-delta ${metaDelta.className}`;
}

// ** NOVA FUNÇÃO: Renderizar Tabela de Vendedor **
function renderVendedorTable(salesData) {
    salesData.sort((a, b) => b.FAT_2025 - a.FAT_2025); // Ordena por Faturamento Atual
    const container = document.getElementById('vendedorTableContainer');
    
    let tableHtml = `<table class="data-table">
        <thead>
            <tr>
                <th rowspan="2">Vendedor</th>
                <th colspan="3" class="num-header">Quantidade</th>
                <th colspan="3" class="num-header">Faturamento</th>
            </tr>
            <tr>
                <th class="num-header">Anterior</th>
                <th class="num-header">Atual</th>
                <th class="num-header">% Var</th>
                <th class="num-header">Anterior</th>
                <th class="num-header">Atual</th>
                <th class="num-header">% Var</th>
            </tr>
        </thead>
        <tbody>`;

    for (const item of salesData) {
        const qtdeDelta = calculateTableDeltaPercent(item.QTDE_2025, item.QTDE_2024);
        const fatDelta = calculateTableDeltaPercent(item.FAT_2025, item.FAT_2024);
        
        tableHtml += `
            <tr>
                <td>${item.VENDEDOR_NOME}</td>
                <td class="num-cell">${formatNumber(item.QTDE_2024)}</td>
                <td class="num-cell">${formatNumber(item.QTDE_2025)}</td>
                <td class="num-cell ${qtdeDelta.className}">${qtdeDelta.text}</td>
                <td class="num-cell">${formatCurrency(item.FAT_2024)}</td>
                <td class="num-cell">${formatCurrency(item.FAT_2025)}</td>
                <td class="num-cell ${fatDelta.className}">${fatDelta.text}</td>
            </tr>`;
    }

    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
}

// ** NOVA FUNÇÃO: Renderizar Tabela de Produto **
function renderProdutoTable(productData) {
    productData.sort((a, b) => b.FAT_2025 - a.FAT_2025); // Ordena por Faturamento Atual
    const container = document.getElementById('produtoTableContainer');

    let tableHtml = `<table class="data-table">
        <thead>
            <tr>
                <th rowspan="2">Grupo de Produto</th>
                <th colspan="3" class="num-header">Quantidade</th>
                <th colspan="3" class="num-header">Faturamento</th>
            </tr>
            <tr>
                <th class="num-header">Anterior</th>
                <th class="num-header">Atual</th>
                <th class="num-header">% Var</th>
                <th class="num-header">Anterior</th>
                <th class="num-header">Atual</th>
                <th class="num-header">% Var</th>
            </tr>
        </thead>
        <tbody>`;

    for (const item of productData) {
        const qtdeDelta = calculateTableDeltaPercent(item.QTDE_2025, item.QTDE_2024);
        const fatDelta = calculateTableDeltaPercent(item.FAT_2025, item.FAT_2024);
        
        tableHtml += `
            <tr>
                <td>${item['GRUPO GERENCIAL']}</td>
                <td class="num-cell">${formatNumber(item.QTDE_2024)}</td>
                <td class="num-cell">${formatNumber(item.QTDE_2025)}</td>
                <td class="num-cell ${qtdeDelta.className}">${qtdeDelta.text}</td>
                <td class="num-cell">${formatCurrency(item.FAT_2024)}</td>
                <td class="num-cell">${formatCurrency(item.FAT_2025)}</td>
                <td class="num-cell ${fatDelta.className}">${fatDelta.text}</td>
            </tr>`;
    }

    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
}