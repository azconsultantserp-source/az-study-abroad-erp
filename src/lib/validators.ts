import { z } from "zod";
import { ConsultancyFeeStatus, Country, Degree, Role, StudentStage } from "@prisma/client";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "COUNSELOR", "STUDENT"]),
});

export const updateAdminUserSchema = z
  .object({
    id: z.string().min(1, "User ID required"),
    isActive: z.boolean().optional(),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
  })
  .refine((data) => data.isActive !== undefined || data.password !== undefined, {
    message: "Provide isActive or password",
  });

export const createStudentQuerySchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  passportNumber: z.string().optional(),
  country: z.nativeEnum(Country).optional(),
  degree: z.nativeEnum(Degree).optional(),
  program: z.string().optional(),
  intake: z.string().optional(),
  university: z.string().optional(),
  notes: z.string().optional(),
  consultancyFeeStatus: z.nativeEnum(ConsultancyFeeStatus).optional(),
  consultancyFeeNote: z.string().optional(),
});

// Admin-only: create a student portal login from an existing query/case
export const createStudentPortalSchema = z.object({
  caseId: z.string().min(1, "Student case is required"),
  name: z.string().min(2, "Name is required"),
  email: z.string().email("A valid login email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Admin-only: change the password of any counselor or student account
export const changePasswordSchema = z.object({
  userId: z.string().min(1, "User is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Self-service: a user changes their own password by proving the current one
export const changeOwnPasswordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export const updateStageRecordSchema = z.object({
  country: z.nativeEnum(Country).optional(),
  degree: z.nativeEnum(Degree).optional(),
  program: z.string().optional(),
  intake: z.string().optional(),
  university: z.string().optional(),
  notes: z.string().optional(),
  consultancyFeeStatus: z.nativeEnum(ConsultancyFeeStatus).optional(),
  consultancyFeeNote: z.string().optional(),
  // Belongs to the linked StudentCase (not the stage record); the stages PATCH
  // route persists it onto the case so it can be edited from the record page.
  passportNumber: z.string().optional(),
});

export const moveStageSchema = z.object({
  recordId: z.string(),
  note: z.string().optional(),
  direction: z.enum(["forward", "backward"]).default("forward"),
});

export const documentApprovalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().optional(),
});

export const typedDocumentUploadSchema = z.object({
  stageRecordId: z.string().min(1),
  documentType: z.string().min(1),
  requirementId: z.string().optional(),
});

export const zipDocumentsSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1, "Select at least one document").max(100),
});

export const markNotificationsSchema = z
  .object({
    ids: z.array(z.string().min(1)).max(100).optional(),
    markAllRead: z.boolean().optional(),
  })
  .refine((data) => data.markAllRead || (data.ids && data.ids.length > 0), {
    message: "Provide notification ids or markAllRead",
  });

export type CreateStudentQueryInput = z.infer<typeof createStudentQuerySchema>;
export type UpdateStageRecordInput = z.infer<typeof updateStageRecordSchema>;
