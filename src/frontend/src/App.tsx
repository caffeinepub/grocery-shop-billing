// =============================================================================
// GROCERY SHOP BILLING APPLICATION
// Complete single-page app with backend sync + LocalStorage fallback
// Dark theme, mobile-first, Outfit font
// =============================================================================

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
// @zxing/library is loaded dynamically at runtime (CDN fallback) — no static import
import {
  BarChart2,
  Camera,
  CheckCircle,
  ChevronLeft,
  Download,
  Edit,
  LogOut,
  Menu,
  MessageSquare,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  Settings,
  Share2,
  ShoppingCart,
  Trash2,
  UserCog,
  Users,
  Volume2,
  X,
} from "lucide-react";
// qrcode is loaded dynamically at runtime — no static import
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// =============================================================================
// DATA MODELS
// =============================================================================

interface AppSettings {
  websiteName: string;
  shopName: string;
  contact: string;
  address: string;
  upiId: string;
  qrNote: string;
  showTax: boolean;
  gstin: string;
  gstinEnabled: boolean;
  billLogoBase64: string;
  websiteLogoBase64: string;
  showQrOnBill: boolean;
}

type UserRole = "admin" | "cashier" | "manager" | "accountant";

interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
}

interface MenuItem {
  id: string;
  name: string;
  mrp: number;
  barcode: string;
  barcodeEnabled: boolean;
  imageBase64: string;
}

interface CartItem {
  menuItemId: string;
  name: string;
  mrp: number;
  qty: number;
  imageBase64: string;
}

interface Order {
  id: string;
  orderNo: number;
  customerName: string;
  customerPhone?: string;
  paymentMode: "cash" | "qr";
  cashAmount: number;
  items: CartItem[];
  discount: number;
  subtotal: number;
  total: number;
  timestamp: string;
  date: string;
}

// =============================================================================
// LOCALSTORAGE KEYS
// =============================================================================
const LS_SETTINGS = "groc_settings";
const LS_USERS = "groc_users";
const LS_MENU = "groc_menu";
const LS_ORDERS = "groc_orders";
const LS_ORDER_COUNTER = "groc_order_counter";
const LS_SOUNDS = "groc_sounds";
const SESSION_KEY = "groc_session";
const SESSION_ROLE_KEY = "groc_session_role";

// =============================================================================
// DEFAULT DATA
// =============================================================================
const DEFAULT_SETTINGS: AppSettings = {
  websiteName: "MRP Grocery",
  shopName: "MRP Grocery Store",
  contact: "+91 9876543210",
  address: "123 Market Street, Thanjavur",
  upiId: "shop@upi",
  qrNote: "Scan to Pay",
  showTax: false,
  gstin: "",
  gstinEnabled: false,
  billLogoBase64: "",
  websiteLogoBase64: "",
  showQrOnBill: true,
};

const DEFAULT_USERS: User[] = [
  { id: "1", username: "mrpadmin", password: "mrp1230", role: "admin" },
];

// Role-based page access
const ROLE_PAGES: Record<UserRole, Page[]> = {
  admin: [
    "billing",
    "manage-menu",
    "sales-report",
    "customer-details",
    "settings",
    "manage-users",
    "sounds",
  ],
  manager: [
    "billing",
    "manage-menu",
    "sales-report",
    "customer-details",
    "sounds",
  ],
  cashier: ["billing"],
  accountant: ["billing", "sales-report", "customer-details", "sounds"],
};

const DEFAULT_MENU: MenuItem[] = [
  {
    id: "1",
    name: "Salt",
    mrp: 20,
    barcode: "8901058851015",
    barcodeEnabled: true,
    imageBase64: "",
  },
  {
    id: "2",
    name: "Sugar",
    mrp: 45,
    barcode: "8901058000321",
    barcodeEnabled: true,
    imageBase64: "",
  },
  {
    id: "3",
    name: "Rice",
    mrp: 65,
    barcode: "8906002310012",
    barcodeEnabled: true,
    imageBase64: "",
  },
  {
    id: "4",
    name: "Masala",
    mrp: 35,
    barcode: "8901030123456",
    barcodeEnabled: true,
    imageBase64: "",
  },
];

const DEFAULT_ORDER_COUNTER = 1001;

// =============================================================================
// HELPERS
// =============================================================================
function loadLS<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================================================
// SOUND SYSTEM
// =============================================================================
interface SoundSettings {
  enabled: boolean;
  volume: number; // 0–100
  scan: boolean;
  login: boolean;
  logout: boolean;
  payment: boolean;
  doneClose: boolean;
  addToCart: boolean;
  error: boolean;
  itemNotFound: boolean;
}

const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 80,
  scan: true,
  login: true,
  logout: true,
  payment: true,
  doneClose: true,
  addToCart: true,
  error: true,
  itemNotFound: true,
};

type SoundEvent = keyof Omit<SoundSettings, "enabled" | "volume">;

function useSoundSystem() {
  const soundSettings = useRef<SoundSettings>(
    loadLS(LS_SOUNDS, DEFAULT_SOUND_SETTINGS),
  );

  const playTone = useCallback(
    (
      frequency: number,
      duration: number,
      type: OscillatorType = "sine",
      volume = 0.5,
    ) => {
      try {
        const ctx = new (
          window.AudioContext ||
          (
            window as unknown as {
              webkitAudioContext: typeof AudioContext;
            }
          ).webkitAudioContext
        )();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gainNode.gain.setValueAtTime(
          volume * (soundSettings.current.volume / 100),
          ctx.currentTime,
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + duration,
        );
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
        oscillator.onended = () => ctx.close();
      } catch {
        /* silent */
      }
    },
    [],
  );

  const playSound = useCallback(
    (event: SoundEvent) => {
      const s = soundSettings.current;
      if (!s.enabled) return;
      if (!s[event]) return;
      const vol = s.volume / 100;
      switch (event) {
        case "scan":
          playTone(880, 0.15, "sine", vol);
          setTimeout(() => playTone(1100, 0.1, "sine", vol), 100);
          break;
        case "login":
          playTone(523, 0.1, "sine", vol);
          setTimeout(() => playTone(659, 0.1, "sine", vol), 120);
          setTimeout(() => playTone(784, 0.2, "sine", vol), 240);
          break;
        case "logout":
          playTone(784, 0.1, "sine", vol);
          setTimeout(() => playTone(523, 0.2, "sine", vol), 120);
          break;
        case "payment":
          playTone(523, 0.08, "sine", vol);
          setTimeout(() => playTone(659, 0.08, "sine", vol), 100);
          setTimeout(() => playTone(784, 0.08, "sine", vol), 200);
          setTimeout(() => playTone(1047, 0.3, "sine", vol), 300);
          break;
        case "doneClose":
          playTone(660, 0.15, "sine", vol);
          setTimeout(() => playTone(880, 0.25, "sine", vol), 180);
          break;
        case "addToCart":
          playTone(600, 0.1, "triangle", vol);
          break;
        case "error":
          playTone(200, 0.2, "sawtooth", vol * 0.5);
          break;
        case "itemNotFound":
          playTone(250, 0.15, "square", vol * 0.5);
          setTimeout(() => playTone(200, 0.2, "square", vol * 0.5), 200);
          break;
      }
    },
    [playTone],
  );

  const updateSoundSettings = useCallback((newSettings: SoundSettings) => {
    soundSettings.current = newSettings;
    saveLS(LS_SOUNDS, newSettings);
  }, []);

  return { playSound, soundSettings, updateSoundSettings };
}

// =============================================================================
// BILL CONTENT COMPONENT (used for both preview modal and download/print)
// =============================================================================
interface BillContentProps {
  order: Order;
  settings: AppSettings;
  darkMode?: boolean;
  qrDataUrl?: string;
}

