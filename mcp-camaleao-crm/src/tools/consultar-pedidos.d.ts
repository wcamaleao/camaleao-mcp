import type { GraphQLClient } from '../lib/graphql-client.js';
interface PedidoResumo {
    codigo: string;
    cliente: string;
    valor: number;
    pago: number;
    devendo: number;
}
export declare function consultarPedidos(client: GraphQLClient, args: {
    data_inicio?: string;
    data_fim?: string;
}): Promise<{
    periodo: string;
    total_pedidos: number;
    valor_total: number;
    total_pago: number;
    total_devendo: number;
    pedidos: PedidoResumo[];
    mensagem: string;
}>;
export {};
//# sourceMappingURL=consultar-pedidos.d.ts.map