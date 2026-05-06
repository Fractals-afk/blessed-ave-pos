export interface OrderReceiptData {
    orderId: string;
    customerName?: string;
    customerEmail?: string;
    items: {
        name: string;
        quantity: number;
        subtotal: number;
        options?: string;
    }[];
    total: number;
    paymentMethod: string;
    source: string;
}
export declare function sendOrderReceipt(data: OrderReceiptData): Promise<void>;
//# sourceMappingURL=mailer.d.ts.map