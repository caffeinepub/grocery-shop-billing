import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface MenuItem {
    id: string;
    mrp: number;
    name: string;
    barcode: string;
    imageBase64: string;
    barcodeEnabled: boolean;
}
export interface CartItem {
    mrp: number;
    qty: bigint;
    name: string;
    imageBase64: string;
    menuItemId: string;
}
export interface Order {
    id: string;
    customerName: string;
    total: number;
    customerPhone: string;
    date: string;
    orderNo: bigint;
    timestamp: string;
    discount: number;
    paymentMode: string;
    items: Array<CartItem>;
    cashAmount: number;
    subtotal: number;
}
export interface User {
    id: string;
    username: string;
    password: string;
    role: string;
}
export interface AppSettings {
    websiteName: string;
    qrNote: string;
    showQrOnBill: boolean;
    contact: string;
    websiteLogoBase64: string;
    billLogoBase64: string;
    showTax: boolean;
    gstin: string;
    address: string;
    upiId: string;
    shopName: string;
    gstinEnabled: boolean;
}
export interface backendInterface {
    addOrder(order: Order): Promise<void>;
    getMenuItems(): Promise<Array<MenuItem>>;
    getOrderCounter(): Promise<bigint>;
    getOrders(): Promise<Array<Order>>;
    getSettings(): Promise<AppSettings>;
    getUsers(): Promise<Array<User>>;
    incrementOrderCounter(): Promise<bigint>;
    setMenuItems(newMenuItems: Array<MenuItem>): Promise<void>;
    setOrders(newOrders: Array<Order>): Promise<void>;
    setSettings(settings: AppSettings): Promise<void>;
    setUsers(newUsers: Array<User>): Promise<void>;
}
