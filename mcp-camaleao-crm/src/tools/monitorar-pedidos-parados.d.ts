import type { GraphQLClient } from '../lib/graphql-client.js';
interface PedidoParado {
    codigo: string;
    cliente: string;
    dias_parado: number;
    valor: number;
    criado_em: string;
    severidade: 'CRÍTICO' | 'ALTO';
}
export declare function monitorarPedidosParados(client: GraphQLClient): Promise<{
    total: number;
    criticos: number;
    pedidos: PedidoParado[];
    mensagem: string;
}>;
export {};
//# sourceMappingURL=monitorar-pedidos-parados.d.ts.map