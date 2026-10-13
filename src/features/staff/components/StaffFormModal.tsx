"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { emailField } from "@/lib/validations/email";
import { FormModal } from "@/components/common/FormModal";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/forms/label";
import { User, Mail, Phone, Lock, Loader2 } from "lucide-react";
import { useCreateStaff, useUpdateStaff } from "../hooks/use-staff";
import type { StaffResponse } from "../types";

const staffSchema = z.object({
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .regex(/^[a-zA-Z\s]+$/, "Name can only contain alphabetic characters and spaces")
    .max(150, "Name cannot exceed 150 characters"),
  email: emailField,
  phone: z
    .string({ message: "Phone number is required" })
    .trim()
    .min(1, "Phone number is required")
    .refine(
      (val) => {
        const digits = val.replace(/\D/g, "");
        return digits.length === 10;
      },
      {
        message: "Please enter a valid 10-digit phone number",
      }
    ),
  password: z
    .string()
    .max(100, "Password cannot exceed 100 characters")
    .optional(),
  isActive: z.boolean(),
});

type StaffFormValues = z.infer<typeof staffSchema>;

interface StaffFormModalProps {
  open: boolean;
  onClose: () => void;
  staff?: StaffResponse | null;
}

export function StaffFormModal({
  open,
  onClose,
  staff,
}: StaffFormModalProps) {
  const isEditing = Boolean(staff);

  const createMutation = useCreateStaff();
  const updateMutation = useUpdateStaff();

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (open) {
      if (staff) {
        const cleanPhone = staff.phone
          ? staff.phone.replace(/^\+91/, "").replace(/^91/, "").trim()
          : "";
        reset({
          name: staff.name || "",
          email: staff.email || "",
          phone: cleanPhone,
          password: "",
          isActive: staff.isActive ?? true,
        });
      } else {
        reset({
          name: "",
          email: "",
          phone: "",
          password: "",
          isActive: true,
        });
      }
    }
  }, [open, staff, reset]);

  const formatPhoneNumber = (val?: string | null) => {
    if (!val) return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    }
    if (trimmed.startsWith("+91")) {
      return trimmed;
    }
    return `+91${trimmed}`;
  };

  const onSubmit = async (values: StaffFormValues) => {
    // Validate password for create mode
    if (!isEditing) {
      if (!values.password || values.password.trim().length < 6) {
        setError("password", {
          type: "manual",
          message: "Password must be at least 6 characters",
        });
        return;
      }
    } else if (
      values.password &&
      values.password.trim().length > 0 &&
      values.password.trim().length < 6
    ) {
      setError("password", {
        type: "manual",
        message: "Password must be at least 6 characters",
      });
      return;
    }

    const formattedPhone = formatPhoneNumber(values.phone);

    try {
      if (isEditing && staff) {
        const updatePayload: {
          name: string;
          email: string;
          phone: string | null;
          isActive: boolean;
          password?: string;
        } = {
          name: values.name.trim(),
          email: values.email.toLowerCase().trim(),
          phone: formattedPhone,
          isActive: values.isActive,
        };

        if (values.password && values.password.trim() !== "") {
          updatePayload.password = values.password.trim();
        }

        await updateMutation.mutateAsync({
          uuid: staff.id,
          data: updatePayload,
        });
        onClose();
      } else {
        await createMutation.mutateAsync({
          name: values.name.trim(),
          email: values.email.toLowerCase().trim(),
          phone: formattedPhone,
          password: values.password!.trim(),
          isActive: values.isActive,
        });
        onClose();
      }
    } catch (err: any) {
      const responseData = err?.response?.data;
      if (responseData?.errors && Array.isArray(responseData.errors)) {
        for (const item of responseData.errors) {
          const field = item.field || item.path?.[0];
          if (field && ["name", "email", "phone", "password"].includes(field)) {
            setError(field as keyof StaffFormValues, {
              type: "server",
              message: item.message,
            });
          }
        }
      } else if (responseData?.error || err?.message) {
        const errorMsg = responseData?.error || err?.message || "";
        if (/email/i.test(errorMsg)) {
          setError("email", { type: "server", message: errorMsg });
        } else if (/phone/i.test(errorMsg)) {
          setError("phone", { type: "server", message: errorMsg });
        } else if (/name/i.test(errorMsg)) {
          setError("name", { type: "server", message: errorMsg });
        }
      }
    }
  };

  return (
    <FormModal
      open={open}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={isEditing ? "Edit Staff Member" : "Create New Staff Member"}
      description={
        isEditing
          ? "Update the details and status for this staff member."
          : "Fill in the information below to add a new staff member."
      }
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div>
          <Label htmlFor="staff-name" className="block mb-1.5 font-medium text-neutral-800">
            Full Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="staff-name"
            placeholder="e.g. Ramesh Kumar"
            leftIcon={<User className="h-4 w-4" />}
            {...register("name")}
            error={errors.name?.message}
            disabled={isSubmitting}
          />
        </div>

        {/* Email Address */}
        <div>
          <Label htmlFor="staff-email" className="block mb-1.5 font-medium text-neutral-800">
            Email Address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="staff-email"
            type="email"
            placeholder="e.g. ramesh@example.com"
            leftIcon={<Mail className="h-4 w-4" />}
            {...register("email")}
            error={errors.email?.message}
            disabled={isSubmitting}
          />
        </div>

        {/* Phone Number */}
        <div>
          <Label htmlFor="staff-phone" className="block mb-1.5 font-medium text-neutral-800">
            Phone Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="staff-phone"
            type="tel"
            placeholder="Enter 10-digit phone number"
            maxLength={10}
            leftIcon={<Phone className="h-4 w-4" />}
            inputPrefix="+91"
            {...register("phone")}
            error={errors.phone?.message}
            disabled={isSubmitting}
          />
        </div>

        {/* Password */}
        <div>
          <Label htmlFor="staff-password" className="block mb-1.5 font-medium text-neutral-800">
            {isEditing ? "New Password" : "Password"}{" "}
            {!isEditing && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="staff-password"
            type="password"
            placeholder={
              isEditing
                ? "Leave blank to keep current password"
                : "At least 6 characters"
            }
            leftIcon={<Lock className="h-4 w-4" />}
            {...register("password")}
            error={errors.password?.message}
            disabled={isSubmitting}
          />
          {isEditing && (
            <p className="mt-1 text-xs text-neutral-500">
              Only enter a new password if you want to change it.
            </p>
          )}
        </div>

        {/* Status Toggle */}
        <div className="pt-2 border-t border-neutral-100">
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <Switch
                id="staff-active-toggle"
                label="Account Status"
                description={
                  field.value
                    ? "Active — staff member can access assigned modules"
                    : "Inactive — staff member account is deactivated"
                }
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isSubmitting}
              />
            )}
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px] bg-gradient-to-b from-[var(--color-primary-400)] to-[var(--color-primary-600)] shadow-[0_6px_16px_-6px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all text-white hover:-translate-y-px hover:shadow-[0_10px_20px_-8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </div>
            ) : isEditing ? (
              "Update Staff"
            ) : (
              "Create Staff"
            )}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
