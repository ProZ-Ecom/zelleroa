"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/Toast";
import { useBlogs, useCreateBlog, useUpdateBlog, useDeleteBlog } from "@/features/blogs/hooks";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { slugify } from "@/lib/utils";
import { createBlogSchema, type CreateBlogSchemaInput } from "@/features/blogs/validations/blog.schema";
import type { ColumnDef } from "@tanstack/react-table";
import type { BlogListItem } from "@/features/blogs/types";

const statusBadgeVariant: Record<string, "secondary" | "success" | "warning"> = {
  DRAFT: "secondary",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export default function AdminBlogsPage() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogListItem | null>(null);

  const { data, isLoading, error, refetch } = useBlogs({
    search: search || undefined,
  });

  const createMutation = useCreateBlog();
  const updateMutation = useUpdateBlog();
  const deleteMutation = useDeleteBlog();

  const blogs = data?.data ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateBlogSchemaInput>({
    resolver: zodResolver(createBlogSchema),
    defaultValues: {
      title: "",
      content: "",
      excerpt: "",
      image: "",
      status: "DRAFT",
      metaTitle: "",
      metaDescription: "",
    },
  });

  const watchTitle = watch("title");

  useEffect(() => {
    if (editingBlog) {
      reset({
        title: editingBlog.title,
        content: editingBlog.content,
        excerpt: editingBlog.excerpt ?? "",
        image: editingBlog.image ?? "",
        status: editingBlog.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        metaTitle: editingBlog.metaTitle ?? "",
        metaDescription: editingBlog.metaDescription ?? "",
      });
    } else {
      reset({ title: "", content: "", excerpt: "", image: "", status: "DRAFT", metaTitle: "", metaDescription: "" });
    }
  }, [editingBlog, reset]);

  const onSubmit = async (formData: CreateBlogSchemaInput) => {
    if (editingBlog) {
      try {
        await updateMutation.mutateAsync({ id: editingBlog.id, data: formData });
        toast.success("Blog updated", `"${formData.title}" was saved successfully.`);
        setModalOpen(false);
        setEditingBlog(null);
      } catch (err: any) {
        toast.error("Failed to update blog", err?.message || "Please try again.");
      }
    } else {
      try {
        await createMutation.mutateAsync(formData);
        toast.success("Blog created", `"${formData.title}" was created successfully.`);
        setModalOpen(false);
        reset();
      } catch (err: any) {
        toast.error("Failed to create blog", err?.message || "Please try again.");
      }
    }
  };

  const handleOpenModal = (blog?: BlogListItem) => {
    if (blog) {
      setEditingBlog(blog);
    } else {
      setEditingBlog(null);
    }
    setModalOpen(true);
  };

  const columns: ColumnDef<BlogListItem, unknown>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      ),
    },
    {
      accessorKey: "author",
      header: "Author",
      cell: ({ row }) => row.original.author?.name ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant[row.original.status] ?? "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "publishedAt",
      header: "Published Date",
      cell: ({ row }) =>
        row.original.publishedAt
          ? new Date(row.original.publishedAt).toLocaleDateString("en-IN")
          : "—",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenModal(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteId(row.original.id)}
          >
            <Trash2 className="h-4 w-4 text-error-600" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading && !data) return <AdminTableSkeleton />;
  if (error) return <ErrorState message="Failed to load blogs" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminBreadcrumb items={[{ label: "Blogs" }]} />
      <AdminPageHeader
        title="Blogs"
        description="Manage your blog posts"
        actions={
          <Button variant="gradient" onClick={() => handleOpenModal()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Blog
          </Button>
        }
      />
      <AdminContent className="flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <DataTable
            columns={columns}
            data={blogs}
            searchKey="title"
            searchPlaceholder="Search blogs..."
            pageSize={20}
            className="bg-white border border-neutral-200"
          />
        </div>
      </AdminContent>

      <FormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingBlog(null);
        }}
        title={editingBlog ? "Edit Blog" : "Add Blog"}
        description={editingBlog ? "Update blog details" : "Create a new blog post"}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setEditingBlog(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingBlog ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-error-600">*</span>
            </label>
            <input
              {...register("title")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Blog title"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input
              readOnly
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50"
              placeholder="auto-generated-from-title"
              value={slugify(watchTitle || "")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content <span className="text-error-600">*</span>
            </label>
            <textarea
              {...register("content")}
              rows={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Blog content"
            />
            {errors.content && (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.content.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
            <textarea
              {...register("excerpt")}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Short excerpt"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              {...register("image")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="https://example.com/image.png"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select
              value={watch("status")}
              onValueChange={(val) => setValue("status", val as "DRAFT" | "PUBLISHED" | "ARCHIVED", { shouldValidate: true })}
              searchable={false}
              options={[
                { value: "DRAFT", label: "Draft" },
                { value: "PUBLISHED", label: "Published" },
                { value: "ARCHIVED", label: "Archived" },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
            <input
              {...register("metaTitle")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="SEO meta title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
            <textarea
              {...register("metaDescription")}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="SEO meta description"
            />
          </div>
        </form>
      </FormModal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            try {
              await deleteMutation.mutateAsync(deleteId);
              toast.success("Blog deleted", "The blog post was removed successfully.");
              setDeleteId(null);
            } catch (err: any) {
              toast.error("Failed to delete blog", err?.message || "Please try again.");
            }
          }
        }}
        title="Delete Blog"
        description="Are you sure you want to delete this blog post? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
