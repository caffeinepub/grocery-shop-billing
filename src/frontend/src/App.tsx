// =============================================================================
// GROCERY SHOP BILLING APPLICATION
// Complete single-page app with LocalStorage persistence
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
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import {
  BarChart2,
  Camera,
  CheckCircle,
  ChevronLeft,
  Download,
  Edit,
  LogOut,
  Menu,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
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
}

interface User {
  id: string;
  username: string;
  password: string;
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
const SESSION_KEY = "groc_session";

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
};

const DEFAULT_USERS: User[] = [
  { id: "1", username: "mrpadmin", password: "mrp1230" },
];

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
// BILL CONTENT COMPONENT (used for both preview modal and download/print)
// =============================================================================
interface BillContentProps {
  order: Order;
  settings: AppSettings;
  darkMode?: boolean;
}

function BillContent({ order, settings, darkMode = true }: BillContentProps) {
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
// LOGIN PAGE
// =============================================================================
interface LoginPageProps {
  onLogin: (username: string) => void;
  settings: AppSettings;
}

function LoginPage({ onLogin, settings }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const users = loadLS<User[]>(LS_USERS, DEFAULT_USERS);
    const user = users.find(
      (u) => u.username === username && u.password === password,
    );
    if (user) {
      sessionStorage.setItem(SESSION_KEY, username);
      onLogin(username);
    } else {
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
  onMenuOpen: () => void;
  onLogout: () => void;
}

function TopBar({ settings, currentUser, onMenuOpen, onLogout }: TopBarProps) {
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
        <span className="text-sm text-muted-foreground hidden sm:block">
          {currentUser}
        </span>
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
  | "manage-users";

interface SlideNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
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
];

const NAV_OCIDS: Record<Page, string> = {
  billing: "nav.billing.link",
  "manage-menu": "nav.menu.link",
  "sales-report": "nav.sales.link",
  "customer-details": "nav.customers.link",
  settings: "nav.settings.link",
  "manage-users": "nav.users.link",
};

function SlideNav({ isOpen, onClose, currentPage, onNavigate }: SlideNavProps) {
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
          {NAV_ITEMS.map((item) => (
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
// BARCODE SCANNER MODAL
// =============================================================================
interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  onAddToCart: (item: MenuItem) => void;
}

function BarcodeScannerModal({
  open,
  onClose,
  menuItems,
  onAddToCart,
}: BarcodeScannerModalProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("camera");
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [isFlipping, setIsFlipping] = useState(false);
  const [uploadProcessing, setUploadProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const isActiveRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopReader = useCallback(() => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {
        // ignore
      }
      readerRef.current = null;
    }
    isActiveRef.current = false;
    setIsInitializing(false);
  }, []);

  const handleBarcodeResult = useCallback(
    (code: string) => {
      const item = menuItems.find(
        (m) => m.barcodeEnabled && m.barcode === code,
      );
      if (item) {
        onAddToCart(item);
        toast.success(`Added: ${item.name}`);
        onClose();
      } else {
        toast.error(`Item not found for barcode: ${code}`);
        // Don't stop scanning — let it continue
      }
    },
    [menuItems, onAddToCart, onClose],
  );

  const startScanning = useCallback(
    async (facing: "environment" | "user") => {
      if (!videoRef.current) return;
      setCameraError(null);
      setIsInitializing(true);
      isActiveRef.current = true;

      try {
        // Create a fresh reader each time
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        // List devices using instance method
        const devices = await reader.listVideoInputDevices();
        // Pick best device based on facing mode
        let deviceId: string | null = null;
        if (devices.length > 1) {
          // Try to find the back/front camera by label
          const keyword = facing === "environment" ? "back" : "front";
          const matched = devices.find((d) =>
            d.label.toLowerCase().includes(keyword),
          );
          if (matched) {
            deviceId = matched.deviceId;
          } else {
            // Fallback: use last device for environment (usually back), first for user (front)
            deviceId =
              facing === "environment"
                ? devices[devices.length - 1].deviceId
                : devices[0].deviceId;
          }
        } else if (devices.length === 1) {
          deviceId = devices[0].deviceId;
        }
        // null = browser default (ZXing will use facingMode: environment by default)

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err) => {
            if (!isActiveRef.current) return;
            if (result) {
              handleBarcodeResult(result.getText());
            }
            if (err && !(err instanceof NotFoundException)) {
              // Only log unexpected errors
              console.debug("ZXing decode error:", err);
            }
          },
        );

        if (isActiveRef.current) {
          setIsInitializing(false);
        }
      } catch (err: unknown) {
        if (isActiveRef.current) {
          const msg =
            err instanceof Error ? err.message : "Camera access failed";
          if (
            msg.toLowerCase().includes("permission") ||
            msg.toLowerCase().includes("denied") ||
            msg.toLowerCase().includes("notallowed")
          ) {
            setCameraError(
              "Camera permission denied. Please allow camera access and try again.",
            );
          } else if (
            msg.toLowerCase().includes("notfound") ||
            msg.toLowerCase().includes("no camera")
          ) {
            setCameraError("No camera found on this device.");
          } else {
            setCameraError(`Camera error: ${msg}`);
          }
          setIsInitializing(false);
        }
      }
    },
    [handleBarcodeResult],
  );

  // Start/stop scanning when modal opens/closes or tab changes
  useEffect(() => {
    if (!open) {
      stopReader();
      setCameraError(null);
      setUploadError(null);
      setActiveTab("camera");
      return;
    }
    if (activeTab === "camera") {
      startScanning(facingMode);
    } else {
      stopReader();
    }
    return () => {
      stopReader();
    };
  }, [open, activeTab, startScanning, stopReader, facingMode]);

  const handleFlipCamera = async () => {
    if (isFlipping || isInitializing) return;
    setIsFlipping(true);
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    stopReader();
    await new Promise((r) => setTimeout(r, 300));
    await startScanning(newFacing);
    setIsFlipping(false);
  };

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

      const uploadReader = new BrowserMultiFormatReader();
      try {
        const result = await uploadReader.decodeFromImageElement(imgEl);
        handleBarcodeResult(result.getText());
      } catch {
        setUploadError("No barcode found in image. Try a clearer photo.");
      } finally {
        uploadReader.reset();
      }
    } catch {
      setUploadError("Failed to read image file.");
    } finally {
      setUploadProcessing(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-ocid="scanner.dialog"
        className="bg-card border-border max-w-sm p-0 overflow-hidden"
      >
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Camera className="w-5 h-5" />
            Barcode Scanner
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "camera" | "upload")}
          className="w-full"
        >
          <TabsList className="w-full rounded-none border-b border-border bg-secondary h-10">
            <TabsTrigger
              data-ocid="scanner.camera.tab"
              value="camera"
              className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Camera className="w-4 h-4 mr-1.5" />
              Live Camera
            </TabsTrigger>
            <TabsTrigger
              data-ocid="scanner.upload.tab"
              value="upload"
              className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Upload Image
            </TabsTrigger>
          </TabsList>

          {/* LIVE CAMERA TAB */}
          <TabsContent value="camera" className="m-0">
            <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
              {/* Video element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ display: cameraError ? "none" : "block" }}
              />

              {/* Green scanning frame overlay */}
              {!cameraError && !isInitializing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-56 h-40">
                    {/* Corner pieces */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br" />
                    {/* Scanning line animation */}
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-green-400 opacity-80 animate-[scan_2s_linear_infinite]" />
                  </div>
                </div>
              )}

              {/* Loading state */}
              {isInitializing && (
                <div
                  data-ocid="scanner.camera.loading_state"
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3"
                >
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    Starting camera…
                  </p>
                </div>
              )}

              {/* Error state */}
              {cameraError && (
                <div
                  data-ocid="scanner.camera.error_state"
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-3 px-6 text-center"
                >
                  <X className="w-10 h-10 text-destructive" />
                  <p className="text-sm text-destructive font-medium">
                    {cameraError}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border mt-1"
                    onClick={() => {
                      setCameraError(null);
                      startScanning(facingMode);
                    }}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>

            {/* Camera controls */}
            <div className="p-3 flex items-center justify-between bg-card">
              <p className="text-xs text-muted-foreground">
                Point camera at barcode
              </p>
              <Button
                data-ocid="scanner.flip_camera.button"
                variant="outline"
                size="sm"
                disabled={isFlipping || isInitializing || !!cameraError}
                onClick={handleFlipCamera}
                className="border-border text-xs gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Flip Camera
              </Button>
            </div>
          </TabsContent>

          {/* UPLOAD IMAGE TAB */}
          <TabsContent value="upload" className="m-0">
            <div className="p-4 space-y-4">
              <button
                type="button"
                data-ocid="scanner.upload.dropzone"
                className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/60 transition-colors bg-transparent"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                  <Download className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-foreground">
                    Upload barcode image
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WebP supported
                  </p>
                </div>
                <span
                  data-ocid="scanner.upload.button"
                  className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground pointer-events-none"
                >
                  Choose File
                </span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                data-ocid="scanner.file.input"
              />

              {uploadProcessing && (
                <div
                  data-ocid="scanner.upload.loading_state"
                  className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground"
                >
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Reading barcode…
                </div>
              )}

              {uploadError && (
                <div
                  data-ocid="scanner.upload.error_state"
                  className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2"
                >
                  <X className="w-4 h-4 shrink-0" />
                  {uploadError}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Close button */}
        <div className="px-4 pb-4 pt-0">
          <Button
            data-ocid="scanner.close.button"
            variant="outline"
            className="w-full border-border"
            onClick={onClose}
          >
            Close
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
  onOrderComplete: (order: Order) => void;
}

function BillingPage({
  menuItems,
  settings,
  onOrderComplete,
}: BillingPageProps) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [customerName, setCustomerName] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "qr" | "">("");
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [validationError, setValidationError] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [postPayment, setPostPayment] = useState(false);
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

  const addToCart = useCallback((item: MenuItem) => {
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
  }, []);

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

  const handlePayNow = () => {
    if (!customerName.trim()) {
      setValidationError("Customer Name is required");
      setShowValidation(true);
      return;
    }
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
      customerName: customerName.trim(),
      paymentMode: paymentMode as "cash" | "qr",
      cashAmount: paymentMode === "cash" ? cashAmount : 0,
      items: [...cart],
      discount,
      subtotal,
      total,
      timestamp: now.toISOString(),
      date: now.toISOString().split("T")[0],
    };

    onOrderComplete(order);
    saveLS(LS_ORDER_COUNTER, counter + 1);
    setCompletedOrder(order);
    setShowBillModal(true);
    setPostPayment(true);
  };

  const handleDoneOrder = () => {
    setCart([]);
    setDiscount(0);
    setCustomerName("");
    setPaymentMode("");
    setCashAmount(0);
    setCompletedOrder(null);
    setPostPayment(false);
    setShowBillModal(false);
    toast.success("Order completed! Screen reset.");
  };

  const handlePrintBill = () => {
    window.print();
  };

  const handleDownloadBill = async () => {
    const target = document.getElementById("bill-download-target");
    if (!target) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(target, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        skipFonts: true,
        style: {
          display: "block",
          position: "static",
          left: "0",
          top: "0",
        },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `bill-${completedOrder?.orderNo || "order"}.png`;
      a.click();
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
              Customer Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customer-name"
              data-ocid="billing.customer_name.input"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
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
              className="bg-green-600 hover:bg-green-700 text-white h-12 text-base font-bold"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Done & Close
            </Button>
          </div>
        </div>
      )}

      {/* BILL MODAL (dark) */}
      {completedOrder && (
        <Dialog open={showBillModal} onOpenChange={setShowBillModal}>
          <DialogContent
            data-ocid="billing.bill_modal.modal"
            className="bg-black border-gray-700 max-w-sm max-h-[90vh] overflow-y-auto p-0"
          >
            <div className="sticky top-0 bg-black border-b border-gray-700 p-4 flex items-center justify-between z-10">
              <span className="font-bold text-white">Bill Preview</span>
              <Button
                data-ocid="billing.bill_modal.close_button"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-gray-800"
                onClick={() => setShowBillModal(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-4">
              <BillContent
                order={completedOrder}
                settings={settings}
                darkMode={true}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* PRINT AREA (visually hidden, shown during print via CSS) */}
      <div
        id="bill-print-area"
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "380px",
          background: "#ffffff",
        }}
      >
        {completedOrder && (
          <BillContent
            order={completedOrder}
            settings={settings}
            darkMode={false}
          />
        )}
      </div>

      {/* DOWNLOAD TARGET (visually hidden but properly sized for html-to-image) */}
      <div
        id="bill-download-target"
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "380px",
          background: "#ffffff",
          padding: "24px",
          fontFamily: "'Courier New', Courier, monospace",
        }}
      >
        {completedOrder && (
          <BillContent
            order={completedOrder}
            settings={settings}
            darkMode={false}
          />
        )}
      </div>

      {/* BARCODE SCANNER MODAL */}
      <BarcodeScannerModal
        open={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        menuItems={menuItems}
        onAddToCart={addToCart}
      />

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
  setMenuItems: (items: MenuItem[]) => void;
}

function ManageMenuPage({ menuItems, setMenuItems }: ManageMenuPageProps) {
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

  const handleSave = () => {
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
      setMenuItems(updated);
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
      setMenuItems([...menuItems, newItem]);
      toast.success("Item added!");
    }
    setShowAddDialog(false);
  };

  const handleDelete = (id: string) => {
    setMenuItems(menuItems.filter((m) => m.id !== id));
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
              <Input
                data-ocid="menu.barcode.input"
                value={form.barcode || ""}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder="Enter barcode number"
                className="input-large bg-secondary border-border"
              />
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
                <div className="mt-2">
                  <img
                    src={form.imageBase64 || imageUrl}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
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
  setOrders: (orders: Order[]) => void;
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

  const handleClearAll = () => {
    setOrders([]);
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
// SETTINGS PAGE
// =============================================================================
interface SettingsPageProps {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
}

function SettingsPage({ settings, setSettings }: SettingsPageProps) {
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [confirmRestartOrder, setConfirmRestartOrder] = useState(false);

  const handleBillLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) =>
      setForm((prev) => ({
        ...prev,
        billLogoBase64: ev.target?.result as string,
      }));
    reader.readAsDataURL(file);
  };

  const handleWebsiteLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) =>
      setForm((prev) => ({
        ...prev,
        websiteLogoBase64: ev.target?.result as string,
      }));
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setSettings(form);
    document.title = form.websiteName;
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
            onChange={(e) => setForm({ ...form, websiteName: e.target.value })}
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
          <input
            type="file"
            accept="image/*"
            onChange={handleBillLogoUpload}
            data-ocid="settings.bill_logo.upload_button"
            className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-foreground hover:file:bg-accent cursor-pointer"
          />
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
          <input
            type="file"
            accept="image/*"
            onChange={handleWebsiteLogoUpload}
            data-ocid="settings.website_logo.upload_button"
            className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-foreground hover:file:bg-accent cursor-pointer"
          />
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
            onChange={(e) => setForm({ ...form, shopName: e.target.value })}
            className="input-large bg-secondary border-border"
          />
        </div>

        {/* 5. Contact */}
        <div>
          <Label className="text-base mb-2 block font-semibold">Contact</Label>
          <Input
            data-ocid="settings.contact.input"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            className="input-large bg-secondary border-border"
          />
        </div>

        {/* 6. Address */}
        <div>
          <Label className="text-base mb-2 block font-semibold">Address</Label>
          <Textarea
            data-ocid="settings.address.textarea"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
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
            onChange={(e) => setForm({ ...form, upiId: e.target.value })}
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
            onChange={(e) => setForm({ ...form, qrNote: e.target.value })}
            className="input-large bg-secondary border-border"
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
            onCheckedChange={(v) => setForm({ ...form, showTax: v })}
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
            onCheckedChange={(v) => setForm({ ...form, gstinEnabled: v })}
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
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
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
  setUsers: (users: User[]) => void;
}

function ManageUsersPage({ users, setUsers }: ManageUsersPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: "", password: "" });

  const openAdd = () => {
    setForm({ username: "", password: "" });
    setEditingUser(null);
    setShowDialog(true);
  };

  const openEdit = (user: User) => {
    setForm({ username: user.username, password: user.password });
    setEditingUser(user);
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!form.password.trim()) {
      toast.error("Password is required");
      return;
    }

    if (editingUser) {
      setUsers(
        users.map((u) =>
          u.id === editingUser.id
            ? { ...u, username: form.username.trim(), password: form.password }
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
      setUsers([
        ...users,
        {
          id: Date.now().toString(),
          username: form.username.trim(),
          password: form.password,
        },
      ]);
      toast.success("User added!");
    }
    setShowDialog(false);
  };

  const handleDelete = (id: string) => {
    if (users.length <= 1) {
      toast.error("Cannot delete the last user");
      setDeleteId(null);
      return;
    }
    setUsers(users.filter((u) => u.id !== id));
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
// MAIN APP
// =============================================================================
export default function App() {
  // ---------------------------------------------------------------------------
  // AUTH STATE
  // ---------------------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return sessionStorage.getItem(SESSION_KEY);
  });

  // ---------------------------------------------------------------------------
  // GLOBAL STATE (all loaded from localStorage)
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

  const [currentPage, setCurrentPage] = useState<Page>("billing");
  const [navOpen, setNavOpen] = useState(false);

  // Set document title on mount
  useEffect(() => {
    document.title = settings.websiteName;
  }, [settings.websiteName]);

  // ---------------------------------------------------------------------------
  // PERSIST HELPERS
  // ---------------------------------------------------------------------------
  const setSettings = (s: AppSettings) => {
    setSettingsState(s);
    saveLS(LS_SETTINGS, s);
    document.title = s.websiteName;
  };

  const setUsers = (u: User[]) => {
    setUsersState(u);
    saveLS(LS_USERS, u);
  };

  const setMenuItems = (m: MenuItem[]) => {
    setMenuItemsState(m);
    saveLS(LS_MENU, m);
  };

  const setOrders = (o: Order[]) => {
    setOrdersState(o);
    saveLS(LS_ORDERS, o);
  };

  const handleOrderComplete = (order: Order) => {
    const updated = [order, ...orders];
    setOrders(updated);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  };

  // ---------------------------------------------------------------------------
  // RENDER: LOGIN
  // ---------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <>
        <LoginPage onLogin={setCurrentUser} settings={settings} />
        <Toaster richColors />
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: APP SHELL
  // ---------------------------------------------------------------------------
  const renderPage = () => {
    switch (currentPage) {
      case "billing":
        return (
          <BillingPage
            menuItems={menuItems}
            settings={settings}
            onOrderComplete={handleOrderComplete}
          />
        );
      case "manage-menu":
        return (
          <ManageMenuPage menuItems={menuItems} setMenuItems={setMenuItems} />
        );
      case "sales-report":
        return <SalesReportPage orders={orders} setOrders={setOrders} />;
      case "customer-details":
        return <CustomerDetailsPage orders={orders} />;
      case "settings":
        return <SettingsPage settings={settings} setSettings={setSettings} />;
      case "manage-users":
        return <ManageUsersPage users={users} setUsers={setUsers} />;
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
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* TOP BAR */}
      <TopBar
        settings={settings}
        currentUser={currentUser}
        onMenuOpen={() => setNavOpen(true)}
        onLogout={handleLogout}
      />

      {/* SLIDE NAV */}
      <SlideNav
        isOpen={navOpen}
        onClose={() => setNavOpen(false)}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
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
              {PAGE_TITLES[currentPage]}
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
