export interface SocialLinks {
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  whatsapp?: string | null;
  twitter?: string | null;
}

export interface CompanyResponse {
  id: string; // Public UUID
  companyName: string;
  logo: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  website: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  socialLinks?: SocialLinks | null;
}

export interface UpdateCompanyInput {
  companyName?: string;
  logo?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  website?: string | null;
  isActive?: boolean;
  socialLinks?: SocialLinks | null;
}