function BillContent({
  order,
  settings,
  darkMode = true,
  qrDataUrl,
}: BillContentProps) {
  const textColor = darkMode ? "text-white" : "text-black";
  const borderColor = darkMode ? "border-gray-500" : "border-gray-400";
  const mutedColor = darkMode ? "text-gray-400" : "text-gray-600";
  const bgColor = darkMode ? "bg-black" : "bg-white";
  const balance =
    order.paymentMode === "cash"
      ? Math.max(0, order.cashAmount - order.total)
      : 0;

  return (
    <div
      className={`${bgColor} ${textColor} font-mono text-sm p-6 min-w-[280px]`}
      style={{ fontFamily: "'Courier New', Courier, monospace" }}
    >
      {/* Logo */}
      {settings.billLogoBase64 && (
        <div className="flex justify-center mb-3">
          <img
            src={settings.billLogoBase64}
            alt="Logo"
            className="h-16 w-auto object-contain"
          />
        </div>
      )}

      {/* Shop Name */}
      <div className="text-center mb-1">
        <p className="font-bold text-lg leading-tight">{settings.shopName}</p>
        {settings.contact && (
          <p className={`${mutedColor} text-xs`}>{settings.contact}</p>
        )}
        {settings.address && (
          <p className={`${mutedColor} text-xs`}>{settings.address}</p>
        )}
      </div>

      <div className={`border-t ${borderColor} my-2`} />

      {/* Order Info */}
      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span>Order No:</span>
          <span className="font-semibold">#{order.orderNo}</span>
        </div>
        <div className="flex justify-between">
          <span>Customer:</span>
          <span className="font-semibold">{order.customerName}</span>
        </div>
        {order.customerPhone && (
          <div className="flex justify-between">
            <span>Phone:</span>
            <span className={mutedColor}>{order.customerPhone}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDate(order.timestamp)}</span>
        </div>
        <div className="flex justify-between">
          <span>Time:</span>
          <span>{formatTime(order.timestamp)}</span>
        </div>
      </div>

      <div className={`border-t ${borderColor} my-2`} />

      {/* Items Header */}
      <div className={`grid grid-cols-12 text-xs font-bold mb-1 ${mutedColor}`}>
        <span className="col-span-5">Item</span>
        <span className="col-span-2 text-center">Qty</span>
        <span className="col-span-2 text-right">MRP</span>
        <span className="col-span-3 text-right">Amt</span>
      </div>

      {/* Items */}
      {order.items.map((item) => (
        <div key={item.menuItemId} className="grid grid-cols-12 text-xs mb-0.5">
          <span className="col-span-5 truncate">{item.name}</span>
          <span className="col-span-2 text-center">{item.qty}</span>
          <span className="col-span-2 text-right">₹{item.mrp}</span>
          <span className="col-span-3 text-right">₹{item.qty * item.mrp}</span>
        </div>
      ))}

      <div className={`border-t ${borderColor} my-2`} />

      {/* Totals */}
      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatINR(order.subtotal)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>- {formatINR(order.discount)}</span>
          </div>
        )}
        {settings.showTax && (
          <div className="flex justify-between">
            <span>Tax:</span>
            <span>0%</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base">
          <span>TOTAL:</span>
          <span>{formatINR(order.total)}</span>
        </div>
      </div>

      <div className={`border-t ${borderColor} my-2`} />

      {/* Payment */}
      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span>Payment:</span>
          <span className="capitalize">
            {order.paymentMode === "qr" ? "QR Code" : "Cash"}
          </span>
        </div>
        {order.paymentMode === "cash" && order.cashAmount > 0 && (
          <>
            <div className="flex justify-between">
              <span>Cash Paid:</span>
              <span>{formatINR(order.cashAmount)}</span>
            </div>
            {balance > 0 && (
              <div className="flex justify-between font-bold">
                <span>Balance:</span>
                <span>{formatINR(balance)}</span>
              </div>
            )}
          </>
        )}
        {settings.gstinEnabled && settings.gstin && (
          <div className="flex justify-between">
            <span>GSTIN:</span>
            <span>{settings.gstin}</span>
          </div>
        )}
      </div>

      {/* UPI QR Code */}
      {settings.showQrOnBill && qrDataUrl && (
        <>
          <div className={`border-t ${borderColor} my-2`} />
          <div className="flex flex-col items-center py-2 gap-1">
            <p className={`text-xs ${mutedColor}`}>
              {settings.qrNote || "Scan to Pay"}
            </p>
            <img src={qrDataUrl} alt="UPI QR" className="w-28 h-28" />
            <p className={`text-xs ${mutedColor}`}>{settings.upiId}</p>
          </div>
        </>
      )}

      <div className={`border-t ${borderColor} my-2`} />

      {/* Footer */}
      <div className="text-center space-y-1">
        <p className="font-bold text-sm">Thank You!</p>
        <p className="text-xs">Visit Again, Come Again!</p>
        <div className={`border-t ${borderColor} my-2`} />
        <p className="text-xs font-semibold">
          Powered By Medwin Techs Thanjavur
        </p>
        <p className="text-xs" style={{ opacity: 0.5, fontSize: "10px" }}>
          medwin2105@gmail.com
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// BUILD BILL TEXT (plain text for sharing)
// =============================================================================
function buildBillText(order: Order, settings: AppSettings): string {
  const sep = "--------------------------------";
  const d = new Date(order.timestamp);
  const dateStr = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const balance =
    order.paymentMode === "cash"
      ? Math.max(0, order.cashAmount - order.total)
      : 0;

  const lines: string[] = [];
  lines.push(settings.shopName);
  if (settings.contact) lines.push(settings.contact);
  if (settings.address) lines.push(settings.address);
  lines.push(sep);
  lines.push(`Order #${order.orderNo} | ${dateStr} ${timeStr}`);
  lines.push(`Customer: ${order.customerName}`);
  if (order.customerPhone) lines.push(`Phone: ${order.customerPhone}`);
  lines.push(sep);
  for (const item of order.items) {
    const amt = item.qty * item.mrp;
    lines.push(`${item.name.padEnd(14)} x${item.qty}   ₹${amt}`);
  }
  lines.push(sep);
  lines.push(`Subtotal: ₹${order.subtotal.toFixed(2)}`);
  if (order.discount > 0)
    lines.push(`Discount: -₹${order.discount.toFixed(2)}`);
  lines.push(`TOTAL: ₹${order.total.toFixed(2)}`);
  lines.push(`Payment: ${order.paymentMode === "qr" ? "QR Code" : "Cash"}`);
  if (order.paymentMode === "cash" && order.cashAmount > 0) {
    lines.push(`Cash Paid: ₹${order.cashAmount.toFixed(2)}`);
    if (balance > 0) lines.push(`Balance: ₹${balance.toFixed(2)}`);
  }
  lines.push(sep);
  lines.push("Thank you! Visit Again.");
  lines.push("Powered By Medwin Techs Thanjavur");
  return lines.join("\n");
}

// =============================================================================
// SHARE BILL DIALOG
// =============================================================================
interface ShareBillDialogProps {
  open: boolean;
  onClose: () => void;
  order: Order;
  settings: AppSettings;
}

function ShareBillDialog({
  open,
  onClose,
  order,
  settings,
}: ShareBillDialogProps) {
  const [phone, setPhone] = useState(order.customerPhone || "");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");

  // Reset phone when order changes
  useEffect(() => {
    setPhone(order.customerPhone || "");
  }, [order.customerPhone]);

  const formatPhoneForUrl = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 10) {
      // If already has country code (>10 digits and doesn't start with 0)
      if (digits.length > 10 && !digits.startsWith("0")) return digits;
      // Prepend 91 for Indian numbers
      return `91${digits.slice(-10)}`;
    }
    return digits;
  };

  const handleShare = () => {
    const billText = buildBillText(order, settings);
    const formattedPhone = formatPhoneForUrl(phone);

    if (channel === "sms") {
      // SMS: go directly to the phone number's SMS with bill text pre-filled
      const smsBody = encodeURIComponent(billText);
      const smsUrl = formattedPhone
        ? `sms:+${formattedPhone}?&body=${smsBody}`
        : `sms:?body=${smsBody}`;
      window.location.href = smsUrl;
      setTimeout(() => onClose(), 500);
      return;
    }

    // WhatsApp: text only — open wa.me directly to the customer's chat
    const encodedText = encodeURIComponent(billText);
    const waUrl = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;
    window.open(waUrl, "_blank");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-ocid="billing.share_bill.dialog"
        className="bg-card border-border max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Share2 className="w-5 h-5" />
            Share Bill
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Phone */}
          <div>
            <Label className="text-base mb-2 block">
              Customer Number{" "}
              <span className="text-muted-foreground text-sm">(optional)</span>
            </Label>
            <Input
              data-ocid="billing.share_phone.input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="input-large bg-secondary border-border"
            />
          </div>

          {/* Channel selector */}
          <div>
            <Label className="text-base mb-2 block">Share via</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                  channel === "whatsapp"
                    ? "border-green-500 bg-green-500/10 text-green-400"
                    : "border-border bg-secondary text-muted-foreground hover:border-green-500/50"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-8 h-8 fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  role="img"
                >
                  <title>WhatsApp</title>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span className="text-sm font-semibold">WhatsApp</span>
                <span className="text-xs opacity-70">Text only</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel("sms")}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                  channel === "sms"
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-border bg-secondary text-muted-foreground hover:border-blue-500/50"
                }`}
              >
                <MessageSquare className="w-8 h-8" />
                <span className="text-sm font-semibold">SMS</span>
                <span className="text-xs opacity-70">Text only</span>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            data-ocid="billing.share_bill.cancel_button"
            variant="outline"
            onClick={onClose}
            className="border-border"
          >
            Cancel
          </Button>
          <Button
            data-ocid="billing.share_bill.confirm_button"
            onClick={handleShare}
            className={
              channel === "whatsapp"
                ? "bg-green-600 hover:bg-green-700 text-white font-bold"
                : "bg-blue-600 hover:bg-blue-700 text-white font-bold"
            }
          >
            <span className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Share via {channel === "whatsapp" ? "WhatsApp" : "SMS"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// LOGIN PAGE
// =============================================================================
interface LoginPageProps {
  onLogin: (username: string, role: UserRole) => void;
  settings: AppSettings;
  playSound?: (event: SoundEvent) => void;
}

function LoginPage({ onLogin, settings, playSound }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const users = loadLS<User[]>(LS_USERS, DEFAULT_USERS);
    const user = users.find(
      (u) => u.username === username && u.password === password,
    );
    if (user) {
      playSound?.("login");
      sessionStorage.setItem(SESSION_KEY, username);
      sessionStorage.setItem(
        SESSION_ROLE_KEY,
        (user.role as string) || "cashier",
      );
      onLogin(username, (user.role as UserRole) || "cashier");
    } else {
      playSound?.("error");
      setError("Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Logo / App Name */}
          <div className="text-center mb-10">
            {settings.websiteLogoBase64 ? (
              <img
                src={settings.websiteLogoBase64}
                alt="Logo"
                className="h-20 w-auto mx-auto mb-4 object-contain"
              />
            ) : (
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/20 flex items-center justify-center">
                <ShoppingCart className="w-10 h-10 text-primary" />
              </div>
            )}
            <h1 className="text-3xl font-bold text-foreground">
              {settings.websiteName}
            </h1>
            <p className="text-muted-foreground mt-1">Billing System</p>
          </div>

          {/* Form */}
          <div className="bg-card rounded-2xl p-6 border border-border space-y-4">
            <div>
              <Label
                htmlFor="login-username"
                className="text-sm font-medium mb-2 block"
              >
                Username
              </Label>
              <Input
                id="login-username"
                data-ocid="login.input"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                placeholder="Enter username"
                className="input-large bg-secondary border-border"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div>
              <Label
                htmlFor="login-password"
                className="text-sm font-medium mb-2 block"
              >
                Password
              </Label>
              <Input
                id="login-password"
                data-ocid="login.password.input"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Enter password"
                className="input-large bg-secondary border-border"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>

            {error && (
              <p
                data-ocid="login.error_state"
                className="text-destructive text-sm font-medium"
              >
                {error}
              </p>
            )}

            <Button
              data-ocid="login.submit_button"
              onClick={handleLogin}
              className="w-full input-large bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-lg"
            >
              Login
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-muted-foreground text-sm">
        Powered By Medwin Techs Thanjavur
      </footer>
    </div>
  );
}

// =============================================================================
// TOP BAR
// =============================================================================
interface TopBarProps {
  settings: AppSettings;
  currentUser: string;
  currentRole: string;
  onMenuOpen: () => void;
  onLogout: () => void;
}

function TopBar({
  settings,
  currentUser,
  currentRole,
  onMenuOpen,
  onLogout,
}: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-card border-b border-border h-14 flex items-center px-4">
      <button
        type="button"
        onClick={onMenuOpen}
        className="p-2 rounded-lg hover:bg-secondary transition-colors mr-3"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>
      <div className="flex-1 flex items-center justify-center">
        {settings.websiteLogoBase64 ? (
          <img
            src={settings.websiteLogoBase64}
            alt="Logo"
            className="h-8 w-auto object-contain"
          />
        ) : (
          <span className="font-bold text-lg text-primary">
            {settings.websiteName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-sm font-semibold">{currentUser}</span>
          <span className="text-xs text-muted-foreground capitalize">
            {currentRole}
          </span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          aria-label="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

// =============================================================================
// SLIDE NAV
// =============================================================================
type Page =
  | "billing"
  | "manage-menu"
  | "sales-report"
  | "customer-details"
  | "settings"
  | "manage-users"
  | "sounds";

interface SlideNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  allowedPages: Page[];
}

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  {
    id: "billing",
    label: "Billing",
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    id: "manage-menu",
    label: "Manage Menu",
    icon: <Package className="w-5 h-5" />,
  },
  {
    id: "sales-report",
    label: "Sales Report",
    icon: <BarChart2 className="w-5 h-5" />,
  },
  {
    id: "customer-details",
    label: "Customer Details",
    icon: <Users className="w-5 h-5" />,
  },
  { id: "settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
  {
    id: "manage-users",
    label: "Manage Users",
    icon: <UserCog className="w-5 h-5" />,
  },
  {
    id: "sounds",
    label: "Sounds",
    icon: <Volume2 className="w-5 h-5" />,
  },
];

const NAV_OCIDS: Record<Page, string> = {
  billing: "nav.billing.link",
  "manage-menu": "nav.menu.link",
  "sales-report": "nav.sales.link",
  "customer-details": "nav.customers.link",
  settings: "nav.settings.link",
  "manage-users": "nav.users.link",
  sounds: "nav.sounds.link",
};

function SlideNav({
  isOpen,
  onClose,
  currentPage,
  onNavigate,
  allowedPages,
}: SlideNavProps) {
  const visibleItems = NAV_ITEMS.filter((item) =>
    allowedPages.includes(item.id),
  );
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70"
          onClick={onClose}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          role="presentation"
          aria-hidden="true"
        />
      )}
      {/* Panel */}
      <nav
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-card border-r border-border flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-bold text-lg text-primary">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 py-4 overflow-y-auto">
          {visibleItems.map((item) => (
            <button
              type="button"
              key={item.id}
              data-ocid={NAV_OCIDS[item.id]}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-lg ${
                currentPage === item.id
                  ? "bg-primary/20 text-primary font-semibold"
                  : "hover:bg-secondary text-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

// =============================================================================
// BARCODE SCANNER — rebuilt with QuaggaJS (CDN) + native BarcodeDetector
// Strategy:
//   1. Load QuaggaJS from CDN once (cached on window.__Quagga)
//   2. Use Quagga.init() which creates its own <video>+<canvas> inside a container
//   3. Native BarcodeDetector fallback polls the <video> that Quagga created
// This avoids all srcObject / readyState / portal-timing issues.
// =============================================================================

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Quagga: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __QuaggaLoading: Promise<any> | null;
    BarcodeDetector: new (options?: { formats: string[] }) => {
      detect: (
        source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
      ) => Promise<Array<{ rawValue: string }>>;
    };
  }
}

// Load QuaggaJS from CDN — resolves to window.Quagga
function loadQuagga(): Promise<void> {
  if (window.Quagga) return Promise.resolve();
  if (window.__QuaggaLoading) return window.__QuaggaLoading;
  window.__QuaggaLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js";
    s.async = true;
    s.onload = () => {
      window.__QuaggaLoading = null;
      resolve();
    };
    s.onerror = () => reject(new Error("Failed to load QuaggaJS"));
    document.head.appendChild(s);
  });
  return window.__QuaggaLoading!;
}

// ---------------------------------------------------------------------------
// Main scanner hook
// ---------------------------------------------------------------------------
function useBarcodeScanner({
  active,
  containerId,
  onDetected,
}: {
  active: boolean;
  containerId: string;
  onDetected: (code: string) => void;
}) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "scanning" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isActiveRef = useRef(false);
  const detectedRef = useRef(false);
  const quaggaRunning = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const stopScanner = useCallback(() => {
    isActiveRef.current = false;
    if (quaggaRunning.current && window.Quagga) {
      try {
        window.Quagga.offDetected();
        window.Quagga.stop();
      } catch {
        /**/
      }
      quaggaRunning.current = false;
    }
    detectedRef.current = false;
    setStatus("idle");
  }, []);

  const startScanner = useCallback(async () => {
    const container = document.getElementById(containerId);
    if (!container) return;

    isActiveRef.current = true;
    detectedRef.current = false;
    setErrorMsg(null);
    setStatus("loading");

    // ── Step 1: load QuaggaJS ──────────────────────────────────────────────
    try {
      await loadQuagga();
    } catch {
      if (!isActiveRef.current) return;
      setErrorMsg("Could not load scanner library. Check your connection.");
      setStatus("error");
      return;
    }
    if (!isActiveRef.current) return;

    const Quagga = window.Quagga;

    // ── Step 2: request camera permission explicitly first ─────────────────
    // This surfaces a user-friendly error before Quagga tries anything.
    let stream: MediaStream | null = null;
    try {
      // Try rear camera first (mobile), fallback to any camera (desktop)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      // Stop the test stream — Quagga will open its own
      for (const t of stream.getTracks()) t.stop();
      stream = null;
    } catch (err: unknown) {
      if (!isActiveRef.current) return;
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.toLowerCase().includes("permission") ||
        msg.toLowerCase().includes("denied") ||
        msg.toLowerCase().includes("notallowed")
      ) {
        setErrorMsg("Camera permission denied. Please allow camera access.");
      } else if (
        msg.toLowerCase().includes("notfound") ||
        msg.toLowerCase().includes("devicenotfound")
      ) {
        setErrorMsg("No camera detected on this device.");
      } else {
        setErrorMsg(`Camera access failed: ${msg}`);
      }
      setStatus("error");
      return;
    }
    if (!isActiveRef.current) return;

    // ── Step 3: init Quagga inside the container with auto-retry ──────────
    // Clear any leftover DOM from previous session
    container.innerHTML = "";

    const MAX_RETRIES = 3;
    let initSuccess = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (!isActiveRef.current) return;

      if (attempt > 1) {
        setErrorMsg(
          `Camera initialization failed. Retrying... (${attempt}/${MAX_RETRIES})`,
        );
        setStatus("loading");
        await new Promise((r) => setTimeout(r, 1000));
        if (!isActiveRef.current) return;
        // Clear container for fresh init
        container.innerHTML = "";
      }

      try {
        await new Promise<void>((resolve, reject) => {
          Quagga.init(
            {
              inputStream: {
                name: "Live",
                type: "LiveStream",
                target: container,
                constraints: {
                  facingMode: "environment",
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              },
              decoder: {
                readers: [
                  "ean_reader",
                  "ean_8_reader",
                  "upc_reader",
                  "upc_e_reader",
                  "code_128_reader",
                  "code_39_reader",
                  "code_93_reader",
                  "codabar_reader",
                  "i2of5_reader",
                ],
                debug: { showCanvas: false, showPatches: false },
              },
              locate: true,
              numOfWorkers: navigator.hardwareConcurrency
                ? Math.min(navigator.hardwareConcurrency, 4)
                : 2,
              frequency: 15, // ~15 decode attempts/s for faster detection
            },
            (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            },
          );
        });
        initSuccess = true;
        break; // success, exit retry loop
      } catch (initErr) {
        if (attempt === MAX_RETRIES) {
          if (!isActiveRef.current) return;
          const msg =
            initErr instanceof Error ? initErr.message : String(initErr);
          setErrorMsg(`Scanner could not start: ${msg}`);
          setStatus("error");
          isActiveRef.current = false;
          return;
        }
        // will retry in next loop iteration
      }
    }

    if (!initSuccess || !isActiveRef.current) return;

    Quagga.start();
    quaggaRunning.current = true;
    setStatus("scanning");

    // Force video playback — needed on iOS/Android
    const videoEl = container.querySelector("video");
    if (videoEl) {
      videoEl.setAttribute("playsinline", "true");
      videoEl.setAttribute("muted", "true");
      videoEl.setAttribute("autoplay", "true");
      videoEl.style.cssText =
        "width:100%;height:100%;object-fit:cover;display:block;";
      videoEl.play().catch(() => {
        /* ignore */
      });
    }
    const canvasEl = container.querySelector("canvas");
    if (canvasEl) {
      (canvasEl as HTMLCanvasElement).style.cssText = "display:none;";
    }

    // ── Step 4: listen for detections ─────────────────────────────────────
    Quagga.onDetected((data: { codeResult: { code: string } }) => {
      if (!isActiveRef.current || detectedRef.current) return;
      const code = data?.codeResult?.code;
      if (!code) return;
      detectedRef.current = true;
      stopScanner();
      onDetectedRef.current(code);
    });

    // Keep scanning loop alive — do nothing on missed frames
    Quagga.onProcessed(() => {
      /* intentionally empty — keeps detection loop running */
    });
  }, [containerId, stopScanner]);

  const resetDetection = useCallback(() => {
    detectedRef.current = false;
  }, []);

  // Start / stop based on `active`
  useEffect(() => {
    if (!active) {
      stopScanner();
      setErrorMsg(null);
      return;
    }

    // Wait for the dialog portal to fully mount the container div
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const tryStart = () => {
      if (cancelled) return;
      attempts++;
      const el = document.getElementById(containerId);
      if (el) {
        startScanner();
      } else if (attempts < 60) {
        timer = setTimeout(tryStart, 50);
      } else {
        setErrorMsg(
          "Scanner could not initialise. Please close and try again.",
        );
        setStatus("error");
      }
    };

    timer = setTimeout(tryStart, 80); // give Dialog portal time to render

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stopScanner();
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only re-runs on active change
  }, [active, containerId, startScanner, stopScanner]);

  return {
    status,
    errorMsg,
    setErrorMsg,
    startScanner,
    stopScanner,
    resetDetection,
  };
}

// ---------------------------------------------------------------------------
// Shared upload-image barcode reader (static image, no camera)
// ---------------------------------------------------------------------------
function ScannerUploadSection({
  onDetected,
  uploadProcessing,
  setUploadProcessing,
  uploadError,
  setUploadError,
  fileInputRef,
  ocidPrefix,
}: {
  onDetected: (code: string) => void;
  uploadProcessing: boolean;
  setUploadProcessing: (v: boolean) => void;
  uploadError: string | null;
  setUploadError: (v: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  ocidPrefix: string;
}) {
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadProcessing(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = (ev) => resolve(ev.target?.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const imgEl = document.createElement("img");
      imgEl.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        imgEl.onload = () => resolve();
        imgEl.onerror = () => reject(new Error("Failed to load image"));
      });

      // Try native BarcodeDetector
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const bitmap = await createImageBitmap(imgEl);
          const detector = new window.BarcodeDetector({
            formats: [
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
              "code_128",
              "code_39",
              "code_93",
              "qr_code",
              "data_matrix",
              "itf",
            ],
          });
          const results = await detector.detect(bitmap);
          if (results.length > 0) {
            onDetected(results[0].rawValue);
            return;
          }
        } catch {
          /**/
        }
      }

      // Quagga static decode fallback
      try {
        await loadQuagga();
        const Quagga = window.Quagga;
        await new Promise<void>((resolve, reject) => {
          Quagga.decodeSingle(
            {
              decoder: {
                readers: [
                  "ean_reader",
                  "ean_8_reader",
                  "upc_reader",
                  "upc_e_reader",
                  "code_128_reader",
                  "code_39_reader",
                ],
              },
              locate: true,
              src: dataUrl,
            },
            (result: { codeResult?: { code?: string } } | null) => {
              if (result?.codeResult?.code) {
                onDetected(result.codeResult.code);
                resolve();
              } else {
                reject(new Error("not found"));
              }
            },
          );
        });
      } catch {
        setUploadError("No barcode found in image. Try a clearer photo.");
      }
    } catch {
      setUploadError("Failed to read image file.");
    } finally {
      setUploadProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-muted-foreground font-medium">
        Or upload a barcode image:
      </p>
      <button
        type="button"
        data-ocid={`${ocidPrefix}.upload.dropzone`}
        className="w-full border border-dashed border-border rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-primary/60 transition-colors bg-transparent text-left"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">
            Upload barcode image
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WebP supported
          </p>
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
        data-ocid={`${ocidPrefix}.file.input`}
      />
      {uploadProcessing && (
        <div
          data-ocid={`${ocidPrefix}.upload.loading_state`}
          className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
        >
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Reading barcode…
        </div>
      )}
      {uploadError && (
        <div
          data-ocid={`${ocidPrefix}.upload.error_state`}
          className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2"
        >
          <X className="w-4 h-4 shrink-0" />
          {uploadError}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera viewfinder — Quagga renders video INSIDE the container div
// ---------------------------------------------------------------------------
function ScannerCameraView({
  containerId,
  status,
  errorMsg,
  onRetry,
  ocidPrefix,
}: {
  containerId: string;
  status: "idle" | "loading" | "scanning" | "error";
  errorMsg: string | null;
  onRetry: () => void;
  ocidPrefix: string;
}) {
  // Inject @keyframes scanline once into document head
  useEffect(() => {
    const styleId = "barcode-scanline-keyframes";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes scanline {
          0%   { top: 2px; }
          50%  { top: calc(100% - 4px); }
          100% { top: 2px; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div
      className="relative bg-black w-full"
      style={{ aspectRatio: "4/3", maxHeight: "60vh" }}
    >
      {/* Quagga injects its <video> and <canvas> here */}
      <div
        id={containerId}
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ background: "#000" }}
      />

      {/* Scanning overlay — only shown when actively scanning */}
      {status === "scanning" && (
        <>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-[min(240px,65%)] aspect-[7/4]">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-green-400 rounded-tl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-green-400 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-green-400 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-green-400 rounded-br" />
              {/* Animated scan line */}
              <div
                className="absolute left-1 right-1 h-0.5 bg-green-400 shadow-[0_0_6px_2px_#4ade80]"
                style={{
                  animation: "scanline 2s ease-in-out infinite",
                  top: 0,
                }}
              />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-2 pointer-events-none">
            <span className="text-xs text-green-400 font-medium tracking-wide animate-pulse">
              ● Scanning Barcode...
            </span>
          </div>
        </>
      )}

      {/* Loading state */}
      {status === "loading" && (
        <div
          data-ocid={`${ocidPrefix}.camera.loading_state`}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3 z-10"
        >
          <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-green-300 font-medium">Starting camera…</p>
          <p className="text-xs text-gray-400">Please allow camera access</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div
          data-ocid={`${ocidPrefix}.camera.error_state`}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-4 px-6 text-center z-10"
        >
          <X className="w-12 h-12 text-red-400" />
          <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
          <Button
            size="sm"
            variant="outline"
            className="border-green-600 text-green-400 hover:bg-green-900/30 mt-1"
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// BARCODE SCANNER FOR INPUT (scan barcode into a text field)
// =============================================================================
interface BarcodeScannerForInputProps {
  open: boolean;
  onClose: () => void;
  onResult: (barcode: string) => void;
  playSound?: (event: SoundEvent) => void;
}

function BarcodeScannerForInput({
  open,
  onClose,
  onResult,
  playSound,
}: BarcodeScannerForInputProps) {
  const CONTAINER_ID = "quagga-input-scanner";
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDetected = useCallback(
    (code: string) => {
      playSound?.("scan");
      onResult(code);
      toast.success(`Barcode scanned: ${code}`);
      onClose();
    },
    [onResult, onClose, playSound],
  );

  const { status, errorMsg, setErrorMsg, startScanner } = useBarcodeScanner({
    active: open,
    containerId: CONTAINER_ID,
    onDetected: handleDetected,
  });

  useEffect(() => {
    if (!open) setUploadError(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-ocid="barcode_input_scanner.dialog"
        className="bg-card border-border w-[95vw] max-w-md sm:max-w-lg p-0 overflow-hidden overflow-y-auto max-h-[90vh]"
      >
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Camera className="w-5 h-5" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <ScannerCameraView
          containerId={CONTAINER_ID}
          status={status}
          errorMsg={errorMsg}
          onRetry={() => {
            setErrorMsg(null);
            startScanner();
          }}
          ocidPrefix="barcode_input_scanner"
        />

        <div className="px-4 py-2 bg-card border-b border-border">
          <p className="text-xs text-muted-foreground">
            Point the rear camera at a barcode to scan automatically
          </p>
        </div>

        <ScannerUploadSection
          onDetected={handleDetected}
          uploadProcessing={uploadProcessing}
          setUploadProcessing={setUploadProcessing}
          uploadError={uploadError}
          setUploadError={setUploadError}
          fileInputRef={fileInputRef}
          ocidPrefix="barcode_input_scanner"
        />

        <div className="px-4 pb-4 pt-1">
          <Button
            data-ocid="barcode_input_scanner.back.button"
            variant="outline"
            className="w-full border-border gap-2 py-3 text-base"
            onClick={onClose}
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Add Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// BARCODE SCANNER MODAL (Billing page — adds item to cart)
// =============================================================================
interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  onAddToCart: (item: MenuItem) => void;
  playSound?: (event: SoundEvent) => void;
}

function BarcodeScannerModal({
  open,
  onClose,
  menuItems,
  onAddToCart,
  playSound,
}: BarcodeScannerModalProps) {
  const CONTAINER_ID = "quagga-billing-scanner";
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDetected = useCallback(
    (code: string) => {
      const item = menuItems.find(
        (m) => m.barcodeEnabled && m.barcode === code,
      );
      if (item) {
        playSound?.("scan");
        onAddToCart(item);
        toast.success(`Added: ${item.name}`);
        onClose();
      } else {
        playSound?.("itemNotFound");
        toast.error(`Item not found for barcode: ${code}`);
      }
    },
    [menuItems, onAddToCart, onClose, playSound],
  );

  const { status, errorMsg, setErrorMsg, startScanner } = useBarcodeScanner({
    active: open,
    containerId: CONTAINER_ID,
    onDetected: handleDetected,
  });

  useEffect(() => {
    if (!open) setUploadError(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-ocid="scanner.dialog"
        className="bg-card border-border w-[95vw] max-w-md sm:max-w-lg p-0 overflow-hidden overflow-y-auto max-h-[90vh]"
      >
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Camera className="w-5 h-5" />
            Barcode Scanner
          </DialogTitle>
        </DialogHeader>

        <ScannerCameraView
          containerId={CONTAINER_ID}
          status={status}
          errorMsg={errorMsg}
          onRetry={() => {
            setErrorMsg(null);
            startScanner();
          }}
          ocidPrefix="scanner"
        />

        <div className="px-4 py-2 bg-card border-b border-border">
          <p className="text-xs text-muted-foreground">
            Point the rear camera at a product barcode to add it to the cart
          </p>
        </div>

        <ScannerUploadSection
          onDetected={handleDetected}
          uploadProcessing={uploadProcessing}
          setUploadProcessing={setUploadProcessing}
          uploadError={uploadError}
          setUploadError={setUploadError}
          fileInputRef={fileInputRef}
          ocidPrefix="scanner"
        />

        <div className="px-4 pb-4 pt-1">
          <Button
            data-ocid="scanner.back.button"
            variant="outline"
            className="w-full border-border gap-2 py-3 text-base"
            onClick={onClose}
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Billing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// BILLING PAGE
// =============================================================================
interface BillingPageProps {
  menuItems: MenuItem[];
  settings: AppSettings;
  onOrderComplete: (order: Order) => Promise<void>;
  playSound?: (event: SoundEvent) => void;
}

function BillingPage({
  menuItems,
  settings,
  onOrderComplete,
  playSound,
}: BillingPageProps) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "qr" | "">("");
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [validationError, setValidationError] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [postPayment, setPostPayment] = useState(false);
  const [billQrDataUrl, setBillQrDataUrl] = useState<string>("");
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef<string>("");
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.mrp, 0);
  const total = Math.max(0, subtotal - discount);
  const balance = paymentMode === "cash" ? cashAmount - total : 0;

  // Search logic
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const q = search.toLowerCase();
    const results = menuItems.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.barcodeEnabled && m.barcode.includes(q)),
    );
    setSearchResults(results);
  }, [search, menuItems]);

  const addToCart = useCallback(
    (item: MenuItem) => {
      playSound?.("addToCart");
      setCart((prev) => {
        const existing = prev.find((c) => c.menuItemId === item.id);
        if (existing) {
          return prev.map((c) =>
            c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c,
          );
        }
        return [
          ...prev,
          {
            menuItemId: item.id,
            name: item.name,
            mrp: item.mrp,
            qty: 1,
            imageBase64: item.imageBase64,
          },
        ];
      });
      setSearch("");
      setSearchResults([]);
    },
    [playSound],
  );

  // Barcode scanner support
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = search.trim();
      if (!q) return;
      // Try exact barcode match first
      const barcodeMatch = menuItems.find(
        (m) => m.barcodeEnabled && m.barcode === q,
      );
      if (barcodeMatch) {
        addToCart(barcodeMatch);
        return;
      }
      // First name match
      const nameMatch = menuItems.find((m) =>
        m.name.toLowerCase().includes(q.toLowerCase()),
      );
      if (nameMatch) {
        addToCart(nameMatch);
      }
    }
  };

  // Fast barcode scanner detection (rapid keystrokes)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);

    // Track rapid input for barcode scanners
    if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
    barcodeBuffer.current = val;
    barcodeTimer.current = setTimeout(() => {
      barcodeBuffer.current = "";
    }, 500);
  };

  const updateQty = (menuItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) =>
          c.menuItemId === menuItemId ? { ...c, qty: c.qty + delta } : c,
        )
        .filter((c) => c.qty > 0);
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
  };

  const handlePayNow = async () => {
    if (!paymentMode) {
      setValidationError("Please select a Payment Mode");
      setShowValidation(true);
      return;
    }
    if (cart.length === 0) {
      setValidationError("Cart is empty. Please add items.");
      setShowValidation(true);
      return;
    }
    if (paymentMode === "cash" && cashAmount <= 0) {
      setValidationError("Please enter Cash Amount");
      setShowValidation(true);
      return;
    }

    const counter = loadLS<number>(LS_ORDER_COUNTER, DEFAULT_ORDER_COUNTER);
    const now = new Date();
    const order: Order = {
      id: Date.now().toString(),
      orderNo: counter,
      customerName: customerName.trim() || "Walk-in Customer",
      customerPhone: customerPhone.trim() || undefined,
      paymentMode: paymentMode as "cash" | "qr",
      cashAmount: paymentMode === "cash" ? cashAmount : 0,
      items: [...cart],
      discount,
      subtotal,
      total,
      timestamp: now.toISOString(),
      date: now.toISOString().split("T")[0],
    };

    // Generate UPI QR code
    if (settings.upiId) {
      try {
        const upiString = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.shopName)}&am=${order.total}&cu=INR`;
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const {
          default: QRCode,
        }: { default: typeof import("qrcode")["default"] } = await new Function(
          "u",
          "return import(u)",
        )("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js");
        const qrUrl = await QRCode.toDataURL(upiString, {
          width: 200,
          margin: 1,
        });
        setBillQrDataUrl(qrUrl);
      } catch {
        setBillQrDataUrl("");
      }
    }

    onOrderComplete(order);
    saveLS(LS_ORDER_COUNTER, counter + 1);
    setCompletedOrder(order);
    playSound?.("payment");
    setShowBillModal(true);
    setPostPayment(true);
  };

  const handleDoneOrder = () => {
    playSound?.("doneClose");
    setCart([]);
    setDiscount(0);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMode("");
    setCashAmount(0);
    setCompletedOrder(null);
    setPostPayment(false);
    setShowBillModal(false);
    setShowShareDialog(false);
    setBillQrDataUrl("");
    toast.success("Order completed! Screen reset.");
  };

  const handlePrintBill = () => {
    if (!completedOrder) return;
    const s = settings;
    const orderData = completedOrder;
    const balance2 =
      orderData.paymentMode === "cash"
        ? Math.max(0, orderData.cashAmount - orderData.total)
        : 0;
    const itemRows = orderData.items
      .map(
        (item) =>
          `<div style="display:grid;grid-template-columns:5fr 2fr 2fr 3fr;font-size:12px;margin-bottom:2px;">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</span>
            <span style="text-align:center;">${item.qty}</span>
            <span style="text-align:right;">&#8377;${item.mrp}</span>
            <span style="text-align:right;">&#8377;${item.qty * item.mrp}</span>
          </div>`,
      )
      .join("");

    const billHtml = `
      <div style="background:#fff;color:#000;font-family:'Courier New',Courier,monospace;font-size:13px;padding:0;line-height:1.5;width:100%;">
        ${s.billLogoBase64 ? `<div style="text-align:center;margin-bottom:10px;"><img src="${s.billLogoBase64}" style="height:64px;width:auto;object-fit:contain;" /></div>` : ""}
        <div style="text-align:center;margin-bottom:6px;">
          <p style="font-weight:bold;font-size:15px;margin:0;">${s.shopName}</p>
          ${s.contact ? `<p style="color:#555;font-size:11px;margin:2px 0;">${s.contact}</p>` : ""}
          ${s.address ? `<p style="color:#555;font-size:11px;margin:2px 0;">${s.address}</p>` : ""}
        </div>
        <hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
        <div style="font-size:11px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Order No:</span><span style="font-weight:bold;">#${orderData.orderNo}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Customer:</span><span style="font-weight:bold;">${orderData.customerName}</span></div>
          ${orderData.customerPhone ? `<div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Phone:</span><span>${orderData.customerPhone}</span></div>` : ""}
          <div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Date:</span><span>${new Date(orderData.timestamp).toLocaleDateString("en-IN")}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Time:</span><span>${new Date(orderData.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></div>
        </div>
        <hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
        <div style="display:grid;grid-template-columns:5fr 2fr 2fr 3fr;font-size:11px;font-weight:bold;color:#444;margin-bottom:3px;">
          <span>Item</span><span style="text-align:center;">Qty</span><span style="text-align:right;">MRP</span><span style="text-align:right;">Amt</span>
        </div>
        ${itemRows}
        <hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
        <div style="font-size:11px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Subtotal:</span><span>&#8377;${orderData.subtotal.toFixed(2)}</span></div>
          ${orderData.discount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Discount:</span><span>- &#8377;${orderData.discount.toFixed(2)}</span></div>` : ""}
          <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:2px;"><span>TOTAL:</span><span>&#8377;${orderData.total.toFixed(2)}</span></div>
        </div>
        <hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
        <div style="font-size:11px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Payment:</span><span>${orderData.paymentMode === "qr" ? "QR Code" : "Cash"}</span></div>
          ${orderData.paymentMode === "cash" && orderData.cashAmount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Cash Paid:</span><span>&#8377;${orderData.cashAmount.toFixed(2)}</span></div>` : ""}
          ${balance2 > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Balance:</span><span>&#8377;${balance2.toFixed(2)}</span></div>` : ""}
          ${s.gstinEnabled && s.gstin ? `<div style="display:flex;justify-content:space-between;"><span>GSTIN:</span><span>${s.gstin}</span></div>` : ""}
        </div>
        ${
          s.showQrOnBill && billQrDataUrl
            ? `<hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
        <div style="text-align:center;padding:6px 0;">
          <p style="font-size:10px;color:#555;margin:0 0 4px 0;">${s.qrNote || "Scan to Pay"}</p>
          <img src="${billQrDataUrl}" style="width:110px;height:110px;" />
          <p style="font-size:10px;color:#555;margin:4px 0 0 0;">${s.upiId}</p>
        </div>`
            : ""
        }
        <hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
        <div style="text-align:center;font-size:12px;">
          <p style="font-weight:bold;margin:3px 0;">Thank You!</p>
          <p style="margin:2px 0;font-size:11px;">Visit Again, Come Again!</p>
          <hr style="border:none;border-top:1px solid #ccc;margin:5px 0;" />
          <p style="font-weight:600;margin:2px 0;font-size:11px;">Powered By Medwin Techs Thanjavur</p>
          <p style="opacity:0.5;font-size:9px;margin:2px 0;">medwin2105@gmail.com</p>
        </div>
      </div>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:none;visibility:hidden;";
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: auto; margin: 8mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: 'Courier New', Courier, monospace; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  * { box-sizing: border-box; }
  .bill-wrap { max-width: 100%; width: fit-content; margin: 0 auto; }
</style>
</head>
<body><div class="bill-wrap">${billHtml}</div></body>
</html>`);
    iframeDoc.close();

    // Wait for images then print
    const images = iframeDoc.querySelectorAll("img");
    let loaded = 0;
    const total = images.length;
    const doPrint = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    };
    if (total === 0) {
      setTimeout(doPrint, 200);
    } else {
      for (const img of Array.from(images)) {
        if (img.complete) {
          loaded++;
          if (loaded >= total) setTimeout(doPrint, 200);
        } else {
          img.onload = img.onerror = () => {
            loaded++;
            if (loaded >= total) setTimeout(doPrint, 200);
          };
        }
      }
    }
  };

  const handleDownloadBill = async () => {
    if (!completedOrder) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const { toPng }: typeof import("html-to-image") = await new Function(
        "u",
        "return import(u)",
      )("https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/es/index.js");
      const orderData = completedOrder;
      const s = settings;
      const balance2 =
        orderData.paymentMode === "cash"
          ? Math.max(0, orderData.cashAmount - orderData.total)
          : 0;
      const itemRows = orderData.items
        .map(
          (item) =>
            `<div style="display:grid;grid-template-columns:5fr 2fr 2fr 3fr;font-size:12px;margin-bottom:2px;">
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</span>
              <span style="text-align:center;">${item.qty}</span>
              <span style="text-align:right;">&#8377;${item.mrp}</span>
              <span style="text-align:right;">&#8377;${item.qty * item.mrp}</span>
            </div>`,
        )
        .join("");

      const billInnerHtml = `
        <div style="background:#fff;color:#000;font-family:'Courier New',Courier,monospace;font-size:13px;padding:0;line-height:1.5;width:100%;">
          ${s.billLogoBase64 ? `<div style="text-align:center;margin-bottom:10px;"><img src="${s.billLogoBase64}" style="height:64px;width:auto;object-fit:contain;" /></div>` : ""}
          <div style="text-align:center;margin-bottom:6px;">
            <p style="font-weight:bold;font-size:15px;margin:0;">${s.shopName}</p>
            ${s.contact ? `<p style="color:#555;font-size:11px;margin:2px 0;">${s.contact}</p>` : ""}
            ${s.address ? `<p style="color:#555;font-size:11px;margin:2px 0;">${s.address}</p>` : ""}
          </div>
          <hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
          <div style="font-size:11px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Order No:</span><span style="font-weight:bold;">#${orderData.orderNo}</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Customer:</span><span style="font-weight:bold;">${orderData.customerName}</span></div>
            ${orderData.customerPhone ? `<div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Phone:</span><span>${orderData.customerPhone}</span></div>` : ""}
            <div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Date:</span><span>${new Date(orderData.timestamp).toLocaleDateString("en-IN")}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Time:</span><span>${new Date(orderData.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></div>
          </div>
          <hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
          <div style="display:grid;grid-template-columns:5fr 2fr 2fr 3fr;font-size:11px;font-weight:bold;color:#444;margin-bottom:3px;">
            <span>Item</span><span style="text-align:center;">Qty</span><span style="text-align:right;">MRP</span><span style="text-align:right;">Amt</span>
          </div>
          ${itemRows}
          <hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
          <div style="font-size:11px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Subtotal:</span><span>&#8377;${orderData.subtotal.toFixed(2)}</span></div>
            ${orderData.discount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Discount:</span><span>- &#8377;${orderData.discount.toFixed(2)}</span></div>` : ""}
            <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:2px;"><span>TOTAL:</span><span>&#8377;${orderData.total.toFixed(2)}</span></div>
          </div>
          <hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
          <div style="font-size:11px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Payment:</span><span>${orderData.paymentMode === "qr" ? "QR Code" : "Cash"}</span></div>
            ${orderData.paymentMode === "cash" && orderData.cashAmount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:1px;"><span>Cash Paid:</span><span>&#8377;${orderData.cashAmount.toFixed(2)}</span></div>` : ""}
            ${balance2 > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Balance:</span><span>&#8377;${balance2.toFixed(2)}</span></div>` : ""}
            ${s.gstinEnabled && s.gstin ? `<div style="display:flex;justify-content:space-between;"><span>GSTIN:</span><span>${s.gstin}</span></div>` : ""}
          </div>
          ${
            s.showQrOnBill && billQrDataUrl
              ? `<hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
          <div style="text-align:center;padding:6px 0;">
            <p style="font-size:10px;color:#555;margin:0 0 4px 0;">${s.qrNote || "Scan to Pay"}</p>
            <img src="${billQrDataUrl}" style="width:110px;height:110px;" />
            <p style="font-size:10px;color:#555;margin:4px 0 0 0;">${s.upiId}</p>
          </div>`
              : ""
          }
          <hr style="border:none;border-top:1px dashed #999;margin:6px 0;" />
          <div style="text-align:center;font-size:12px;">
            <p style="font-weight:bold;margin:3px 0;">Thank You!</p>
            <p style="margin:2px 0;font-size:11px;">Visit Again, Come Again!</p>
            <hr style="border:none;border-top:1px solid #ccc;margin:5px 0;" />
            <p style="font-weight:600;margin:2px 0;font-size:11px;">Powered By Medwin Techs Thanjavur</p>
            <p style="opacity:0.5;font-size:9px;margin:2px 0;">medwin2105@gmail.com</p>
          </div>
        </div>
      `;

      // Create container — use 360px width for a clean receipt look on all screen sizes
      const container = document.createElement("div");
      container.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        "width:360px",
        "background:#ffffff",
        "color:#000000",
        "font-family:'Courier New',Courier,monospace",
        "font-size:13px",
        "line-height:1.5",
        "z-index:-9999",
        "opacity:0",
        "pointer-events:none",
        "padding:12px",
      ].join(";");
      container.innerHTML = billInnerHtml;
      document.body.appendChild(container);

      // Wait for images to load inside container
      const imgs = container.querySelectorAll("img");
      if (imgs.length > 0) {
        await Promise.all(
          Array.from(imgs).map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) {
                  resolve();
                } else {
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                }
              }),
          ),
        );
      }
      // Extra settle time for fonts/rendering
      await new Promise((r) => setTimeout(r, 300));

      const dataUrl = await toPng(container, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width: 360,
        style: {
          padding: "12px",
        },
      });

      document.body.removeChild(container);

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `bill-${orderData.orderNo}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Bill downloaded!");
    } catch (err) {
      toast.error("Download failed. Try again.");
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* ADD ITEM SECTION */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h2 className="font-bold text-xl mb-3 text-primary">Add Item</h2>
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                ref={searchRef}
                data-ocid="billing.search_input"
                value={search}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by name or barcode"
                className="input-large bg-secondary border-border pl-10 text-base"
                autoComplete="off"
              />
            </div>
            <Button
              data-ocid="billing.camera_button"
              variant="outline"
              size="icon"
              className="w-14 h-14 border-border bg-secondary shrink-0"
              onClick={() => setShowCameraModal(true)}
              aria-label="Camera scan"
            >
              <Camera className="w-6 h-6" />
            </Button>
          </div>

          {/* Dropdown results */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 bg-popover border border-border rounded-xl shadow-xl mt-1 max-h-64 overflow-y-auto">
              {searchResults.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-left border-b border-border last:border-0"
                >
                  {item.imageBase64 ? (
                    <img
                      src={item.imageBase64}
                      alt={item.name}
                      className="w-10 h-10 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{item.name}</p>
                    {item.barcodeEnabled && (
                      <p className="text-xs text-muted-foreground">
                        {item.barcode}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-primary text-lg">
                    ₹{item.mrp}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CART SECTION */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-xl text-primary">Cart</h2>
          {cart.length > 0 && (
            <Button
              data-ocid="billing.clear_cart.button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setCart([]);
                setDiscount(0);
              }}
              className="text-sm"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear Cart
            </Button>
          )}
        </div>

        {cart.length === 0 ? (
          <div
            data-ocid="billing.cart.empty_state"
            className="text-center py-10 text-muted-foreground"
          >
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">Cart is empty</p>
            <p className="text-sm">Search and add items above</p>
          </div>
        ) : (
          <>
            {/* Mobile cart: cards */}
            <div className="space-y-2 md:hidden" data-ocid="billing.cart.table">
              {cart.map((item, idx) => (
                <div
                  key={item.menuItemId}
                  data-ocid={`billing.cart.item.${idx + 1}`}
                  className="bg-secondary rounded-lg p-3 flex items-center gap-3"
                >
                  {item.imageBase64 ? (
                    <img
                      src={item.imageBase64}
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ₹{item.mrp} × {item.qty} ={" "}
                      <span className="text-foreground font-bold">
                        ₹{item.qty * item.mrp}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 border-border"
                      onClick={() => updateQty(item.menuItemId, -1)}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-7 text-center font-bold">
                      {item.qty}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 border-border"
                      onClick={() => updateQty(item.menuItemId, 1)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-destructive hover:bg-destructive/10"
                      onClick={() => removeFromCart(item.menuItemId)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop cart: table */}
            <div
              className="hidden md:block overflow-x-auto"
              data-ocid="billing.cart.table"
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.menuItemId} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.imageBase64 ? (
                            <img
                              src={item.imageBase64}
                              alt={item.name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="w-7 h-7 border-border"
                            onClick={() => updateQty(item.menuItemId, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center font-bold">
                            {item.qty}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="w-7 h-7 border-border"
                            onClick={() => updateQty(item.menuItemId, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">₹{item.mrp}</TableCell>
                      <TableCell className="text-right font-bold">
                        ₹{item.qty * item.mrp}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-destructive"
                          onClick={() => removeFromCart(item.menuItemId)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Discount & Total */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-base whitespace-nowrap">
                  Discount (₹)
                </Label>
                <Input
                  data-ocid="billing.discount.input"
                  type="number"
                  min="0"
                  value={discount || ""}
                  onChange={(e) =>
                    setDiscount(Math.max(0, Number(e.target.value)))
                  }
                  placeholder="0"
                  className="max-w-[120px] bg-secondary border-border"
                />
              </div>
              <div className="flex justify-between items-center py-2 border-t border-border">
                <span className="text-lg font-semibold text-muted-foreground">
                  Total Amount
                </span>
                <span className="text-2xl font-bold text-primary">
                  {formatINR(total)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* CUSTOMER & PAYMENT SECTION */}
      {!postPayment ? (
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h2 className="font-bold text-xl text-primary">Customer & Payment</h2>

          <div>
            <Label htmlFor="customer-name" className="text-base mb-2 block">
              Customer Name{" "}
              <span className="text-muted-foreground text-sm">(optional)</span>
            </Label>
            <Input
              id="customer-name"
              data-ocid="billing.customer_name.input"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in Customer (optional)"
              className="input-large bg-secondary border-border"
            />
          </div>

          <div>
            <Label htmlFor="customer-phone" className="text-base mb-2 block">
              Customer Number{" "}
              <span className="text-muted-foreground text-sm">(optional)</span>
            </Label>
            <Input
              id="customer-phone"
              data-ocid="billing.customer_phone.input"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="input-large bg-secondary border-border"
            />
          </div>

          <div>
            <Label className="text-base mb-2 block">
              Payment Mode <span className="text-destructive">*</span>
            </Label>
            <Select
              value={paymentMode}
              onValueChange={(v) => setPaymentMode(v as "cash" | "qr")}
            >
              <SelectTrigger
                data-ocid="billing.payment_mode.select"
                className="input-large bg-secondary border-border"
              >
                <SelectValue placeholder="Select payment mode" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="qr">QR Code</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMode === "cash" && (
            <div>
              <Label htmlFor="cash-amount" className="text-base mb-2 block">
                Cash Amount (₹)
              </Label>
              <Input
                id="cash-amount"
                data-ocid="billing.cash_amount.input"
                type="number"
                min="0"
                value={cashAmount || ""}
                onChange={(e) => setCashAmount(Number(e.target.value))}
                placeholder="Enter cash amount"
                className="input-large bg-secondary border-border"
              />
              {balance > 0 && (
                <div className="balance-highlight mt-2">
                  BALANCE: {formatINR(balance)}
                </div>
              )}
            </div>
          )}

          <Button
            data-ocid="billing.pay_now.button"
            onClick={handlePayNow}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xl input-large"
            disabled={cart.length === 0}
          >
            Pay Now
          </Button>
        </div>
      ) : (
        /* POST PAYMENT ACTIONS */
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center gap-3 text-green-500">
            <CheckCircle className="w-8 h-8" />
            <div>
              <p className="font-bold text-xl">Payment Successful!</p>
              <p className="text-muted-foreground">
                Order #{completedOrder?.orderNo}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              data-ocid="billing.print_bill.button"
              onClick={handlePrintBill}
              variant="outline"
              className="border-border h-12 text-base"
            >
              <Printer className="w-5 h-5 mr-2" />
              Print Bill
            </Button>
            <Button
              data-ocid="billing.download_bill.button"
              onClick={handleDownloadBill}
              variant="outline"
              className="border-border h-12 text-base"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Bill
            </Button>
            <Button
              data-ocid="billing.share_bill.button"
              onClick={() => setShowShareDialog(true)}
              variant="outline"
              className="border-border h-12 text-base text-green-400 hover:text-green-300 hover:border-green-500"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share Bill
            </Button>
            <Button
              data-ocid="billing.back.button"
              onClick={() => {
                setShowBillModal(true);
              }}
              variant="outline"
              className="border-border h-12 text-base"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              View Bill
            </Button>
            <Button
              data-ocid="billing.done_order.button"
              onClick={handleDoneOrder}
              className="bg-green-600 hover:bg-green-700 text-white h-12 text-base font-bold col-span-2"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Done & Close
            </Button>
          </div>
        </div>
      )}

      {/* BILL MODAL (white background, black text for print-accurate preview) */}
      {completedOrder && (
        <Dialog open={showBillModal} onOpenChange={setShowBillModal}>
          <DialogContent
            data-ocid="billing.bill_modal.modal"
            className="bg-white border-gray-300 max-w-sm max-h-[90vh] overflow-y-auto p-0"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-300 px-4 py-3 flex items-center justify-between z-10">
              <span className="font-bold text-black text-base">
                Bill Preview
              </span>
              <Button
                data-ocid="billing.bill_modal.close_button"
                variant="ghost"
                size="icon"
                className="text-black hover:bg-gray-100"
                onClick={() => setShowBillModal(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Bill content — always white bg, black text */}
            <div className="p-4 bg-white">
              <BillContent
                order={completedOrder}
                settings={settings}
                darkMode={false}
                qrDataUrl={billQrDataUrl}
              />
            </div>

            {/* Action buttons at the bottom of the modal */}
            <div className="sticky bottom-0 bg-white border-t border-gray-300 p-3 grid grid-cols-2 gap-2">
              <Button
                data-ocid="billing.bill_modal.print_button"
                onClick={handlePrintBill}
                variant="outline"
                className="border-gray-400 text-black hover:bg-gray-100 font-semibold h-11"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Bill
              </Button>
              <Button
                data-ocid="billing.bill_modal.download_button"
                onClick={handleDownloadBill}
                variant="outline"
                className="border-gray-400 text-black hover:bg-gray-100 font-semibold h-11"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Bill
              </Button>
              <Button
                data-ocid="billing.bill_modal.share_button"
                onClick={() => setShowShareDialog(true)}
                variant="outline"
                className="border-green-500 text-green-700 hover:bg-green-50 font-semibold h-11"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Bill
              </Button>
              <Button
                data-ocid="billing.bill_modal.done_button"
                onClick={handleDoneOrder}
                className="bg-green-600 hover:bg-green-700 text-white font-bold h-11"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Done & Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Print area removed — printing is handled via iframe injection */}

      {/* BARCODE SCANNER MODAL */}
      <BarcodeScannerModal
        open={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        menuItems={menuItems}
        onAddToCart={addToCart}
        playSound={playSound}
      />

      {/* SHARE BILL DIALOG */}
      {completedOrder && (
        <ShareBillDialog
          open={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          order={completedOrder}
          settings={settings}
        />
      )}

      {/* VALIDATION DIALOG */}
      <AlertDialog open={showValidation} onOpenChange={setShowValidation}>
        <AlertDialogContent
          data-ocid="billing.validation.dialog"
          className="bg-card border-border"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Validation Error</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {validationError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              data-ocid="billing.validation.confirm_button"
              onClick={() => setShowValidation(false)}
              className="bg-primary text-primary-foreground"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// MANAGE MENU PAGE
// =============================================================================
interface ManageMenuPageProps {
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => Promise<void>;
  playSound?: (event: SoundEvent) => void;
}

function ManageMenuPage({
  menuItems,
  setMenuItems,
  playSound,
}: ManageMenuPageProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<MenuItem>>({
    name: "",
    mrp: 0,
    barcode: "",
    barcodeEnabled: true,
    imageBase64: "",
  });
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const openAdd = () => {
    setForm({
      name: "",
      mrp: 0,
      barcode: "",
      barcodeEnabled: true,
      imageBase64: "",
    });
    setImageMode("upload");
    setImageUrl("");
    setEditingItem(null);
    setShowAddDialog(true);
  };

  const openEdit = (item: MenuItem) => {
    setForm({ ...item });
    setEditingItem(item);
    setImageMode("upload");
    setImageUrl(item.imageBase64.startsWith("data:") ? "" : item.imageBase64);
    setShowAddDialog(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((prev) => ({
        ...prev,
        imageBase64: ev.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (!form.mrp || form.mrp <= 0) {
      toast.error("Valid MRP is required");
      return;
    }

    const imageToUse =
      imageMode === "url" && imageUrl ? imageUrl : form.imageBase64 || "";

    if (editingItem) {
      const updated = menuItems.map((m) =>
        m.id === editingItem.id
          ? { ...m, ...form, imageBase64: imageToUse, id: m.id }
          : m,
      );
      await setMenuItems(updated);
      toast.success("Item updated!");
    } else {
      const newItem: MenuItem = {
        id: Date.now().toString(),
        name: form.name!.trim(),
        mrp: Number(form.mrp),
        barcode: form.barcode || "",
        barcodeEnabled: form.barcodeEnabled ?? true,
        imageBase64: imageToUse,
      };
      await setMenuItems([...menuItems, newItem]);
      toast.success("Item added!");
    }
    setShowAddDialog(false);
  };

  const handleDelete = async (id: string) => {
    await setMenuItems(menuItems.filter((m) => m.id !== id));
    toast.success("Item deleted");
    setDeleteId(null);
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Menu</h1>
        <Button
          data-ocid="menu.add_item.button"
          onClick={openAdd}
          className="bg-primary text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      {menuItems.length === 0 ? (
        <div
          data-ocid="menu.empty_state"
          className="text-center py-16 text-muted-foreground"
        >
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg">No menu items yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuItems.map((item, idx) => (
            <div
              key={item.id}
              data-ocid={`menu.item.${idx + 1}`}
              className="bg-card rounded-xl border border-border p-4 flex gap-3"
            >
              {item.imageBase64 ? (
                <img
                  src={item.imageBase64}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded-lg shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Package className="w-7 h-7 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg truncate">{item.name}</p>
                <p className="text-primary font-semibold">₹{item.mrp}</p>
                {item.barcodeEnabled && item.barcode && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.barcode}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <Button
                    data-ocid={`menu.edit_button.${idx + 1}`}
                    size="sm"
                    onClick={() => openEdit(item)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    data-ocid={`menu.delete_button.${idx + 1}`}
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteId(item.id)}
                    className="text-sm"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Item" : "Add New Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-base mb-2 block">
                Item Name <span className="text-destructive">*</span>
              </Label>
              <Input
                data-ocid="menu.item_name.input"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Rice"
                className="input-large bg-secondary border-border"
              />
            </div>
            <div>
              <Label className="text-base mb-2 block">
                MRP (₹) <span className="text-destructive">*</span>
              </Label>
              <Input
                data-ocid="menu.mrp.input"
                type="number"
                min="0"
                value={form.mrp || ""}
                onChange={(e) =>
                  setForm({ ...form, mrp: Number(e.target.value) })
                }
                placeholder="e.g. 50"
                className="input-large bg-secondary border-border"
              />
            </div>
            <div>
              <Label className="text-base mb-2 block">Barcode</Label>
              <div className="flex gap-2">
                <Input
                  data-ocid="menu.barcode.input"
                  value={form.barcode || ""}
                  onChange={(e) =>
                    setForm({ ...form, barcode: e.target.value })
                  }
                  placeholder="Enter or scan barcode"
                  className="input-large bg-secondary border-border flex-1"
                />
                <Button
                  type="button"
                  data-ocid="menu.scan_barcode.button"
                  variant="outline"
                  size="icon"
                  className="w-14 h-14 border-border bg-secondary shrink-0"
                  onClick={() => setShowBarcodeScanner(true)}
                  aria-label="Scan barcode"
                  title="Scan barcode with camera"
                >
                  <Camera className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Type barcode or tap the camera icon to scan
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.barcodeEnabled ?? true}
                onCheckedChange={(v) => setForm({ ...form, barcodeEnabled: v })}
                id="barcode-enabled"
              />
              <Label
                htmlFor="barcode-enabled"
                className="text-base cursor-pointer"
              >
                Enable Barcode
              </Label>
            </div>

            {/* Image */}
            <div>
              <Label className="text-base mb-2 block">Item Image</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={imageMode === "upload" ? "default" : "outline"}
                  onClick={() => setImageMode("upload")}
                  className={
                    imageMode === "upload"
                      ? "bg-primary text-primary-foreground"
                      : "border-border"
                  }
                >
                  Upload File
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={imageMode === "url" ? "default" : "outline"}
                  onClick={() => setImageMode("url")}
                  className={
                    imageMode === "url"
                      ? "bg-primary text-primary-foreground"
                      : "border-border"
                  }
                >
                  Image URL
                </Button>
              </div>
              {imageMode === "upload" ? (
                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-foreground hover:file:bg-accent cursor-pointer"
                  data-ocid="menu.image.upload_button"
                />
              ) : (
                <Input
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setForm({ ...form, imageBase64: e.target.value });
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="bg-secondary border-border"
                />
              )}
              {(form.imageBase64 || imageUrl) && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={form.imageBase64 || imageUrl}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    data-ocid="menu.remove_image.button"
                    onClick={() => {
                      setForm({ ...form, imageBase64: "" });
                      setImageUrl("");
                      if (imageFileInputRef.current)
                        imageFileInputRef.current.value = "";
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remove Image
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              data-ocid="menu.save_item.button"
              onClick={handleSave}
              className="bg-primary text-primary-foreground"
            >
              {editingItem ? "Update Item" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner for barcode input field */}
      <BarcodeScannerForInput
        open={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onResult={(barcode) => setForm((prev) => ({ ...prev, barcode }))}
        playSound={playSound}
      />

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the item from the menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-border"
              onClick={() => setDeleteId(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// SALES REPORT PAGE
// =============================================================================
interface SalesReportPageProps {
  orders: Order[];
  setOrders: (orders: Order[]) => Promise<void>;
}

function SalesReportPage({ orders, setOrders }: SalesReportPageProps) {
  const [period, setPeriod] = useState<
    "daily" | "weekly" | "monthly" | "yearly"
  >("daily");
  const [sortBy, setSortBy] = useState("newest");
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const now = new Date();

  const filteredOrders = orders.filter((o) => {
    const d = new Date(o.timestamp);
    if (period === "daily") {
      return d.toDateString() === now.toDateString();
    }
    if (period === "weekly") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }
    if (period === "monthly") {
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }
    if (period === "yearly") {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortBy === "newest")
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (sortBy === "oldest")
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (sortBy === "high-amount") return b.total - a.total;
    if (sortBy === "low-amount") return a.total - b.total;
    return 0;
  });

  const totalSales = filteredOrders.reduce((s, o) => s + o.total, 0);
  const uniqueCustomers = new Set(
    filteredOrders.map((o) => o.customerName.toLowerCase()),
  ).size;
  const highestSale = filteredOrders.reduce(
    (max, o) => (o.total > max ? o.total : max),
    0,
  );

  // Highest selling item
  const itemCount: Record<string, number> = {};
  for (const o of filteredOrders) {
    for (const i of o.items) {
      itemCount[i.name] = (itemCount[i.name] || 0) + i.qty;
    }
  }
  const highestItem = Object.entries(itemCount).sort((a, b) => b[1] - a[1])[0];

  // Peak time (by hour)
  const hourCount: Record<number, number> = {};
  for (const o of filteredOrders) {
    const h = new Date(o.timestamp).getHours();
    hourCount[h] = (hourCount[h] || 0) + 1;
  }
  const peakHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];
  const peakTime = peakHour
    ? `${Number(peakHour[0]) % 12 || 12}:00 ${Number(peakHour[0]) >= 12 ? "PM" : "AM"}`
    : "N/A";

  const handleDownloadExcel = () => {
    const rows: string[] = [];
    rows.push(
      `Total Sales: ₹${totalSales.toFixed(2)},Total Customers: ${uniqueCustomers}`,
    );
    rows.push("Order No,Customer,Items,Total,Date,Time");
    for (const o of sortedOrders) {
      const items = o.items.map((i) => `${i.name} x${i.qty}`).join("; ");
      rows.push(
        `${o.orderNo},"${o.customerName}","${items}",${o.total.toFixed(2)},${o.date},${formatTime(o.timestamp)}`,
      );
    }
    downloadCSV("sales-report.csv", rows.join("\n"));
  };

  const handleRestartOrders = () => {
    saveLS(LS_ORDER_COUNTER, 1001);
    toast.success("Order counter restarted from #1001");
    setConfirmRestart(false);
  };

  const handleClearAll = async () => {
    await setOrders([]);
    toast.success("All reports cleared");
    setConfirmClear(false);
  };

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-2xl font-bold">Sales Report</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-sm">Total Sales</p>
          <p className="text-2xl font-bold text-primary">
            {formatINR(totalSales)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-sm">Total Orders</p>
          <p className="text-2xl font-bold">{filteredOrders.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-sm">Customers</p>
          <p className="text-2xl font-bold">{uniqueCustomers}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-sm">Highest Sale</p>
          <p className="text-2xl font-bold text-green-500">
            {formatINR(highestSale)}
          </p>
        </div>
      </div>

      {/* Period Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
        <TabsList className="w-full bg-secondary grid grid-cols-4">
          <TabsTrigger data-ocid="sales.daily.tab" value="daily">
            Daily
          </TabsTrigger>
          <TabsTrigger data-ocid="sales.weekly.tab" value="weekly">
            Weekly
          </TabsTrigger>
          <TabsTrigger data-ocid="sales.monthly.tab" value="monthly">
            Monthly
          </TabsTrigger>
          <TabsTrigger data-ocid="sales.yearly.tab" value="yearly">
            Yearly
          </TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="mt-4 space-y-3">
          {/* Sort & Filter */}
          <div className="flex gap-2 items-center">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger
                data-ocid="sales.sort.select"
                className="flex-1 bg-secondary border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="newest">Newest to Oldest</SelectItem>
                <SelectItem value="oldest">Oldest to Newest</SelectItem>
                <SelectItem value="high-amount">High Sale Amount</SelectItem>
                <SelectItem value="low-amount">Low Sale Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orders Table */}
          {sortedOrders.length === 0 ? (
            <div
              data-ocid="sales.orders.empty_state"
              className="text-center py-12 text-muted-foreground"
            >
              <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No orders in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table data-ocid="sales.orders.table">
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Order#</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOrders.map((o) => (
                    <TableRow key={o.id} className="border-border">
                      <TableCell className="font-mono">#{o.orderNo}</TableCell>
                      <TableCell>{o.customerName}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">
                        {o.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatINR(o.total)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(o.timestamp)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatTime(o.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary */}
          {sortedOrders.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Live Total Sales:</span>
                <span className="font-bold text-xl text-primary">
                  {formatINR(totalSales)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Top Selling Item:</span>
                <span>
                  {highestItem
                    ? `${highestItem[0]} (${highestItem[1]} units)`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Peak Time:</span>
                <span>{peakTime}</span>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button
          data-ocid="sales.download_excel.button"
          onClick={handleDownloadExcel}
          variant="outline"
          className="border-border h-12"
        >
          <Download className="w-4 h-4 mr-2" />
          Download CSV
        </Button>
        <Button
          data-ocid="sales.restart_orders.button"
          onClick={() => setConfirmRestart(true)}
          variant="outline"
          className="border-border h-12"
        >
          Restart Order #
        </Button>
        <Button
          data-ocid="sales.clear_reports.button"
          variant="destructive"
          onClick={() => setConfirmClear(true)}
          className="h-12"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All Reports
        </Button>
      </div>

      {/* Restart Confirm */}
      <AlertDialog open={confirmRestart} onOpenChange={setConfirmRestart}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Restart Order Numbers?</AlertDialogTitle>
            <AlertDialogDescription>
              Order counter will restart from #1001.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestartOrders}
              className="bg-primary text-primary-foreground"
            >
              Restart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Confirm */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Reports?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all order history. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// CUSTOMER DETAILS PAGE
// =============================================================================
interface CustomerDetailsPageProps {
  orders: Order[];
}

function CustomerDetailsPage({ orders }: CustomerDetailsPageProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // Aggregate by customer
  const customerMap: Record<
    string,
    {
      name: string;
      items: string[];
      totalQty: number;
      totalAmount: number;
      lastDate: string;
    }
  > = {};

  for (const o of orders) {
    const key = o.customerName.toLowerCase().trim();
    if (!customerMap[key]) {
      customerMap[key] = {
        name: o.customerName,
        items: [],
        totalQty: 0,
        totalAmount: 0,
        lastDate: o.timestamp,
      };
    }
    for (const i of o.items) {
      customerMap[key].items.push(`${i.name} x${i.qty}`);
      customerMap[key].totalQty += i.qty;
    }
    customerMap[key].totalAmount += o.total;
    if (new Date(o.timestamp) > new Date(customerMap[key].lastDate)) {
      customerMap[key].lastDate = o.timestamp;
    }
  }

  let customers = Object.values(customerMap);

  if (search.trim()) {
    customers = customers.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()),
    );
  }

  customers.sort((a, b) => {
    if (sortBy === "newest")
      return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
    if (sortBy === "oldest")
      return new Date(a.lastDate).getTime() - new Date(b.lastDate).getTime();
    if (sortBy === "high-amount") return b.totalAmount - a.totalAmount;
    if (sortBy === "low-amount") return a.totalAmount - b.totalAmount;
    return 0;
  });

  const handleDownloadExcel = () => {
    const rows = [
      "Customer Name,Items Purchased,Total Qty,Total Amount,Last Visit",
      ...customers.map(
        (c) =>
          `"${c.name}","${[...new Set(c.items)].join("; ")}",${c.totalQty},${c.totalAmount.toFixed(2)},${formatDate(c.lastDate)}`,
      ),
    ];
    downloadCSV("customer-details.csv", rows.join("\n"));
  };

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-2xl font-bold">Customer Details</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            data-ocid="customers.search_input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name"
            className="bg-secondary border-border pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger
            data-ocid="customers.sort.select"
            className="w-full sm:w-48 bg-secondary border-border"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="high-amount">High Amount</SelectItem>
            <SelectItem value="low-amount">Low Amount</SelectItem>
          </SelectContent>
        </Select>
        <Button
          data-ocid="customers.download_excel.button"
          onClick={handleDownloadExcel}
          variant="outline"
          className="border-border whitespace-nowrap"
        >
          <Download className="w-4 h-4 mr-2" />
          Download CSV
        </Button>
      </div>

      {customers.length === 0 ? (
        <div
          data-ocid="customers.empty_state"
          className="text-center py-12 text-muted-foreground"
        >
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No customer data yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table data-ocid="customers.table">
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Customer Name</TableHead>
                <TableHead>Items Purchased</TableHead>
                <TableHead className="text-center">Total Qty</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Last Visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.name} className="border-border">
                  <TableCell className="font-semibold">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {[...new Set(c.items)].slice(0, 3).join(", ")}
                    {c.items.length > 3 ? "..." : ""}
                  </TableCell>
                  <TableCell className="text-center">{c.totalQty}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {formatINR(c.totalAmount)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(c.lastDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SOUNDS CARD (reused in both SettingsPage and SoundsPage)
// =============================================================================
interface SoundsCardProps {
  soundForm: SoundSettings;
  updateSound: (updates: Partial<SoundSettings>) => void;
  playSound: (event: SoundEvent) => void;
}

const SOUND_EVENTS: {
  key: SoundEvent;
  label: string;
  description: string;
}[] = [
  {
    key: "scan",
    label: "Barcode Scan",
    description: "Beep when barcode is detected",
  },
  { key: "login", label: "Login", description: "Sound when logging in" },
  { key: "logout", label: "Logout", description: "Sound when logging out" },
  {
    key: "payment",
    label: "Payment",
    description: "Sound when payment is completed",
  },
  {
    key: "doneClose",
    label: "Done & Close",
    description: "Sound when order is closed",
  },
  {
    key: "addToCart",
    label: "Add to Cart",
    description: "Sound when item added to cart",
  },
  {
    key: "error",
    label: "Error",
    description: "Sound for validation errors",
  },
  {
    key: "itemNotFound",
    label: "Item Not Found",
    description: "Sound when barcode item is not found",
  },
];

function SoundsCard({ soundForm, updateSound, playSound }: SoundsCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Volume2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-primary">Sounds</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Sounds save automatically — no need to click Save Settings.
      </p>

      <Separator className="bg-border" />

      {/* Master enable */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-base">Enable All Sounds</p>
          <p className="text-sm text-muted-foreground">
            Master switch for all app sounds
          </p>
        </div>
        <Switch
          data-ocid="settings.sounds.toggle"
          checked={soundForm.enabled}
          onCheckedChange={(v) => updateSound({ enabled: v })}
        />
      </div>

      {/* Volume */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="font-semibold text-base">
            Volume: {soundForm.volume}%
          </Label>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={soundForm.volume}
          data-ocid="settings.sounds.volume.input"
          onChange={(e) => updateSound({ volume: Number(e.target.value) })}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary bg-secondary"
          disabled={!soundForm.enabled}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* Sound events table */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Sound Events
        </p>
        {SOUND_EVENTS.map((ev) => (
          <div
            key={ev.key}
            className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{ev.label}</p>
              <p className="text-xs text-muted-foreground">{ev.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-border text-xs h-8 px-3"
                disabled={!soundForm.enabled || !soundForm[ev.key]}
                onClick={() => playSound(ev.key)}
              >
                Test
              </Button>
              <Switch
                checked={soundForm[ev.key]}
                onCheckedChange={(v) => updateSound({ [ev.key]: v })}
                disabled={!soundForm.enabled}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// SOUNDS PAGE (standalone page)
// =============================================================================
interface SoundsPageProps {
  soundSettings: React.MutableRefObject<SoundSettings>;
  updateSoundSettings: (s: SoundSettings) => void;
  playSound: (event: SoundEvent) => void;
}

function SoundsPage({
  soundSettings,
  updateSoundSettings,
  playSound,
}: SoundsPageProps) {
  const [soundForm, setSoundForm] = useState<SoundSettings>(
    () => soundSettings.current,
  );

  const updateSound = (updates: Partial<SoundSettings>) => {
    const next = { ...soundForm, ...updates };
    setSoundForm(next);
    updateSoundSettings(next);
  };

  return (
    <div className="space-y-4 pb-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Sounds</h1>
      <SoundsCard
        soundForm={soundForm}
        updateSound={updateSound}
        playSound={playSound}
      />
    </div>
  );
}

// =============================================================================
// SETTINGS PAGE
// =============================================================================
interface SettingsPageProps {
  settings: AppSettings;
  setSettings: (s: AppSettings) => Promise<void>;
  soundSettings: React.MutableRefObject<SoundSettings>;
  updateSoundSettings: (s: SoundSettings) => void;
  playSound: (event: SoundEvent) => void;
}

function SettingsPage({
  settings,
  setSettings,
  soundSettings,
  updateSoundSettings,
  playSound,
}: SettingsPageProps) {
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [isDirty, setIsDirty] = useState(false);
  const [confirmRestartOrder, setConfirmRestartOrder] = useState(false);
  const billLogoFileInputRef = useRef<HTMLInputElement>(null);
  const websiteLogoFileInputRef = useRef<HTMLInputElement>(null);

  // Sounds local form state (loaded from soundSettings ref)
  const [soundForm, setSoundForm] = useState<SoundSettings>(
    () => soundSettings.current,
  );

  const updateSound = (updates: Partial<SoundSettings>) => {
    const next = { ...soundForm, ...updates };
    setSoundForm(next);
    updateSoundSettings(next);
  };

  // Sync form when settings change from backend polling, but ONLY if the user has not made unsaved edits
  useEffect(() => {
    if (!isDirty) {
      setForm({ ...settings });
    }
  }, [settings, isDirty]);

  const handleBillLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setIsDirty(true);
      setForm((prev) => ({
        ...prev,
        billLogoBase64: ev.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleWebsiteLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setIsDirty(true);
      setForm((prev) => ({
        ...prev,
        websiteLogoBase64: ev.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    await setSettings(form);
    document.title = form.websiteName;
    setIsDirty(false);
    toast.success("Settings saved!");
  };

  return (
    <div className="space-y-6 pb-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="bg-card rounded-xl border border-border p-5 space-y-5">
        {/* 1. Website Name */}
        <div>
          <Label className="text-base mb-2 block font-semibold">
            Website Name
          </Label>
          <Input
            data-ocid="settings.website_name.input"
            value={form.websiteName}
            onChange={(e) => {
              setIsDirty(true);
              setForm({ ...form, websiteName: e.target.value });
            }}
            className="input-large bg-secondary border-border"
          />
        </div>

        <Separator className="bg-border" />

        {/* 2. Bill Logo */}
        <div>
          <Label className="text-base mb-2 block font-semibold">
            Bill Logo
          </Label>
          {form.billLogoBase64 && (
            <img
              src={form.billLogoBase64}
              alt="Bill Logo"
              className="h-16 w-auto object-contain mb-2 rounded border border-border"
            />
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={billLogoFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleBillLogoUpload}
              data-ocid="settings.bill_logo.upload_button"
              className="block flex-1 text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-foreground hover:file:bg-accent cursor-pointer"
            />
            {form.billLogoBase64 && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                data-ocid="settings.bill_logo.remove_button"
                onClick={() => {
                  setIsDirty(true);
                  setForm((prev) => ({ ...prev, billLogoBase64: "" }));
                  if (billLogoFileInputRef.current)
                    billLogoFileInputRef.current.value = "";
                }}
                className="shrink-0"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </div>

        <Separator className="bg-border" />

        {/* 3. Website Logo */}
        <div>
          <Label className="text-base mb-2 block font-semibold">
            Website Logo
          </Label>
          {form.websiteLogoBase64 && (
            <img
              src={form.websiteLogoBase64}
              alt="Website Logo"
              className="h-16 w-auto object-contain mb-2 rounded border border-border"
            />
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={websiteLogoFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleWebsiteLogoUpload}
              data-ocid="settings.website_logo.upload_button"
              className="block flex-1 text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-foreground hover:file:bg-accent cursor-pointer"
            />
            {form.websiteLogoBase64 && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                data-ocid="settings.website_logo.remove_button"
                onClick={() => {
                  setIsDirty(true);
                  setForm((prev) => ({ ...prev, websiteLogoBase64: "" }));
                  if (websiteLogoFileInputRef.current)
                    websiteLogoFileInputRef.current.value = "";
                }}
                className="shrink-0"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </div>

        <Separator className="bg-border" />

        {/* 4. Shop Name */}
        <div>
          <Label className="text-base mb-2 block font-semibold">
            Shop Name
          </Label>
          <Input
            data-ocid="settings.shop_name.input"
            value={form.shopName}
            onChange={(e) => {
              setIsDirty(true);
              setForm({ ...form, shopName: e.target.value });
            }}
            className="input-large bg-secondary border-border"
          />
        </div>

        {/* 5. Contact */}
        <div>
          <Label className="text-base mb-2 block font-semibold">Contact</Label>
          <Input
            data-ocid="settings.contact.input"
            value={form.contact}
            onChange={(e) => {
              setIsDirty(true);
              setForm({ ...form, contact: e.target.value });
            }}
            className="input-large bg-secondary border-border"
          />
        </div>

        {/* 6. Address */}
        <div>
          <Label className="text-base mb-2 block font-semibold">Address</Label>
          <Textarea
            data-ocid="settings.address.textarea"
            value={form.address}
            onChange={(e) => {
              setIsDirty(true);
              setForm({ ...form, address: e.target.value });
            }}
            rows={3}
            className="bg-secondary border-border resize-none"
          />
        </div>

        <Separator className="bg-border" />

        {/* 7. UPI ID */}
        <div>
          <Label className="text-base mb-2 block font-semibold">UPI ID</Label>
          <Input
            data-ocid="settings.upi_id.input"
            value={form.upiId}
            onChange={(e) => {
              setIsDirty(true);
              setForm({ ...form, upiId: e.target.value });
            }}
            className="input-large bg-secondary border-border"
            placeholder="shop@upi"
          />
        </div>

        {/* 8. QR Code Note */}
        <div>
          <Label className="text-base mb-2 block font-semibold">
            QR Code Note
          </Label>
          <Input
            data-ocid="settings.qr_note.input"
            value={form.qrNote}
            onChange={(e) => {
              setIsDirty(true);
              setForm({ ...form, qrNote: e.target.value });
            }}
            className="input-large bg-secondary border-border"
          />
        </div>

        {/* Show QR on Bill toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-base">Show QR Code on Bill</p>
            <p className="text-sm text-muted-foreground">
              Display UPI payment QR on printed/downloaded bills
            </p>
          </div>
          <Switch
            data-ocid="settings.show_qr_on_bill.toggle"
            checked={form.showQrOnBill ?? true}
            onCheckedChange={(v) => {
              setIsDirty(true);
              setForm({ ...form, showQrOnBill: v });
            }}
          />
        </div>

        <Separator className="bg-border" />

        {/* 9. Show Tax */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-base">Show Tax on Bill</p>
            <p className="text-sm text-muted-foreground">
              Display tax information on bills
            </p>
          </div>
          <Switch
            data-ocid="settings.show_tax.toggle"
            checked={form.showTax}
            onCheckedChange={(v) => {
              setIsDirty(true);
              setForm({ ...form, showTax: v });
            }}
          />
        </div>

        {/* 10. GSTIN */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-base">Show GSTIN</p>
            <p className="text-sm text-muted-foreground">
              Display GSTIN number on bills
            </p>
          </div>
          <Switch
            data-ocid="settings.gstin_enabled.toggle"
            checked={form.gstinEnabled}
            onCheckedChange={(v) => {
              setIsDirty(true);
              setForm({ ...form, gstinEnabled: v });
            }}
          />
        </div>
        {form.gstinEnabled && (
          <div>
            <Label className="text-base mb-2 block font-semibold">
              GSTIN Number
            </Label>
            <Input
              data-ocid="settings.gstin.input"
              value={form.gstin}
              onChange={(e) => {
                setIsDirty(true);
                setForm({ ...form, gstin: e.target.value });
              }}
              className="input-large bg-secondary border-border"
              placeholder="e.g. 22AAAAA0000A1Z5"
            />
          </div>
        )}

        <Separator className="bg-border" />

        {/* 11. Restart Order Number */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-base">Restart Order Number</p>
            <p className="text-sm text-muted-foreground">
              Reset order counter to start from #1001
            </p>
          </div>
          <Button
            data-ocid="settings.restart_order.button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmRestartOrder(true)}
            className="border-border"
          >
            Restart
          </Button>
        </div>
      </div>

      <Button
        data-ocid="settings.save.button"
        onClick={handleSave}
        className="w-full bg-primary text-primary-foreground font-bold text-lg input-large"
      >
        Save Settings
      </Button>

      {/* SOUNDS SECTION */}
      <SoundsCard
        soundForm={soundForm}
        updateSound={updateSound}
        playSound={playSound}
      />

      {/* Restart Order Confirm */}
      <AlertDialog
        open={confirmRestartOrder}
        onOpenChange={setConfirmRestartOrder}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Restart Order Number?</AlertDialogTitle>
            <AlertDialogDescription>
              The order counter will be reset to #1001.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                saveLS(LS_ORDER_COUNTER, 1001);
                setConfirmRestartOrder(false);
                toast.success("Order counter restarted from #1001");
              }}
              className="bg-primary text-primary-foreground"
            >
              Restart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// MANAGE USERS PAGE
// =============================================================================
interface ManageUsersPageProps {
  users: User[];
  setUsers: (users: User[]) => Promise<void>;
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-blue-600 text-white",
  manager: "bg-amber-600 text-white",
  cashier: "bg-green-600 text-white",
  accountant: "bg-purple-600 text-white",
};

function ManageUsersPage({ users, setUsers }: ManageUsersPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    username: string;
    password: string;
    role: UserRole;
  }>({ username: "", password: "", role: "cashier" });

  const openAdd = () => {
    setForm({ username: "", password: "", role: "cashier" });
    setEditingUser(null);
    setShowDialog(true);
  };

  const openEdit = (user: User) => {
    setForm({
      username: user.username,
      password: user.password,
      role: user.role || "cashier",
    });
    setEditingUser(user);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!form.password.trim()) {
      toast.error("Password is required");
      return;
    }

    if (editingUser) {
      await setUsers(
        users.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                username: form.username.trim(),
                password: form.password,
                role: form.role,
              }
            : u,
        ),
      );
      toast.success("User updated!");
    } else {
      // Check duplicate
      if (users.some((u) => u.username === form.username.trim())) {
        toast.error("Username already exists");
        return;
      }
      await setUsers([
        ...users,
        {
          id: Date.now().toString(),
          username: form.username.trim(),
          password: form.password,
          role: form.role,
        },
      ]);
      toast.success("User added!");
    }
    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (users.length <= 1) {
      toast.error("Cannot delete the last user");
      setDeleteId(null);
      return;
    }
    await setUsers(users.filter((u) => u.id !== id));
    toast.success("User deleted");
    setDeleteId(null);
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <Button
          data-ocid="users.add_user.button"
          onClick={openAdd}
          className="bg-primary text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table data-ocid="users.table">
          <TableHeader>
            <TableRow className="border-border">
              <TableHead>#</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user, idx) => (
              <TableRow key={user.id} className="border-border">
                <TableCell className="text-muted-foreground">
                  {idx + 1}
                </TableCell>
                <TableCell className="font-semibold">{user.username}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${ROLE_COLORS[user.role || "cashier"]}`}
                  >
                    {user.role || "cashier"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      data-ocid={`users.edit_button.${idx + 1}`}
                      size="sm"
                      onClick={() => openEdit(user)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      data-ocid={`users.delete_button.${idx + 1}`}
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteId(user.id)}
                      className="text-sm"
                      disabled={users.length <= 1}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Add New User"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-base mb-2 block">Username</Label>
              <Input
                data-ocid="users.username.input"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Enter username"
                className="input-large bg-secondary border-border"
              />
            </div>
            <div>
              <Label className="text-base mb-2 block">Password</Label>
              <Input
                data-ocid="users.password.input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
                className="input-large bg-secondary border-border"
              />
            </div>
            <div>
              <Label className="text-base mb-2 block">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as UserRole })}
              >
                <SelectTrigger
                  data-ocid="users.role.select"
                  className="input-large bg-secondary border-border"
                >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="admin">Admin (Full Access)</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                <p>
                  <span className="font-semibold">Admin:</span> All pages (full
                  CRUD)
                </p>
                <p>
                  <span className="font-semibold">Manager:</span> Billing, Menu,
                  Reports, Customers
                </p>
                <p>
                  <span className="font-semibold">Cashier:</span> Billing only
                </p>
                <p>
                  <span className="font-semibold">Accountant:</span> Billing,
                  Reports, Customers
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              data-ocid="users.save_user.button"
              onClick={handleSave}
              className="bg-primary text-primary-foreground"
            >
              {editingUser ? "Update User" : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this user account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// HELPERS: backend <-> local type conversion
// =============================================================================
type BackendOrder = import("./backend").Order;
type BackendMenuItem = import("./backend").MenuItem;
type BackendCartItem = import("./backend").CartItem;
type BackendUser = import("./backend").User;
type BackendSettings = import("./backend").AppSettings;

function toLocalOrder(o: BackendOrder): Order {
  return {
    id: o.id,
    orderNo: Number(o.orderNo),
    customerName: o.customerName,
    customerPhone: o.customerPhone || undefined,
    paymentMode: (o.paymentMode as "cash" | "qr") || "cash",
    cashAmount: o.cashAmount,
    items: o.items.map((i: BackendCartItem) => ({
      menuItemId: i.menuItemId,
      name: i.name,
      mrp: i.mrp,
      qty: Number(i.qty),
      imageBase64: i.imageBase64,
    })),
    discount: o.discount,
    subtotal: o.subtotal,
    total: o.total,
    timestamp: o.timestamp,
    date: o.date,
  };
}

function toBackendOrder(o: Order): BackendOrder {
  return {
    id: o.id,
    orderNo: BigInt(o.orderNo),
    customerName: o.customerName,
    customerPhone: o.customerPhone || "",
    paymentMode: o.paymentMode,
    cashAmount: o.cashAmount,
    items: o.items.map((i) => ({
      menuItemId: i.menuItemId,
      name: i.name,
      mrp: i.mrp,
      qty: BigInt(i.qty),
      imageBase64: i.imageBase64,
    })),
    discount: o.discount,
    subtotal: o.subtotal,
    total: o.total,
    timestamp: o.timestamp,
    date: o.date,
  };
}

function toLocalMenuItem(m: BackendMenuItem): MenuItem {
  return {
    id: m.id,
    name: m.name,
    mrp: m.mrp,
    barcode: m.barcode,
    barcodeEnabled: m.barcodeEnabled,
    imageBase64: m.imageBase64,
  };
}

function toLocalUser(u: BackendUser): User {
  return {
    id: u.id,
    username: u.username,
    password: u.password,
    role: (u.role as UserRole) || "cashier",
  };
}

function toLocalSettings(s: BackendSettings): AppSettings {
  return {
    websiteName: s.websiteName,
    shopName: s.shopName,
    contact: s.contact,
    address: s.address,
    upiId: s.upiId,
    qrNote: s.qrNote,
    showTax: s.showTax,
    gstin: s.gstin,
    gstinEnabled: s.gstinEnabled,
    billLogoBase64: s.billLogoBase64,
    websiteLogoBase64: s.websiteLogoBase64,
    showQrOnBill: s.showQrOnBill,
  };
}

// =============================================================================
// MAIN APP
// =============================================================================
export default function App() {
  const { actor, isFetching: actorFetching } = useActor();
  const { playSound, soundSettings, updateSoundSettings } = useSoundSystem();

  // ---------------------------------------------------------------------------
  // AUTH STATE
  // ---------------------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return sessionStorage.getItem(SESSION_KEY);
  });
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    return (sessionStorage.getItem(SESSION_ROLE_KEY) as UserRole) || "admin";
  });

  // ---------------------------------------------------------------------------
  // GLOBAL STATE (loaded from backend, fallback to localStorage)
  // ---------------------------------------------------------------------------
  const [settings, setSettingsState] = useState<AppSettings>(() =>
    loadLS(LS_SETTINGS, DEFAULT_SETTINGS),
  );
  const [users, setUsersState] = useState<User[]>(() =>
    loadLS(LS_USERS, DEFAULT_USERS),
  );
  const [menuItems, setMenuItemsState] = useState<MenuItem[]>(() =>
    loadLS(LS_MENU, DEFAULT_MENU),
  );
  const [orders, setOrdersState] = useState<Order[]>(() =>
    loadLS(LS_ORDERS, []),
  );
  const [backendLoaded, setBackendLoaded] = useState(false);

  const [currentPage, setCurrentPage] = useState<Page>("billing");
  const [navOpen, setNavOpen] = useState(false);

  // Set document title on mount
  useEffect(() => {
    document.title = settings.websiteName;
  }, [settings.websiteName]);

  // ---------------------------------------------------------------------------
  // INITIAL LOAD FROM BACKEND
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!actor || actorFetching) return;

    const loadAll = async () => {
      try {
        const [beSettings, beUsers, beMenuItems, beOrders] = await Promise.all([
          actor.getSettings(),
          actor.getUsers(),
          actor.getMenuItems(),
          actor.getOrders(),
        ]);

        const localSettings = toLocalSettings(beSettings);
        const localUsers = beUsers.map(toLocalUser);
        const localMenu = beMenuItems.map(toLocalMenuItem);
        const localOrders = beOrders.map(toLocalOrder);

        setSettingsState(localSettings);
        saveLS(LS_SETTINGS, localSettings);

        if (localUsers.length > 0) {
          setUsersState(localUsers);
          saveLS(LS_USERS, localUsers);
        }

        setMenuItemsState(localMenu);
        saveLS(LS_MENU, localMenu);

        setOrdersState(localOrders);
        saveLS(LS_ORDERS, localOrders);

        document.title = localSettings.websiteName;
      } catch (err) {
        console.error("Backend initial load failed, using localStorage:", err);
      } finally {
        setBackendLoaded(true);
      }
    };

    loadAll();
  }, [actor, actorFetching]);

  // ---------------------------------------------------------------------------
  // POLLING: refresh every 5 seconds
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!actor) return;

    const poll = async () => {
      try {
        const [beSettings, beUsers, beMenuItems, beOrders] = await Promise.all([
          actor.getSettings(),
          actor.getUsers(),
          actor.getMenuItems(),
          actor.getOrders(),
        ]);

        const localSettings = toLocalSettings(beSettings);
        const localUsers = beUsers.map(toLocalUser);
        const localMenu = beMenuItems.map(toLocalMenuItem);
        const localOrders = beOrders.map(toLocalOrder);

        setSettingsState(localSettings);
        saveLS(LS_SETTINGS, localSettings);

        if (localUsers.length > 0) {
          setUsersState(localUsers);
          saveLS(LS_USERS, localUsers);
        }

        setMenuItemsState(localMenu);
        saveLS(LS_MENU, localMenu);

        setOrdersState(localOrders);
        saveLS(LS_ORDERS, localOrders);
      } catch {
        // Silent fail — app keeps running with local state
      }
    };

    // Poll immediately, then every second
    poll();
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [actor]);

  // ---------------------------------------------------------------------------
  // PERSIST HELPERS (write to backend + localStorage)
  // ---------------------------------------------------------------------------
  const setSettings = async (s: AppSettings) => {
    setSettingsState(s);
    saveLS(LS_SETTINGS, s);
    document.title = s.websiteName;
    if (actor) {
      try {
        await actor.setSettings(s);
      } catch {
        /* silent */
      }
    }
  };

  const setUsers = async (u: User[]) => {
    setUsersState(u);
    saveLS(LS_USERS, u);
    if (actor) {
      try {
        await actor.setUsers(
          u.map((usr) => ({ ...usr, role: usr.role as string })),
        );
      } catch {
        /* silent */
      }
    }
  };

  const setMenuItems = async (m: MenuItem[]) => {
    setMenuItemsState(m);
    saveLS(LS_MENU, m);
    if (actor) {
      try {
        await actor.setMenuItems(m);
      } catch {
        /* silent */
      }
    }
  };

  const setOrders = async (o: Order[]) => {
    setOrdersState(o);
    saveLS(LS_ORDERS, o);
    if (actor) {
      try {
        await actor.setOrders(o.map(toBackendOrder));
      } catch {
        /* silent */
      }
    }
  };

  const handleOrderComplete = async (order: Order) => {
    const updated = [order, ...orders];
    setOrdersState(updated);
    saveLS(LS_ORDERS, updated);
    if (actor) {
      try {
        await actor.addOrder(toBackendOrder(order));
      } catch {
        /* silent */
      }
    }
  };

  const handleLogout = () => {
    playSound("logout");
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    setCurrentUser(null);
    setCurrentRole("admin");
  };

  // ---------------------------------------------------------------------------
  // RENDER: LOADING (waiting for initial backend data)
  // ---------------------------------------------------------------------------
  if (!backendLoaded && actor && !actorFetching) {
    // Still loading — show spinner briefly
  }

  // ---------------------------------------------------------------------------
  // RENDER: LOGIN
  // ---------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <>
        <LoginPage
          onLogin={(username, role) => {
            setCurrentUser(username);
            setCurrentRole(role);
          }}
          settings={settings}
          playSound={playSound}
        />
        <Toaster richColors />
      </>
    );
  }

  const allowedPages = ROLE_PAGES[currentRole] || ROLE_PAGES.cashier;

  // ---------------------------------------------------------------------------
  // RENDER: APP SHELL
  // ---------------------------------------------------------------------------
  // Redirect to billing if current page not allowed for this role
  const safePage: Page = allowedPages.includes(currentPage)
    ? currentPage
    : "billing";

  const renderPage = () => {
    switch (safePage) {
      case "billing":
        return (
          <BillingPage
            menuItems={menuItems}
            settings={settings}
            onOrderComplete={handleOrderComplete}
            playSound={playSound}
          />
        );
      case "manage-menu":
        return (
          <ManageMenuPage
            menuItems={menuItems}
            setMenuItems={setMenuItems}
            playSound={playSound}
          />
        );
      case "sales-report":
        return <SalesReportPage orders={orders} setOrders={setOrders} />;
      case "customer-details":
        return <CustomerDetailsPage orders={orders} />;
      case "settings":
        return (
          <SettingsPage
            settings={settings}
            setSettings={setSettings}
            soundSettings={soundSettings}
            updateSoundSettings={updateSoundSettings}
            playSound={playSound}
          />
        );
      case "manage-users":
        return <ManageUsersPage users={users} setUsers={setUsers} />;
      case "sounds":
        return (
          <SoundsPage
            soundSettings={soundSettings}
            updateSoundSettings={updateSoundSettings}
            playSound={playSound}
          />
        );
      default:
        return null;
    }
  };

  const PAGE_TITLES: Record<Page, string> = {
    billing: "Billing",
    "manage-menu": "Manage Menu",
    "sales-report": "Sales Report",
    "customer-details": "Customer Details",
    settings: "Settings",
    "manage-users": "Manage Users",
    sounds: "Sounds",
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* TOP BAR */}
      <TopBar
        settings={settings}
        currentUser={currentUser}
        currentRole={currentRole}
        onMenuOpen={() => setNavOpen(true)}
        onLogout={handleLogout}
      />

      {/* SLIDE NAV */}
      <SlideNav
        isOpen={navOpen}
        onClose={() => setNavOpen(false)}
        currentPage={safePage}
        onNavigate={setCurrentPage}
        allowedPages={allowedPages}
      />

      {/* MAIN CONTENT */}
      <main className="flex-1 pt-14">
        {/* Page title bar */}
        <div className="bg-card border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary text-primary font-semibold"
            >
              {PAGE_TITLES[safePage]}
            </Badge>
          </div>
        </div>

        <div className="p-4 max-w-5xl mx-auto">{renderPage()}</div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border py-4 text-center text-sm text-muted-foreground">
        Powered By Medwin Techs Thanjavur
      </footer>

      <Toaster richColors />
    </div>
  );
}
