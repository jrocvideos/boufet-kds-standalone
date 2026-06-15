import { useState, useEffect, useRef } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import {
  CheckCircle, Clock, ChefHat, Phone, MapPin,
  DollarSign, Bell, BellOff, Wifi, WifiOff,
  Zap, Calendar, Users, RefreshCw, Package
} from 'lucide-react';
const sf = (n: any) => { const v = Number(n); return isNaN(v) ? '0.00' : v.toFixed(2); };
const API_URL = 'https://boufet-backend-production-e170.up.railway.app';

const RESTAURANT_NAMES: Record<string, string> = {
  'burger-vault': 'Burger Vault',
  'papa-johns': 'Papa Johns',
  'smoke2snack': 'Smoke2Snack',
  'blue-water-cafe': 'Blue Water Cafe',
  'sakura-sushi': 'Sakura Sushi',
  'cuba-street-food': 'Cuba Street Food',
};

const RESTAURANT_IDS: Record<string, string> = {
  'burger-vault': 'cb8b55eb-118b-4895-9277-93847a329533',
  'papa-johns': '5a3ac06e-7a5d-4e5c-ba4c-4dac89a2e79d',
  'smoke2snack': 'a93bbf8f-4895-4908-8a71-87d390989300',
  'blue-water-cafe': 'ec544790-3d6b-4fb8-97ab-bc4725271e75',
  'sakura-sushi': '8eaf9ff4-2f47-4ac5-a2b2-f76860b4f6c6',
  'cuba-street-food': 'bd67f62d-cdd9-4541-b6cd-d140be14fe1a',
};

type OrderStatus = 'incoming' | 'preparing' | 'ready' | 'driver_assigned' | 'picked_up' | 'out_for_delivery' | 'processed' | 'cancelled' | 'advanced';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  modifiers?: string[];
  special_instructions?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  subtotal?: number;
  tip: number;
  createdAt: Date;
  address: string;
  orderType: 'delivery' | 'pickup' | 'advanced';
  isExpress?: boolean;
  eventType?: string;
  guestCount?: number;
  eventDate?: Date;
  specialInstructions?: string;
}

