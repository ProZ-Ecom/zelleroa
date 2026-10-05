"use client";

import { useState, useCallback, useRef } from "react";
import { lookupPincode, type PincodeLookupResponse, type PostOfficeOption } from "../services/pincode.service";

export interface PostOfficeDropdownOption {
  value: string;
  label: string;
  description?: string;
}

export function usePincodeLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [postOffices, setPostOffices] = useState<PostOfficeDropdownOption[]>([]);
  const [rawPostOffices, setRawPostOffices] = useState<PostOfficeOption[]>([]);
  const [selectedPostOffice, setSelectedPostOffice] = useState<string>("");
  const activeLookupRef = useRef<string>("");

  const resetLookup = useCallback(() => {
    setIsLoading(false);
    setLookupError(null);
    setPostOffices([]);
    setRawPostOffices([]);
    setSelectedPostOffice("");
    activeLookupRef.current = "";
  }, []);

  const triggerLookup = useCallback(
    async (
      pincode: string,
      callbacks?: {
        onSuccess?: (data: { city: string; state: string; postOffices: PostOfficeOption[] }) => void;
        onClear?: () => void;
      }
    ): Promise<PincodeLookupResponse | null> => {
      const cleanPin = pincode.replace(/\D/g, "").trim();

      // If pincode is not 6 digits, immediately clear city, state, and post offices
      if (cleanPin.length !== 6) {
        resetLookup();
        callbacks?.onClear?.();
        return null;
      }

      activeLookupRef.current = cleanPin;
      setIsLoading(true);
      setLookupError(null);

      const result = await lookupPincode(cleanPin);

      // Guard against race conditions if user changed input while fetching
      if (activeLookupRef.current !== cleanPin) {
        return null;
      }

      setIsLoading(false);

      if (result.success) {
        setLookupError(null);
        setRawPostOffices(result.postOffices);

        const options: PostOfficeDropdownOption[] = result.postOffices.map((po) => ({
          value: po.name,
          label: po.name,
          description: po.branchType
            ? `${po.branchType}${po.deliveryStatus ? ` • ${po.deliveryStatus}` : ""}`
            : undefined,
        }));

        setPostOffices(options);

        if (options.length > 0) {
          setSelectedPostOffice(options[0].value);
        }

        callbacks?.onSuccess?.({
          city: result.city,
          state: result.state,
          postOffices: result.postOffices,
        });

        return result;
      } else {
        setLookupError(result.error || "Invalid PIN code");
        setPostOffices([]);
        setRawPostOffices([]);
        setSelectedPostOffice("");
        callbacks?.onClear?.();
        return result;
      }
    },
    [resetLookup]
  );

  return {
    isLoading,
    lookupError,
    postOffices,
    rawPostOffices,
    selectedPostOffice,
    setSelectedPostOffice,
    triggerLookup,
    resetLookup,
  };
}
