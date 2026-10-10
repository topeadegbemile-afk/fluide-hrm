import { z } from "zod";

const contactName = z.string().trim().max(120);
const phone = z.string().trim().max(30);
const email = z.string().trim().max(160);

export const employeePersonalInformationSchema = z.object({
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

export type EmployeePersonalInformationInput = z.infer<
  typeof employeePersonalInformationSchema
>;
