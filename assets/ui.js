/* Liga os formulários (data-calc) às funções de Calc. Sem dependências, sem rastreamento. */
(function () {
  'use strict';

  var fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var brl = function (v) { return fmt.format(v); };
  var pct = function (v) { return (v * 100).toLocaleString('pt-BR') + '%'; };

  // Aceita "1.234,56" e "1234.56".
  function parse(s) {
    s = String(s).trim().replace(/\s/g, '');
    if (s === '') return 0;
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s);
    if (!isFinite(n)) throw new RangeError('Número inválido: ' + s);
    return n;
  }

  function row(label, value, destaque) {
    return { label: label, value: value, destaque: !!destaque };
  }

  var handlers = {
    'juros-compostos': function (v) {
      var taxa = v.tipoTaxa === 'anual' ? Calc.taxaAnualParaMensalPct(v.taxa) : v.taxa;
      var meses = v.tipoPrazo === 'anos' ? v.prazo * 12 : v.prazo;
      var r = Calc.jurosCompostos({ capital: v.capital, aporte: v.aporte, taxaMensalPct: taxa, meses: meses });
      return [
        row('Montante final', brl(r.montante), true),
        row('Total investido', brl(r.investido)),
        row('Total de juros', brl(r.juros)),
        row('Taxa mensal usada', taxa.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) + '%'),
      ];
    },
    'financiamento-price-sac': function (v) {
      var r = Calc.financiamento({ valor: v.valor, taxaMensalPct: v.taxa, meses: v.meses });
      return [
        row('Price: parcela fixa', brl(r.price.parcela), true),
        row('Price: total de juros', brl(r.price.juros)),
        row('SAC: primeira parcela', brl(r.sac.primeira), true),
        row('SAC: última parcela', brl(r.sac.ultima)),
        row('SAC: total de juros', brl(r.sac.juros)),
        row('Diferença de juros (Price - SAC)', brl(Calc.r2(r.price.juros - r.sac.juros))),
      ];
    },
    'decimo-terceiro-proporcional': function (v) {
      var meses = Calc.mesesComFracao(v.meses, v.dias);
      var r = Calc.decimoTerceiro({ salario: v.salario, variaveis: v.variaveis, meses: meses });
      return [
        row('13º salário bruto', brl(r.bruto), true),
        row('Meses considerados', meses + '/12'),
        row('Base de cálculo', brl(r.base)),
      ];
    },
    'ferias-proporcionais': function (v) {
      var meses = Calc.mesesComFracao(v.meses, v.dias);
      var r = Calc.feriasProporcionais({ salario: v.salario, variaveis: v.variaveis, meses: meses });
      return [
        row('Total bruto (férias + 1/3)', brl(r.total), true),
        row('Férias proporcionais', brl(r.ferias)),
        row('Adicional de 1/3', brl(r.terco)),
        row('Meses considerados', meses + '/12'),
      ];
    },
    'aviso-previo-proporcional': function (v) {
      var r = Calc.avisoPrevio({ anos: v.anos });
      return [
        row('Dias de aviso prévio', r.dias + ' dias', true),
        row('Dias adicionais por tempo de serviço', r.extra + ' dias'),
      ];
    },
    'hora-extra': function (v) {
      var r = Calc.horaExtra({
        salario: v.salario, horasSemanais: v.horasSemanais, horas50: v.horas50, horas100: v.horas100,
      });
      return [
        row('Total de horas extras', brl(r.total), true),
        row('Valor da hora normal (divisor ' + r.divisor + ')', brl(r.valorHora)),
        row('Horas a 50%', brl(r.valor50)),
        row('Horas a 100%', brl(r.valor100)),
      ];
    },
    'multa-fgts': function (v) {
      var saldo = v.saldo;
      var estimado = false;
      if (saldo <= 0) {
        saldo = Calc.estimaFgts({ salario: v.salario, meses: v.meses }).saldo;
        estimado = true;
      }
      var r = Calc.multaFgts({ saldo: saldo, modalidade: v.modalidade });
      return [
        row('Multa do FGTS (' + pct(r.taxa) + ')', brl(r.multa), true),
        row(estimado ? 'Saldo estimado (8% ao mês, sem correção)' : 'Saldo informado', brl(saldo)),
      ];
    },
    'ferias-vendendo-10-dias': function (v) {
      var r = Calc.abonoPecuniario({ salario: v.salario, diasVendidos: v.diasVendidos });
      return [
        row('Total bruto', brl(r.total), true),
        row('Férias dos ' + r.diasGozados + ' dias gozados', brl(r.ferias)),
        row('1/3 sobre as férias gozadas', brl(r.tercoFerias)),
        row('Abono pecuniário', brl(r.abono)),
        row('1/3 sobre o abono', brl(r.tercoAbono)),
      ];
    },
    'decimo-terceiro-com-horas-extras': function (v) {
      var r = Calc.decimoComHorasExtras({ salario: v.salario, totalHorasExtras: v.totalHorasExtras, meses: v.meses });
      return [
        row('13º salário bruto', brl(r.bruto), true),
        row('Média mensal de horas extras', brl(r.mediaExtras)),
        row('Base de cálculo (salário + média)', brl(r.base)),
      ];
    },
    'hora-extra-com-dsr': function (v) {
      var h = Calc.horaExtra({
        salario: v.salario, horasSemanais: v.horasSemanais, horas50: v.horas50, horas100: v.horas100,
      });
      var d = Calc.dsrHorasExtras({
        valorHorasExtras: h.total, diasUteis: v.diasUteis, domingosFeriados: v.domingosFeriados,
      });
      return [
        row('Total (extras + DSR)', brl(Calc.r2(h.total + d.dsr)), true),
        row('Horas extras', brl(h.total)),
        row('Reflexo no DSR', brl(d.dsr)),
        row('Valor da hora normal (divisor ' + h.divisor + ')', brl(h.valorHora)),
      ];
    },
    'adicional-noturno': function (v) {
      var r = Calc.adicionalNoturno({
        salario: v.salario, horasSemanais: v.horasSemanais, horasNoturnas: v.horasNoturnas,
        adicionalPct: v.adicionalPct, horaReduzida: v.horaReduzida === 'sim',
      });
      return [
        row('Total a receber além do salário', brl(r.total), true),
        row('Adicional noturno', brl(r.adicional)),
        row('Efeito da hora reduzida', brl(r.horaReduzida)),
        row('Horas pagas (hora reduzida)', r.horasPagas.toLocaleString('pt-BR') + ' h'),
        row('Valor da hora normal', brl(r.valorHora)),
      ];
    },
    'ferias-vencidas-em-dobro': function (v) {
      var r = Calc.feriasVencidas({ salario: v.salario, periodos: v.periodos });
      return [
        row('Férias vencidas, valor simples (com 1/3)', brl(r.simples), true),
        row('Se não concedidas até o fim do período concessivo: em dobro', brl(r.dobro)),
        row('Valor adicional da dobra', brl(r.diferencaDobra)),
      ];
    },
    'financiamento-de-veiculo': function (v) {
      var r = Calc.financiamentoVeiculo({
        preco: v.preco, entrada: v.entrada, taxaMensalPct: v.taxa, meses: v.meses,
      });
      var linhas = [
        row('Parcela mensal', brl(r.parcela), true),
        row('Valor financiado', brl(r.valorFinanciado)),
        row('Total de juros', brl(r.juros)),
        row('Total pago (entrada + parcelas)', brl(r.totalPago)),
        row('Taxa anual equivalente', r.taxaAnualPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%'),
      ];
      [24, 36, 48, 60].forEach(function (n) {
        if (n === v.meses) return;
        var o = Calc.financiamentoVeiculo({ preco: v.preco, entrada: v.entrada, taxaMensalPct: v.taxa, meses: n });
        linhas.push(row('Em ' + n + ' meses: parcela / juros', brl(o.parcela) + ' / ' + brl(o.juros)));
      });
      return linhas;
    },
  };

  function render(out, linhas) {
    out.innerHTML = '';
    var dl = document.createElement('dl');
    linhas.forEach(function (l) {
      var dt = document.createElement('dt');
      dt.textContent = l.label;
      var dd = document.createElement('dd');
      dd.textContent = l.value;
      if (l.destaque) { dt.className = 'destaque'; dd.className = 'destaque'; }
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    out.appendChild(dl);
  }

  function erro(out, msg) {
    out.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'erro';
    p.textContent = msg;
    out.appendChild(p);
  }

  function bind(form) {
    var slug = form.getAttribute('data-calc');
    var out = document.getElementById('resultado');
    var handler = handlers[slug];
    if (!handler || !out) return;
    function run() {
      var v = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        v[el.name] = el.tagName === 'SELECT' ? el.value : parse(el.value);
      });
      try {
        render(out, handler(v));
      } catch (e) {
        erro(out, e.message);
      }
    }
    form.addEventListener('submit', function (ev) { ev.preventDefault(); run(); });
    form.addEventListener('input', run);
    run();
  }

  Array.prototype.forEach.call(document.querySelectorAll('form[data-calc]'), bind);
})();
