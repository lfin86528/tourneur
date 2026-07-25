import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const pieces = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/pieces" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		image: z.string(),
		date: z.coerce.date(),
	}),
});

export const collections = { pieces };
