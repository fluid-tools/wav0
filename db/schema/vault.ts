import { z } from "zod";
import {
	FOLDER_NAME_MAX_LENGTH,
	NAME_MIN_LENGTH,
	PROJECT_NAME_MAX_LENGTH,
} from "@/lib/constants";

// Common validation schemas
const folderNameSchema = z
	.string()
	.min(NAME_MIN_LENGTH, "Name is required")
	.max(
		FOLDER_NAME_MAX_LENGTH,
		`Name is too long (max ${FOLDER_NAME_MAX_LENGTH} characters)`,
	)
	.trim();

const projectNameSchema = z
	.string()
	.min(NAME_MIN_LENGTH, "Name is required")
	.max(
		PROJECT_NAME_MAX_LENGTH,
		`Name is too long (max ${PROJECT_NAME_MAX_LENGTH} characters)`,
	)
	.trim();

const optionalIdSchema = z.string().nullable().optional();

// Folder operation schemas
export const createFolderSchema = z.object({
	name: folderNameSchema,
	parentFolderId: optionalIdSchema,
});

export const deleteFolderSchema = z.object({
	folderId: z.string().min(1, "Folder ID is required"),
});

export const renameFolderSchema = z.object({
	folderId: z.string().min(1, "Folder ID is required"),
	name: folderNameSchema,
});

export const moveFolderSchema = z.object({
	folderId: z.string().min(1, "Folder ID is required"),
	parentFolderId: optionalIdSchema,
	sourceParentFolderId: optionalIdSchema,
});

// Project operation schemas
export const createProjectSchema = z.object({
	name: projectNameSchema,
	folderId: optionalIdSchema,
});

export const deleteProjectSchema = z.object({
	projectId: z.string().min(1, "Project ID is required"),
	folderId: optionalIdSchema,
});

export const renameProjectSchema = z.object({
	projectId: z.string().min(1, "Project ID is required"),
	name: projectNameSchema,
	folderId: optionalIdSchema,
});

export const moveProjectSchema = z.object({
	projectId: z.string().min(1, "Project ID is required"),
	folderId: optionalIdSchema,
	sourceFolderId: optionalIdSchema,
});

export const combineProjectsSchema = z
	.object({
		sourceProjectId: z.string().min(1, "Source project ID is required"),
		targetProjectId: z.string().min(1, "Target project ID is required"),
		parentFolderId: optionalIdSchema,
	})
	.refine((data) => data.sourceProjectId !== data.targetProjectId, {
		message: "Cannot combine a project with itself",
		path: ["targetProjectId"],
	});

// Export common schemas for reuse
export { folderNameSchema, projectNameSchema, optionalIdSchema };
