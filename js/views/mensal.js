// Resumo mensal de faturamento — rota #/mensal
import { getAll } from '../store.js';
import { resumoMensal } from '../core/calc.js';
import { brl, hoje } from '../core/util.js';

function fmtMes(yyyyMm) {
  const [ano, mes] = yyyyMm.split('-');
  const nome = new Date(+ano, +mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export function renderMensal(el) {
  const meses = resumoMensal(getAll());
  const mesAtual = hoje().slice(0, 7);
  const totalGeral = meses.reduce((s, m) => s + m.total, 0);
  const recebidoGeral = meses.reduce((s, m) => s + m.recebido, 0);

  el.innerHTML = `
  <header class="barra">
    <a href="#/" class="voltar">‹ Voltar</a>
    <h1>Faturamento por mês</h1>
  </header>
  <div class="form">
    ${meses.length ? `
      <div class="totais" style="margin-bottom:16px">
        <div><span>Total geral (${meses.reduce((s, m) => s + m.quantidade, 0)} festas)</span><b>${brl(totalGeral)}</b></div>
        <div><span>Já recebido</span><b style="color:var(--ok)">${brl(recebidoGeral)}</b></div>
      </div>
      <div class="lista" style="padding:0">
        ${meses.map(m => {
          const ehAtual = m.mes === mesAtual;
          const cor = m.aReceber <= 0 && m.total > 0 ? 'pago' : m.recebido > 0 ? 'parcial' : '';
          return `<div class="card ${cor}">
            <div class="linha1">
              <b>${fmtMes(m.mes)}${ehAtual ? ' <span class="selo pago">Atual</span>' : ''}</b>
              <span>${m.quantidade} ${m.quantidade === 1 ? 'festa' : 'festas'}</span>
            </div>
            <div class="valores">
              <span>Feito: <b>${brl(m.total)}</b></span>
              <span>Recebido: <b style="color:var(--ok)">${brl(m.recebido)}</b></span>
            </div>
            ${m.aReceber > 0 ? `<div class="info" style="margin-top:4px;text-align:right">Falta receber: <b>${brl(m.aReceber)}</b></div>` : ''}
          </div>`;
        }).join('')}
      </div>
    ` : '<p class="vazio">Nenhuma festa cadastrada ainda.</p>'}
  </div>`;
}