const MOCK_ORDERS: Order[] = [
  {
    id: '1', orderNumber: 'ORD-2054', customerName: 'Alex M.', status: 'incoming',
    items: [{ id: 'i1', name: 'Double Smash Burger', quantity: 2 }, { id: 'i2', name: 'Truffle Fries', quantity: 1 }, { id: 'i3', name: 'Chocolate Shake', quantity: 2 }],
    total: 62.50, tip: 8.00, createdAt: new Date(Date.now() - 2 * 60000),
    address: '888 Cambie St, Suite 400', orderType: 'delivery', isExpress: true,
  },
  {
    id: '2', orderNumber: 'ORD-2055', customerName: 'Priya S.', status: 'incoming',
    items: [{ id: 'i4', name: 'Classic Burger', quantity: 1 }, { id: 'i5', name: 'Onion Rings', quantity: 1 }],
    total: 34.75, tip: 5.00, createdAt: new Date(Date.now() - 1 * 60000),
    address: '1028 Alberni St, Penthouse', orderType: 'delivery',
  },
  {
    id: '3', orderNumber: 'ORD-2049', customerName: 'Sarah K.', status: 'preparing',
    items: [{ id: 'i6', name: 'BBQ Bacon Burger', quantity: 2 }, { id: 'i7', name: 'Sweet Potato Fries', quantity: 2 }, { id: 'i8', name: 'Lemonade', quantity: 2 }],
    total: 78.50, tip: 10.00, createdAt: new Date(Date.now() - 8 * 60000),
    address: '555 W Hastings St, Floor 12', orderType: 'delivery',
  },
  {
    id: '4', orderNumber: 'ORD-2050', customerName: 'James L.', status: 'preparing',
    items: [{ id: 'i9', name: 'Veggie Burger', quantity: 1 }, { id: 'i10', name: 'Side Salad', quantity: 1 }],
    total: 28.65, tip: 3.00, createdAt: new Date(Date.now() - 12 * 60000),
    address: '1234 Robson St, Apt 805', orderType: 'pickup',
  },
  {
    id: '5', orderNumber: 'ORD-2051', customerName: 'Maria G.', status: 'ready',
    items: [{ id: 'i11', name: 'Double Smash Burger', quantity: 3 }, { id: 'i12', name: 'Truffle Fries', quantity: 3 }, { id: 'i13', name: 'Vanilla Shake', quantity: 2 }],
    total: 112.40, tip: 15.00, createdAt: new Date(Date.now() - 20 * 60000),
    address: '999 W Pender St, Apt 302', orderType: 'delivery',
  },
  {
    id: '6', orderNumber: 'ORD-2052', customerName: 'David W.', status: 'ready',
    items: [{ id: 'i14', name: 'Classic Burger', quantity: 2 }, { id: 'i15', name: 'Fries', quantity: 2 }],
    total: 45.20, tip: 6.00, createdAt: new Date(Date.now() - 18 * 60000),
    address: '777 Seymour St, Apt 1503', orderType: 'delivery',
  },
  {
    id: '7', orderNumber: 'ADV-1001', customerName: 'Rebecca & Tom', status: 'advanced',
    items: [{ id: 'i16', name: 'Wedding Burger Package', quantity: 80 }, { id: 'i17', name: 'Premium Sides', quantity: 80 }],
    total: 4355.06, tip: 500.00, createdAt: new Date(Date.now() - 3 * 86400000),
    address: 'Vancouver Yacht Club, 450 Stanley Park Dr', orderType: 'advanced',
    eventType: 'wedding', guestCount: 80, eventDate: new Date('2026-06-15'),
  },
];

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  incoming: { label: 'Incoming', color: '#EF4444', bg: 'border-red-500 bg-red-500/5' },
  preparing: { label: 'Preparing', color: '#F59E0B', bg: 'border-yellow-500 bg-yellow-500/5' },
  ready: { label: 'Ready', color: '#10B981', bg: 'border-emerald-500 bg-emerald-500/5' },
  picked_up: { label: 'Picked Up', color: '#3B82F6', bg: 'border-blue-500 bg-blue-500/5' },
  driver_assigned: { label: 'With Driver', color: '#6366F1', bg: 'border-indigo-500 bg-indigo-500/5' },
  out_for_delivery: { label: 'Out for Delivery', color: '#3B82F6', bg: 'border-blue-500 bg-blue-500/5' },
  processed: { label: 'Processed', color: '#3B82F6', bg: 'border-blue-500 bg-blue-500/5' },
  cancelled: { label: 'Cancelled', color: '#6B7280', bg: 'border-gray-500 bg-gray-500/5' },
  advanced: { label: 'Advanced', color: '#8B5CF6', bg: 'border-purple-500 bg-purple-500/5' },
};

const getElapsed = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
};

