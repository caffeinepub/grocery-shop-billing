import Iter "mo:core/Iter";
import List "mo:core/List";

import Nat "mo:core/Nat";


actor {
  type AppSettings = {
    websiteName : Text;
    shopName : Text;
    contact : Text;
    address : Text;
    upiId : Text;
    qrNote : Text;
    showTax : Bool;
    gstin : Text;
    gstinEnabled : Bool;
    billLogoBase64 : Text;
    websiteLogoBase64 : Text;
    showQrOnBill : Bool;
  };

  type User = {
    id : Text;
    username : Text;
    password : Text;
    role : Text;
  };

  type MenuItem = {
    id : Text;
    name : Text;
    mrp : Float;
    barcode : Text;
    barcodeEnabled : Bool;
    imageBase64 : Text;
  };

  type CartItem = {
    menuItemId : Text;
    name : Text;
    mrp : Float;
    qty : Nat;
    imageBase64 : Text;
  };

  type Order = {
    id : Text;
    orderNo : Nat;
    customerName : Text;
    customerPhone : Text;
    paymentMode : Text;
    cashAmount : Float;
    items : [CartItem];
    discount : Float;
    subtotal : Float;
    total : Float;
    timestamp : Text;
    date : Text;
  };

  var appSettings : AppSettings = {
    websiteName = "MRP Grocery";
    shopName = "MRP Grocery Store";
    contact = "+91 9876543210";
    address = "123 Market Street, Thanjavur";
    upiId = "shop@upi";
    qrNote = "Scan to Pay";
    showTax = false;
    gstin = "";
    gstinEnabled = false;
    billLogoBase64 = "";
    websiteLogoBase64 = "";
    showQrOnBill = true;
  };

  var users = List.fromArray<User>([
    {
      id = "1";
      username = "mrpadmin";
      password = "mrp1230";
      role = "admin";
    },
  ]);

  var menuItems = List.fromArray<MenuItem>([
    {
      id = "1";
      name = "Salt";
      mrp = 20.0;
      barcode = "8901058851015";
      barcodeEnabled = true;
      imageBase64 = "";
    },
    {
      id = "2";
      name = "Sugar";
      mrp = 45.0;
      barcode = "8901058000321";
      barcodeEnabled = true;
      imageBase64 = "";
    },
    {
      id = "3";
      name = "Rice";
      mrp = 65.0;
      barcode = "8906002310012";
      barcodeEnabled = true;
      imageBase64 = "";
    },
    {
      id = "4";
      name = "Masala";
      mrp = 35.0;
      barcode = "8901030123456";
      barcodeEnabled = true;
      imageBase64 = "";
    },
  ]);

  var orders = List.empty<Order>();
  var orderCounter = 1001;

  // App Settings
  public query ({ caller }) func getSettings() : async AppSettings {
    appSettings;
  };

  public shared ({ caller }) func setSettings(settings : AppSettings) : async () {
    appSettings := settings;
  };

  // Users
  public query ({ caller }) func getUsers() : async [User] {
    users.toArray();
  };

  public shared ({ caller }) func setUsers(newUsers : [User]) : async () {
    users := List.fromArray<User>(newUsers);
  };

  // Menu Items
  public query ({ caller }) func getMenuItems() : async [MenuItem] {
    menuItems.toArray();
  };

  public shared ({ caller }) func setMenuItems(newMenuItems : [MenuItem]) : async () {
    menuItems := List.fromArray<MenuItem>(newMenuItems);
  };

  // Orders
  public query ({ caller }) func getOrders() : async [Order] {
    orders.toArray();
  };

  public shared ({ caller }) func addOrder(order : Order) : async () {
    orders.add(order);
  };

  public shared ({ caller }) func setOrders(newOrders : [Order]) : async () {
    orders := List.fromArray<Order>(newOrders);
  };

  // Order Counter
  public query ({ caller }) func getOrderCounter() : async Nat {
    orderCounter;
  };

  public shared ({ caller }) func incrementOrderCounter() : async Nat {
    let current = orderCounter;
    orderCounter += 1;
    current;
  };
};
