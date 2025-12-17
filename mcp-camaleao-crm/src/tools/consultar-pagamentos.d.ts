import type { GraphQLClient } from '../lib/graphql-client.js';
export declare function consultarPagamentos(client: GraphQLClient): Promise<{
    total_pago: number;
    total_a_receber: number;
    mensagem: string;
}>;
//# sourceMappingURL=consultar-pagamentos.d.ts.map