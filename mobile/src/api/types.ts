export type UserRole = 'client' | 'tenant' | 'komisiyoneri' | 'property_owner' | 'admin';

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: string;
};

export type ApiProfile = {
  bio: string;
  photo_url: string;
  language: 'en' | 'fr' | 'rw' | 'sw' | string;
};

export type ListingMedia = { type: 'photo' | 'video' | 'tour_3d' | string; url: string; sort_order?: number };

export type ApiListing = {
  id: string;
  owner: { id: string; name: string; role: UserRole | string };
  category: string;
  transaction_type: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  province: string;
  district: string;
  sector: string;
  cell?: string;
  village?: string;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  tags?: string[];
  amenities?: string[];
  media?: ListingMedia[];
  created_at: string;
  expires_at?: string;
};

export type FavoriteItem = {
  property_id: string;
  title: string;
  type: string;
  location: string;
  price: string;
  image: string;
  saved_at?: string;
};

export type ApiMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string;
  recipient_name: string;
  listing_id: string;
  body: string;
  created_at: string;
};

export type ApiNotification = { id: string; type: string; title: string; body: string; read_at?: string | null; created_at: string };

export type ApiApplication = { id: string; listing_id: string; listing_title: string; status: string; message: string; viewed_at?: string | null; created_at: string };

export type OwnerListing = ApiListing & { price?: number };

export type ListingQuery = {
  search?: string;
  province?: string;
  district?: string;
  sector?: string;
  category?: string;
  transaction_type?: string;
};
