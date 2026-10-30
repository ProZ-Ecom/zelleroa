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
  const [district, setDistrict] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [cities, setCities] = useState<string[]>([]);
  const [selectedPostOffice, setSelectedPostOffice] = useState<string>("");
  const activeLookupRef = useRef<string>("");

  const resetLookup = useCallback(() => {
    setIsLoading(false);
    setLookupError(null);
    setPostOffices([]);
    setRawPostOffices([]);
    setSelectedPostOffice("");
    setDistrict("");
    setState("");
    setCountry("");
    setCities([]);
    activeLookupRef.current = "";
  }, []);

  const triggerLookup = useCallback(
    async (
      pincode: string,
      callbacks?: {
        onSuccess?: (data: {
          city: string;
          state: string;
          district: string;
          country: string;
          cities: string[];
          postOffices: PostOfficeOption[];
        }) => void;
        onClear?: () => void;
      }
    ): Promise<PincodeLookupResponse | null> => {
      const cleanPin = pincode.replace(/\D/g, "").trim().slice(0, 6);

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
        setDistrict(result.district);
        setState(result.state);
        setCountry(result.country);
        setCities(result.cities);

        const options: PostOfficeDropdownOption[] = result.postOffices.map((po) => ({
          value: po.name,
          label: po.name,
          description: po.branchType || undefined,
        }));

        setPostOffices(options);

        if (options.length > 0) {
          setSelectedPostOffice(options[0].value);
        }

        callbacks?.onSuccess?.({
          city: result.city,
          state: result.state,
          district: result.district,
          country: result.country,
          cities: result.cities,
          postOffices: result.postOffices,
        });

        return result;
      } else {
        setLookupError(result.error || "Invalid PIN code");
        setPostOffices([]);
        setRawPostOffices([]);
        setSelectedPostOffice("");
        setDistrict("");
        setState("");
        setCountry("");
        setCities([]);
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
    district,
    state,
    country,
    cities,
    setSelectedPostOffice,
    triggerLookup,
    resetLookup,
  };
}
