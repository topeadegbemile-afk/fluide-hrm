import { z } from "zod";

const contactName = z.string().trim().max(120);
const phone = z.string().trim().max(30);
const email = z.string().trim().max(160);

export const employeePersonalInformationSchema = z.object({
  taxId: z.string().trim().max(80),
  personalEmail: z.string().trim().max(160).email().or(z.literal("")),
  bankName: z.string().trim().max(120),
  accountName: z.string().trim().max(160),
  accountNumber: z.string().trim().max(80),
  pensionProvider: z.string().trim().max(160),
  pensionNumber: z.string().trim().max(80),
  nhfNumber: z.string().trim().max(80),
  spouse: z.object({
    fullName: contactName,
    phone,
    email,
    occupation: z.string().trim().max(120),
  }),
  beneficiaries: z.array(z.object({
    fullName: contactName,
    relationship: z.string().trim().max(80),
    phone,
    allocation: z.string().trim().max(20),
  })).max(20),
  dependants: z.array(z.object({
    fullName: contactName,
    relationship: z.string().trim().max(80),
    dateOfBirth: z.string().trim().max(30),
  })).max(30),
  interests: z.array(z.string().trim().min(1).max(120)).max(30),
  qualifications: z.array(z.object({
    qualification: z.string().trim().max(160),
    institution: z.string().trim().max(160),
    fieldOfStudy: z.string().trim().max(120),
    yearCompleted: z.string().trim().max(10),
  })).max(30),
  guarantors: z.array(z.object({
    fullName: contactName,
    relationship: z.string().trim().max(80),
    phone,
    email,
    address: z.string().trim().max(500),
  })).max(10),
});

export const employeePersonalInformationAdminEditSchema = z.object({
  taxId: z.string().trim().max(80),
  personalEmail: z.string().trim().max(160).email().or(z.literal("")),
  bankName: z.string().trim().max(120),
  accountName: z.string().trim().max(160),
  accountNumber: z.string().trim().max(80),
});

export const employeePersonalInformationReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().trim().max(1000).optional(),
}).refine((value) => value.status !== "REJECTED" || Boolean(value.comment?.trim()), {
  message: "A comment is required when returning information for updates.",
  path: ["comment"],
});

export type EmployeePersonalInformationAdminEditInput = z.infer<typeof employeePersonalInformationAdminEditSchema>;

export type EmployeePersonalInformationInput = z.infer<
  typeof employeePersonalInformationSchema
>;
