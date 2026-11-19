"use client";

import * as React from "react";
import { EMAIL_MAX_LENGTH } from "@/lib/validations/email";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubmitBulkOrderEnquiry } from "../hooks";
import {
  createBulkOrderSchema,
  type CreateBulkOrderInput,
} from "../validations/bulk-order.schema";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500 font-medium">{message}</p>;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

export function BulkOrderForm() {
  const { mutate, isPending, isSuccess, reset } = useSubmitBulkOrderEnquiry();

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateBulkOrderInput>({
    resolver: zodResolver(createBulkOrderSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: "",
      productInterest: "",
      quantity: 1,
      message: "",
    },
  });

  const onSubmit = (data: CreateBulkOrderInput) => {
    mutate(data, {
      onSuccess: () => {
        resetForm();
      },
    });
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-12">
        <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Enquiry Submitted Successfully
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Thanks for reaching out! Our team will contact you shortly with bulk
            pricing details.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => reset()}>
          Submit Another Enquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-600">*</span>
          </label>
          <input {...register("name")} className={inputClass} placeholder="Your name" />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number <span className="text-red-600">*</span>
          </label>
          <input {...register("phone")} className={inputClass} placeholder="Mobile number" />
          <FieldError message={errors.phone?.message} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address <span className="text-red-600">*</span>
        </label>
        <input
          {...register("email")}
          type="email"
          maxLength={EMAIL_MAX_LENGTH}
          className={inputClass}
          placeholder="you@example.com"
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company / Business Name
        </label>
        <input
          {...register("companyName")}
          className={inputClass}
          placeholder="Optional"
        />
        <FieldError message={errors.companyName?.message} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Interested In
          </label>
          <input
            {...register("productInterest")}
            className={inputClass}
            placeholder="e.g. Evening Gowns, Festive Kurtis, Cotton Shirts"
          />
          <FieldError message={errors.productInterest?.message} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity Required <span className="text-red-600">*</span>
          </label>
          <input
            {...register("quantity", { valueAsNumber: true })}
            type="number"
            min={1}
            className={inputClass}
            placeholder="e.g. 50"
          />
          <FieldError message={errors.quantity?.message} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Additional Requirements
        </label>
        <textarea
          {...register("message")}
          rows={4}
          className={inputClass}
          placeholder="Tell us about your requirements, delivery timeline, etc. (optional)"
        />
        <FieldError message={errors.message?.message} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Submitting..." : "Submit Bulk Order Enquiry"}
      </Button>
    </form>
  );
}
