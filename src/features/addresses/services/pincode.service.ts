/**
 * Indian Postal PIN Code Lookup Service
 * Fetches district, state, and post offices from the public India Post directory.
 */

export interface PostOfficeOption {
  name: string;
  branchType?: string;
  deliveryStatus?: string;
  district: string;
  state: string;
  pincode: string;
}

export interface PincodeLookupResponse {
  success: boolean;
  city: string;
  state: string;
  district: string;
  postOffices: PostOfficeOption[];
  error?: string;
}

const pincodeCache = new Map<string, PincodeLookupResponse>();

export async function lookupPincode(pincode: string): Promise<PincodeLookupResponse> {
  const cleanPin = pincode.replace(/\D/g, "").trim();

  if (cleanPin.length !== 6) {
    return {
      success: false,
      city: "",
      state: "",
      district: "",
      postOffices: [],
      error: "PIN code must be exactly 6 digits",
    };
  }

  if (pincodeCache.has(cleanPin)) {
    return pincodeCache.get(cleanPin)!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch postal details (${response.status})`);
    }

    const data = await response.json();

    if (Array.isArray(data) && data[0]?.Status === "Success" && Array.isArray(data[0]?.PostOffice) && data[0].PostOffice.length > 0) {
      const postOfficesList: PostOfficeOption[] = data[0].PostOffice.map((po: any) => ({
        name: po.Name || "",
        branchType: po.BranchType || "",
        deliveryStatus: po.DeliveryStatus || "",
        district: po.District || "",
        state: po.State || "",
        pincode: po.Pincode || cleanPin,
      }));

      // Best candidate for City: District or Block
      const primaryDistrict = postOfficesList[0].district || "";
      const primaryState = postOfficesList[0].state || "";

      const result: PincodeLookupResponse = {
        success: true,
        city: primaryDistrict,
        state: primaryState,
        district: primaryDistrict,
        postOffices: postOfficesList,
      };

      pincodeCache.set(cleanPin, result);
      return result;
    } else {
      const errorMsg = (Array.isArray(data) && data[0]?.Message) || "Invalid PIN code or no post office found";
      const failedResult: PincodeLookupResponse = {
        success: false,
        city: "",
        state: "",
        district: "",
        postOffices: [],
        error: errorMsg,
      };
      return failedResult;
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error && err.name === "AbortError"
      ? "PIN code lookup timed out"
      : "Unable to connect to Postal PIN code directory";

    return {
      success: false,
      city: "",
      state: "",
      district: "",
      postOffices: [],
      error: errorMsg,
    };
  }
}
