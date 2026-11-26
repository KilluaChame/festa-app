// Testes de merge.js — rodam com: node js/core/merge.test.js
// Sem dependências externas.

import { mesclar } from './merge.js';

let passou = 0, falhou = 0;

function assert(descricao, condicao) {
  if (condicao) {
    console.log(`  ✓ ${descricao}`);
    passou++;
  } else {
    console.error(`  ✗ FALHOU: ${descricao}`);
    falhou++;
  }
}

function porId(lista, id) {
  return lista.find(p => p.id === id);
}

// --- Dados de apoio ---
const TS_VELHO  = '2026-11-01T10:00:00.000Z';
const TS_NOVO   = '2026-11-02T10:00:00.000Z';
const TS_IGUAL  = '2026-11-01T10:00:00.000Z'; // mesmo valor

console.log('\n=== Testes de mesclar() ===\n');

// 1. Festa existe só localmente
console.log('1. Festa só local:');
{
  const local  = [{ id: 'a', nome: 'Local', atualizadoEm: TS_NOVO, excluida: false }];
  const remota = [];
  const result = mesclar(local, remota);
  assert('a está no resultado', porId(result, 'a') !== undefined);
  assert('tamanho é 1', result.length === 1);
}

// 2. Festa existe só remotamente
console.log('\n2. Festa só remota:');
{
  const local  = [];
  const remota = [{ id: 'b', nome: 'Remota', atualizadoEm: TS_NOVO, excluida: false }];
  const result = mesclar(local, remota);
  assert('b está no resultado', porId(result, 'b') !== undefined);
  assert('tamanho é 1', result.length === 1);
}

// 3. Festa nos dois, local mais recente → local vence
console.log('\n3. Nos dois — local mais recente:');
{
  const local  = [{ id: 'c', nome: 'Local Novo',  atualizadoEm: TS_NOVO,  excluida: false }];
  const remota = [{ id: 'c', nome: 'Remota Velho',atualizadoEm: TS_VELHO, excluida: false }];
  const result = mesclar(local, remota);
  assert('venceu a local', porId(result, 'c').nome === 'Local Novo');
  assert('tamanho é 1', result.length === 1);
}

// 4. Festa nos dois, remota mais recente → remota vence
console.log('\n4. Nos dois — remota mais recente:');
{
  const local  = [{ id: 'd', nome: 'Local Velho', atualizadoEm: TS_VELHO, excluida: false }];
  const remota = [{ id: 'd', nome: 'Remota Nova', atualizadoEm: TS_NOVO,  excluida: false }];
  const result = mesclar(local, remota);
  assert('venceu a remota', porId(result, 'd').nome === 'Remota Nova');
  assert('tamanho é 1', result.length === 1);
}

// 5. Empate de datas → local vence
console.log('\n5. Empate de datas — local deve vencer:');
{
  const local  = [{ id: 'e', nome: 'Local Empate',  atualizadoEm: TS_IGUAL, excluida: false }];
  const remota = [{ id: 'e', nome: 'Remota Empate', atualizadoEm: TS_IGUAL, excluida: false }];
  const result = mesclar(local, remota);
  assert('venceu a local no empate', porId(result, 'e').nome === 'Local Empate');
}

// 6. Exclusão mais recente que edição → exclusão vence
console.log('\n6. Exclusão (remota) mais recente que edição (local):');
{
  const local  = [{ id: 'f', nome: 'Editada local', atualizadoEm: TS_VELHO, excluida: false }];
  const remota = [{ id: 'f', nome: 'Editada local', atualizadoEm: TS_NOVO,  excluida: true  }];
  const result = mesclar(local, remota);
  assert('festa está excluida=true no resultado', porId(result, 'f').excluida === true);
}

// 7. Edição mais recente que exclusão → edição restaura
console.log('\n7. Edição (local) mais recente que exclusão (remota):');
{
  const local  = [{ id: 'g', nome: 'Restaurada', atualizadoEm: TS_NOVO,  excluida: false }];
  const remota = [{ id: 'g', nome: 'Restaurada', atualizadoEm: TS_VELHO, excluida: true  }];
  const result = mesclar(local, remota);
  assert('festa está excluida=false (restaurada)', porId(result, 'g').excluida === false);
}

// 8. Festas diferentes nos dois aparelhos → as duas existem no resultado
console.log('\n8. Festas diferentes em cada aparelho:');
{
  const local  = [{ id: 'h1', nome: 'Festa H1', atualizadoEm: TS_NOVO, excluida: false }];
  const remota = [{ id: 'h2', nome: 'Festa H2', atualizadoEm: TS_NOVO, excluida: false }];
  const result = mesclar(local, remota);
  assert('h1 está no resultado', porId(result, 'h1') !== undefined);
  assert('h2 está no resultado', porId(result, 'h2') !== undefined);
  assert('tamanho é 2', result.length === 2);
}

// 9. Conjuntos de materiais hierárquicos (bolsas + sub-caixas + itens) — versão mais recente vence
console.log('\n9. Conjuntos de materiais:');
{
  const local = [{
    id: 'k1', tipo: 'Animação', numero: 1, nome: 'Animação 1', cor: 'verde', obs: '',
    itens: [{ id: 'i1', nome: 'Caixa de Som', cor: 'verde', obs: '' }],
    compartimentos: [{
      id: 'b1', nome: 'Bolsa de animação preta', numero: 1, cor: 'amarelo', obs: 'Zíper',
      itens: [],
      compartimentos: [{
        id: 'cx1', nome: 'Caixa do Microfone', cor: 'verde', obs: '',
        itens: [{ id: 'm1', nome: '2 pilhas novas', cor: 'azul', obs: 'João' }],
        compartimentos: [],
      }],
    }],
    atualizadoEm: TS_NOVO, excluida: false,
  }];
  const remota = [{
    id: 'k1', tipo: 'Animação', numero: 1, nome: 'Animação 1', cor: 'verde', obs: '',
    itens: [], compartimentos: [],
    atualizadoEm: TS_VELHO, excluida: false,
  }];
  const result = mesclar(local, remota);
  const resK1 = porId(result, 'k1');
  assert('conjunto local mais recente vence', resK1.compartimentos[0].cor === 'amarelo');
  assert('item dentro de subcaixa preservado', resK1.compartimentos[0].compartimentos[0].itens[0].obs === 'João');
}

// --- Sumário ---
console.log(`\n=== Resultado: ${passou} passaram, ${falhou} falharam ===\n`);
if (falhou > 0) process.exit(1);
