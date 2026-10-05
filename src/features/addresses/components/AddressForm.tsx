"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import {
  createAddressSchema,
  type CreateAddressSchemaInput,
} from "../validations/address.schema";
import type { AddressItem } from "../types";
import { usePincodeLookup } from "../hooks/use-pincode-lookup";
import { Select } from "@/components/ui/select";


interface AddressFormProps {
  defaultValues?: AddressItem | null;
  isSubmitting?: boolean;
  onSubmit: (data: CreateAddressSchemaInput) => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500 font-medium animate-in fade-in duration-150">{message}</p>;
}

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none transition-colors";

export function AddressForm({
  defaultValues,
  isSubmitting = false,
  onSubmit,
}: AddressFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<CreateAddressSchemaInput>({
    resolver: zodResolver(createAddressSchema),
    defaultValues: {
      firstName: defaultValues?.firstName ?? "",
      lastName: defaultValues?.lastName ?? "",
      phone: defaultValues?.phone ?? "",
      addressLine1: defaultValues?.addressLine1 ?? "",
      addressLine2: defaultValues?.addressLine2 ?? "",
      city: defaultValues?.city ?? "",
      state: defaultValues?.state ?? "",
      postalCode: defaultValues?.postalCode ?? "",
      country: defaultValues?.country ?? "India",
      isDefault: defaultValues?.isDefault ?? false,
    },
  });

  const {
    isLoading: isPincodeLoading,
    lookupError: pincodeLookupError,
    postOffices,
    selectedPostOffice,
    setSelectedPostOffice,
    triggerLookup: triggerPincodeLookup,
    resetLookup: resetPincodeLookup,
  } = usePincodeLookup();

  const currentPostalCode = watch("postalCode");

  React.useEffect(() => {
    if (defaultValues?.postalCode && defaultValues.postalCode.length === 6) {
      triggerPincodeLookup(defaultValues.postalCode);
    }
  }, [defaultValues?.postalCode, triggerPincodeLookup]);

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanPin = e.target.value.replace(/\D/g, "").slice(0, 6);
    setValue("postalCode", cleanPin, { shouldValidate: true });

    if (cleanPin.length !== 6) {
      setValue("city", "");
      setValue("state", "");
      resetPincodeLookup();
    } else {
      triggerPincodeLookup(cleanPin, {
        onSuccess: ({ city, state }) => {
          setValue("city", city, { shouldValidate: true });
          setValue("state", state, { shouldValidate: true });
          clearErrors(["city", "state", "postalCode"]);
        },
        onClear: () => {
          setValue("city", "");
          setValue("state", "");
        },
      });
    }
  };

  return (
    <form id="address-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name <span className="text-error-600 font-bold">*</span>
          </label>
          <input
            {...register("firstName")}
            className={cn(
              inputClass,
              errors.firstName
                ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                : "border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/30"
            )}
            placeholder="First name"
          />
          <FieldError message={errors.firstName?.message} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <input
            {...register("lastName")}
            className={cn(
              inputClass,
              errors.lastName
                ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                : "border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/30"
            )}
            placeholder="Last name"
          />
          <FieldError message={errors.lastName?.message} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mobile <span className="text-error-600 font-bold">*</span>
        </label>
        <input
          {...register("phone")}
          className={cn(
            inputClass,
            errors.phone
              ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
              : "border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/30"
          )}
          placeholder="Mobile number"
        />
        <FieldError message={errors.phone?.message} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address Line 1 <span className="text-error-600 font-bold">*</span>
        </label>
        <input
          {...register("addressLine1")}
          className={cn(
            inputClass,
            errors.addressLine1
              ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
              : "border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/30"
          )}
          placeholder="House no, street, area"
        />
        <FieldError message={errors.addressLine1?.message} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address Line 2
        </label>
        <input
          {...register("addressLine2")}
          className={cn(
            inputClass,
            errors.addressLine2
              ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
              : "border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/30"
          )}
          placeholder="Apartment, landmark (optional)"
        />
        <FieldError message={errors.addressLine2?.message} />
      </div>

      {/* PIN Code with lookup */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
          <span>
            Pincode <span className="text-error-600 font-bold">*</span>
          </span>
          {isPincodeLoading && (
            <span className="text-xs text-primary font-medium">Checking postal directory...</span>
          )}
        </label>
        <div className="relative">
          <input
            type="text"
            maxLength={6}
            value={currentPostalCode || ""}
            onChange={handlePincodeChange}
            className={cn(
              inputClass,
              errors.postalCode || pincodeLookupError
                ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                : "border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/30"
            )}
            placeholder="6-digit Pincode"
          />
        </div>
        <FieldError message={errors.postalCode?.message || pincodeLookupError || undefined} />
      </div>

      {/* Post Office Dropdown (Admin Select Component) */}
      {postOffices.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Post Office / Locality ({postOffices.length} found)
          </label>
          <Select
            options={postOffices.map((po) => ({
              value: po.value,
              label: `${po.label}${po.description ? ` (${po.description})` : ""}`,
            }))}
            value={selectedPostOffice}
            onValueChange={(val) => {
              setSelectedPostOffice(val);
              if (!watch("addressLine2")) {
                setValue("addressLine2", val);
              }
            }}
            placeholder="-- Choose your nearest Post Office / Area --"
          />
        </div>
      )}

      {/* City & State (Auto-filled, ReadOnly, Normal background color) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
            <span>
              City / District <span className="text-error-600 font-bold">*</span>
            </span>
            <span className="text-xs text-gray-400 font-normal">Auto-filled</span>
          </label>

          <input
            {...register("city")}
            readOnly
            tabIndex={-1}
            className={cn(
              inputClass,
              "bg-white text-gray-900 cursor-default select-none shadow-none",
              errors.city
                ? "border-red-500 bg-red-50/20"
                : "border-gray-300"
            )}
            placeholder={isPincodeLoading ? "Fetching city..." : "Auto-filled from Pincode"}
          />
          <FieldError message={errors.city?.message} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
            <span>
              State <span className="text-error-600 font-bold">*</span>
            </span>
            <span className="text-xs text-gray-400 font-normal">Auto-filled</span>
          </label>
          <input
            {...register("state")}
            readOnly
            tabIndex={-1}
            className={cn(
              inputClass,
              "bg-white text-gray-900 cursor-default select-none shadow-none",
              errors.state
                ? "border-red-500 bg-red-50/20"
                : "border-gray-300"
            )}
            placeholder={isPincodeLoading ? "Fetching state..." : "Auto-filled from Pincode"}
          />
          <FieldError message={errors.state?.message} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Country
        </label>
        <input
          {...register("country")}
          className={cn(
            inputClass,
            errors.country
              ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
              : "border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/30"
          )}
          placeholder="Country"
        />
        <FieldError message={errors.country?.message} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          {...register("isDefault")}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">
          Set as default address
        </label>
      </div>

      {isSubmitting && (
        <p className="text-sm text-muted-foreground">Saving address...</p>
      )}
    </form>
  );
}
