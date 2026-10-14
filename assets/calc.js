/* Nucleo de calculo das calculadoras. Funcoes puras, sem dependencias.
 * Roda no navegador (global Calc) e no Node (require). Testes: test/calc.test.js */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function r2(x) {
    return Math.round((x + Number.EPSILON) * 100) / 100;
  }

  function num(v, nome, { min = 0, max = Infinity, inteiro = false } = {}) {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new RangeError(nome + ' invalido');
    if (v < min || v > max) throw new RangeError(nome + ' fora do intervalo (' + min + ' a ' + max + ')');
    if (inteiro && !Number.isInteger(v)) throw new RangeError(nome + ' deve ser inteiro');
    return v;
  }

  // Taxa anual (%) equivalente mensal (%) pela regra de juros compostos.
  function taxaAnualParaMensalPct(anualPct) {
    num(anualPct, 'taxa anual', { min: 0, max: 1000 });
    return (Math.pow(1 + anualPct / 100, 1 / 12) - 1) * 100;
  }

  // Aportes no fim de cada mes. FV = P(1+i)^n + A((1+i)^n - 1)/i
  function jurosCompostos({ capital, aporte, taxaMensalPct, meses }) {
    num(capital, 'capital inicial', { max: 1e12 });
    num(aporte, 'aporte mensal', { max: 1e12 });
    num(taxaMensalPct, 'taxa mensal', { max: 100 });
    num(meses, 'meses', { min: 1, max: 1200, inteiro: true });
    const i = taxaMensalPct / 100;
    const fator = Math.pow(1 + i, meses);
    const montante = i === 0 ? capital + aporte * meses : capital * fator + aporte * ((fator - 1) / i);
    const investido = capital + aporte * meses;
    return { montante: r2(montante), investido: r2(investido), juros: r2(montante - investido) };
  }

  // Price (parcela fixa) x SAC (amortizacao constante). Juros mensais compostos sobre o saldo.
  function financiamento({ valor, taxaMensalPct, meses }) {
    num(valor, 'valor financiado', { min: 0.01, max: 1e12 });
    num(taxaMensalPct, 'taxa mensal', { max: 100 });
    num(meses, 'prazo', { min: 1, max: 600, inteiro: true });
    const i = taxaMensalPct / 100;

    const pmt = i === 0 ? valor / meses : (valor * i) / (1 - Math.pow(1 + i, -meses));
    const totalPrice = pmt * meses;

    const amort = valor / meses;
    let saldo = valor;
    let totalSac = 0;
    let primeira = 0;
    let ultima = 0;
    for (let k = 1; k <= meses; k++) {
      const parcela = amort + saldo * i;
      if (k === 1) primeira = parcela;
      if (k === meses) ultima = parcela;
      totalSac += parcela;
      saldo -= amort;
    }
    return {
      price: { parcela: r2(pmt), total: r2(totalPrice), juros: r2(totalPrice - valor) },
      sac: { primeira: r2(primeira), ultima: r2(ultima), total: r2(totalSac), juros: r2(totalSac - valor) },
    };
  }

  // Fracao de mes: 13o conta fracao >= 15 dias (Lei 4.090/1962, art. 1o, par. 2o);
  // ferias proporcionais contam fracao > 14 dias (CLT, art. 146, par. unico). Na pratica as duas regras
  // dao o mesmo resultado para dias inteiros: 15 ou mais dias conta como mes cheio.
  function mesesComFracao(meses, diasFracao) {
    num(meses, 'meses completos', { max: 12, inteiro: true });
    num(diasFracao, 'dias da fracao', { max: 30, inteiro: true });
    return Math.min(12, meses + (diasFracao >= 15 ? 1 : 0));
  }

  // 13o proporcional bruto: remuneracao de dezembro x meses/12 (Lei 4.090/1962, art. 1o).
  function decimoTerceiro({ salario, variaveis = 0, meses }) {
    num(salario, 'salario', { max: 1e9 });
    num(variaveis, 'media de variaveis', { max: 1e9 });
    num(meses, 'meses', { max: 12, inteiro: true });
    const base = salario + variaveis;
    return { base: r2(base), meses, bruto: r2((base * meses) / 12) };
  }

  // Ferias proporcionais + 1/3 constitucional (CF, art. 7o, XVII; CLT, art. 146, par. unico).
  function feriasProporcionais({ salario, variaveis = 0, meses }) {
    num(salario, 'salario', { max: 1e9 });
    num(variaveis, 'media de variaveis', { max: 1e9 });
    num(meses, 'meses', { max: 12, inteiro: true });
    const base = salario + variaveis;
    const ferias = (base * meses) / 12;
    const terco = ferias / 3;
    return { base: r2(base), meses, ferias: r2(ferias), terco: r2(terco), total: r2(ferias + terco) };
  }

  // Aviso previo proporcional: 30 dias + 3 por ano completo, maximo 90 (Lei 12.506/2011).
  function avisoPrevio({ anos }) {
    num(anos, 'anos completos', { max: 80, inteiro: true });
    const extra = Math.min(anos * 3, 60);
    return { dias: 30 + extra, extra };
  }

  // Hora extra: valor-hora = salario / (5 x horas semanais) (220 para 44h, 200 para 40h);
  // adicional minimo de 50% (CF, art. 7o, XVI). Adicional de 100% quando previsto em norma/convencao.
  function horaExtra({ salario, horasSemanais, horas50, horas100 = 0 }) {
    num(salario, 'salario', { min: 0.01, max: 1e9 });
    num(horasSemanais, 'jornada semanal', { min: 1, max: 44 });
    num(horas50, 'horas extras a 50%', { max: 744 });
    num(horas100, 'horas extras a 100%', { max: 744 });
    const divisor = 5 * horasSemanais;
    const valorHora = salario / divisor;
    const v50 = horas50 * valorHora * 1.5;
    const v100 = horas100 * valorHora * 2;
    return {
      divisor,
      valorHora: r2(valorHora),
      valor50: r2(v50),
      valor100: r2(v100),
      total: r2(v50 + v100),
    };
  }

  // Deposito mensal do FGTS: 8% da remuneracao (Lei 8.036/1990, art. 15). Estimativa sem correcao.
  function estimaFgts({ salario, meses }) {
    num(salario, 'salario', { max: 1e9 });
    num(meses, 'meses', { min: 0, max: 1200, inteiro: true });
    return { saldo: r2(salario * 0.08 * meses) };
  }

  // Multa do FGTS sobre o saldo depositado: 40% (Lei 8.036/1990, art. 18, par. 1o) na dispensa sem
  // justa causa; 20% no acordo (CLT, art. 484-A). Sem justa causa x pedido de demissao: nao ha multa.
  function multaFgts({ saldo, modalidade }) {
    num(saldo, 'saldo do FGTS', { max: 1e12 });
    const taxas = { 'sem-justa-causa': 0.4, acordo: 0.2 };
    if (!(modalidade in taxas)) throw new RangeError('modalidade invalida');
    return { taxa: taxas[modalidade], multa: r2(saldo * taxas[modalidade]) };
  }

  function taxaMensalParaAnualPct(mensalPct) {
    num(mensalPct, 'taxa mensal', { max: 100 });
    return (Math.pow(1 + mensalPct / 100, 12) - 1) * 100;
  }

  // Abono pecuniario: ate 1/3 das ferias (10 de 30 dias) convertido em dinheiro (CLT, art. 143).
  // As ferias gozadas e o abono recebem 1/3 (CF, art. 7o, XVII). O total bruto nao muda: muda a divisao.
  function abonoPecuniario({ salario, diasVendidos }) {
    num(salario, 'salario', { max: 1e9 });
    num(diasVendidos, 'dias vendidos', { max: 10, inteiro: true });
    const dia = salario / 30;
    const gozados = 30 - diasVendidos;
    const ferias = dia * gozados;
    const abono = dia * diasVendidos;
    const tercoFerias = ferias / 3;
    const tercoAbono = abono / 3;
    return {
      diasGozados: gozados,
      ferias: r2(ferias),
      tercoFerias: r2(tercoFerias),
      abono: r2(abono),
      tercoAbono: r2(tercoAbono),
      total: r2(ferias + tercoFerias + abono + tercoAbono),
    };
  }

  // 13o com media de horas extras habituais (TST, Sumula 45): (salario + total de extras / meses) x meses / 12.
  function decimoComHorasExtras({ salario, totalHorasExtras, meses }) {
    num(salario, 'salario', { max: 1e9 });
    num(totalHorasExtras, 'total de horas extras', { max: 1e9 });
    num(meses, 'meses', { min: 1, max: 12, inteiro: true });
    const media = totalHorasExtras / meses;
    const r = decimoTerceiro({ salario, variaveis: media, meses });
    return { mediaExtras: r2(media), base: r.base, bruto: r.bruto };
  }

  // Reflexo das horas extras no DSR: total de extras do mes / dias uteis x domingos e feriados
  // (Lei 605/1949; TST, Sumula 172).
  function dsrHorasExtras({ valorHorasExtras, diasUteis, domingosFeriados }) {
    num(valorHorasExtras, 'valor das horas extras', { max: 1e9 });
    num(diasUteis, 'dias uteis', { min: 1, max: 31, inteiro: true });
    num(domingosFeriados, 'domingos e feriados', { max: 31, inteiro: true });
    return { dsr: r2((valorHorasExtras / diasUteis) * domingosFeriados) };
  }

  // Adicional noturno (CLT, art. 73): minimo de 20% sobre a hora diurna; a hora noturna urbana tem
  // 52min30s, entao 60/52,5 horas pagas por hora de relogio. Retorna so o que excede o salario base.
  function adicionalNoturno({ salario, horasSemanais, horasNoturnas, adicionalPct = 20, horaReduzida = true }) {
    num(salario, 'salario', { min: 0.01, max: 1e9 });
    num(horasSemanais, 'jornada semanal', { min: 1, max: 44 });
    num(horasNoturnas, 'horas noturnas', { max: 744 });
    num(adicionalPct, 'adicional', { min: 20, max: 200 });
    const vh = salario / (5 * horasSemanais);
    const p = adicionalPct / 100;
    const adicional = horasNoturnas * vh * p;
    const horasPagas = horaReduzida ? (horasNoturnas * 60) / 52.5 : horasNoturnas;
    const reducao = (horasPagas - horasNoturnas) * vh * (1 + p);
    return {
      valorHora: r2(vh),
      adicional: r2(adicional),
      horaReduzida: r2(reducao),
      horasPagas: r2(horasPagas),
      total: r2(adicional + reducao),
    };
  }

  // Ferias vencidas: salario + 1/3 por periodo; concedidas apos o periodo concessivo sao pagas em
  // dobro (CLT, art. 137; TST, Sumula 450).
  function feriasVencidas({ salario, periodos }) {
    num(salario, 'salario', { max: 1e9 });
    num(periodos, 'periodos vencidos', { min: 1, max: 10, inteiro: true });
    const simples = (salario + salario / 3) * periodos;
    return { simples: r2(simples), dobro: r2(simples * 2), diferencaDobra: r2(simples) };
  }

  // Financiamento de veiculo pela tabela Price, sem IOF, seguros e tarifas.
  function financiamentoVeiculo({ preco, entrada, taxaMensalPct, meses }) {
    num(preco, 'preco do veiculo', { min: 0.01, max: 1e10 });
    num(entrada, 'entrada', { max: 1e10 });
    if (entrada >= preco) throw new RangeError('a entrada deve ser menor que o preco');
    const valor = preco - entrada;
    const f = financiamento({ valor, taxaMensalPct, meses });
    return {
      valorFinanciado: r2(valor),
      parcela: f.price.parcela,
      juros: f.price.juros,
      totalPago: r2(entrada + f.price.total),
      taxaAnualPct: taxaMensalParaAnualPct(taxaMensalPct),
    };
  }

  return {
    r2,
    taxaMensalParaAnualPct,
    abonoPecuniario,
    decimoComHorasExtras,
    dsrHorasExtras,
    adicionalNoturno,
    feriasVencidas,
    financiamentoVeiculo,
    taxaAnualParaMensalPct,
    jurosCompostos,
    financiamento,
    mesesComFracao,
    decimoTerceiro,
    feriasProporcionais,
    avisoPrevio,
    horaExtra,
    estimaFgts,
    multaFgts,
  };
});
