// ═══════════════════════════════════════════════════════════════
// TIPOS DO MCP CAMALEÃO CRM
// ═══════════════════════════════════════════════════════════════

export interface CamaleaoConfig {
  apiUrl: string;
  email: string;
  password: string;
}

export interface PeriodoDetectado {
  data_inicio: string;
  data_fim: string;
  label: string;
}

export interface RecebimentoPorVia {
  via: string;
  total: number;
  quantidade: number;
}

export interface Transacao {
  data: string;
  descricao: string;
  valor: number;
  via: string;
  tipo: 'ENTRADA' | 'SAIDA';
}

export interface EspelhoBancarioResult {
  data_inicio: string;
  data_fim: string;
  periodo_label: string;
  mensagem: string;
  total_recebido: number;
  total_pago: number;
  saldo_periodo: number;
  recebimentos_por_via: RecebimentoPorVia[];
  extrato?: Transacao[];
}

export interface PedidoParado {
  id: number;
  client_name: string;
  status: string;
  production_date: string;
  dias_parado: number;
  urgente: boolean;
}

export interface PedidosParadosResult {
  total_parados: number;
  pedidos_criticos: PedidoParado[];
  mensagem: string;
}

export interface Pedido {
  id: number;
  client_name: string;
  value: number;
  status: string;
  created_at: string;
}

export interface ConsultaPedidosResult {
  periodo_label: string;
  total_pedidos: number;
  valor_total: number;
  pedidos: Pedido[];
  mensagem: string;
}

export interface PagamentoPendente {
  client_name: string;
  valor: number;
  dias_atraso: number;
}

export interface ConsultaPagamentosResult {
  total_pendente: number;
  quantidade: number;
  pagamentos: PagamentoPendente[];
  mensagem: string;
}

// Tipos da API GraphQL
export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export interface PaginatorInfo {
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
}

export interface BankMirrorEntry {
  id: string;
  description: string;
  value: number;
  date: string;
  via_id: string;
}

export interface Order {
  id: number;
  client?: {
    name: string;
  };
  value: number;
  status?: {
    name: string;
  };
  production_date?: string;
  created_at: string;
}

export interface Payment {
  id: number;
  client?: {
    name: string;
  };
  value: number;
  due_date: string;
  paid_at?: string;
}
