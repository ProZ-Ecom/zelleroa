import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { companyRepository } from "../repositories/company.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import { uploadService } from "@/features/uploads/services/upload.service";
import type { CompanyResponse, UpdateCompanyInput, SocialLinks } from "../types";

export const SOCIAL_LINKS_KEY = "social_links";

export const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  facebook: "https://facebook.com",
  instagram: "https://instagram.com",
  youtube: "https://youtube.com",
  whatsapp: null,
  twitter: null,
};

async function getStoredSocialLinks(): Promise<SocialLinks> {
  try {
    const row = await db.settings.findUnique({
      where: { key_name: SOCIAL_LINKS_KEY },
    });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return {
        facebook: typeof parsed.facebook === "string" ? parsed.facebook : null,
        instagram: typeof parsed.instagram === "string" ? parsed.instagram : null,
        youtube: typeof parsed.youtube === "string" ? parsed.youtube : null,
        whatsapp: typeof parsed.whatsapp === "string" ? parsed.whatsapp : null,
        twitter: typeof parsed.twitter === "string" ? parsed.twitter : null,
      };
    }
  } catch (err) {
    console.error("Error reading social_links from settings:", err);
  }
  return DEFAULT_SOCIAL_LINKS;
}

async function saveSocialLinks(links: SocialLinks, adminId?: bigint | null) {
  const value = JSON.stringify(links);
  await db.settings.upsert({
    where: { key_name: SOCIAL_LINKS_KEY },
    create: {
      key_name: SOCIAL_LINKS_KEY,
      value,
      type: "json",
      created_by: adminId ?? null,
      updated_by: adminId ?? null,
    },
    update: {
      value,
      type: "json",
      updated_by: adminId ?? null,
      updated_at: new Date(),
    },
  });
}

function formatCompanyResponse(c: any, socialLinks?: SocialLinks | null): CompanyResponse {
  return {
    id: c.uuid,
    companyName: c.companyName,
    logo: c.logo ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    address: c.address ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    country: c.country ?? "India",
    pincode: c.pincode ?? null,
    gstNumber: c.gstNumber ?? null,
    panNumber: c.panNumber ?? null,
    website: c.website ?? null,
    isActive: Boolean(c.isActive),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    createdBy: c.users_companies_created_byTousers?.uuid || null,
    updatedBy: c.users_companies_updated_byTousers?.uuid || null,
    socialLinks: socialLinks ?? DEFAULT_SOCIAL_LINKS,
  };
}

export const companyService = {
  async getCompany(): Promise<CompanyResponse> {
    const [company, socialLinks] = await Promise.all([
      companyRepository.getCompany(),
      getStoredSocialLinks(),
    ]);
    if (!company) {
      throw ApiError.notFound("Company settings not found");
    }
    return formatCompanyResponse(company, socialLinks);
  },

  async updateCompany(
    data: UpdateCompanyInput,
    adminEmail?: string | null
  ): Promise<CompanyResponse> {
    let adminId: bigint | null = null;
    if (adminEmail) {
      const admin = await userRepository.findByEmail(adminEmail);
      if (admin && admin.internalId) adminId = BigInt(admin.internalId);
    }

    if (data.socialLinks !== undefined && data.socialLinks !== null) {
      await saveSocialLinks(data.socialLinks, adminId);
    }

    const { socialLinks: _sl, ...companyData } = data;

    const existing = await companyRepository.getCompany();

    let result;
    if (existing) {
      result = await companyRepository.updateCompany(existing.id, companyData, adminId);
    } else {
      result = await companyRepository.createCompany(companyData, adminId);
    }

    const latestSocialLinks = await getStoredSocialLinks();
    return formatCompanyResponse(result, latestSocialLinks);
  },

  async uploadLogo(
    formData: FormData,
    adminEmail?: string | null
  ): Promise<{ logo: string; company: CompanyResponse }> {
    // Force folder to "company"
    formData.set("folder", "company");

    const uploadResult = await uploadService.handleSingleFileUpload(formData);
    const newLogoPath = uploadResult.path;

    let adminId: bigint | null = null;
    if (adminEmail) {
      const admin = await userRepository.findByEmail(adminEmail);
      if (admin && admin.internalId) adminId = BigInt(admin.internalId);
    }

    const existing = await companyRepository.getCompany();

    let updatedCompany;
    if (existing) {
      // Clean up previous logo if it existed
      if (existing.logo && existing.logo !== newLogoPath) {
        await uploadService.deleteUploadedFile(existing.logo, "company");
      }
      updatedCompany = await companyRepository.updateCompanyLogo(
        existing.id,
        newLogoPath,
        adminId
      );
    } else {
      updatedCompany = await companyRepository.createCompany(
        {
          companyName: "Zellora",
          logo: newLogoPath,
        },
        adminId
      );
    }

    const socialLinks = await getStoredSocialLinks();
    return {
      logo: newLogoPath,
      company: formatCompanyResponse(updatedCompany, socialLinks),
    };
  },
};