const KDSCard = ({ order, onAction }: { order: Order; onAction: (id: string, status: OrderStatus) => void }) => {
  const cfg = STATUS_CONFIG[order.status];
  const isIncoming = order.status === 'incoming';
  const isPreparing = order.status === 'preparing';
  const isReady = order.status === 'ready';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-2xl border-2 ${cfg.bg} ${isIncoming ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : `border-opacity-50 ${cfg.bg}`} p-4 flex flex-col gap-3 relative overflow-hidden`}
    >
      {/* Incoming pulse animation */}
      {isIncoming && (
        <div className="absolute inset-0 rounded-2xl border-2 border-red-500 animate-ping opacity-20 pointer-events-none" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-mono">{order.orderNumber}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.color + '20', color: cfg.color }}>{cfg.label}</span>
            {order.isExpress && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">⚡ EXPRESS</span>}
            {order.orderType === 'pickup' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">🏃 Pickup</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-white">${sf(order.total)}</p>

        </div>
      </div>

      {/* Customer + time */}
      <div className="flex items-center justify-between">
        <p className="font-bold text-white text-lg">{order.customerName}</p>
        <div className="flex items-center gap-1 text-gray-400 text-xs">
          <Clock className="w-3 h-3" />
          <span>{getElapsed(order.createdAt)}</span>
        </div>
      </div>

      {/* Event badge */}
      {order.eventType && (
        <div className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30">
          <p className="text-xs font-bold text-purple-400 capitalize">
            {order.eventType} • {order.guestCount} guests • {order.eventDate?.toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Items */}
      <div className="space-y-1 flex-1">
        {order.items.slice(0, 5).map(item => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{item.quantity}</span>
            <span className="text-sm text-gray-200">{item.name}</span>
          </div>
        ))}
        {order.items.length > 5 && <p className="text-xs text-gray-500 italic">+{order.items.length - 5} more items</p>}
      </div>

      {/* Special instructions */}
      {order.specialInstructions && (
        <div className="px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-xs text-yellow-400">📝 {order.specialInstructions}</p>
        </div>
      )}

      {/* Address */}
      <div className="flex items-center gap-1 text-gray-500 text-xs">
        <MapPin className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{order.address}</span>
      </div>

      {/* Action button */}
      <div>
        {isIncoming && (
          <button onClick={() => onAction(order.id, 'preparing')}
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm transition-colors">
            ✓ Accept & Start
          </button>
        )}
        {isPreparing && (
          <button onClick={() => onAction(order.id, 'ready')}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors">
            🍽️ Ready for Pickup
          </button>
        )}
        {isReady && (
          <div className="w-full py-3 rounded-xl bg-gray-700 text-center">
            <p className="text-emerald-400 font-bold text-sm">⏳ Waiting for driver...</p>
          </div>
        )}
        {order.status === 'processed' && (
          <div className="w-full py-3 rounded-xl bg-blue-500/10 text-center">
            <p className="text-blue-400 font-bold text-sm">✓ Completed</p>
          </div>
        )}
        {order.status === 'advanced' && (
          <button onClick={() => onAction(order.id, 'preparing')}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-colors">
            🎉 Start Preparing
          </button>
        )}
      </div>
    </motion.div>
  );
};

export const RestaurantKDS = () => {
  const slug = 'cuba-street-food';
  const restaurantName = RESTAURANT_NAMES[slug || ''] || slug?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Restaurant';

  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'kitchen'|'earnings'|'advanced'|'history'>('kitchen');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const socketRef = useRef<Socket | null>(null);

  // Auto-archive processed orders after 2 hours
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders(prev => prev.filter(o => {
        if (o.status !== 'processed') return true;
        const age = Date.now() - o.createdAt.getTime();
        return age < 2 * 60 * 60 * 1000;
      }));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Socket.io connection
  useEffect(() => {
    const socket = io(API_URL, { transports: ['polling', 'websocket'], reconnection: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const restaurantId = RESTAURANT_IDS[slug || ''] || slug || 'restaurant_1';
      socket.emit('join_restaurant', restaurantId);
      // Fetch existing orders on connect
      fetch(`${API_URL}/api/orders?status=incoming,preparing,ready,driver_assigned,picked_up,out_for_delivery&limit=50&restaurant_id=${restaurantId}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            const mapped = data.map((o: any) => ({
              id: o.id,
              orderNumber: `ORD-${o.id.slice(0, 6).toUpperCase()}`,
              customerName: o.customer_name || 'Customer',
              status: o.status,
              items: (o.items || []).map((i: any) => ({ id: i.id, name: i.name, quantity: i.quantity })),
              total: parseFloat(o.total) || 0,
              tip: parseFloat(o.tip) || 0,
              createdAt: new Date(o.created_at || Date.now()),
              address: o.customer_address || '',
              orderType: 'delivery' as const,
              isExpress: false,
            }));
            setOrders(mapped);
            setLastUpdate(new Date());
          }
        })
        .catch(() => {});
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('new_order', (data: any) => {
      setLastUpdate(new Date());
      fetch(`${API_URL}/api/orders/${data.order_id}`)
        .then(r => r.json())
        .then(order => {
          const newOrder: Order = {
            id: order.id,
            orderNumber: `ORD-${order.id.slice(0, 6).toUpperCase()}`,
            customerName: order.customer_name || 'Customer',
            status: 'incoming',
            items: (order.items || []).map((i: any) => ({ id: i.id, name: i.name, quantity: i.quantity })),
            total: order.total || 0,
            tip: order.tip || 0,
            createdAt: new Date(order.created_at || Date.now()),
            address: order.customer_address || '',
            orderType: 'delivery',
            isExpress: order.delivery_type === 'asap',
          };
          setOrders(prev => [newOrder, ...prev]);
          if (soundEnabled) new Audio('/sounds/bell.mp3').play().catch(() => {});
        })
        .catch(() => {});
    });

    socket.on('order_update', (data: any) => {
      if (data.order_id && data.status) {
        setOrders(prev => prev.map(o => o.id === data.order_id ? { ...o, status: data.status } : o));
        setLastUpdate(new Date());
      }
    });

    return () => { socket.disconnect(); };
  }, [slug]);

  const handleAction = (id: string, newStatus: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    fetch(`${API_URL}/api/orders/${id}/status`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-kds-secret': 'BoufetKDS2026',
      },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
    setLastUpdate(new Date());
  };

  const addTestOrder = () => {
    const names = ['Chris P.', 'Amanda L.', 'Kevin S.', 'Jessica T.', 'Ryan M.'];
    const items = [['Double Smash Burger', 'Truffle Fries'], ['Classic Burger', 'Onion Rings', 'Coke'], ['BBQ Bacon Burger', 'Sweet Potato Fries']];
    const pick = items[Math.floor(Math.random() * items.length)];
    const newOrder: Order = {
      id: Date.now().toString(),
      orderNumber: `ORD-${Math.floor(Math.random() * 9000 + 1000)}`,
      customerName: names[Math.floor(Math.random() * names.length)],
      status: 'incoming',
      items: pick.map((name, i) => ({ id: `${i}`, name, quantity: Math.ceil(Math.random() * 2) })),
      total: Math.floor(Math.random() * 60 + 20),
      tip: Math.floor(Math.random() * 12 + 3),
      createdAt: new Date(),
      address: `${Math.floor(Math.random() * 9000 + 1000)} Robson St, Vancouver`,
      orderType: Math.random() > 0.7 ? 'pickup' : 'delivery',
      isExpress: Math.random() > 0.7,
    };
    setOrders(prev => [newOrder, ...prev]);
  };

  // Column data
  const now = Date.now();
  const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000;
  const freshOrders = orders.filter(o => (now - o.createdAt.getTime()) < STALE_THRESHOLD_MS);
  const incoming = freshOrders.filter(o => o.status === 'incoming');
  const preparing = freshOrders.filter(o => o.status === 'preparing');
  const ready = freshOrders.filter(o => o.status === 'ready');
  const pickedUp = orders.filter(o => ['picked_up', 'out_for_delivery'].includes(o.status));
  const withDriver = orders.filter(o => ['driver_assigned','picked_up','out_for_delivery'].includes(o.status));
  const advanced = orders.filter(o => o.status === 'advanced');
  const processed = freshOrders.filter(o => o.status === 'processed');

  const todayRevenue = orders.filter(o => o.status !== 'cancelled').reduce((a, o) => a + o.subtotal, 0);
  const restaurantRevenue = todayRevenue;  // GROSS - what customer paid
  const completedOrders = orders.filter(o => o.status === 'processed');
  const boufetCommission = todayRevenue * 0.20;
  const restaurantEarnings = todayRevenue - boufetCommission;
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center font-bold text-lg">B</div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{restaurantName}</h1>
            <p className="text-xs text-gray-400">Kitchen Display System · boufet.com/r/{slug}/orders</p>
          </div>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center"><p className="text-xs text-gray-400">Revenue</p><p className="font-bold text-teal-400">${sf(restaurantRevenue)}</p></div>
          <div className="text-center"><p className="text-xs text-gray-400">Orders</p><p className="font-bold">{orders.filter(o => o.status !== 'cancelled').length}</p></div>
          <div className="text-center"><p className="text-xs text-gray-400">Active</p><p className="font-bold text-yellow-400">{preparing.length}</p></div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700">
            {connected ? <Wifi className="w-4 h-4 text-teal-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
            <span className={`text-xs font-medium ${connected ? 'text-teal-400' : 'text-red-400'}`}>{connected ? 'Live' : 'Demo'}</span>
          </div>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg bg-gray-800 border border-gray-700">
            {soundEnabled ? <Bell className="w-4 h-4 text-teal-400" /> : <BellOff className="w-4 h-4 text-gray-500" />}
          </button>

        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-gray-900 border-b border-gray-800 flex px-4 gap-2 py-2 flex-shrink-0">
        <button onClick={() => setActiveTab('kitchen')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab==='kitchen' ? 'bg-teal-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
          🍳 Kitchen
        </button>
        <button onClick={() => setActiveTab('advanced')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors relative ${activeTab==='advanced' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
          🎉 Advanced {advanced.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full text-xs text-white flex items-center justify-center">{advanced.length}</span>}
        </button>
        <button onClick={() => setActiveTab('earnings')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab==='earnings' ? 'bg-teal-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
          💰 Earnings
        </button>
        <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab==='history' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
          📋 History
        </button>
      </div>

      {/* 6-Column Staggered Grid */}
      {activeTab === 'kitchen' && <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-0 overflow-hidden">

        {/* COLUMN 1 — INCOMING */}
        <div className="border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="font-bold text-red-400">INCOMING</span>
              </div>
              <span className="text-2xl font-bold text-red-400">{incoming.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AnimatePresence>
              {incoming.map(order => <KDSCard key={order.id} order={order} onAction={handleAction} />)}
            </AnimatePresence>
            {incoming.length === 0 && advanced.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                <ChefHat className="w-8 h-8 mb-2" />
                <p className="text-sm">No incoming orders</p>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2 — PREPARING */}
        <div className="border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="font-bold text-yellow-400">PREPARING</span>
              </div>
              <span className="text-2xl font-bold text-yellow-400">{preparing.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AnimatePresence>
              {preparing.map(order => <KDSCard key={order.id} order={order} onAction={handleAction} />)}
            </AnimatePresence>
            {preparing.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                <Clock className="w-8 h-8 mb-2" />
                <p className="text-sm">Kitchen is clear</p>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3 — READY */}
        <div className="border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-bold text-emerald-400">READY</span>
              </div>
              <span className="text-2xl font-bold text-emerald-400">{ready.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AnimatePresence>
              {ready.map(order => <KDSCard key={order.id} order={order} onAction={handleAction} />)}
            </AnimatePresence>
            {ready.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                <CheckCircle className="w-8 h-8 mb-2" />
                <p className="text-sm">No orders ready</p>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 4 — PICKED UP */}
        <div className="border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-blue-500/10 border-b border-blue-500/20 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="font-bold text-blue-400">PICKED UP</span>
              </div>
              <span className="text-2xl font-bold text-blue-400">{pickedUp.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AnimatePresence>
              {pickedUp.map(order => <KDSCard key={order.id} order={order} onAction={handleAction} />)}
            </AnimatePresence>
            {pickedUp.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                <span className="text-3xl mb-2">📦</span>
                <p className="text-sm">No orders picked up</p>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 5 — WITH DRIVER */}
        <div className="border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-indigo-500/10 border-b border-indigo-500/20 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                <span className="font-bold text-indigo-400">WITH DRIVER</span>
              </div>
              <span className="text-2xl font-bold text-indigo-400">{withDriver.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AnimatePresence>
              {withDriver.map(order => <KDSCard key={order.id} order={order} onAction={handleAction} />)}
            </AnimatePresence>
            {withDriver.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                <span className="text-3xl mb-2">🚗</span>
                <p className="text-sm">No orders with driver</p>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 6 — PROCESSED */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-gray-500/10 border-b border-gray-500/20 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                <span className="font-bold text-gray-400">PROCESSED</span>
              </div>
              <span className="text-2xl font-bold text-gray-400">{processed.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AnimatePresence>
              {processed.slice(0, 5).map(order => <KDSCard key={order.id} order={order} onAction={handleAction} />)}
            </AnimatePresence>
            {processed.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                <span className="text-3xl mb-2">✅</span>
                <p className="text-sm">No processed orders</p>
              </div>
            )}
          </div>
        </div>
      </div>
      }

      {/* Advanced Orders Tab */}
      {activeTab === 'advanced' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {advanced.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600">
              <span className="text-4xl mb-3">🎉</span>
              <p className="text-sm">No advanced orders scheduled</p>
            </div>
          )}
          {advanced.map(order => (
            <div key={order.id} className="bg-gray-900 border-2 border-purple-500/50 rounded-2xl p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs font-mono text-gray-400">{order.orderNumber}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold capitalize">{order.eventType}</span>
                    {order.guestCount && <span className="text-xs text-gray-400">{order.guestCount} guests</span>}
                    {order.eventDate && <span className="text-xs text-gray-400">📅 {new Date(order.eventDate).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-400">${sf(order.subtotal)}</p>
                  <p className="text-xs text-yellow-400">${sf(order.tip)} tip</p>
                </div>
              </div>
              <p className="font-bold text-lg mb-2">{order.customerName}</p>
              <div className="space-y-1 mb-3">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-800 text-white text-xs font-bold flex items-center justify-center">{item.quantity}</span>
                    <span className="text-sm text-gray-200">{item.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-3">📍 {order.address}</p>
              <button onClick={() => handleAction(order.id, 'preparing')}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors">
                🎉 Start Preparing Event Order
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Earnings Tab */}
      {activeTab === 'earnings' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Today Revenue', value: `$${sf(todayRevenue)}`, color: 'text-teal-400' },
              { label: 'Your Earnings (80%)', value: `$${sf(restaurantEarnings)}`, color: 'text-emerald-400' },
              { label: 'Boufet Fee (20%)', value: `$${sf(boufetCommission)}`, color: 'text-gray-400' },
              { label: 'Orders Completed', value: `${completedOrders.length}`, color: 'text-blue-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs text-gray-400 mb-2">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="font-bold mb-4 text-gray-200">Completed Orders Today</h3>
            <div className="space-y-2">
              {completedOrders.length === 0 && <p className="text-gray-500 text-sm">No completed orders yet</p>}
              {completedOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">{o.orderNumber}</p>
                    <p className="text-xs text-gray-400">{o.customerName} · {o.items.length} items</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-teal-400">${sf(o.subtotal)}</p>
                    <p className="text-xs text-gray-500">${sf((o.subtotal * 0.80))} yours</p>
                  </div>
                </div>
              ))}
            </div>
            {completedOrders.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between font-bold">
                <span>Total Your Earnings</span>
                <span className="text-emerald-400">${sf(restaurantEarnings)}</span>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-teal-900/40 to-gray-900 border border-teal-800/40 rounded-2xl p-5">
            <p className="text-xs text-gray-400 mb-1">vs DoorDash (30% fee)</p>
            <p className="text-sm text-gray-300">With DoorDash you would keep <span className="text-red-400 font-bold">${sf((todayRevenue * 0.70))}</span></p>
            <p className="text-sm text-gray-300 mt-1">With Boufet you keep <span className="text-teal-400 font-bold">${sf(restaurantEarnings)}</span></p>
            <p className="text-teal-400 font-bold mt-2">You saved ${sf((todayRevenue * 0.10))} today by using Boufet 🎉</p>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <h2 className="text-lg font-bold text-gray-200 mb-4">Order History</h2>
          {orders.filter(o => ['processed','delivered','cancelled'].includes(o.status)).length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600">
              <span className="text-4xl mb-3">📋</span>
              <p className="text-sm">No completed orders yet</p>
            </div>
          )}
          {orders.filter(o => ['processed','delivered','cancelled'].includes(o.status)).map(order => (
            <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-xs text-gray-400">{order.orderNumber}</p>
                <p className="font-bold text-white">{order.customerName}</p>
                <p className="text-xs text-gray-400">{order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</p>
                <p className="text-xs text-gray-500 mt-1">{order.createdAt.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-teal-400">${sf(order.subtotal * 0.80)}</p>
                <p className="text-xs text-gray-500">of ${sf(order.subtotal)} order</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer status bar */}
      <div className="bg-gray-900 border-t border-gray-800 px-6 py-2 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
        <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        <span className="text-gray-600">boufet.com/r/{slug}/orders · Kitchen Display System</span>
        <span>{new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
      </div>
    </div>
  );
};
