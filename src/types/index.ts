export type OrderStatus = 
  | 'pending' 
  | 'take' 
  | 'call_again' 
  | 'confirmed' 
  | 'shipped' 
  | 'returned' 
  | 'paid' 
  | 'trashed' 
  | 'cancelled';

export interface Order {
  id: string;
  product: string;
  productId: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  postalCode: string;
  birthday: string | null;
  price: number;
  status: OrderStatus;
  assignedAgent: string | null;
  assignedAgentId: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  createdAt: string;
  notes: Note[];
  statusHistory: StatusChange[];
}

export interface Note {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface StatusChange {
  from: OrderStatus;
  to: OrderStatus;
  changedBy: string;
  changedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  isActive: boolean;
  lastLogin: string;
  totalProcessed: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  photo?: string;
  isActive: boolean;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  take: 'Take',
  call_again: 'Call Again',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  returned: 'Returned',
  paid: 'Paid',
  trashed: 'Trashed',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'status-pending',
  take: 'status-take',
  call_again: 'status-call-again',
  confirmed: 'status-confirmed',
  shipped: 'status-shipped',
  returned: 'status-returned',
  paid: 'status-paid',
  trashed: 'status-trashed',
  cancelled: 'status-cancelled',
};

export const AGENT_ALLOWED_STATUSES: OrderStatus[] = ['pending', 'take', 'call_again', 'confirmed'];
export const ALL_STATUSES: OrderStatus[] = ['pending', 'take', 'call_again', 'confirmed', 'shipped', 'returned', 'paid', 'trashed', 'cancelled'];

// Prediction Lists
export type PredictionLeadStatus = 'not_contacted' | 'no_answer' | 'interested' | 'not_interested' | 'confirmed';

export const PREDICTION_LEAD_STATUSES: PredictionLeadStatus[] = ['not_contacted', 'no_answer', 'interested', 'not_interested', 'confirmed'];

export const PREDICTION_LEAD_LABELS: Record<PredictionLeadStatus, string> = {
  not_contacted: 'Not Contacted',
  no_answer: 'No Answer',
  interested: 'Interested',
  not_interested: 'Not Interested',
  confirmed: 'Confirmed',
};

export const PREDICTION_LEAD_COLORS: Record<PredictionLeadStatus, string> = {
  not_contacted: 'status-pending',
  no_answer: 'status-call-again',
  interested: 'status-take',
  not_interested: 'status-returned',
  confirmed: 'status-confirmed',
};

export interface PredictionEntry {
  id: string;
  name: string;
  telephone: string;
  address: string;
  city: string;
  product: string;
  status: PredictionLeadStatus;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  notes: string;
}

export interface PredictionList {
  id: string;
  name: string;
  uploadedAt: string;
  totalRecords: number;
  assignedCount: number;
  entries: PredictionEntry[];
}
